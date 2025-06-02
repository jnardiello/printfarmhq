# Multi-Tenancy Implementation

## Overview

PrintfarmHQ now supports multi-tenancy with self-registration. The system uses a simplified approach where super-admin users serve as the anchor point for each tenant's data, eliminating the need for a separate organizations table.

## User Hierarchy

### 1. God User
- **Characteristics:**
  - `is_god_user = true`
  - `is_superadmin = true`
  - `created_by_user_id = null`
- **Created:** During initial system setup
- **Access:** Can see ALL data across all tenants
- **Limit:** Only one god user per system
- **Purpose:** System administration and support

### 2. Super-Admin Users (Tenant Owners)
- **Characteristics:**
  - `is_superadmin = true`
  - `is_god_user = false`
  - `created_by_user_id = null`
- **Created:** Through self-registration (`/auth/self-register`)
- **Access:** Own and see only their team's data
- **Capabilities:**
  - Create team members
  - Manage all team data
  - Full admin privileges within their tenant

### 3. Team Members
- **Characteristics:**
  - `created_by_user_id = [super-admin's id]`
  - `is_admin` can be true or false
- **Created:** By their team's super-admin
- **Access:** Only their team's data (owned by their super-admin)

## Data Ownership Model

All data tables include an `owner_id` field that points to the super-admin user who owns the data:

```python
# In models.py
owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
owner = relationship("User", foreign_keys=[owner_id])
```

### Owner ID Resolution

```python
def get_owner_id(user: User) -> Optional[int]:
    """Get the owner_id for filtering data"""
    if user.is_god_user:
        return None  # God user sees all data
    elif user.is_superadmin:
        return user.id  # Super-admin owns their data
    else:
        return user.created_by_user_id  # Team member's data belongs to their super-admin
```

## Registration Flow

### 1. Initial Setup (First Time Only)
```
POST /auth/setup
{
  "email": "admin@example.com",
  "password": "secure_password",
  "name": "System Admin"
}
```
- Creates the god user
- Sets `is_god_user = true`
- One-time operation

### 1.1 God User Selection (If Missing)
If super-admins exist but no god user is defined:

**Check Status:**
```
GET /auth/setup-status
Response: {
  "setup_required": false,
  "god_user_required": true
}
```

**List Available Super-Admins:**
```
GET /auth/superadmins
```

**Select God User:**
```
POST /auth/select-god-user
{
  "user_id": 2
}
```
- Promotes existing super-admin to god user
- One-time, irreversible operation
- Returns auth token for the god user

### 2. Self-Registration (Tenant Creation)
```
POST /auth/self-register
{
  "email": "company@example.com",
  "password": "secure_password",
  "name": "John Doe",
  "company_name": "ACME Corp"
}
```
- Creates a new super-admin user
- Sets `is_superadmin = true`
- User name includes company name for clarity
- All subsequent data created will have `owner_id = user.id`

### 3. Team Member Creation
```
POST /users
{
  "email": "team@example.com",
  "password": "secure_password",
  "name": "Team Member",
  "is_admin": false
}
```
- Only super-admins can create team members
- Sets `created_by_user_id = super_admin.id`
- Team member's data will have `owner_id = created_by_user_id`

## API Filtering Pattern

All data endpoints filter by owner:

```python
@app.get("/filaments")
def list_filaments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    owner_id = get_owner_id(current_user)
    query = db.query(Filament)
    if owner_id is not None:
        query = query.filter(Filament.owner_id == owner_id)
    return query.all()
```

## Database Migrations

The implementation includes several migrations:

1. **Add multi-tenancy to users** - Adds `is_god_user` and `created_by_user_id` fields
2. **Add owner_id to all tables** - Adds `owner_id` field to all data tables
3. **Populate owner_id for existing data** - Assigns existing data to the first super-admin
4. **Mark existing superadmin as god user** - Converts existing super-admin to god user

## Security Considerations

1. **Data Isolation:** Each tenant's data is completely isolated through owner_id filtering
2. **Permission Inheritance:** Team members inherit their super-admin's data ownership
3. **God User Protection:** God user cannot be deleted or modified by non-god users
4. **Registration Protection:** Self-registration requires system to be initialized first

## God Dashboard

The god user has access to a special dashboard that provides system-wide visibility:

### Features:
- View total organizations (super-admins) count
- See all users across all tenants
- Monitor system growth and usage
- Hierarchical view of organizations and their team members

### Access:
- Menu item "God Dashboard" visible only to god user
- Protected endpoints at `/god/*`
- Returns 403 Forbidden for non-god users

See [God Dashboard Documentation](../god-dashboard/README.md) for details.

## Frontend Integration

The frontend needs to:

1. Show different registration options based on setup status
2. Display company/team context in the UI
3. Handle multi-tenant data filtering automatically through API
4. Show appropriate user management options based on user role
5. Display God Dashboard for god users only
6. Handle god user selection flow when needed

## Testing Considerations

When testing multi-tenancy:

1. Create multiple tenants with distinct data
2. Verify data isolation between tenants
3. Test god user's ability to see all data
4. Verify team member permissions
5. Test edge cases (deleted super-admin, etc.)

## Future Enhancements

Potential improvements:

1. Tenant-specific settings and customization
2. Billing integration per tenant
3. Usage analytics per tenant
4. Tenant data export/import
5. Cross-tenant data sharing (with permissions)