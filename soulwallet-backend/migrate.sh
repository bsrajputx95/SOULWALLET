#!/bin/sh
# Pre-deployment migration script
echo "Running Prisma migrations..."
npx prisma migrate deploy
