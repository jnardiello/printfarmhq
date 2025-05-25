# Docker-Based Testing for PrintFarmHQ

This document describes the Docker-based testing infrastructure for PrintFarmHQ, which ensures consistent, isolated, and reproducible test execution across all environments.

## 🎯 Overview

All tests now run in Docker containers by default, eliminating the need for developers to install Python, Node.js, or any other dependencies on their local machines.

## 🚀 Quick Start

```bash
# Run all tests (backend + frontend)
make test

# Run only backend tests
make test-backend

# Run only frontend E2E tests  
make test-frontend

# Clean up test artifacts and containers
make test-docker-clean
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

### Docker-Based Testing (Default)

| Command | Description |
|---------|-------------|
| `make test` | Run all tests in Docker |
| `make test-docker` | Same as `make test` |
| `make test-docker-backend` | Run backend tests only |
| `make test-docker-frontend` | Run frontend E2E tests only |
| `make test-docker-clean` | Clean up all test artifacts |
| `make test-ci` | CI-optimized test run |

### Local Testing (Requires Dependencies)

| Command | Description |
|---------|-------------|
| `make test-local-backend` | Run backend tests locally |
| `make test-local-frontend` | Run frontend tests locally |
| `make test-local-backend-cov` | Backend tests with coverage |
| `make test-local-frontend-ui` | Frontend tests with UI mode |

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

1. **No Local Dependencies**: Developers don't need Python, Node.js, or browsers installed
2. **Consistent Environment**: Tests run identically on all machines
3. **Isolated Testing**: No interference with local development environment
4. **Parallel Execution**: Backend and frontend tests can run simultaneously
5. **Easy Cleanup**: Single command removes all test artifacts and containers

## 🔄 Migrating from Local Tests

If you were previously running tests locally:

1. **No changes to test code required** - all tests work as-is
2. **Use `make test` instead of individual pytest/npm commands**
3. **Test results appear in the same locations**
4. **Coverage reports remain compatible**

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
- Run `make test-docker-clean` to reset permissions
- Ensure your user owns the project directory

### Out of disk space
- Run `docker system prune` to clean up unused containers/images
- Clear test artifacts: `make test-docker-clean`