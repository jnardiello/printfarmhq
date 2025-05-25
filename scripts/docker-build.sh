#!/bin/bash
set -e

# Configuration
REGISTRY="${REGISTRY:-ghcr.io}"
NAMESPACE="${NAMESPACE:-$(whoami | tr '[:upper:]' '[:lower:]')}"
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
    local image_name=$3
    local build_args=$4

    print_status "Building ${image_name}:${VERSION}..."
    
    # Build the image
    docker build \
        -f "${dockerfile}" \
        -t "${REGISTRY}/${NAMESPACE}/${image_name}:${VERSION}" \
        -t "${REGISTRY}/${NAMESPACE}/${image_name}:latest" \
        ${build_args} \
        "${context}"
    
    if [ "$PUSH" == "true" ]; then
        print_status "Pushing ${image_name}:${VERSION}..."
        docker push "${REGISTRY}/${NAMESPACE}/${image_name}:${VERSION}"
        docker push "${REGISTRY}/${NAMESPACE}/${image_name}:latest"
    fi
}

# Main build process
main() {
    print_status "Starting Docker build process..."
    print_status "Registry: ${REGISTRY}"
    print_status "Namespace: ${NAMESPACE}"
    print_status "Version: ${VERSION}"
    print_status "Push: ${PUSH}"
    
    # Build backend base image
    build_image \
        "backend/Dockerfile.base" \
        "backend" \
        "printfarmhq-backend-base" \
        ""
    
    # Build backend app image
    build_image \
        "backend/Dockerfile" \
        "backend" \
        "printfarmhq-backend" \
        "--build-arg REGISTRY=${REGISTRY} --build-arg NAMESPACE=${NAMESPACE} --build-arg BASE_TAG=${VERSION}"
    
    # Build backend test image
    build_image \
        "backend/Dockerfile.test" \
        "backend" \
        "printfarmhq-backend-test" \
        "--build-arg REGISTRY=${REGISTRY} --build-arg NAMESPACE=${NAMESPACE} --build-arg BASE_TAG=${VERSION}"
    
    # Build frontend base image
    build_image \
        "frontend/Dockerfile.base" \
        "frontend" \
        "printfarmhq-frontend-base" \
        ""
    
    # Build frontend app image
    build_image \
        "frontend/Dockerfile" \
        "frontend" \
        "printfarmhq-frontend" \
        "--build-arg REGISTRY=${REGISTRY} --build-arg NAMESPACE=${NAMESPACE} --build-arg BASE_TAG=${VERSION}"
    
    # Build frontend test image
    build_image \
        "frontend/Dockerfile.test" \
        "frontend" \
        "printfarmhq-frontend-test" \
        "--build-arg REGISTRY=${REGISTRY} --build-arg NAMESPACE=${NAMESPACE} --build-arg BASE_TAG=${VERSION}"
    
    print_status "Build process completed successfully!"
}

# Run main function
main "$@"