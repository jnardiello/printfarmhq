# Task 10: CI Parallel Execution

## Context Description
Current CI test execution is sequential and slow:
- All tests run in a single job
- No parallelization across test types
- Long feedback cycles
- Resource underutilization
- No test result aggregation

## Desired Solution
Implement parallel test execution in CI that:
1. Runs different test suites concurrently
2. Distributes tests across multiple runners
3. Aggregates results effectively
4. Provides fast feedback
5. Optimizes resource usage

## Implementation Steps

### Step 1: GitHub Actions Parallel Strategy
```yaml
# .github/workflows/test-parallel.yml
name: Parallel Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  NAMESPACE: ${{ github.repository_owner }}

jobs:
  # Build test images once
  build-test-images:
    runs-on: ubuntu-latest
    outputs:
      backend-image: ${{ steps.image.outputs.backend }}
      frontend-image: ${{ steps.image.outputs.frontend }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push backend test image
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          file: ./backend/Dockerfile.test
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.NAMESPACE }}/printfarmhq:backend-test-${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Build and push frontend test image
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          file: ./frontend/Dockerfile.test
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.NAMESPACE }}/printfarmhq:frontend-test-${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - id: image
        run: |
          echo "backend=${{ env.REGISTRY }}/${{ env.NAMESPACE }}/printfarmhq:backend-test-${{ github.sha }}" >> $GITHUB_OUTPUT
          echo "frontend=${{ env.REGISTRY }}/${{ env.NAMESPACE }}/printfarmhq:frontend-test-${{ github.sha }}" >> $GITHUB_OUTPUT

  # Backend test matrix
  backend-tests:
    needs: build-test-images
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-suite:
          - name: unit
            pattern: "tests/test_unit"
          - name: integration
            pattern: "tests/test_integration"
          - name: api
            pattern: "tests/test_api"
          - name: models
            pattern: "tests/test_models"
      fail-fast: false
    
    name: Backend ${{ matrix.test-suite.name }} tests
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Run ${{ matrix.test-suite.name }} tests
        run: |
          docker run --rm \
            -v ${{ github.workspace }}/backend:/app \
            -e TEST_SUITE=${{ matrix.test-suite.name }} \
            ${{ needs.build-test-images.outputs.backend-image }} \
            pytest -v ${{ matrix.test-suite.pattern }} \
            --junitxml=test-results-${{ matrix.test-suite.name }}.xml
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: backend-test-results-${{ matrix.test-suite.name }}
          path: backend/test-results-*.xml

  # Frontend test sharding
  frontend-tests:
    needs: build-test-images
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
      fail-fast: false
    
    name: Frontend tests (shard ${{ matrix.shard }}/4)
    
    services:
      backend:
        image: ${{ needs.build-test-images.outputs.backend-image }}
        options: --health-cmd "curl -f http://localhost:8000/health" --health-interval 5s
        ports:
          - 8000:8000
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Run frontend tests shard ${{ matrix.shard }}
        run: |
          docker run --rm \
            --network host \
            -e API_URL=http://localhost:8000 \
            -v ${{ github.workspace }}/frontend:/app \
            ${{ needs.build-test-images.outputs.frontend-image }} \
            npx playwright test --shard=${{ matrix.shard }}/4 \
            --reporter=junit --reporter=html
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: frontend-test-results-shard-${{ matrix.shard }}
          path: |
            frontend/test-results/
            frontend/playwright-report/

  # Aggregate results
  test-results:
    needs: [backend-tests, frontend-tests]
    runs-on: ubuntu-latest
    if: always()
    
    steps:
      - name: Download all test results
        uses: actions/download-artifact@v4
        with:
          path: test-results
      
      - name: Merge test results
        run: |
          npm install -g junit-report-merger
          junit-report-merger --out merged-results.xml test-results/**/*.xml
      
      - name: Publish test results
        uses: dorny/test-reporter@v1
        if: always()
        with:
          name: Test Results
          path: merged-results.xml
          reporter: java-junit
          fail-on-error: true
```

