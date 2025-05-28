# Task 09: Docker Test Isolation

## Context Description
Current Docker test setup has isolation issues:
- Tests share the same database container
- No automatic cleanup between test runs
- Container state persists across runs
- Difficult to run tests in parallel
- No isolation between different test types

## Desired Solution
Implement Docker-based test isolation that:
1. Creates isolated environments per test run
2. Supports parallel test execution
3. Automatically cleans up resources
4. Provides consistent initial state
5. Enables fast test execution

## Implementation Steps

### Step 1: Create Isolated Test Compose Configuration
```yaml
# docker-compose.test-isolated.yml
services:
  # Template service - not started directly
  backend-test-template:
    image: ${REGISTRY:-ghcr.io}/${NAMESPACE:-jnardiello}/printfarmhq:backend-test-${VERSION:-latest}
    build:
      context: ./backend
      dockerfile: Dockerfile.test
      args:
        REGISTRY: ${REGISTRY:-ghcr.io}
        NAMESPACE: ${NAMESPACE:-jnardiello}
        BASE_TAG: ${VERSION:-latest}
    environment:
      - DATABASE_URL=sqlite:///./test_${TEST_RUN_ID:-default}.db
      - TESTING=true
      - PYTHONPATH=/app
      - TEST_RUN_ID=${TEST_RUN_ID:-default}
    volumes:
      - test-data-${TEST_RUN_ID:-default}:/app/test-data
    networks:
      - test-network-${TEST_RUN_ID:-default}

  # Frontend test template
  frontend-test-template:
    image: ${REGISTRY:-ghcr.io}/${NAMESPACE:-jnardiello}/printfarmhq:frontend-test-${VERSION:-latest}
    build:
      context: ./frontend
      dockerfile: Dockerfile.test
      args:
        REGISTRY: ${REGISTRY:-ghcr.io}
        NAMESPACE: ${NAMESPACE:-jnardiello}
        BASE_TAG: ${VERSION:-latest}
    environment:
      - API_URL=http://backend-api-${TEST_RUN_ID:-default}:8000
      - TEST_RUN_ID=${TEST_RUN_ID:-default}
    depends_on:
      backend-api-${TEST_RUN_ID:-default}:
        condition: service_healthy
    networks:
      - test-network-${TEST_RUN_ID:-default}

networks:
  test-network-${TEST_RUN_ID:-default}:
    name: test-network-${TEST_RUN_ID:-default}

volumes:
  test-data-${TEST_RUN_ID:-default}:
    name: test-data-${TEST_RUN_ID:-default}
```

