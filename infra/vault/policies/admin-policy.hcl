# Vault Admin Policy
# Full access for administrators

# Full access to all secrets
path "secret/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Manage secret engines
path "sys/mounts/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Manage policies
path "sys/policies/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "sys/policy/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Manage auth methods
path "auth/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

# Manage identity
path "identity/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Database engine admin
path "database/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Transit engine admin
path "transit/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# AWS engine admin
path "aws/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# PKI engine admin
path "pki/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# System health
path "sys/health" {
  capabilities = ["read", "sudo"]
}

# Audit logs
path "sys/audit" {
  capabilities = ["read", "list"]
}

path "sys/audit/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Lease management
path "sys/leases/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}