### Step 2: GitLab CI Parallel Configuration
```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - report

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: ""
  TEST_IMAGE_TAG: $CI_COMMIT_SHA

# Build stage
build:test-images:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE/backend-test:$TEST_IMAGE_TAG -f backend/Dockerfile.test backend/
    - docker build -t $CI_REGISTRY_IMAGE/frontend-test:$TEST_IMAGE_TAG -f frontend/Dockerfile.test frontend/
    - docker push $CI_REGISTRY_IMAGE/backend-test:$TEST_IMAGE_TAG
    - docker push $CI_REGISTRY_IMAGE/frontend-test:$TEST_IMAGE_TAG

# Backend parallel tests
test:backend:
  stage: test
  image: $CI_REGISTRY_IMAGE/backend-test:$TEST_IMAGE_TAG
  parallel:
    matrix:
      - TEST_SUITE: [unit, integration, api, models]
  script:
    - |
      case $TEST_SUITE in
        unit) PATTERN="tests/test_unit" ;;
        integration) PATTERN="tests/test_integration" ;;
        api) PATTERN="tests/test_api" ;;
        models) PATTERN="tests/test_models" ;;
      esac
    - pytest -v $PATTERN --junitxml=report-$TEST_SUITE.xml
  artifacts:
    when: always
    reports:
      junit: report-*.xml
    expire_in: 1 week

# Frontend parallel tests
test:frontend:
  stage: test
  image: $CI_REGISTRY_IMAGE/frontend-test:$TEST_IMAGE_TAG
  services:
    - name: $CI_REGISTRY_IMAGE/backend-test:$TEST_IMAGE_TAG
      alias: backend
      command: ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0"]
  parallel: 4
  script:
    - export SHARD=$((CI_NODE_INDEX + 1))
    - npx playwright test --shard=$SHARD/$CI_NODE_TOTAL --reporter=junit
  artifacts:
    when: always
    reports:
      junit: test-results/junit.xml
    paths:
      - playwright-report/
    expire_in: 1 week

# Aggregate results
test:report:
  stage: report
  image: node:18
  dependencies:
    - test:backend
    - test:frontend
  script:
    - npm install -g junit-report-merger
    - junit-report-merger --out final-results.xml **/*.xml
    - echo "Total test results:"
    - cat final-results.xml | grep -E "tests|failures|errors" | head -1
  artifacts:
    reports:
      junit: final-results.xml
```

### Step 3: Test Distribution Strategy
```python
# backend/tests/conftest_parallel.py
import pytest
import hashlib
from pathlib import Path

def pytest_collection_modifyitems(session, config, items):
    """Distribute tests across workers intelligently"""
    
    # Get worker info from environment
    worker_id = config.getoption("--worker-id", default="master")
    total_workers = config.getoption("--total-workers", default=1)
    
    if worker_id == "master" or total_workers == 1:
        return
    
    # Distribute tests based on file hash for consistency
    selected_items = []
    
    for item in items:
        # Hash the test file path
        test_file = str(Path(item.fspath).relative_to(session.config.rootdir))
        file_hash = int(hashlib.md5(test_file.encode()).hexdigest(), 16)
        
        # Assign to worker based on hash
        if (file_hash % total_workers) == (int(worker_id) - 1):
            selected_items.append(item)
    
    # Update items to run only selected tests
    items[:] = selected_items
    
    print(f"Worker {worker_id} will run {len(selected_items)} of {len(items)} tests")

def pytest_configure(config):
    """Configure pytest for parallel execution"""
    
    # Add custom markers
    config.addinivalue_line("markers", "slow: marks tests as slow")
    config.addinivalue_line("markers", "integration: marks tests as integration tests")
    config.addinivalue_line("markers", "unit: marks tests as unit tests")
    
    # Configure based on environment
    if config.getoption("--parallel", default=False):
        config.option.numprocesses = "auto"
        config.option.dist = "loadscope"
```

