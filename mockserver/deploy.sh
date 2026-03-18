#!/usr/bin/env bash
set -e

# Deploy the Pets mock server to Vercel.
# Prerequisites: Vercel CLI installed globally — npm i -g vercel

cd "$(dirname "$0")"

if ! command -v vercel &>/dev/null; then
  echo "Error: Vercel CLI not found. Install it with:  npm i -g vercel"
  exit 1
fi

echo "Installing dependencies..."
npm install

echo "Deploying to Vercel (production)..."
vercel --prod

echo "Done."
