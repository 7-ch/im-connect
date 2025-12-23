#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Starting Deployment Process..."

# 1. Install Dependencies
echo "📦 Installing dependencies..."
# Detect package manager
if [ -f "pnpm-lock.yaml" ]; then
    pnpm install
elif [ -f "yarn.lock" ]; then
    yarn install
else
    npm install
fi

# 2. Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate

# 3. Database Setup (Migration & Seeding)
RESET_MODE=false

# Check for --reset argument
for arg in "$@"; do
  if [ "$arg" == "--reset" ]; then
    RESET_MODE=true
    break
  fi
done

if [ "$RESET_MODE" = true ]; then
    echo "🗑️  Resetting database (clearing all data)..."
    # verify environment to prevent accidental reset in production if needed, 
    # but here we assume the user knows what they are doing with the flag.
    npx prisma migrate reset --force
    echo "✅ Database reset and seeded."
else
    echo "🗄️  Applying database migrations..."
    npx prisma migrate deploy
    
    echo "🌱 Running database seed..."
    # Using the script directly or via npm run
    node scripts/seed-db.js
fi

# 5. Build Frontend
echo "🏗️  Building frontend..."
if [ -f "pnpm-lock.yaml" ]; then
    pnpm run build
else
    npm run build
fi

echo "✅ Deployment complete!"

# 6. Start/Restart Server
echo "🔄 Checking for existing server process..."

# Safer approach: Check if port 8080 is in use and kill that specific process
# lsof -t -i :8080 returns the PID(s) using port 8080
EXISTING_PID=$(lsof -t -i :8080 || true)

if [ -n "$EXISTING_PID" ]; then
    echo "⚠️  Port 8080 is busy. PID: $EXISTING_PID"
    echo "🛑 Stopping process on port 8080..."
    echo $EXISTING_PID | xargs kill
    sleep 2
    echo "✅ Process stopped."
else
    echo "No process found running on port 8080."
fi

echo "🚀 Starting server..."
# Run in foreground to show logs.
node server.js