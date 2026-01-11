#!/bin/bash
# EC2 User Data Script for SoulWallet Application Servers
# This script runs on first boot of new EC2 instances

set -euo pipefail

# Configuration from Terraform
ENVIRONMENT="${environment}"
AWS_REGION="${region}"
DB_SECRET_ID="${db_secret_id}"
DB_HOST="${db_host}"
REDIS_URL="${redis_url}"
ECR_REGISTRY="${ecr_registry}"
IMAGE_TAG="${image_tag}"

# Log output
exec > >(tee /var/log/user-data.log) 2>&1
echo "Starting SoulWallet application server setup..."

# Error handler - abort on failure
trap 'echo "ERROR: User data script failed at line $LINENO"; exit 1' ERR

# Install dependencies
dnf update -y
dnf install -y docker nodejs npm git jq aws-cli

# Start Docker
systemctl enable docker
systemctl start docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create app user
useradd -m -s /bin/bash soulwallet || true
usermod -aG docker soulwallet

# Fetch secrets from Secrets Manager
echo "Fetching database credentials from Secrets Manager..."
DB_CREDS=$(aws secretsmanager get-secret-value --secret-id "$DB_SECRET_ID" --region "$AWS_REGION" --query SecretString --output text)
DB_USERNAME=$(echo "$DB_CREDS" | jq -r '.username')
DB_PASSWORD=$(echo "$DB_CREDS" | jq -r '.password')

if [[ -z "$DB_USERNAME" || "$DB_USERNAME" == "null" ]]; then
  echo "ERROR: Failed to retrieve database credentials"
  exit 1
fi

# Create application directory
mkdir -p /opt/soulwallet
cd /opt/soulwallet

# Authenticate to ECR and pull the application image
echo "Authenticating to ECR and pulling application image..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"

docker pull "$ECR_REGISTRY/soulwallet-backend:$IMAGE_TAG"

if [[ $? -ne 0 ]]; then
  echo "ERROR: Failed to pull Docker image"
  exit 1
fi

echo "Docker image pulled successfully"

# Create environment file with Terraform-provided values
cat > /opt/soulwallet/.env <<EOF
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://$DB_USERNAME:$DB_PASSWORD@$DB_HOST/soulwallet
REDIS_URL=$REDIS_URL
VAULT_ADDR=${vault_addr}
VAULT_ROLE_ID=${vault_role_id}
UNLEASH_API_URL=${unleash_api_url}
FEATURE_FLAG_PROVIDER=unleash
EOF

# Create minimal docker-compose file for single container
cat > /opt/soulwallet/docker-compose.yml <<EOF
version: '3.8'
services:
  backend:
    image: $ECR_REGISTRY/soulwallet-backend:$IMAGE_TAG
    restart: always
    env_file:
      - .env
    ports:
      - '3001:3001'
    logging:
      driver: json-file
      options:
        max-size: 50m
        max-file: 5
    healthcheck:
      test: ['CMD', 'wget', '--spider', '-q', 'http://localhost:3001/health']
      interval: 30s
      timeout: 10s
      retries: 3
EOF

# Set permissions
chown -R soulwallet:soulwallet /opt/soulwallet
chmod 600 /opt/soulwallet/.env

# Create systemd service
cat > /etc/systemd/system/soulwallet.service <<EOF
[Unit]
Description=SoulWallet API Service
After=docker.service
Requires=docker.service

[Service]
User=soulwallet
Group=soulwallet
WorkingDirectory=/opt/soulwallet
ExecStart=/usr/local/bin/docker-compose up
ExecStop=/usr/local/bin/docker-compose down
Restart=always
RestartSec=10
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable soulwallet
systemctl start soulwallet

# Verify service started
sleep 10
if ! systemctl is-active --quiet soulwallet; then
  echo "ERROR: SoulWallet service failed to start"
  journalctl -u soulwallet --no-pager -n 50
  exit 1
fi

# Install CloudWatch agent for logs
dnf install -y amazon-cloudwatch-agent
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<EOF
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/soulwallet/*.log",
            "log_group_name": "/soulwallet/$ENVIRONMENT",
            "log_stream_name": "{instance_id}/app"
          }
        ]
      }
    }
  }
}
EOF
systemctl enable amazon-cloudwatch-agent
systemctl start amazon-cloudwatch-agent

echo "SoulWallet application server setup complete!"
