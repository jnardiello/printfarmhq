# Publishing Releases

This document describes the enhanced release publishing process for PrintFarmHQ.

## Overview

The enhanced publish process automates the complete release workflow:

1. **Pre-flight Checks**: Ensures clean working directory and proper branch
2. **Version Bump**: Updates docker-compose files with new version
3. **Git Operations**: Creates tags and pushes to repository
4. **Docker Images**: Builds and pushes versioned images
5. **GitHub Release**: Creates release with auto-generated changelog
6. **Cleanup**: Reverts compose files to use 'latest' for development

## Usage

### Interactive Release (Recommended)
```bash
make publish
# or
./scripts/publish.sh
```
This will prompt you to select the version bump type (patch/minor/major).

### Major/Minor Releases
```bash
make publish-major    # 1.0.0 -> 2.0.0
make publish-minor    # 1.0.0 -> 1.1.0
make publish-patch    # 1.0.0 -> 1.0.1
```

### Dry Run (Test Without Changes)
```bash
make publish-dry-run
# or
./scripts/publish.sh --dry-run
```

### Help
```bash
make publish-help
# or
./scripts/publish.sh --help
```

## Process Details

### 1. Pre-flight Checks

The script performs these checks before proceeding:

- ✅ Working directory is clean (no uncommitted changes)
- ✅ On the correct branch (main/master)
- ✅ Latest changes pulled from origin
- ✅ Required tools available (git, docker, gh CLI)
- ✅ GitHub CLI authenticated
- ✅ Tests pass (if `make test-ci` target exists)

### 2. Version Management

Version numbers follow [Semantic Versioning](https://semver.org/):

- **Major**: Breaking changes (X.0.0)
- **Minor**: New features, backwards compatible (x.Y.0)
- **Patch**: Bug fixes, backwards compatible (x.y.Z)

### 3. Docker Compose Update

During release, the script:

1. Updates `docker-compose.yml` and `docker-compose.dev.yml` to use the new version
2. Commits this change with the version bump
3. After successful release, reverts files to use `latest` for development

This ensures users can run `VERSION=v1.2.3 make up` to use a specific release.

### 4. Docker Images

Images are built and tagged as:
- `ghcr.io/jnardiello/printfarmhq:backend-v1.2.3`
- `ghcr.io/jnardiello/printfarmhq:frontend-v1.2.3`
- `ghcr.io/jnardiello/printfarmhq:backend-latest` (updated)
- `ghcr.io/jnardiello/printfarmhq:frontend-latest` (updated)

### 5. GitHub Release

Automatically creates a GitHub release with:
- Auto-generated changelog from commit messages
- Release marked as "latest"
- Proper version tag

## Environment Variables

You can customize the process with these environment variables:

```bash
export REGISTRY=ghcr.io              # Docker registry
export NAMESPACE=your-username       # Registry namespace
export DEFAULT_BRANCH=main          # Default branch name
export DRY_RUN=true                 # Dry run mode
```

## Error Handling and Rollback

If any step fails, the script automatically:

1. Deletes the created git tag (local and remote)
2. Resets the commit that updated docker-compose files
3. Deletes the GitHub release if it was created
4. Force-pushes the reset state to origin

## User Experience

After a successful release, users can:

### Use Latest Version
```bash
make up  # Uses latest images
```

### Use Specific Version
```bash
VERSION=v1.2.3 make up  # Uses specific release
```

### Check Available Versions
```bash
gh release list
# or visit: https://github.com/jnardiello/printfarmhq/releases
```

## Troubleshooting

### Common Issues

1. **"GitHub CLI not authenticated"**
   ```bash
   gh auth login
   ```

2. **"Working directory not clean"**
   ```bash
   git status
   git add . && git commit -m "commit message"
   # or
   git stash
   ```

3. **"Must be on main branch"**
   ```bash
   git checkout main
   git pull origin main
   ```

4. **Docker push fails**
   - Ensure you're logged into the registry:
   ```bash
   docker login ghcr.io
   ```

### Recovery from Failed Release

If a release fails and rollback doesn't work properly:

1. Check git tags: `git tag -l`
2. Delete problematic tag: `git tag -d v1.2.3 && git push origin :refs/tags/v1.2.3`
3. Reset to known good state: `git reset --hard HEAD~1`
4. Force push if needed: `git push --force-with-lease origin main`

## Development Workflow

### Before Release
1. Ensure all features are merged to main
2. Update CHANGELOG.md if manually maintained
3. Run tests: `make test`
4. Test dry run: `make publish-dry-run`

### During Release
1. Run release command: `make publish-minor`
2. Confirm when prompted
3. Wait for completion
4. Verify release at GitHub

### After Release
1. Announce release to team
2. Update documentation if needed
3. Monitor for issues

## Best Practices

1. **Test First**: Always run `make publish-dry-run` before real release
2. **Clean State**: Ensure working directory is clean
3. **Review Changes**: Check what commits will be included
4. **Semantic Versioning**: Choose appropriate version bump type
5. **Monitor**: Watch the process and verify each step succeeds

## Integration with CI/CD

The publish script can be integrated with CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Publish Release
  if: github.ref == 'refs/heads/main'
  run: |
    gh auth login --with-token <<< "${{ secrets.GITHUB_TOKEN }}"
    ./scripts/publish.sh minor
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Security Considerations

- GitHub token has appropriate permissions for releases
- Docker registry credentials are properly configured
- Script runs in trusted environment only
- No secrets are logged or exposed