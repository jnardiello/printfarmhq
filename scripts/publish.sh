#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="${REGISTRY:-ghcr.io}"
NAMESPACE="${NAMESPACE:-jnardiello}"
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"
BUMP_TYPE="${BUMP_TYPE:-patch}"
DRY_RUN="${DRY_RUN:-false}"

# Global variables
ROLLBACK_COMMIT=""
NEW_VERSION=""
LAST_VERSION=""

# Print colored status messages
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_dry_run() {
    echo -e "${YELLOW}[DRY RUN]${NC} $1"
}

# Execute command with dry-run support
execute() {
    if [[ "$DRY_RUN" == "true" ]]; then
        print_dry_run "Would execute: $*"
    else
        "$@"
    fi
}

# Rollback function
rollback() {
    print_error "Release failed. Rolling back changes..."
    
    if [[ -n "$NEW_VERSION" ]]; then
        # Delete local tag
        git tag -d "$NEW_VERSION" 2>/dev/null || true
        
        # Delete remote tag
        git push origin ":refs/tags/$NEW_VERSION" 2>/dev/null || true
        
        # Reset to rollback point
        if [[ -n "$ROLLBACK_COMMIT" ]]; then
            git reset --hard "$ROLLBACK_COMMIT"
            git push --force-with-lease origin $(git branch --show-current) 2>/dev/null || true
        fi
        
        # Delete GitHub release if created
        gh release delete "$NEW_VERSION" --yes 2>/dev/null || true
    fi
    
    print_error "Rollback complete"
    exit 1
}

# Set trap for rollback on error
trap rollback ERR

# Get current version from git tags
get_current_version() {
    local version=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    if [[ -z "$version" ]]; then
        echo "v0.0.0"
    else
        echo "$version"
    fi
}

# Parse semantic version
parse_version() {
    local version=$1
    # Remove 'v' prefix if present
    version=${version#v}
    
    # Split version into parts
    IFS='.' read -ra PARTS <<< "$version"
    MAJOR=${PARTS[0]:-0}
    MINOR=${PARTS[1]:-0}
    PATCH=${PARTS[2]:-0}
}

# Calculate new version based on increment type
calculate_new_version() {
    local increment_type=$1
    local current_version=$2
    
    parse_version "$current_version"
    
    case $increment_type in
        "major")
            MAJOR=$((MAJOR + 1))
            MINOR=0
            PATCH=0
            ;;
        "minor")
            MINOR=$((MINOR + 1))
            PATCH=0
            ;;
        "patch")
            PATCH=$((PATCH + 1))
            ;;
        *)
            print_error "Invalid increment type: $increment_type"
            exit 1
            ;;
    esac
    
    echo "v${MAJOR}.${MINOR}.${PATCH}"
}

# Pre-flight checks
pre_flight_checks() {
    print_status "Running pre-flight checks..."
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        exit 1
    fi
    
    # Check current branch
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$current_branch" != "$DEFAULT_BRANCH" ]]; then
        print_warning "Currently on branch '$current_branch', not '$DEFAULT_BRANCH'"
        print_warning "This is typically only safe for testing purposes"
        read -p "Do you want to proceed anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Release cancelled. Switch to $DEFAULT_BRANCH branch first."
            exit 1
        fi
        # Update DEFAULT_BRANCH to current for this run
        DEFAULT_BRANCH="$current_branch"
    fi
    
    # Check if working directory is clean
    if [[ -n $(git status --porcelain) ]]; then
        print_error "Working directory is not clean. Please commit or stash your changes."
        git status --short
        exit 1
    fi
    
    # Pull latest changes
    print_status "Pulling latest changes..."
    git pull origin "$current_branch"
    
    # Check for required tools
    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI (gh) is required but not installed"
        exit 1
    fi
    
    # Check GitHub authentication
    if ! gh auth status &> /dev/null; then
        print_error "GitHub CLI not authenticated. Run 'gh auth login'"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is required but not installed"
        exit 1
    fi
    
    print_success "Pre-flight checks passed"
}

# Update docker-compose files with new version
update_compose_files() {
    local version=$1
    print_status "Updating docker-compose files to use version $version..."
    
    # Update docker-compose.yml - replace any existing version with new one
    if [[ -f "docker-compose.yml" ]]; then
        # This regex matches VERSION:-anything and replaces with VERSION:-newversion
        sed -i.bak "s/VERSION:-[^}]*/VERSION:-${version}/g" docker-compose.yml
        rm docker-compose.yml.bak
    fi
    
    # Update docker-compose.dev.yml
    if [[ -f "docker-compose.dev.yml" ]]; then
        sed -i.bak "s/VERSION:-[^}]*/VERSION:-${version}/g" docker-compose.dev.yml
        rm docker-compose.dev.yml.bak
    fi
    
    print_success "Updated docker-compose files"
}

