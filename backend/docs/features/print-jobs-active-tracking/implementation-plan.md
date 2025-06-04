# Print Jobs Active Tracking Implementation Plan

## Overview
Enhance the Print Queue tab to show actively printing jobs with real-time progress tracking and prevent printer conflicts.

## Requirements
1. Rename "Print Queue" tab to "Print Jobs"
2. Add "Currently Printing" section above "Job Queue"
3. Allow starting queued jobs with printer conflict prevention
4. Show countdown timer and progress bar for active jobs

## Technical Implementation

### 1. Database Schema Changes
```sql
-- Add fields to print_jobs table
ALTER TABLE print_jobs ADD COLUMN started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE print_jobs ADD COLUMN estimated_completion_at TIMESTAMP WITH TIME ZONE;

-- Update status enum values: pending -> printing -> completed -> failed
```

### 2. Backend API Changes

#### New Endpoints
- `PUT /api/print-jobs/{id}/start` - Start a print job
  - Validates printer availability
  - Sets status to "printing"
  - Sets started_at timestamp
  - Calculates estimated_completion_at
  - Returns updated job with completion time

#### Business Logic
- Check printer availability by querying active jobs
- Calculate total print time from products × quantities × print times
- Set estimated_completion_at = started_at + total_hours

#### Printer Conflict Prevention
```python
def is_printer_available(printer_id: int, db: Session) -> bool:
    active_jobs = db.query(PrintJob).filter(
        PrintJob.status == "printing",
        PrintJob.printers.any(PrintJobPrinter.printer_profile_id == printer_id)
    ).count()
    return active_jobs == 0
```

### 3. Frontend Implementation

#### UI Structure
```
Print Jobs Tab
├── Currently Printing Section
│   ├── Job Card with Progress Bar
│   ├── Time Remaining Countdown
│   └── Printer Assignment Info
└── Job Queue Section
    ├── Pending Jobs Table
    └── Start Button for Each Job
```

#### State Management
- Separate arrays for printing vs queued jobs
- Real-time countdown using useEffect interval
- Progress calculation: (elapsed / total) × 100

#### Components
1. `ActivePrintJobCard` - Shows printing job with progress
2. `PrintJobCountdown` - Live countdown timer
3. `StartPrintButton` - Validates and starts job

### 4. Migration Strategy
1. Create migration file for database changes
2. Update existing jobs with status = "pending"
3. Handle backward compatibility

### 5. Testing Requirements
- Unit tests for printer conflict logic
- E2E tests for starting jobs
- Test countdown timer accuracy
- Verify printer double-booking prevention

### 6. Future Enhancements
- Pause/resume functionality
- Print failure tracking
- Historical completion accuracy
- Multi-printer job support

## Implementation Phases
1. **Phase 1**: Database schema and backend endpoints
2. **Phase 2**: Frontend UI split and basic start functionality
3. **Phase 3**: Real-time progress tracking and countdown
4. **Phase 4**: Testing and edge cases

## Risks and Mitigations
- **Risk**: Timer drift over long prints
  - **Mitigation**: Periodic server sync
- **Risk**: Browser tab inactive affecting countdown
  - **Mitigation**: Use server timestamps for calculations