### Step 2: Test Runner Script
```bash
#!/bin/bash
# scripts/run-isolated-tests.sh

set -e

# Generate unique test run ID
TEST_RUN_ID="test-$(date +%s)-$$"
export TEST_RUN_ID

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting isolated test run: ${TEST_RUN_ID}${NC}"

# Cleanup function
cleanup() {
    echo -e "${YELLOW}Cleaning up test environment ${TEST_RUN_ID}...${NC}"
    
    # Stop and remove containers
    docker-compose -f docker-compose.test-isolated.yml \
        -p "${TEST_RUN_ID}" \
        down -v --remove-orphans 2>/dev/null || true
    
    # Remove test database files
    rm -f backend/test_${TEST_RUN_ID}.db 2>/dev/null || true
    
    # Remove test volumes
    docker volume rm "test-data-${TEST_RUN_ID}" 2>/dev/null || true
    
    # Remove test network
    docker network rm "test-network-${TEST_RUN_ID}" 2>/dev/null || true
    
    echo -e "${GREEN}Cleanup complete${NC}"
}

# Set trap to cleanup on exit
trap cleanup EXIT INT TERM

# Parse arguments
TEST_TYPE="${1:-all}"
PARALLEL="${2:-no}"

# Run tests based on type
case $TEST_TYPE in
    backend)
        echo -e "${GREEN}Running backend tests...${NC}"
        docker-compose -f docker-compose.test-isolated.yml \
            -p "${TEST_RUN_ID}" \
            run --rm \
            --name "backend-test-${TEST_RUN_ID}" \
            backend-test-template \
            pytest -v
        ;;
    
    frontend)
        echo -e "${GREEN}Running frontend tests...${NC}"
        # Start backend API for frontend tests
        docker-compose -f docker-compose.test-isolated.yml \
            -p "${TEST_RUN_ID}" \
            up -d backend-api-template
        
        # Wait for backend to be ready
        echo "Waiting for backend..."
        sleep 10
        
        # Run frontend tests
        docker-compose -f docker-compose.test-isolated.yml \
            -p "${TEST_RUN_ID}" \
            run --rm \
            --name "frontend-test-${TEST_RUN_ID}" \
            frontend-test-template \
            npm test
        ;;
    
    all)
        echo -e "${GREEN}Running all tests...${NC}"
        
        if [ "$PARALLEL" = "yes" ]; then
            # Run in parallel
            ./scripts/run-isolated-tests.sh backend &
            BACKEND_PID=$!
            
            ./scripts/run-isolated-tests.sh frontend &
            FRONTEND_PID=$!
            
            # Wait for both to complete
            wait $BACKEND_PID
            BACKEND_EXIT=$?
            
            wait $FRONTEND_PID
            FRONTEND_EXIT=$?
            
            if [ $BACKEND_EXIT -ne 0 ] || [ $FRONTEND_EXIT -ne 0 ]; then
                echo -e "${RED}Some tests failed${NC}"
                exit 1
            fi
        else
            # Run sequentially
            ./scripts/run-isolated-tests.sh backend
            ./scripts/run-isolated-tests.sh frontend
        fi
        ;;
    
    *)
        echo "Usage: $0 [backend|frontend|all] [parallel]"
        exit 1
        ;;
esac

echo -e "${GREEN}Test run ${TEST_RUN_ID} completed successfully${NC}"
```

### Step 3: Parallel Test Execution
```yaml
# docker-compose.test-parallel.yml
version: '3.8'

x-backend-test: &backend-test
  image: ${REGISTRY:-ghcr.io}/${NAMESPACE:-jnardiello}/printfarmhq:backend-test-${VERSION:-latest}
  build:
    context: ./backend
    dockerfile: Dockerfile.test
  environment:
    - TESTING=true
    - PYTHONPATH=/app
  networks:
    - test-network

services:
  # Backend test runners (can scale)
  backend-test-worker:
    <<: *backend-test
    environment:
      - TESTING=true
      - PYTHONPATH=/app
      - DATABASE_URL=sqlite:///./test_worker_${WORKER_ID:-1}.db
      - PYTEST_XDIST_WORKER=${WORKER_ID:-1}
    command: >
      pytest -v 
      --dist loadscope 
      --tx popen//python=python3
      -n ${WORKER_COUNT:-4}

  # Dedicated API instance for frontend tests
  backend-api-1:
    <<: *backend-test
    container_name: backend-api-1
    environment:
      - DATABASE_URL=sqlite:///./test_api_1.db
      - TESTING=true
    command: python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 5s
      timeout: 3s
      retries: 10

  backend-api-2:
    <<: *backend-test
    container_name: backend-api-2
    environment:
      - DATABASE_URL=sqlite:///./test_api_2.db
      - TESTING=true
    command: python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 5s
      timeout: 3s
      retries: 10

  # Frontend test runners
  frontend-test-1:
    image: ${REGISTRY:-ghcr.io}/${NAMESPACE:-jnardiello}/printfarmhq:frontend-test-${VERSION:-latest}
    environment:
      - API_URL=http://backend-api-1:8000
      - TEST_WORKER=1
    depends_on:
      backend-api-1:
        condition: service_healthy
    command: npx playwright test --shard=1/2

  frontend-test-2:
    image: ${REGISTRY:-ghcr.io}/${NAMESPACE:-jnardiello}/printfarmhq:frontend-test-${VERSION:-latest}
    environment:
      - API_URL=http://backend-api-2:8000
      - TEST_WORKER=2
    depends_on:
      backend-api-2:
        condition: service_healthy
    command: npx playwright test --shard=2/2

networks:
  test-network:
    driver: bridge
```

