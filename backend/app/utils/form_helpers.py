"""Form processing helpers for API endpoints."""

from typing import Optional, Union
from fastapi import HTTPException
from .time_parser import parse_time_to_hours


def parse_time_from_form(
    print_time: Optional[Union[str, float]] = None,
    print_time_hrs: Optional[float] = None
) -> float:
    """Parse time from form data, handling both new and legacy formats.
    
    Args:
        print_time: New format like "1h30m" or decimal
        print_time_hrs: Legacy decimal hours format
        
    Returns:
        Parsed time in decimal hours
        
    Raises:
        HTTPException: For validation errors
    """
    if print_time is not None and print_time_hrs is not None:
        raise HTTPException(status_code=400, detail="Cannot specify both print_time and print_time_hrs")
    
    if print_time is not None:
        try:
            return parse_time_to_hours(print_time)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
    
    if print_time_hrs is not None:
        if print_time_hrs < 0:
            raise HTTPException(status_code=400, detail="Print time cannot be negative")
        return print_time_hrs
    
    raise HTTPException(status_code=400, detail="Either print_time or print_time_hrs must be specified")