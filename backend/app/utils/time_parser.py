"""Simple time parsing utility."""

import re
from typing import Union


def parse_time_to_hours(time_input: Union[str, float, int]) -> float:
    """Parse time input to decimal hours.
    
    Supports: "1h30m", "1h", "45m", 1.5 (decimal)
    """
    if isinstance(time_input, (int, float)):
        if time_input < 0:
            raise ValueError("Time cannot be negative")
        return float(time_input)
    
    if not isinstance(time_input, str):
        raise ValueError("Time must be string or number")
    
    time_str = time_input.strip()
    if not time_str:
        raise ValueError("Time cannot be empty")
    
    # Try decimal first
    try:
        value = float(time_str)
        if value < 0:
            raise ValueError("Time cannot be negative")
        return value
    except ValueError:
        pass
    
    # Parse time format like "1h30m"
    pattern = r'^(?:(\d+)h)?(?:(\d+)m)?$'
    match = re.match(pattern, time_str)
    if not match:
        raise ValueError(f"Invalid time format: '{time_str}'. Use '1h30m', '1h', '45m', or decimal '1.5'")
    
    hours_str, minutes_str = match.groups()
    hours = int(hours_str) if hours_str else 0
    minutes = int(minutes_str) if minutes_str else 0
    
    if hours == 0 and minutes == 0:
        raise ValueError("Time cannot be zero")
    
    return hours + (minutes / 60.0)


def format_hours_display(hours: float) -> str:
    """Format decimal hours for display."""
    if hours <= 0:
        return "0m"
    
    h = int(hours)
    m = round((hours - h) * 60)
    
    if m == 60:  # Handle rounding edge case
        h += 1
        m = 0
    
    if h > 0 and m > 0:
        return f"{h}h{m}m"
    elif h > 0:
        return f"{h}h"
    else:
        return f"{m}m"