# Update docker-compose files after release
update_compose_files_post_release() {
    local version=$1
    print_status "Updating docker-compose files for post-release..."
    
    # Keep version in docker-compose.yml for production use
    # Users can run 'make up' and get the stable release
    print_status "Keeping version $version in docker-compose.yml for production use"
    
    # Revert docker-compose.dev.yml to latest for development
    if [[ -f "docker-compose.dev.yml" ]]; then
        print_status "Reverting docker-compose.dev.yml to use latest for development..."
        sed -i.bak "s/VERSION:-[^}]*/VERSION:-latest/g" docker-compose.dev.yml
        rm docker-compose.dev.yml.bak
    fi
}

# Generate changelog from commits
generate_changelog() {
    local from_version=$1
    local to_version=$2
    
    # Note: Don't use print_status here as it adds color codes that end up in the changelog
    echo "Generating changelog..." >&2
    
    if [[ "$from_version" == "v0.0.0" ]]; then
        # First release, get all commits
        git log --pretty=format:"- %s" --no-merges --reverse
    else
        # Get commits since last version
        git log "${from_version}..HEAD" --pretty=format:"- %s" --no-merges --reverse
    fi
}

# Update CHANGELOG.md file
update_changelog_file() {
    local version=$1
    local changelog="$2"
    local date=$(date +%Y-%m-%d)
    
    print_status "Updating CHANGELOG.md..."
    
    # Create a temporary file with the new entry
    {
        echo "# Changelog"
        echo ""
        echo "## $version ($date)"
        echo ""
        echo "$changelog"
        echo ""
        # Append the rest of the existing changelog, skipping the first line
        tail -n +2 CHANGELOG.md 2>/dev/null || true
    } > CHANGELOG.md.tmp
    
    # Replace the original file
    mv CHANGELOG.md.tmp CHANGELOG.md
    
    print_success "Updated CHANGELOG.md"
}

# Build and push Docker images
build_and_push_images() {
    local version=$1
    print_status "Building and pushing Docker images for version $version..."
    
    # Build backend image
    print_status "Building backend image..."
    docker build -t "${REGISTRY}/${NAMESPACE}/printfarmhq:backend-${version}" \
        ./backend
    
    # Build frontend image
    print_status "Building frontend image..."
    docker build -t "${REGISTRY}/${NAMESPACE}/printfarmhq:frontend-${version}" \
        ./frontend
    
    # Push images
    print_status "Pushing images to registry..."
    docker push "${REGISTRY}/${NAMESPACE}/printfarmhq:backend-${version}"
    docker push "${REGISTRY}/${NAMESPACE}/printfarmhq:frontend-${version}"
    
    # Tag and push as latest
    docker tag "${REGISTRY}/${NAMESPACE}/printfarmhq:backend-${version}" \
        "${REGISTRY}/${NAMESPACE}/printfarmhq:backend-latest"
    docker tag "${REGISTRY}/${NAMESPACE}/printfarmhq:frontend-${version}" \
        "${REGISTRY}/${NAMESPACE}/printfarmhq:frontend-latest"
    
    docker push "${REGISTRY}/${NAMESPACE}/printfarmhq:backend-latest"
    docker push "${REGISTRY}/${NAMESPACE}/printfarmhq:frontend-latest"
    
    print_success "Docker images built and pushed successfully"
}

# Create GitHub release
create_github_release() {
    local version=$1
    local changelog="$2"
    
    print_status "Creating GitHub release for $version..."
    
    # Create release
    gh release create "$version" \
        --title "Release $version" \
        --notes "$changelog" \
        --latest
    
    print_success "GitHub release created: $version"
}

# Prompt user for version type
prompt_for_version_type() {
    echo "Select version bump type:"
    echo "  1) Patch (x.y.Z) - Bug fixes, backwards compatible"
    echo "  2) Minor (x.Y.0) - New features, backwards compatible" 
    echo "  3) Major (X.0.0) - Breaking changes"
    echo ""
    
    while true; do
        read -p "Enter choice [1-3]: " -n 1 -r
        echo
        case $REPLY in
            1)
                BUMP_TYPE="patch"
                break
                ;;
            2)
                BUMP_TYPE="minor"
                break
                ;;
            3)
                BUMP_TYPE="major"
                break
                ;;
            *)
                print_error "Invalid selection. Please choose 1, 2, or 3."
                ;;
        esac
    done
    
    print_status "Selected: $BUMP_TYPE version bump"
}

