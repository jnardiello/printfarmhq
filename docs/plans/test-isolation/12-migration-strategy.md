# Task 12: Migration Strategy

## Context Description
We need to migrate the existing test suite to use the new isolation infrastructure without:
- Breaking existing tests
- Disrupting development
- Losing test coverage
- Creating confusion

## Objective
Provide a phased migration approach that:
1. Maintains backwards compatibility
2. Allows incremental adoption
3. Provides clear migration paths
4. Ensures no test regressions
5. Completes within reasonable timeframe

## Migration Phases

### Phase 1: Foundation Setup (Week 1)
**Goal**: Install infrastructure without breaking existing tests

#### Tasks:
1. **Add New Dependencies**
```bash
# Backend
cd backend
pip install factory-boy==3.3.0 faker==19.12.0 pytest-xdist==3.3.1

# Frontend  
cd frontend
npm install --save-dev @faker-js/faker
```

2. **Create Parallel Configuration Files**
```python
# backend/tests/conftest_isolated.py (NEW)
# New isolated fixtures alongside existing ones

# backend/tests/conftest.py (EXISTING)
# Keep existing fixtures unchanged
```

3. **Add Feature Flags**
```python
# backend/tests/conftest.py
import os

USE_ISOLATED_TESTS = os.environ.get('USE_ISOLATED_TESTS', 'false') == 'true'

if USE_ISOLATED_TESTS:
    from .conftest_isolated import *
else:
    # Use existing fixtures
    pass
```

4. **Verification**
```bash
# Existing tests should still pass
pytest

# New infrastructure available with flag
USE_ISOLATED_TESTS=true pytest tests/test_isolated_example.py
```

### Phase 2: Create New Test Patterns (Week 2)
**Goal**: Establish patterns for new tests

#### 1. Create Example Tests
```python
# backend/tests/examples/test_isolated_pattern.py
"""Example of isolated test pattern - DO NOT DELETE"""

from tests.builders import FilamentBuilder
from tests.fixtures.isolated import isolated_db_session, api_client

def test_isolated_example(isolated_db_session, api_client):
    """Example: Creating filament with isolated fixtures"""
    # Build test data
    filament = FilamentBuilder()\
        .with_material("PLA")\
        .with_inventory(1000)\
        .build(isolated_db_session)
    
    # Test API
    response = api_client.get(f'/api/filaments/{filament.id}')
    assert response.status_code == 200
```

#### 2. Create Migration Guide
```markdown
# Test Migration Guide

## For New Tests
Always use isolated fixtures:
- Use `isolated_db_session` instead of `db_session`
- Use builders instead of raw model creation
- Use `api_client` instead of raw `client`

## For Existing Tests
See migration examples in `tests/examples/`
```

#### 3. Update CI for Both Patterns
```yaml
# .github/workflows/test.yml
- name: Run existing tests
  run: pytest
  
- name: Run isolated tests
  run: USE_ISOLATED_TESTS=true pytest tests/isolated/
```

### Phase 3: Incremental Migration (Weeks 3-4)
**Goal**: Migrate tests file by file

#### Migration Order (Least to Most Complex):
1. **Unit Tests** (Low risk)
   - `test_models.py`
   - `test_utils.py`
   - `test_calculations.py`

2. **API Tests** (Medium risk)
   - `test_auth_api.py`
   - `test_filament_api.py`
   - `test_product_api.py`

3. **Integration Tests** (High risk)
   - `test_workflows.py`
   - `test_complex_scenarios.py`

#### Migration Process Per File:
```bash
# 1. Copy file to isolated version
cp tests/test_filaments.py tests/test_filaments_isolated.py

# 2. Update imports and fixtures
sed -i 's/db_session/isolated_db_session/g' tests/test_filaments_isolated.py

# 3. Run both versions
pytest tests/test_filaments.py  # Original
USE_ISOLATED_TESTS=true pytest tests/test_filaments_isolated.py  # New

# 4. When stable, replace original
mv tests/test_filaments_isolated.py tests/test_filaments.py
```

