#!/bin/bash
set -e

# Configuration
REGISTRY="${REGISTRY:-ghcr.io}"
NAMESPACE="${NAMESPACE:-jnardiello}"
VERSION="${VERSION:-latest}"
PUSH="${PUSH:-false}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"

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

# Check if buildx is available
check_buildx() {
    if ! docker buildx version &> /dev/null; then
        print_error "Docker buildx is not available. Please update Docker."
        exit 1
    fi
}

# Setup buildx builder
setup_builder() {
    local builder_name="printfarmhq-builder"
    
    # Check if builder already exists
    if docker buildx ls | grep -q "$builder_name"; then
        print_status "Using existing buildx builder: $builder_name"
    else
        print_status "Creating new buildx builder: $builder_name"
        docker buildx create --name "$builder_name" --use --bootstrap
    fi
    
    # Use the builder
    docker buildx use "$builder_name"
}

# Function to build and optionally push a multi-arch image
build_multiarch_image() {
    local dockerfile=$1
    local context=$2
    local component_name=$3
    local build_args=$4
    
    print_status "Building printfarmhq:${component_name} for platforms: ${PLATFORMS}..."
    
    # Prepare build command
    local build_cmd="docker buildx build"
    build_cmd="$build_cmd --platform=${PLATFORMS}"
    build_cmd="$build_cmd -f ${dockerfile}"
    build_cmd="$build_cmd -t ${REGISTRY}/${NAMESPACE}/printfarmhq:${component_name}-${VERSION}"
    build_cmd="$build_cmd -t ${REGISTRY}/${NAMESPACE}/printfarmhq:${component_name}-latest"
    
    # Add build args if provided
    if [ -n "$build_args" ]; then
        build_cmd="$build_cmd $build_args"
    fi
    
    # Add push flag if requested
    if [ "$PUSH" == "true" ]; then
        build_cmd="$build_cmd --push"
    else
        # For local builds, we need to load the image (only works for single platform)
        if [ "$PLATFORMS" == "linux/arm64" ] || [ "$PLATFORMS" == "linux/amd64" ]; then
            build_cmd="$build_cmd --load"
        else
            print_warning "Multi-platform builds can only be pushed to registry, not loaded locally"
            print_warning "To build for local use, set PLATFORMS to a single platform"
        fi
    fi
    
    # Add context
    build_cmd="$build_cmd ${context}"
    
    # Execute build
    eval $build_cmd
}

# Main build process
main() {
    print_status "Starting multi-architecture Docker build process..."
    print_status "Registry: ${REGISTRY}"
    print_status "Namespace: ${NAMESPACE}"
    print_status "Version: ${VERSION}"
    print_status "Platforms: ${PLATFORMS}"
    print_status "Push: ${PUSH}"
    
    # Check prerequisites
    check_buildx
    setup_builder
    
    # Build backend base image
    build_multiarch_image \
        "backend/Dockerfile.base" \
        "backend" \
        "backend-base" \
        ""
    
    # Build backend app image
    build_multiarch_image \
        "backend/Dockerfile" \
        "backend" \
        "backend" \
        "--build-arg REGISTRY=${REGISTRY} --build-arg NAMESPACE=${NAMESPACE} --build-arg BASE_TAG=latest"
    
    # Build backend test image
    build_multiarch_image \
        "backend/Dockerfile.test" \
        "backend" \
        "backend-test" \
        "--build-arg REGISTRY=${REGISTRY} --build-arg NAMESPACE=${NAMESPACE} --build-arg BASE_TAG=latest"
    
    # Build frontend base image
    build_multiarch_image \
        "frontend/Dockerfile.base" \
        "frontend" \
        "frontend-base" \
        ""
    
    # Build frontend app image
    build_multiarch_image \
        "frontend/Dockerfile" \
        "frontend" \
        "frontend" \
        "--build-arg REGISTRY=${REGISTRY} --build-arg NAMESPACE=${NAMESPACE} --build-arg BASE_TAG=latest"
    
    # Build frontend test image
    build_multiarch_image \
        "frontend/Dockerfile.test" \
        "frontend" \
        "frontend-test" \
        "--build-arg REGISTRY=${REGISTRY} --build-arg NAMESPACE=${NAMESPACE} --build-arg BASE_TAG=latest"
    
    print_status "Multi-architecture build process completed successfully!"
}

# Run main function
main "$@"