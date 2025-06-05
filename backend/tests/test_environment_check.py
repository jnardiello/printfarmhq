"""Check test environment setup"""
import os
import pytest

def test_environment_variables():
    """Check which environment variables are set."""
    print("\n=== Environment Check ===")

    # These should NOT be set anymore
    assert "JWT_SECRET_KEY" not in os.environ, "JWT_SECRET_KEY should not be set - using database-based secrets now"
    assert "SUPERADMIN_EMAIL" not in os.environ, "SUPERADMIN_EMAIL should not be set - using database-based setup now"
    assert "SUPERADMIN_PASSWORD" not in os.environ, "SUPERADMIN_PASSWORD should not be set - using database-based setup now"
    assert "SUPERADMIN_NAME" not in os.environ, "SUPERADMIN_NAME should not be set - using database-based setup now"
