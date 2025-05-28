#!/bin/bash

# Extract just the version functions for testing
get_current_version() {
    local version=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    if [[ -z "$version" ]]; then
        echo "v0.0.0"
    else
        echo "$version"
    fi
}

parse_version() {
    local version=$1
    version=${version#v}
    IFS='.' read -ra PARTS <<< "$version"
    MAJOR=${PARTS[0]:-0}
    MINOR=${PARTS[1]:-0}
    PATCH=${PARTS[2]:-0}
}

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
            echo "Invalid increment type: $increment_type"
            exit 1
            ;;
    esac
    
    echo "v${MAJOR}.${MINOR}.${PATCH}"
}

# Test the functions
current=$(get_current_version)
echo "Current version: $current"
echo "New patch version: $(calculate_new_version "patch" "$current")"
echo "New minor version: $(calculate_new_version "minor" "$current")"
echo "New major version: $(calculate_new_version "major" "$current")"