# Main release process
main() {
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "🧪 PrintFarmHQ Release Publisher (DRY RUN)"
        echo "==========================================="
    else
        echo "🚀 PrintFarmHQ Release Publisher"
        echo "================================"
    fi
    echo ""
    
    # Parse arguments
    case "${1:-}" in
        major|minor|patch)
            BUMP_TYPE="$1"
            ;;
        --dry-run)
            DRY_RUN="true"
            BUMP_TYPE="${2:-patch}"
            ;;
        --help|-h)
            echo "Usage: $0                              # Interactive mode"
            echo "       $0 [major|minor|patch]          # Direct version type"
            echo "       $0 --dry-run [major|minor|patch] # Dry run mode"
            echo ""
            echo "Arguments:"
            echo "  major      Increment major version (X.0.0)"
            echo "  minor      Increment minor version (x.Y.0)"
            echo "  patch      Increment patch version (x.y.Z)"
            echo "  --dry-run  Show what would happen without making changes"
            echo ""
            echo "Interactive mode (no arguments) will prompt for version type."
            echo ""
            echo "Environment variables:"
            echo "  REGISTRY       Docker registry (default: ghcr.io)"
            echo "  NAMESPACE      Registry namespace (default: jnardiello)"
            echo "  DEFAULT_BRANCH Default branch name (default: main)"
            echo "  DRY_RUN        Set to 'true' for dry run mode"
            exit 0
            ;;
        "")
            # Prompt for version type
            prompt_for_version_type
            ;;
        *)
            print_error "Invalid argument: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
    
    # Store current commit for rollback
    ROLLBACK_COMMIT=$(git rev-parse HEAD)
    
    # Run pre-flight checks
    pre_flight_checks
    
    # Get current version and calculate new version
    LAST_VERSION=$(get_current_version)
    NEW_VERSION=$(calculate_new_version "$BUMP_TYPE" "$LAST_VERSION")
    
    echo ""
    print_status "Current version: $LAST_VERSION"
    print_status "New version: $NEW_VERSION ($BUMP_TYPE bump)"
    echo ""
    
    # Confirm with user
    read -p "Do you want to proceed with release $NEW_VERSION? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Release cancelled by user"
        exit 0
    fi
    
    # Run tests before proceeding
    print_status "Running tests..."
    if command -v make >/dev/null 2>&1 && grep -q "test-ci" Makefile; then
        make test-ci
    else
        print_warning "No test-ci target found, skipping tests"
    fi
    
    # Update docker-compose files
    update_compose_files "$NEW_VERSION"
    
    # Generate changelog early for CHANGELOG.md
    CHANGELOG=$(generate_changelog "$LAST_VERSION" "$NEW_VERSION")
    
    # Update CHANGELOG.md file
    update_changelog_file "$NEW_VERSION" "$CHANGELOG"
    
    # Commit version bump and changelog
    git add docker-compose*.yml CHANGELOG.md
    git commit -m "chore: bump version to $NEW_VERSION and update changelog"
    
    # Create and push tag
    print_status "Creating git tag $NEW_VERSION..."
    git tag -a "$NEW_VERSION" -m "Release $NEW_VERSION"
    
    print_status "Pushing commits and tag to origin..."
    git push origin "$DEFAULT_BRANCH"
    git push origin "$NEW_VERSION"
    
    # Build and push Docker images
    build_and_push_images "$NEW_VERSION"
    
    # Create GitHub release (changelog was already generated)
    create_github_release "$NEW_VERSION" "$CHANGELOG"
    
    # Update compose files for post-release
    update_compose_files_post_release "$NEW_VERSION"
    
    # Only commit if there are changes (docker-compose.dev.yml)
    if [[ -n $(git status --porcelain docker-compose*.yml) ]]; then
        git add docker-compose*.yml
        git commit -m "chore: update docker-compose.dev.yml to use latest for development"
        git push origin "$DEFAULT_BRANCH"
    fi
    
    # Success message
    echo ""
    print_success "Release $NEW_VERSION published successfully! 🎉"
    echo ""
    echo "Summary:"
    echo "  • Version: $NEW_VERSION"
    echo "  • Docker Images: ${REGISTRY}/${NAMESPACE}/printfarmhq:*-${NEW_VERSION}"
    echo "  • GitHub Release: https://github.com/${NAMESPACE}/printfarmhq/releases/tag/${NEW_VERSION}"
    echo ""
    echo "Users can now run:"
    echo "  make up                    # Uses the released version ${NEW_VERSION}"
    echo "  VERSION=latest make up     # Uses local development version"
    echo "  make dev                   # Development mode with hot reload"
    echo ""
    
    # Disable trap on successful completion
    trap - ERR
}

# Run main function
main "$@"