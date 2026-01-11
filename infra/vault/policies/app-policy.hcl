# Vault App Policy
# Allows SoulWallet application to read secrets

path "secret/data/soulwallet/*" {
  capabilities = ["read"]
}

path "secret/metadata/soulwallet/*" {
  capabilities = ["read", "list"]
}

# Database dynamic credentials
path "database/creds/soulwallet-app" {
  capabilities = ["read"]
}

# Transit encryption for sensitive data
path "transit/encrypt/soulwallet" {
  capabilities = ["update"]
}

path "transit/decrypt/soulwallet" {
  capabilities = ["update"]
}

# AWS secrets engine for temporary credentials
path "aws/creds/soulwallet-app" {
  capabilities = ["read"]
}

# PKI for certificate generation
path "pki/issue/soulwallet" {
  capabilities = ["create", "update"]
}
