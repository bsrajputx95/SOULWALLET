# ElastiCache Redis Configuration

# Subnet Group for ElastiCache
resource "aws_elasticache_subnet_group" "main" {
  name       = "soulwallet-${var.environment}-cache-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "soulwallet-${var.environment}-cache-subnet"
  }
}

# Security Group for ElastiCache
resource "aws_security_group" "cache" {
  name        = "soulwallet-${var.environment}-cache-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from app servers"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "soulwallet-${var.environment}-cache-sg"
  }
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "main" {
  family = "redis7"
  name   = "soulwallet-${var.environment}-redis"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  tags = {
    Name = "soulwallet-${var.environment}-redis-params"
  }
}

# ElastiCache Replication Group
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "soulwallet-${var.environment}"
  description          = "Redis cluster for SoulWallet ${var.environment}"

  engine               = "redis"
  engine_version       = "7.0"
  node_type            = var.cache_node_type
  num_cache_clusters   = var.cache_num_nodes
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.main.name

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.cache.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth.result

  automatic_failover_enabled = true
  multi_az_enabled           = true

  snapshot_retention_limit = 7
  snapshot_window          = "05:00-06:00"
  maintenance_window       = "sun:06:00-sun:07:00"

  apply_immediately = false

  tags = {
    Name = "soulwallet-${var.environment}-redis"
  }
}

resource "random_password" "redis_auth" {
  length  = 32
  special = false
}

# Store Redis auth token in Secrets Manager
resource "aws_secretsmanager_secret" "redis_auth" {
  name                    = "soulwallet/${var.environment}/redis-auth"
  recovery_window_in_days = 7

  tags = {
    Name = "soulwallet-${var.environment}-redis-auth"
  }
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id     = aws_secretsmanager_secret.redis_auth.id
  secret_string = random_password.redis_auth.result
}
