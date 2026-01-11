# Vault Secrets Engine Configuration

# Enable KV v2 secrets engine
resource "vault_mount" "kv" {
  path        = "secret"
  type        = "kv-v2"
  description = "KV v2 secrets engine for SoulWallet"

  options = {
    version = "2"
  }
}

# Enable Transit secrets engine for encryption
resource "vault_mount" "transit" {
  path        = "transit"
  type        = "transit"
  description = "Transit secrets engine for encryption operations"
}

# Create transit encryption key
resource "vault_transit_secret_backend_key" "soulwallet" {
  backend = vault_mount.transit.path
  name    = "soulwallet"
  type    = "aes256-gcm96"

  deletion_allowed         = false
  exportable               = false
  allow_plaintext_backup   = false
  min_decryption_version   = 1
  min_encryption_version   = 1
  auto_rotate_period       = 2592000 # 30 days in seconds
}

# Enable Database secrets engine
resource "vault_mount" "database" {
  path        = "database"
  type        = "database"
  description = "Database secrets engine for dynamic credentials"
}

# PostgreSQL database connection configuration
resource "vault_database_secret_backend_connection" "postgres" {
  backend       = vault_mount.database.path
  name          = "soulwallet-postgres"
  allowed_roles = ["soulwallet-app"]

  postgresql {
    connection_url = "postgresql://{{username}}:{{password}}@${var.db_host}:5432/${var.db_name}?sslmode=require"
    username       = var.db_admin_username
    password       = var.db_admin_password
  }
}

# Database role for application
resource "vault_database_secret_backend_role" "app" {
  backend     = vault_mount.database.path
  name        = "soulwallet-app"
  db_name     = vault_database_secret_backend_connection.postgres.name

  creation_statements = [
    "CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';",
    "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";",
    "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO \"{{name}}\";"
  ]

  revocation_statements = [
    "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM \"{{name}}\";",
    "REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM \"{{name}}\";",
    "DROP ROLE IF EXISTS \"{{name}}\";"
  ]

  default_ttl = 3600   # 1 hour
  max_ttl     = 86400  # 24 hours
}

# AWS secrets engine for temporary IAM credentials
resource "vault_aws_secret_backend" "aws" {
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
  region     = var.aws_region

  default_lease_ttl_seconds = 3600
  max_lease_ttl_seconds     = 86400
}

resource "vault_aws_secret_backend_role" "app" {
  backend         = vault_aws_secret_backend.aws.path
  name            = "soulwallet-app"
  credential_type = "iam_user"

  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::soulwallet-*",
          "arn:aws:s3:::soulwallet-*/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey"
        ]
        Resource = var.kms_key_arn
      }
    ]
  })
}

# Store application secrets
resource "vault_kv_secret_v2" "app_config" {
  mount = vault_mount.kv.path
  name  = "soulwallet/config"

  data_json = jsonencode({
    jwt_secret         = var.jwt_secret
    jwt_refresh_secret = var.jwt_refresh_secret
    wallet_encryption_key = var.wallet_encryption_key
    pgcrypto_key       = var.pgcrypto_key
  })
}

# Variables
variable "db_host" {
  type = string
}

variable "db_name" {
  type    = string
  default = "soulwallet"
}

variable "db_admin_username" {
  type      = string
  sensitive = true
}

variable "db_admin_password" {
  type      = string
  sensitive = true
}

variable "aws_access_key" {
  type      = string
  sensitive = true
}

variable "aws_secret_key" {
  type      = string
  sensitive = true
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "kms_key_arn" {
  type = string
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "jwt_refresh_secret" {
  type      = string
  sensitive = true
}

variable "wallet_encryption_key" {
  type      = string
  sensitive = true
}

variable "pgcrypto_key" {
  type      = string
  sensitive = true
}