### Step 4: Dynamic Test Splitting
```typescript
// frontend/e2e/test-splitter.ts
import { createHash } from 'crypto'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'

interface TestFile {
  path: string
  size: number
  hash: string
}

export class TestSplitter {
  /**
   * Split test files across shards for balanced execution
   */
  static splitTests(
    testDir: string,
    currentShard: number,
    totalShards: number
  ): string[] {
    const testFiles = this.getTestFiles(testDir)
    
    // Sort by size for better distribution
    testFiles.sort((a, b) => b.size - a.size)
    
    // Distribute using round-robin with size consideration
    const shards: TestFile[][] = Array(totalShards).fill(null).map(() => [])
    const shardSizes: number[] = Array(totalShards).fill(0)
    
    for (const file of testFiles) {
      // Find shard with least total size
      const minSizeIndex = shardSizes.indexOf(Math.min(...shardSizes))
      shards[minSizeIndex].push(file)
      shardSizes[minSizeIndex] += file.size
    }
    
    // Return files for current shard
    return shards[currentShard - 1].map(f => f.path)
  }

  private static getTestFiles(dir: string, files: TestFile[] = []): TestFile[] {
    const entries = readdirSync(dir)
    
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      
      if (stat.isDirectory()) {
        this.getTestFiles(fullPath, files)
      } else if (entry.endsWith('.spec.ts')) {
        files.push({
          path: fullPath,
          size: stat.size,
          hash: createHash('md5').update(fullPath).digest('hex')
        })
      }
    }
    
    return files
  }

  /**
   * Generate test configuration for current shard
   */
  static generateConfig(shard: number, total: number): string {
    const files = this.splitTests('./e2e/tests', shard, total)
    
    return `
export default {
  testMatch: [
    ${files.map(f => `'${f}'`).join(',\n    ')}
  ]
}
    `.trim()
  }
}

// Usage in playwright config
const shard = parseInt(process.env.SHARD || '1')
const totalShards = parseInt(process.env.TOTAL_SHARDS || '1')

if (totalShards > 1) {
  // Dynamic test selection
  const testFiles = TestSplitter.splitTests('./e2e/tests', shard, totalShards)
  config.testMatch = testFiles
}
```

### Step 5: Parallel Execution Monitoring
```bash
#!/bin/bash
# scripts/monitor-parallel-tests.sh

# Real-time test monitoring for parallel execution

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Track test progress
declare -A TEST_STATUS
declare -A TEST_START_TIME
TOTAL_WORKERS=$1
COMPLETED=0

# Monitor function for each worker
monitor_worker() {
    local worker_id=$1
    local log_file="test-worker-${worker_id}.log"
    
    echo -e "${BLUE}[Worker ${worker_id}]${NC} Starting..."
    TEST_STATUS[$worker_id]="running"
    TEST_START_TIME[$worker_id]=$(date +%s)
    
    # Run tests and capture output
    docker run --rm \
        -e WORKER_ID=${worker_id} \
        -e TOTAL_WORKERS=${TOTAL_WORKERS} \
        printfarmhq:backend-test \
        pytest -v --tb=short \
        > "${log_file}" 2>&1
    
    local exit_code=$?
    local end_time=$(date +%s)
    local duration=$((end_time - ${TEST_START_TIME[$worker_id]}))
    
    if [ $exit_code -eq 0 ]; then
        TEST_STATUS[$worker_id]="passed"
        echo -e "${GREEN}[Worker ${worker_id}]${NC} Completed in ${duration}s ✓"
    else
        TEST_STATUS[$worker_id]="failed"
        echo -e "${RED}[Worker ${worker_id}]${NC} Failed after ${duration}s ✗"
        echo -e "${RED}Last 20 lines of output:${NC}"
        tail -20 "${log_file}"
    fi
    
    ((COMPLETED++))
}

# Start all workers
echo -e "${YELLOW}Starting ${TOTAL_WORKERS} parallel test workers...${NC}"

for ((i=1; i<=TOTAL_WORKERS; i++)); do
    monitor_worker $i &
done

# Wait and show progress
while [ $COMPLETED -lt $TOTAL_WORKERS ]; do
    sleep 2
    echo -ne "\r${YELLOW}Progress:${NC} ${COMPLETED}/${TOTAL_WORKERS} workers completed"
done

echo ""
echo -e "${YELLOW}All workers completed. Summary:${NC}"

# Show summary
PASSED=0
FAILED=0

for ((i=1; i<=TOTAL_WORKERS; i++)); do
    if [ "${TEST_STATUS[$i]}" == "passed" ]; then
        ((PASSED++))
    else
        ((FAILED++))
    fi
    
    duration=$(($(date +%s) - ${TEST_START_TIME[$i]}))
    echo -e "Worker $i: ${TEST_STATUS[$i]} (${duration}s)"
done

echo -e "${GREEN}Passed: ${PASSED}${NC}, ${RED}Failed: ${FAILED}${NC}"

# Exit with error if any failed
[ $FAILED -eq 0 ] || exit 1
```

