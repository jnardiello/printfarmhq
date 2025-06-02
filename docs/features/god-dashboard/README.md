# God Dashboard

## Overview

The God Dashboard is a special administrative interface available only to the god user. It provides a comprehensive view of all organizations (super-admins) and their team members across the entire PrintfarmHQ system.

## Access Requirements

- User must be authenticated as the god user (`is_god_user = true`)
- Appears as a menu item "God Dashboard" in the main navigation
- All endpoints are protected and return 403 Forbidden for non-god users

## Features

### 1. Statistics Overview
- **Total Organizations**: Count of all super-admin accounts (excluding god user)
- **Total Users**: Count of all users in the system
- **Team Members**: Count of all non-admin users

### 2. Organizations & Users Table
Hierarchical view showing:
- Each super-admin (organization) with their details
- All team members under each organization
- User status (active/inactive)
- User roles (admin/user)
- Join dates

## Implementation Details

### Backend Endpoints

#### GET `/god/stats`
Returns aggregated statistics about the system.

**Response:**
```json
{
  "total_superadmins": 5,
  "total_users": 47,
  "total_team_members": 35
}
```

**Protection:** `get_current_god_user` dependency

#### GET `/god/users`
Returns hierarchical view of all organizations and their users.

**Response:**
```json
[
  {
    "superadmin": {
      "id": 2,
      "email": "admin@company1.com",
      "name": "John Doe (Company 1)",
      "is_active": true,
      "is_admin": true,
      "is_superadmin": true,
      "is_god_user": false,
      "created_at": "2024-01-15T10:00:00Z"
    },
    "team_members": [
      {
        "id": 3,
        "email": "user@company1.com",
        "name": "Jane Smith",
        "is_active": true,
        "is_admin": false,
        "is_superadmin": false,
        "is_god_user": false,
        "created_at": "2024-01-20T14:30:00Z"
      }
    ]
  }
]
```

**Protection:** `get_current_god_user` dependency

### Frontend Component

The God Dashboard is implemented as a React component at `/components/tabs/god-dashboard-tab.tsx`.

Key features:
- Real-time data fetching
- Loading states
- Error handling
- Responsive design
- Visual hierarchy with expandable organization sections

### Security Considerations

1. **Backend Protection**: All god dashboard endpoints use `get_current_god_user` dependency which verifies:
   - User is authenticated
   - User has `is_god_user = true`

2. **Frontend Protection**: The menu item and route are only rendered if `user.is_god_user` is true

3. **Data Isolation**: God user sees all data without owner_id filtering

## God User Selection

If no god user exists in the system, a special setup flow is triggered:

1. System checks for existing god user on startup
2. If none exists but super-admins exist, redirects to `/setup/god-user`
3. Lists all super-admins for selection
4. Selected super-admin is promoted to god user
5. This is a one-time, permanent operation

### God User Selection Endpoints

#### GET `/auth/superadmins`
Lists all super-admins for god user selection.
- Only works when no god user exists
- Returns 400 if god user already exists

#### POST `/auth/select-god-user`
Promotes a super-admin to god user.
- Requires `user_id` in request body
- Only works when no god user exists
- Returns auth token for the new god user

## Usage Guidelines

1. **System Monitoring**: Use the statistics to monitor system growth
2. **User Management**: Quickly identify inactive users or organizations
3. **Support**: Assist organizations with user-related issues
4. **Compliance**: Track user access for audit purposes

## Future Enhancements

1. **Activity Metrics**: Show last login times, activity levels
2. **Data Usage**: Display storage/resource usage per organization
3. **Bulk Actions**: Enable/disable users, send notifications
4. **Export**: Download user lists as CSV/Excel
5. **Search & Filter**: Find users across organizations
6. **Audit Log**: Track god user actions for accountability