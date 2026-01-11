# Terraform AWS Provider Configuration
# SoulWallet Infrastructure as Code

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "~> 3.20"
    }
  }

  backend "s3" {
    bucket         = "soulwallet-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "soulwallet-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "SoulWallet"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

provider "vault" {
  address = var.vault_addr
  # Token from environment: VAULT_TOKEN
}

# Data sources for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}
