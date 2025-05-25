# Docker Registry Setup

PrintFarmHQ uses GitHub Container Registry (ghcr.io) to store and distribute Docker images.

## Architecture

We use a multi-stage build approach with base images to optimize build times:

```
Base Images (rarely change, cached):
├── backend-base      # Python 3.11 + system deps
└── frontend-base     # Node.js 20 + build tools

Application Images (built from base):
├── backend          # FastAPI application
├── frontend         # Next.js application
├── backend-test     # Backend test runner (uses backend-base)
└── frontend-test    # E2E test runner (uses frontend-base + Playwright)
```

## Setup

### 1. Create GitHub Personal Access Token

1. Go to https://github.com/settings/tokens/new
2. Name: "PrintFarmHQ Docker Registry"
3. Expiration: 90 days (recommended)
4. Scopes:
   - `write:packages` - Push images
   - `read:packages` - Pull images
   - `delete:packages` - Delete old images (optional)
5. Click "Generate token" and copy it

### 2. Set Environment Variable

```bash
# For current session
export GITHUB_TOKEN=your_token_here

# For persistence (add to ~/.bashrc or ~/.zshrc)
echo 'export GITHUB_TOKEN=your_token_here' >> ~/.bashrc
```

### 3. Authenticate to Registry

```bash
make docker-auth
```

## Building and Pushing Images

### Build All Images
```bash
# Build all images locally
make docker-build

# Build and push to registry
make docker-push

# Or do both with authentication
make docker-build-push
```

### Version Management

By default, images are tagged as `latest`. To use specific versions:

```bash
# Build with specific version
VERSION=1.0.0 make docker-build

# Push with specific version
VERSION=1.0.0 make docker-push
```

## Using Registry Images

### For Production/Staging

The main `docker-compose.yml` uses registry images by default:

```bash
# Pull latest images and run
make prod

# Or manually
docker compose pull
docker compose up
```

### For Local Development

Use the override file to build locally:

```bash
# Build and run with local changes
make dev

# Or manually
docker compose -f docker-compose.yml -f docker-compose.override.yml up --build
```

## Image URLs

The default namespace is `printfarmhq`, but you can use your own:

Default images:
- `ghcr.io/printfarmhq/printfarmhq-backend:latest`
- `ghcr.io/printfarmhq/printfarmhq-frontend:latest`
- `ghcr.io/printfarmhq/printfarmhq-backend-test:latest`
- `ghcr.io/printfarmhq/printfarmhq-frontend-test:latest`

Custom namespace example:
- `ghcr.io/yourusername/printfarmhq-backend:latest`
- `ghcr.io/yourusername/printfarmhq-frontend:latest`

Base images follow the same pattern:
- `ghcr.io/{namespace}/printfarmhq-backend-base:latest`
- `ghcr.io/{namespace}/printfarmhq-frontend-base:latest`

## Updating Base Images

Base images should be updated when:
- System dependencies change
- Major version updates (Python, Node.js)
- Security patches

```bash
# Update base images only
NAMESPACE=yourusername
cd backend && docker build -f Dockerfile.base -t ghcr.io/${NAMESPACE}/printfarmhq-backend-base:latest .
cd frontend && docker build -f Dockerfile.base -t ghcr.io/${NAMESPACE}/printfarmhq-frontend-base:latest .

# Push updated base images
docker push ghcr.io/${NAMESPACE}/printfarmhq-backend-base:latest
docker push ghcr.io/${NAMESPACE}/printfarmhq-frontend-base:latest
```

## CI/CD Integration

For GitHub Actions, add these secrets:
- `GITHUB_TOKEN` - Already available in Actions
- `REGISTRY_NAMESPACE` - Your GitHub username/org

Example workflow:
```yaml
- name: Build and push Docker images
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    echo "$GITHUB_TOKEN" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
    make docker-push
```