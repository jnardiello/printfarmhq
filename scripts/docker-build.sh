#!/bin/bash
set -e

# Configuration
REGISTRY="${REGISTRY:-ghcr.io}"
NAMESPACE="${NAMESPACE:-jnardiello}"
VERSION="${VERSION:-latest}"
PUSH="${PUSH:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Function to build and optionally push an image
build_image() {
    local dockerfile=$1
    local context=$2
    local component_name=$3
    local build_args=$4

    print_status "Building printfarmhq:${component_name}..."
    
    # Build the image directly with registry format
    docker build \
        -f "${dockerfile}" \
        -t "${REGISTRY}/${NAMESPACE}/printfarmhq:${component_name}-${VERSION}" \
        -t "${REGISTRY}/${NAMESPACE}/printfarmhq:${component_name}-latest" \
        ${build_args} \
        "${context}"
    
    if [ "$PUSH" == "true" ]; then
        print_status "Pushing printfarmhq:${component_name}..."
        docker push "${REGISTRY}/${NAMESPACE}/printfarmhq:${component_name}-${VERSION}"
        docker push "${REGISTRY}/${NAMESPACE}/printfarmhq:${component_name}-latest"
    fi
}

# Main build process
main() {
    print_status "Starting Docker build process..."
    print_status "Registry: ${REGISTRY}"
    print_status "Namespace: ${NAMESPACE}"
    print_status "Version: ${VERSION}"
    print_status "Push: ${PUSH}"
    
    # Build backend app image
    build_image \
        "backend/Dockerfile" \
        "backend" \
        "backend" \
        ""
    
    # Build backend test image
    build_image \
        "backend/Dockerfile.test" \
        "backend" \
        "backend-test" \
        ""
    
    # Build frontend app image
    build_image \
        "frontend/Dockerfile" \
        "frontend" \
        "frontend" \
        ""
    
    # Build frontend test image
    build_image \
        "frontend/Dockerfile.test" \
        "frontend" \
        "frontend-test" \
        ""
    
    print_status "Build process completed successfully!"
}

# Run main function
main "$@"