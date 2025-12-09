#!/bin/bash
set -e

echo "🔄 Creating production migration from current schema..."

# Step 1: Generate migration (don't apply yet)
npx prisma migrate dev --name production_indexes_and_optimizations --create-only

echo "✅ Migration created in prisma/migrations/"
echo "📝 Review the migration SQL before deploying"
echo "🚀 Deploy with: npm run db:migrate:deploy"
