# Terraform Variables for SoulWallet Infrastructure

variable "aws_region" {
  description = "AWS region for infrastructure"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (production, staging)"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 100
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "soulwallet"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "soulwallet_admin"
  sensitive   = true
}

variable "cache_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.medium"
}

variable "cache_num_nodes" {
  description = "Number of ElastiCache nodes"
  type        = number
  default     = 2
}

variable "asg_min_size" {
  description = "Minimum size of Auto Scaling Group"
  type        = number
  default     = 2
}

variable "asg_max_size" {
  description = "Maximum size of Auto Scaling Group"
  type        = number
  default     = 10
}

variable "asg_desired_capacity" {
  description = "Desired capacity of Auto Scaling Group"
  type        = number
  default     = 2
}

variable "instance_type" {
  description = "EC2 instance type for ASG"
  type        = string
  default     = "t3.medium"
}

variable "vault_addr" {
  description = "HashiCorp Vault address"
  type        = string
  default     = "https://vault.soulwallet.com:8200"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "api.soulwallet.com"
}

variable "certificate_arn" {
  description = "ARN of ACM certificate for HTTPS"
  type        = string
  default     = ""
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "vault_role_id" {
  description = "Vault AppRole role ID for authentication"
  type        = string
  default     = ""
  sensitive   = true
}