#### Migration Checklist Per File:
- [ ] Create isolated version
- [ ] Update fixtures
- [ ] Replace model creation with builders
- [ ] Add transaction isolation
- [ ] Verify same test coverage
- [ ] Run in CI for 3 days
- [ ] Replace original file
- [ ] Update imports in other files

### Phase 4: Frontend Migration (Week 5)
**Goal**: Migrate frontend tests to isolation

#### 1. Add Cleanup Fixtures
```typescript
// frontend/e2e/fixtures/cleanup.ts
export const test = base.extend({
  autoCleanup: [async ({ page }, use) => {
    // Setup remains the same
    await use(page)
    
    // Add cleanup after each test
    await resetDatabase(page)
  }, { auto: true }]
})
```

#### 2. Migrate Test by Test
```typescript
// OLD
import { test } from '@playwright/test'

// NEW  
import { test } from '../fixtures/cleanup'
```

#### 3. Update Page Objects
```typescript
// Add to existing page objects
export class FilamentsPage extends BasePage {
  // Existing methods...
  
  async waitForCleanState(): Promise<void> {
    await this.page.waitForLoadState('networkidle')
    // Additional state verification
  }
}
```

### Phase 5: Parallel Execution (Week 6)
**Goal**: Enable parallel test execution

#### 1. Mark Test Dependencies
```python
# backend/tests/test_filaments.py
import pytest

@pytest.mark.no_parallel  # Tests that can't run in parallel
def test_modifies_global_state():
    pass

@pytest.mark.parallel_safe  # Explicitly safe for parallel
def test_isolated_operation():
    pass
```

#### 2. Configure Parallel Groups
```ini
# backend/pytest.ini
[pytest]
markers =
    parallel_safe: Test is safe for parallel execution
    no_parallel: Test must run sequentially
    
[pytest:parallel]
groups = 
    safe = parallel_safe
    sequential = no_parallel
```

#### 3. Update CI for Parallel
```yaml
- name: Run parallel tests
  run: pytest -n auto -m parallel_safe

- name: Run sequential tests  
  run: pytest -m no_parallel
```

### Phase 6: Cleanup and Documentation (Week 7)
**Goal**: Remove old patterns and finalize

#### 1. Remove Old Fixtures
```python
# backend/tests/conftest.py
# Remove after all tests migrated:
# - Old db_session fixture
# - Old client fixtures
# - Session-scoped fixtures
```

#### 2. Update Documentation
- Update README with new test patterns
- Create troubleshooting guide
- Document performance improvements
- Archive migration guide

#### 3. Final Verification
```bash
# Run full test suite multiple times
for i in {1..10}; do
  pytest -n auto --random-order
done
```

## Migration Tooling

### 1. Migration Status Tracker
```python
#!/usr/bin/env python3
# scripts/track_migration.py

import ast
import sys
from pathlib import Path

class TestMigrationChecker(ast.NodeVisitor):
    def __init__(self):
        self.uses_old_fixtures = False
        self.uses_new_fixtures = False
        self.old_patterns = [
            'db_session', 'client', 'test_db'
        ]
        self.new_patterns = [
            'isolated_db_session', 'api_client', 'factory'
        ]
    
    def visit_FunctionDef(self, node):
        # Check function arguments
        for arg in node.args.args:
            if arg.arg in self.old_patterns:
                self.uses_old_fixtures = True
            if arg.arg in self.new_patterns:
                self.uses_new_fixtures = True
        self.generic_visit(node)

def check_test_file(filepath):
    with open(filepath, 'r') as f:
        tree = ast.parse(f.read())
    
    checker = TestMigrationChecker()
    checker.visit(tree)
    
    if checker.uses_new_fixtures and not checker.uses_old_fixtures:
        return 'migrated'
    elif checker.uses_old_fixtures and not checker.uses_new_fixtures:
        return 'not_migrated'
    elif checker.uses_old_fixtures and checker.uses_new_fixtures:
        return 'partial'
    else:
        return 'unknown'

# Generate report
test_files = Path('backend/tests').glob('test_*.py')
stats = {'migrated': 0, 'not_migrated': 0, 'partial': 0, 'unknown': 0}

for test_file in test_files:
    status = check_test_file(test_file)
    stats[status] += 1
    print(f"{test_file.name}: {status}")

print(f"\nMigration Status:")
print(f"✅ Migrated: {stats['migrated']}")
print(f"❌ Not Migrated: {stats['not_migrated']}")  
print(f"⚠️  Partial: {stats['partial']}")
print(f"❓ Unknown: {stats['unknown']}")
```

