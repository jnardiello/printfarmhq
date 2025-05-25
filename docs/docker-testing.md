# Docker Testing for PrintFarmHQ

This document describes the Docker-based testing infrastructure for PrintFarmHQ. **All tests MUST be run through Docker containers** to ensure consistency and reproducibility.

## 🎯 Overview

Tests are exclusively run in Docker containers. There is no option to run tests locally on the host machine. This enforces consistent test environments across all developers and CI/CD systems.

## 🚀 Quick Start

```bash
# Run all tests (backend + frontend)
make test

# Run only backend tests
make test-backend

# Run only frontend E2E tests  
make test-frontend

# Clean up test artifacts and containers
make test-clean
```

## 🏗️ Architecture

### Test Containers

1. **Backend Test Container** (`backend-test`)
   - Python 3.11 with pytest and all test dependencies
   - Runs unit tests, integration tests, and generates coverage reports
   - Uses isolated SQLite database for testing

2. **Backend API Container** (`backend-api`)
   - Provides API server for frontend E2E tests
   - Runs with test configuration and seeded test data

3. **Frontend Test Container** (`frontend-test`)
   - Playwright with Chromium and WebKit browsers pre-installed
   - Runs E2E tests against the backend API container
   - Generates test reports and screenshots

4. **Frontend App Container** (`frontend-app`)
   - Next.js application server for E2E testing
   - Configured to use containerized backend API

### File Structure

```
printfarmhq/
├── docker-compose.test.yml     # Test orchestration
├── backend/
│   ├── Dockerfile.test        # Backend test container
│   └── test-results/          # Backend test outputs
├── frontend/
│   ├── Dockerfile.test        # Frontend test container
│   ├── test-results/          # Frontend test outputs
│   └── playwright-report/     # E2E test reports
└── test-results/              # Aggregated test results
```

## 🔧 Available Commands

| Command | Description |
|---------|-------------|
| `make test` | Run all tests in Docker |
| `make test-backend` | Run backend tests only |
| `make test-frontend` | Run frontend E2E tests only |
| `make test-clean` | Clean up all test artifacts |
| `make test-ci` | CI-optimized test run |

## 📊 Test Reports

After running tests, you'll find:

- **Backend Coverage**: `backend/htmlcov/index.html`
- **Backend JUnit XML**: `backend/test-results/junit.xml`
- **Frontend Report**: `frontend/playwright-report/index.html`
- **Frontend JUnit XML**: `frontend/test-results/*.xml`

## 🔍 Debugging Tests

### View Backend Test Logs
```bash
docker compose -f docker-compose.test.yml logs backend-test
```

### Run Backend Tests Interactively
```bash
docker compose -f docker-compose.test.yml run --rm backend-test /bin/bash
# Then inside container:
python -m pytest -v tests/test_specific.py::test_name
```

### Debug Frontend E2E Tests
```bash
# Run with headed browser (requires X11 on Linux/Mac)
docker compose -f docker-compose.test.yml run --rm \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  frontend-test npx playwright test --headed
```

## 🌐 CI/CD Integration

The Docker-based tests integrate seamlessly with CI/CD pipelines:

```yaml
# .github/workflows/test.yml
- name: Run all tests
  run: make test-ci
```

## 🛡️ Benefits

1. **Enforced Consistency**: No option for local testing means no environment discrepancies
2. **Zero Dependencies**: No Python, Node.js, or browsers needed on host
3. **Isolated Testing**: Complete separation from development environment
4. **Reproducible Results**: Identical behavior across all machines
5. **Simple Commands**: Just `make test` - nothing else to remember

## 📝 Environment Variables

Test containers use these default environment variables:

```env
# Backend Test Environment
TESTING=true
DATABASE_URL=sqlite:///./test_data/test.db
JWT_SECRET_KEY=test-secret-key-for-testing-only
SUPERADMIN_EMAIL=admin@test.com
SUPERADMIN_PASSWORD=testpass123

# Frontend Test Environment  
CI=true
PLAYWRIGHT_BASE_URL=http://backend-api:8000
NEXT_PUBLIC_API_URL=http://backend-api:8000
```

## 🚨 Troubleshooting

### Tests fail with "Cannot connect to Docker daemon"
- Ensure Docker Desktop is running
- Check Docker permissions: `docker ps`

### Frontend tests timeout
- Increase health check timeouts in `docker-compose.test.yml`
- Check backend API logs: `docker compose -f docker-compose.test.yml logs backend-api`

### Permission errors with test results
- Run `make test-clean` to reset permissions
- Ensure your user owns the project directory

### Out of disk space
- Run `docker system prune` to clean up unused containers/images
- Clear test artifacts: `make test-clean`