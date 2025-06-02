# Simplified Multi-Tenancy Implementation

## Core Concept
Use the super-admin user as the anchor point for multi-tenancy. No need for separate organizations table.

## User Hierarchy

1. **God User** 
   - `is_god_user = true`
   - Created during initial setup
   - Can see ALL data across all teams
   - Cannot be deleted

2. **Super-Admin Users**
   - `is_superadmin = true`
   - `created_by_user_id = null`
   - Created through self-registration
   - Own all team data
   - Can create team members

3. **Team Members**
   - `created_by_user_id = [super-admin's id]`
   - Created by their super-admin
   - Access only their team's data

## Database Changes

### 1. Update Users Table
```sql
ALTER TABLE users ADD COLUMN is_god_user BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN created_by_user_id INTEGER REFERENCES users(id);
CREATE INDEX idx_users_created_by ON users(created_by_user_id);
```

### 2. Add Owner to All Data Tables
Add `owner_id` (pointing to super-admin) to:
- filaments
- products  
- plates
- subscriptions
- filament_purchases
- printer_profiles
- print_jobs
- etc.

```sql
ALTER TABLE [table_name] ADD COLUMN owner_id INTEGER REFERENCES users(id);
CREATE INDEX idx_[table_name]_owner ON [table_name](owner_id);
```

## Key Functions

### Get Owner ID
```python
def get_owner_id(user: User) -> Optional[int]:
    """Get the owner_id for filtering data"""
    if user.is_god_user:
        return None  # No filtering for god user
    elif user.is_superadmin:
        return user.id
    else:
        return user.created_by_user_id
```

### Query Pattern
```python
def get_products(db: Session, current_user: User):
    owner_id = get_owner_id(current_user)
    query = db.query(Product)
    if owner_id:
        query = query.filter(Product.owner_id == owner_id)
    return query.all()
```

## Registration Flow

1. **Initial Setup (First Time)**
   - Creates god user with `is_god_user = true`

2. **Self-Registration**
   - Creates super-admin with `is_superadmin = true`
   - Sets `created_by_user_id = null`
   - All data created will have `owner_id = user.id`

3. **Team Member Creation**
   - Super-admin creates team members
   - Sets `created_by_user_id = super_admin.id`
   - All data created will have `owner_id = created_by_user_id`

## Migration Strategy

1. Create default owner for existing data (first super-admin)
2. Update all existing records with `owner_id`
3. Make `owner_id` required on all tables

## Benefits

1. **Simplicity**: No separate organizations table
2. **Natural Hierarchy**: Uses existing user relationships
3. **Flexibility**: Easy to query and filter
4. **Performance**: Single join for access control
5. **Backwards Compatible**: Existing single-tenant deployments just work