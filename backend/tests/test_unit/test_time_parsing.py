"""Focused tests for time parsing functionality."""

import pytest
from app.utils.time_parser import parse_time_to_hours, format_hours_display


class TestParseTimeToHours:
    """Test core parsing functionality."""
    
    def test_decimal_input(self):
        """Test decimal hours."""
        assert parse_time_to_hours(1.5) == 1.5
        assert parse_time_to_hours("2.25") == 2.25
        assert parse_time_to_hours(0) == 0.0
    
    def test_hours_only(self):
        """Test hours-only format."""
        assert parse_time_to_hours("1h") == 1.0
        assert parse_time_to_hours("10h") == 10.0
    
    def test_minutes_only(self):
        """Test minutes-only format."""
        assert parse_time_to_hours("30m") == 0.5
        assert parse_time_to_hours("90m") == 1.5
    
    def test_combined_format(self):
        """Test combined hours and minutes."""
        assert parse_time_to_hours("1h30m") == 1.5
        assert parse_time_to_hours("2h15m") == 2.25
        assert parse_time_to_hours("0h45m") == 0.75
    
    def test_invalid_formats(self):
        """Test that invalid formats raise ValueError."""
        with pytest.raises(ValueError):
            parse_time_to_hours("invalid")
        with pytest.raises(ValueError):
            parse_time_to_hours("1.5h")
        with pytest.raises(ValueError):
            parse_time_to_hours("-1h")
        with pytest.raises(ValueError):
            parse_time_to_hours("")
        with pytest.raises(ValueError):
            parse_time_to_hours("0h0m")


class TestFormatHoursDisplay:
    """Test display formatting."""
    
    def test_basic_formatting(self):
        """Test common formatting cases."""
        assert format_hours_display(1.0) == "1h"
        assert format_hours_display(0.5) == "30m"
        assert format_hours_display(1.5) == "1h30m"
        assert format_hours_display(2.25) == "2h15m"
    
    def test_edge_cases(self):
        """Test edge cases."""
        assert format_hours_display(0) == "0m"
        assert format_hours_display(0.0833333) == "5m"  # 5/60


class TestRoundTrip:
    """Test that parsing and formatting work together."""
    
    def test_roundtrip_consistency(self):
        """Test parse -> format -> parse consistency."""
        test_cases = ["1h", "30m", "1h30m", "2h15m"]
        
        for time_str in test_cases:
            parsed = parse_time_to_hours(time_str)
            formatted = format_hours_display(parsed)
            re_parsed = parse_time_to_hours(formatted)
            assert abs(parsed - re_parsed) < 0.01  # Allow small floating point differences