### 2. Automated Migration Helper
```python
#!/usr/bin/env python3
# scripts/migrate_test_file.py

import re
import sys
from pathlib import Path

def migrate_test_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Replace fixtures
    replacements = [
        (r'\bdb_session\b', 'isolated_db_session'),
        (r'\bclient\b', 'api_client'),
        (r'from tests.conftest import', 'from tests.fixtures.isolated import'),
    ]
    
    for old, new in replacements:
        content = re.sub(old, new, content)
    
    # Add builder imports if needed
    if 'Factory' not in content and 'Builder' not in content:
        import_line = 'from tests.builders import *\n'
        content = import_line + content
    
    # Write to new file
    new_path = filepath.parent / f"{filepath.stem}_migrated.py"
    with open(new_path, 'w') as f:
        f.write(content)
    
    print(f"Migrated: {filepath} -> {new_path}")
    print("Please review and test the migrated file")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python migrate_test_file.py <test_file>")
        sys.exit(1)
    
    migrate_test_file(Path(sys.argv[1]))
```

## Rollback Strategy

### If Migration Causes Issues:
1. **Immediate Rollback**
```bash
# Revert to using old fixtures
unset USE_ISOLATED_TESTS
git checkout main -- tests/conftest.py
```

2. **Partial Rollback**
```python
# In specific test files
def test_something(request):
    # Use old fixture for this test only
    if hasattr(request, 'old_db_session'):
        db = request.old_db_session
    else:
        db = request.isolated_db_session
```

3. **Feature Flag Override**
```python
# Force old behavior for specific tests
@pytest.mark.use_legacy_fixtures
def test_legacy_behavior(legacy_db_session):
    pass
```

## Success Criteria

### Week-by-Week Metrics:
- **Week 1**: All existing tests pass with new deps
- **Week 2**: 5+ example isolated tests created
- **Week 3-4**: 50% of tests migrated
- **Week 5**: All frontend tests migrated
- **Week 6**: Parallel execution working
- **Week 7**: Old fixtures removed

### Final Success Metrics:
- [ ] 100% of tests using isolated fixtures
- [ ] Test execution time reduced by 50%
- [ ] Zero flaky tests
- [ ] All tests pass in random order
- [ ] Parallel execution working
- [ ] Documentation updated

## Communication Plan

### Weekly Updates:
```markdown
## Test Migration Status - Week X

### Progress
- Migrated: X/Y test files
- Running in parallel: X tests
- Time saved: X minutes

### This Week
- Migrating: [list of files]
- Blockers: [any issues]

### Next Week
- Planning to migrate: [files]
- Need help with: [areas]
```

### Team Training:
1. **Week 1**: Introduction session on new patterns
2. **Week 2**: Hands-on workshop with examples
3. **Week 3**: Code review focus on tests
4. **Week 4**: Q&A and troubleshooting
5. **Week 5**: Advanced patterns workshop
6. **Week 6**: Performance optimization tips
7. **Week 7**: Retrospective and lessons learned

## Risk Mitigation

### Identified Risks:
1. **Test Failures During Migration**
   - Mitigation: Run both old and new versions
   - Rollback: Keep old fixtures available

2. **Developer Confusion**
   - Mitigation: Clear examples and documentation
   - Support: Dedicated Slack channel for questions

3. **CI/CD Disruption**
   - Mitigation: Separate CI jobs during migration
   - Monitoring: Track test execution times

4. **Hidden Dependencies**
   - Detection: Run with `--random-order`
   - Fix: Add explicit test dependencies

## Conclusion

This migration strategy provides a safe, incremental path to fully isolated tests. By maintaining backwards compatibility and providing clear migration paths, we can achieve the benefits of test isolation without disrupting development.

The key to success is:
- Clear communication
- Incremental progress
- Continuous verification
- Quick rollback options
- Team involvement

With this approach, we'll have a modern, fast, and reliable test suite within 7 weeks.