### Step 4: Database Isolation Strategies
```python
# backend/tests/conftest_docker.py
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import tempfile

@pytest.fixture(scope="session")
def isolated_db_url():
    """Create isolated database URL per test worker"""
    worker_id = os.environ.get('PYTEST_XDIST_WORKER', 'master')
    test_run_id = os.environ.get('TEST_RUN_ID', 'default')
    
    if os.environ.get('USE_TEMP_DB', 'false') == 'true':
        # Use temporary file for complete isolation
        temp_file = tempfile.NamedTemporaryFile(
            prefix=f'test_{test_run_id}_{worker_id}_',
            suffix='.db',
            delete=False
        )
        return f'sqlite:///{temp_file.name}'
    else:
        # Use named database per worker
        db_name = f'test_{test_run_id}_{worker_id}.db'
        return f'sqlite:///./{db_name}'

@pytest.fixture(scope="function")
def isolated_db(isolated_db_url):
    """Create isolated database for each test"""
    engine = create_engine(
        isolated_db_url,
        connect_args={"check_same_thread": False}
    )
    
    # Create all tables
    from app.models import Base
    Base.metadata.create_all(bind=engine)
    
    # Create session
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    
    yield session
    
    # Cleanup
    session.close()
    
    # Drop all tables
    Base.metadata.drop_all(bind=engine)
    
    # Remove file if temporary
    if 'tmp' in isolated_db_url:
        os.unlink(isolated_db_url.replace('sqlite:///', ''))
```

### Step 5: Container Health Checks
```dockerfile
# backend/Dockerfile.test
FROM python:3.11-slim

# ... other setup ...

# Add health check script
COPY <<EOF /healthcheck.py
#!/usr/bin/env python3
import sys
try:
    from app.database import engine
    from app.models import Base
    
    # Try to connect
    with engine.connect() as conn:
        conn.execute("SELECT 1")
    
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    
    print("Health check passed")
    sys.exit(0)
except Exception as e:
    print(f"Health check failed: {e}")
    sys.exit(1)
EOF

HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=3 \
    CMD python3 /healthcheck.py
```

### Step 6: Test Orchestration
```python
# backend/tests/orchestrator.py
import subprocess
import time
import uuid
from typing import List, Dict, Any
import docker
import concurrent.futures

class TestOrchestrator:
    """Orchestrate isolated test runs"""
    
    def __init__(self):
        self.client = docker.from_env()
        self.test_runs: Dict[str, Any] = {}
    
    def create_test_environment(self, name: str) -> str:
        """Create isolated test environment"""
        test_id = f"{name}-{uuid.uuid4().hex[:8]}"
        
        # Create network
        network = self.client.networks.create(
            f"test-net-{test_id}",
            driver="bridge"
        )
        
        # Create volumes
        volume = self.client.volumes.create(
            f"test-vol-{test_id}"
        )
        
        self.test_runs[test_id] = {
            "network": network,
            "volume": volume,
            "containers": []
        }
        
        return test_id
    
    def run_backend_tests(self, test_id: str, parallel: int = 4) -> bool:
        """Run backend tests in isolation"""
        env = self.test_runs[test_id]
        
        # Run pytest with xdist
        container = self.client.containers.run(
            "printfarmhq:backend-test",
            command=f"pytest -n {parallel} -v",
            environment={
                "TEST_RUN_ID": test_id,
                "DATABASE_URL": f"sqlite:///./test_{test_id}.db"
            },
            network=env["network"].name,
            volumes={
                env["volume"].name: {"bind": "/app/test-data", "mode": "rw"}
            },
            detach=True,
            remove=False
        )
        
        env["containers"].append(container)
        
        # Wait for completion
        result = container.wait()
        return result["StatusCode"] == 0
    
    def cleanup_test_environment(self, test_id: str):
        """Clean up test environment"""
        if test_id not in self.test_runs:
            return
        
        env = self.test_runs[test_id]
        
        # Stop and remove containers
        for container in env["containers"]:
            try:
                container.stop()
                container.remove()
            except:
                pass
        
        # Remove network and volume
        try:
            env["network"].remove()
            env["volume"].remove()
        except:
            pass
        
        del self.test_runs[test_id]
    
    def run_parallel_test_suites(
        self,
        suites: List[str],
        max_parallel: int = 3
    ) -> Dict[str, bool]:
        """Run multiple test suites in parallel"""
        results = {}
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_parallel) as executor:
            futures = {}
            
            for suite in suites:
                test_id = self.create_test_environment(suite)
                future = executor.submit(self.run_backend_tests, test_id)
                futures[future] = (suite, test_id)
            
            for future in concurrent.futures.as_completed(futures):
                suite, test_id = futures[future]
                try:
                    results[suite] = future.result()
                finally:
                    self.cleanup_test_environment(test_id)
        
        return results

# Usage
if __name__ == "__main__":
    orchestrator = TestOrchestrator()
    
    # Run different test suites in parallel
    results = orchestrator.run_parallel_test_suites([
        "unit-tests",
        "integration-tests",
        "api-tests"
    ])
    
    print(f"Test results: {results}")
```

