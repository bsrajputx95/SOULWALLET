# Vault Authentication Configuration

# Enable AWS auth method for EC2 instances
resource "vault_auth_backend" "aws" {
  type = "aws"
  path = "aws"
}

resource "vault_aws_auth_backend_client" "main" {
  backend    = vault_auth_backend.aws.path
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
}

# Role for EC2 instances to authenticate
resource "vault_aws_auth_backend_role" "app" {
  backend                  = vault_auth_backend.aws.path
  role                     = "soulwallet-app"
  auth_type                = "iam"
  bound_iam_principal_arns = var.app_iam_role_arns
  token_policies           = ["soulwallet-app"]
  token_ttl                = 3600
  token_max_ttl            = 86400
}

# Enable AppRole auth for CI/CD and services
resource "vault_auth_backend" "approle" {
  type = "approle"
  path = "approle"
}

resource "vault_approle_auth_backend_role" "app" {
  backend        = vault_auth_backend.approle.path
  role_name      = "soulwallet-app"
  token_policies = ["soulwallet-app"]
  token_ttl      = 3600
  token_max_ttl  = 86400

  secret_id_ttl         = 86400  # 24 hours
  secret_id_num_uses    = 0      # unlimited
  token_num_uses        = 0      # unlimited
  bind_secret_id        = true
}

# CI/CD role with limited permissions
resource "vault_approle_auth_backend_role" "cicd" {
  backend        = vault_auth_backend.approle.path
  role_name      = "soulwallet-cicd"
  token_policies = ["soulwallet-cicd"]
  token_ttl      = 600   # 10 minutes
  token_max_ttl  = 1800  # 30 minutes

  secret_id_ttl      = 3600
  secret_id_num_uses = 1  # single use
  token_num_uses     = 0
  bind_secret_id     = true
}

# Create policies
resource "vault_policy" "app" {
  name   = "soulwallet-app"
  policy = file("${path.module}/../policies/app-policy.hcl")
}

resource "vault_policy" "admin" {
  name   = "soulwallet-admin"
  policy = file("${path.module}/../policies/admin-policy.hcl")
}

resource "vault_policy" "cicd" {
  name = "soulwallet-cicd"
  policy = <<-EOT
    # CI/CD Policy - read-only access to secrets
    path "secret/data/soulwallet/config" {
      capabilities = ["read"]
    }
    
    path "secret/data/soulwallet/ci" {
      capabilities = ["read"]
    }
    
    # Can request temporary database credentials
    path "database/creds/soulwallet-app" {
      capabilities = ["read"]
    }
  EOT
}

# Variables
variable "app_iam_role_arns" {
  description = "IAM role ARNs allowed to authenticate"
  type        = list(string)
}
