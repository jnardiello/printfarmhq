#!/bin/bash
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if GITHUB_TOKEN is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}❌ GITHUB_TOKEN is not set${NC}"
    echo ""
    echo "To authenticate to GitHub Container Registry, you need a Personal Access Token."
    echo ""
    echo "Steps to create one:"
    echo "1. Go to https://github.com/settings/tokens/new"
    echo "2. Give it a name (e.g., 'PrintFarmHQ Docker Registry')"
    echo "3. Select expiration (recommended: 90 days)"
    echo "4. Select scopes:"
    echo "   - write:packages (to push images)"
    echo "   - read:packages (to pull images)"
    echo "   - delete:packages (optional, to delete old images)"
    echo "5. Click 'Generate token' and copy it"
    echo ""
    echo "Then set it as an environment variable:"
    echo "  export GITHUB_TOKEN=your_token_here"
    echo ""
    echo "Or add it to your shell profile for persistence:"
    echo "  echo 'export GITHUB_TOKEN=your_token_here' >> ~/.bashrc"
    echo ""
    exit 1
fi

# Get GitHub username from environment, git config, or current user
GITHUB_USER="${GITHUB_USER:-$(git config user.name | tr '[:upper:]' '[:lower:]' | tr ' ' '-')}"
if [ -z "$GITHUB_USER" ]; then
    GITHUB_USER="$(whoami | tr '[:upper:]' '[:lower:]')"
fi

echo -e "${YELLOW}🔐 Authenticating to GitHub Container Registry...${NC}"
echo "   User: $GITHUB_USER"
echo "   Registry: ghcr.io"

# Authenticate to GitHub Container Registry
echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USER" --password-stdin

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Successfully authenticated to ghcr.io${NC}"
else
    echo -e "${RED}❌ Failed to authenticate to ghcr.io${NC}"
    exit 1
fi