### Step 7: Makefile Integration
```makefile
# Isolated test targets
.PHONY: test-isolated test-parallel test-cleanup

# Run tests in isolation
test-isolated:
	@echo "🧪 Running isolated tests..."
	@./scripts/run-isolated-tests.sh all

# Run tests in parallel
test-parallel:
	@echo "🚀 Running tests in parallel..."
	@./scripts/run-isolated-tests.sh all parallel

# Clean up all test resources
test-cleanup:
	@echo "🧹 Cleaning up test resources..."
	@docker ps -a | grep "test-" | awk '{print $$1}' | xargs -r docker rm -f
	@docker volume ls | grep "test-" | awk '{print $$2}' | xargs -r docker volume rm
	@docker network ls | grep "test-" | awk '{print $$2}' | xargs -r docker network rm
	@find . -name "test_*.db" -delete

# Run specific test file in isolation
test-file:
	@test -n "$(FILE)" || (echo "Usage: make test-file FILE=path/to/test.py" && exit 1)
	@TEST_RUN_ID="file-$$$$" docker-compose -f docker-compose.test-isolated.yml \
		run --rm backend-test-template pytest -v $(FILE)

# Run tests with coverage in isolation
test-coverage:
	@TEST_RUN_ID="coverage-$$$$" docker-compose -f docker-compose.test-isolated.yml \
		run --rm backend-test-template \
		pytest --cov=app --cov-report=html --cov-report=term
```

## Guidelines for Implementation

### DO:
1. **Use unique identifiers** for each test run
2. **Clean up resources** after tests complete
3. **Implement health checks** for all services
4. **Support parallel execution** from the start
5. **Provide clear logging** of test execution

### DON'T:
1. **Don't share databases** between test runs
2. **Don't hardcode container names**
3. **Don't forget cleanup** on failure
4. **Don't use host networking**
5. **Don't persist data** between runs

### Performance Optimization
```bash
# Pre-build test images for faster runs
docker build -t printfarmhq:backend-test -f backend/Dockerfile.test backend/
docker build -t printfarmhq:frontend-test -f frontend/Dockerfile.test frontend/

# Use BuildKit for faster builds
DOCKER_BUILDKIT=1 docker-compose -f docker-compose.test-isolated.yml build

# Cache test dependencies
docker volume create test-cache-pip
docker volume create test-cache-npm
```

### Debugging Isolated Tests
```bash
# Keep containers running after test failure
TEST_RUN_ID="debug-123" NO_CLEANUP=1 ./scripts/run-isolated-tests.sh backend

# Attach to running test container
docker exec -it "backend-test-debug-123" bash

# View test logs
docker logs "backend-test-debug-123"

# Inspect test database
docker exec -it "backend-test-debug-123" sqlite3 test_debug-123.db
```

### Success Metrics
- Zero test contamination issues
- Parallel test execution working
- 50% reduction in total test time
- Automatic resource cleanup
- Reproducible test environments