#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
    
    # Check if working directory is clean
    if [[ -n $(git status --porcelain) ]]; then
        print_error "Working directory is not clean. Please commit or stash your changes."
        git status --short
        exit 1
    fi
    
    # Check if we're on the main branch
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$current_branch" != "main" && "$current_branch" != "master" ]]; then
        print_error "Not on main/master branch. Current branch: $current_branch"
        exit 1
    fi
    
    # Pull latest changes
    print_status "Pulling latest changes from origin..."
    git pull origin "$current_branch"
    
    print_success "Pre-flight checks passed"
}

# Interactive version selection
select_version_increment() {
    local current_version=$(get_current_version)
    
    echo ""
    print_status "Current version: $current_version"
    echo ""
    echo "Select release type:"
    echo "  1) patch - Bug fixes and small improvements"
    echo "  2) minor - New features, backwards compatible"
    echo "  3) major - Breaking changes"
    echo ""
    
    while true; do
        read -p "Enter choice [1-3]: " choice
        case "$choice" in
            1)
                SELECTED_INCREMENT="patch"
                return
                ;;
            2)
                SELECTED_INCREMENT="minor"
                return
                ;;
            3)
                SELECTED_INCREMENT="major"
                return
                ;;
            *)
                print_warning "Invalid choice. Please enter 1, 2, or 3."
                ;;
        esac
    done
}

# Update CHANGELOG
update_changelog() {
    local new_version=$1
    local changelog_file="CHANGELOG.md"
    local date=$(date +%Y-%m-%d)
    
    print_status "Updating CHANGELOG.md..."
    
    # Create CHANGELOG.md if it doesn't exist
    if [[ ! -f "$changelog_file" ]]; then
        echo "# Changelog" > "$changelog_file"
        echo "" >> "$changelog_file"
        echo "All notable changes to this project will be documented in this file." >> "$changelog_file"
        echo "" >> "$changelog_file"
    fi
    
    # Create temporary file for new changelog content
    local temp_file=$(mktemp)
    
    # Read existing changelog
    local found_first_version=false
    while IFS= read -r line; do
        if echo "$line" | grep -q "^## v[0-9]" && [[ "$found_first_version" == false ]]; then
            # Insert new version before the first existing version
            echo "## $new_version ($date)" >> "$temp_file"
            echo "" >> "$temp_file"
            found_first_version=true
        fi
        echo "$line" >> "$temp_file"
    done < "$changelog_file"
    
    # If no existing versions found, add the new version at the end
    if [[ "$found_first_version" == false ]]; then
        echo "## $new_version ($date)" >> "$temp_file"
        echo "" >> "$temp_file"
    fi
    
    # Add release notes
    if [[ -n "$AUTOMATED_RELEASE" ]]; then
        # For automated releases, add content from stdin or default
        echo "- Complete 3D printing management platform" >> "$temp_file"
        echo "- User authentication and management" >> "$temp_file" 
        echo "- Printer, filament, and print job tracking" >> "$temp_file"
        echo "- Cost calculation and analytics" >> "$temp_file"
        echo "" >> "$temp_file"
    fi
    
    # Replace original file
    mv "$temp_file" "$changelog_file"
    
    # Open changelog for editing (if not automated)
    if [[ -z "$AUTOMATED_RELEASE" ]]; then
        echo ""
        print_status "Please add release notes for $new_version"
        echo "The CHANGELOG.md file will open in your default editor."
        echo "Add your release notes under the $new_version section, then save and close."
        echo ""
        read -p "Press Enter to open CHANGELOG.md..."
        
        ${EDITOR:-nano} "$changelog_file"
    fi
    
    # Commit the changelog
    git add "$changelog_file"
    git commit -m "Update CHANGELOG for $new_version"
    
    print_success "CHANGELOG.md updated and committed"
}

# Create git tag and push
create_tag_and_push() {
    local new_version=$1
    
    print_status "Creating git tag and pushing..."
    
    # Create annotated tag
    git tag -a "$new_version" -m "Release $new_version"
    
    # Push commits and tags
    git push origin "$(git rev-parse --abbrev-ref HEAD)"
    git push origin "$new_version"
    
    print_success "Git tag $new_version created and pushed"
}

# Build and push Docker images
build_and_push_images() {
    local new_version=$1
    
    print_status "Building and pushing Docker images..."
    
    # Set version for Docker builds
    export VERSION="$new_version"
    
    # Authenticate to registry
    ./scripts/docker-auth.sh
    
    # Build and push multi-architecture images
    PUSH=true ./scripts/docker-build-multiarch.sh
    
    print_success "Docker images built and pushed with tag $new_version"
}

# Main function
main() {
    echo "🚀 PrintFarmHQ Release Publisher"
    echo "================================="
    echo ""
    
    # Run pre-flight checks
    pre_flight_checks
    
    # Get current version and select increment
    local current_version=$(get_current_version)
    select_version_increment
    local increment_type="$SELECTED_INCREMENT"
    local new_version
    new_version=$(calculate_new_version "$increment_type" "$current_version")
    
    echo ""
    print_status "Releasing: $current_version → $new_version"
    echo ""
    
    # Confirm before proceeding
    read -p "Continue with release? [y/N]: " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        print_warning "Release cancelled"
        exit 0
    fi
    
    # Check if tag already exists
    if git tag -l | grep -q "^$new_version$"; then
        print_error "Tag $new_version already exists"
        exit 1
    fi
    
    # Execute release steps
    update_changelog "$new_version"
    create_tag_and_push "$new_version"
    build_and_push_images "$new_version"
    
    echo ""
    print_success "🎉 Release $new_version completed successfully!"
    echo ""
    print_status "Release summary:"
    echo "  • Version: $new_version"
    echo "  • Git tag: $new_version"
    echo "  • Docker images: ghcr.io/jnardiello/printfarmhq:backend-$new_version, frontend-$new_version, etc."
    echo "  • CHANGELOG: Updated with release notes"
    echo ""
}

# Run main function
main "$@"