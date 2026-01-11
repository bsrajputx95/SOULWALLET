# Application Load Balancer Configuration

# Security Group for ALB
resource "aws_security_group" "alb" {
  name        = "soulwallet-${var.environment}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "soulwallet-${var.environment}-alb-sg"
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "soulwallet-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = true
  enable_http2               = true

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "alb"
    enabled = true
  }

  tags = {
    Name = "soulwallet-${var.environment}-alb"
  }
}

# S3 bucket for ALB logs
resource "aws_s3_bucket" "alb_logs" {
  bucket = "soulwallet-${var.environment}-alb-logs-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "soulwallet-${var.environment}-alb-logs"
  }
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::127311923021:root" # ELB account for us-east-1
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs.arn}/alb/*"
      }
    ]
  })
}

# Main Target Group (Blue)
resource "aws_lb_target_group" "blue" {
  name     = "soulwallet-${var.environment}-blue"
  port     = 3001
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  tags = {
    Name  = "soulwallet-${var.environment}-blue"
    Color = "blue"
  }
}

# Green Target Group
resource "aws_lb_target_group" "green" {
  name     = "soulwallet-${var.environment}-green"
  port     = 3002
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  tags = {
    Name  = "soulwallet-${var.environment}-green"
    Color = "green"
  }
}

# Canary Target Group
resource "aws_lb_target_group" "canary" {
  name     = "soulwallet-${var.environment}-canary"
  port     = 3003
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  tags = {
    Name  = "soulwallet-${var.environment}-canary"
    Color = "canary"
  }
}

# HTTPS Listener
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type = "forward"
    forward {
      target_group {
        arn    = aws_lb_target_group.blue.arn
        weight = 100
      }
    }
  }
}

# HTTP to HTTPS redirect
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Canary listener rule - DISABLED by default
# Enable during canary deployments by setting var.enable_canary_traffic = true
# When enabled, create a separate canary ASG attached to aws_lb_target_group.canary
# resource "aws_lb_listener_rule" "canary" {
#   count        = var.enable_canary_traffic ? 1 : 0
#   listener_arn = aws_lb_listener.https.arn
#   priority     = 100
#
#   action {
#     type = "forward"
#     forward {
#       target_group {
#         arn    = aws_lb_target_group.blue.arn
#         weight = 90
#       }
#       target_group {
#         arn    = aws_lb_target_group.canary.arn
#         weight = 10
#       }
#     }
#   }
#
#   condition {
#     path_pattern {
#       values = ["/*"]
#     }
#   }
# }
