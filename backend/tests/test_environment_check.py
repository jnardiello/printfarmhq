"""Check test environment setup"""
import os
import pytest

def test_environment_variables():
    """Check which environment variables are set."""
    print("\n=== Environment Check ===")
    env_vars = ["JWT_SECRET_KEY", "SUPERADMIN_EMAIL", "SUPERADMIN_PASSWORD", "SUPERADMIN_NAME", "DATABASE_URL", "TESTING", "PYTHONPATH"]
    for var in env_vars:
        value = os.environ.get(var, "NOT SET")
        print(f"{var}: {value}")
    
    # These should NOT be set anymore
    assert "JWT_SECRET_KEY" not in os.environ, "JWT_SECRET_KEY should not be set - using database-based secrets now"
    assert "SUPERADMIN_EMAIL" not in os.environ, "SUPERADMIN_EMAIL should not be set - using database-based setup now"
    assert "SUPERADMIN_PASSWORD" not in os.environ, "SUPERADMIN_PASSWORD should not be set - using database-based setup now"
    assert "SUPERADMIN_NAME" not in os.environ, "SUPERADMIN_NAME should not be set - using database-based setup now"
    
    # These should be set
    assert os.environ.get("TESTING") == "true", "TESTING should be set to true"
    assert "PYTHONPATH" in os.environ, "PYTHONPATH should be set"