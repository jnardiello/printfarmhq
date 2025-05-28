#!/bin/bash

# Test version of publish script that automatically fills in changelog
export EDITOR=true  # Use 'true' as editor (does nothing, just exits)

# Simulate user input: choice "2" (minor), then "y" to confirm
echo -e "2\ny" | ./scripts/publish.sh

# Then manually add content to the changelog after it's created
if [ -f "CHANGELOG.md" ]; then
    # Find the latest version entry and add content
    sed -i '' '/^## v[0-9]/a\
- Complete 3D printing management platform\
- User authentication and management\
- Printer, filament, and print job tracking\
- Cost calculation and analytics\
' CHANGELOG.md
    
    # Commit the updated changelog
    git add CHANGELOG.md
    git commit -m "Add release notes to CHANGELOG"
fi