### Step 6: Result Aggregation
```python
# scripts/aggregate_test_results.py
#!/usr/bin/env python3
"""Aggregate test results from parallel execution"""

import json
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Dict, Any
import sys

class TestResultAggregator:
    def __init__(self):
        self.total_tests = 0
        self.total_failures = 0
        self.total_errors = 0
        self.total_skipped = 0
        self.total_time = 0.0
        self.test_suites = []
    
    def add_junit_file(self, file_path: Path):
        """Parse and add JUnit XML results"""
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        # Handle both testsuite and testsuites root
        if root.tag == 'testsuites':
            suites = root.findall('testsuite')
        else:
            suites = [root]
        
        for suite in suites:
            self.total_tests += int(suite.get('tests', 0))
            self.total_failures += int(suite.get('failures', 0))
            self.total_errors += int(suite.get('errors', 0))
            self.total_skipped += int(suite.get('skipped', 0))
            self.total_time += float(suite.get('time', 0))
            
            self.test_suites.append({
                'name': suite.get('name'),
                'tests': int(suite.get('tests', 0)),
                'failures': int(suite.get('failures', 0)),
                'errors': int(suite.get('errors', 0)),
                'time': float(suite.get('time', 0))
            })
    
    def generate_summary(self) -> Dict[str, Any]:
        """Generate summary report"""
        return {
            'total_tests': self.total_tests,
            'total_failures': self.total_failures,
            'total_errors': self.total_errors,
            'total_skipped': self.total_skipped,
            'total_time': round(self.total_time, 2),
            'success_rate': round(
                (self.total_tests - self.total_failures - self.total_errors) / 
                self.total_tests * 100, 2
            ) if self.total_tests > 0 else 0,
            'test_suites': self.test_suites
        }
    
    def generate_markdown_report(self) -> str:
        """Generate markdown report for GitHub/GitLab"""
        summary = self.generate_summary()
        
        report = f"""# Test Results Summary

## Overall Statistics
- **Total Tests**: {summary['total_tests']}
- **Passed**: {summary['total_tests'] - summary['total_failures'] - summary['total_errors']}
- **Failed**: {summary['total_failures']}
- **Errors**: {summary['total_errors']}
- **Skipped**: {summary['total_skipped']}
- **Success Rate**: {summary['success_rate']}%
- **Total Time**: {summary['total_time']}s

## Test Suites
| Suite | Tests | Failures | Errors | Time |
|-------|-------|----------|--------|------|
"""
        
        for suite in summary['test_suites']:
            report += f"| {suite['name']} | {suite['tests']} | {suite['failures']} | {suite['errors']} | {suite['time']:.2f}s |\n"
        
        return report

def main():
    aggregator = TestResultAggregator()
    
    # Find all JUnit XML files
    for xml_file in Path('.').rglob('*junit*.xml'):
        print(f"Processing {xml_file}")
        aggregator.add_junit_file(xml_file)
    
    # Generate reports
    summary = aggregator.generate_summary()
    print(json.dumps(summary, indent=2))
    
    # Write markdown report
    with open('test-summary.md', 'w') as f:
        f.write(aggregator.generate_markdown_report())
    
    # Exit with error if tests failed
    if summary['total_failures'] > 0 or summary['total_errors'] > 0:
        sys.exit(1)

if __name__ == '__main__':
    main()
```

## Guidelines for Implementation

### DO:
1. **Use matrix strategies** for test parallelization
2. **Build images once** and reuse across jobs
3. **Aggregate results** for unified reporting
4. **Balance test distribution** across workers
5. **Cache dependencies** aggressively

### DON'T:
1. **Don't hardcode shard counts** - make configurable
2. **Don't ignore flaky tests** in parallel
3. **Don't share state** between parallel jobs
4. **Don't forget timeouts** for hung tests
5. **Don't skip result aggregation**

### Performance Tips
- Use `fail-fast: false` to run all tests
- Implement smart test selection
- Cache Docker layers effectively
- Use artifact passing between jobs
- Monitor resource usage

### Success Metrics
- 70% reduction in test execution time
- All tests pass in parallel execution
- Clear aggregated test reports
- Efficient resource utilization
- Fast feedback on failures