# Task 01: Backend Transaction Isolation

## Context Description
Currently, backend tests share a database session and changes persist between tests. This causes test failures when tests run in different orders or when previous tests leave data behind. We need to implement transaction-based isolation where each test runs in its own database transaction that is rolled back after completion.

## Current Problems
- Tests modify the database permanently
- Test order affects results
- Difficult to debug test failures
- Cannot run tests in parallel
- Manual cleanup required

## Desired Solution
Implement a pytest fixture that:
1. Creates a new database transaction for each test
2. Provides a session bound to that transaction
3. Automatically rolls back all changes after test completion
4. Overrides FastAPI's dependency injection to use test session
5. Handles nested transactions for tests that use transactions

## Implementation Steps

### Step 1: Update conftest.py with Transaction Fixture
```python
# backend/tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app

@pytest.fixture(scope="function")
def db_engine():
    """Create a test database engine"""
    SQLALCHEMY_DATABASE_URL = "sqlite:///./test_isolated.db"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session(db_engine):
    """Create a new database session with automatic rollback"""
    connection = db_engine.connect()
    transaction = connection.begin()
    
    # Configure session to use this connection
    SessionLocal = sessionmaker(bind=connection)
    session = SessionLocal()
    
    # Create nested transaction for savepoints
    nested = connection.begin_nested()
    
    @pytest.fixture(autouse=True)
    def reset_savepoint():
        nonlocal nested
        yield
        session.rollback()
        nested = connection.begin_nested()
    
    # Override FastAPI's get_db
    def override_get_db():
        try:
            yield session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    yield session
    
    # Cleanup
    session.close()
    transaction.rollback()
    connection.close()
    
    # Clear dependency override
    app.dependency_overrides.clear()
```

### Step 2: Create Base Test Class
```python
# backend/tests/base.py
import pytest
from sqlalchemy.orm import Session

class BaseTest:
    """Base class for all tests with database access"""
    
    @pytest.fixture(autouse=True)
    def setup(self, db_session: Session):
        """Automatically inject db_session into all test methods"""
        self.db = db_session
        yield
        # Any additional cleanup can go here
```

### Step 3: Update Existing Test Structure
```python
# backend/tests/test_filaments.py
from tests.base import BaseTest
from app.models import Filament

class TestFilamentAPI(BaseTest):
    def test_create_filament(self, client, auth_headers):
        # db session is available as self.db
        assert self.db.query(Filament).count() == 0
        
        response = client.post(
            "/api/filaments",
            json={"material": "PLA", "color": "Red", "price_per_kg": 25.99},
            headers=auth_headers
        )
        
        assert response.status_code == 201
        assert self.db.query(Filament).count() == 1
        # All changes will be rolled back after test
```

### Step 4: Handle Complex Scenarios
```python
# backend/tests/conftest.py additions
@pytest.fixture
def db_session_with_commit(db_engine):
    """Special session for tests that need to test commits"""
    SessionLocal = sessionmaker(bind=db_engine)
    session = SessionLocal()
    
    def override_get_db():
        try:
            yield session
        finally:
            session.close()
    
    app.dependency_overrides[get_db] = override_get_db
    
    yield session
    
    # Clean up any data created
    session.rollback()
    session.close()
    app.dependency_overrides.clear()
```

## Guidelines for Implementation

### DO:
1. **Use function scope** for database fixtures to ensure isolation
2. **Clear dependency overrides** after each test
3. **Test the rollback** by verifying data doesn't persist
4. **Handle nested transactions** for complex test scenarios
5. **Document fixture usage** clearly in docstrings

### DON'T:
1. **Don't use module or session scope** for database fixtures
2. **Don't commit transactions** in the fixture
3. **Don't share sessions** between tests
4. **Don't forget to close connections** properly
5. **Don't mix transactional and non-transactional tests**

### Testing the Implementation
1. Create a test that verifies rollback:
```python
def test_transaction_rollback(db_session):
    # Create data
    filament = Filament(material="PLA", color="Red", price_per_kg=25.99)
    db_session.add(filament)
    db_session.flush()
    
    # Verify it exists in this session
    assert db_session.query(Filament).count() == 1
    
    # Don't commit - let fixture rollback

def test_data_not_persisted(db_session):
    # This should be 0 if rollback worked
    assert db_session.query(Filament).count() == 0
```

### Migration Strategy
1. Add new fixtures alongside existing ones
2. Update tests incrementally
3. Run both old and new tests during transition
4. Remove old fixtures once all tests migrated

### Common Pitfalls
- Forgetting to override get_db dependency
- Using the wrong session in tests
- Not handling cleanup properly
- Transaction deadlocks in complex scenarios
- Not clearing dependency overrides

### Success Metrics
- All tests pass with transaction isolation
- No data persists between tests
- Tests can run in random order
- Database is clean after test run
- No manual cleanup needed