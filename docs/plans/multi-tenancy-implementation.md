# Multi-Tenancy Implementation Plan

## Overview
Transform PrintFarmHQ from a single-tenant self-hosted application to a multi-tenant SaaS-ready platform with self-registration and complete data isolation between organizations.

## Key Concepts

### User Hierarchy
1. **God User**: Created during initial setup, has access to all organizations and data
2. **Organization Super Admin**: Created during self-registration, manages their organization
3. **Organization Admin**: Created by super admin, has admin rights within organization
4. **Regular User**: Created by admins, has limited rights within organization

### Data Isolation
- Each organization has completely isolated data
- All entities (products, filaments, printers, print jobs, etc.) belong to an organization
- Users can only access data within their organization (except god user)

## Implementation Phases

### Phase 1: Database Schema Updates

#### 1.1 Create Organizations Table
```sql
CREATE TABLE organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    settings JSON -- For future organization-specific settings
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
```

#### 1.2 Update Users Table
```sql
-- Add organization reference and god_user flag
ALTER TABLE users ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE users ADD COLUMN is_god_user BOOLEAN DEFAULT FALSE;

-- Create index for organization queries
CREATE INDEX idx_users_organization ON users(organization_id);
```

#### 1.3 Add Organization ID to All Data Tables
Tables to update:
- filaments
- products
- plates
- plate_filament_usages
- filament_usages
- subscriptions
- filament_purchases
- printer_profiles
- print_jobs
- print_job_products
- print_job_printers

For each table:
```sql
ALTER TABLE [table_name] ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
CREATE INDEX idx_[table_name]_organization ON [table_name](organization_id);
```

### Phase 2: Backend Implementation

#### 2.1 Models Update
```python
# models.py
class Organization(Base):
    __tablename__ = "organizations"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    settings = Column(JSON, nullable=True)
    
    # Relationships
    users = relationship("User", back_populates="organization")
    filaments = relationship("Filament", back_populates="organization")
    products = relationship("Product", back_populates="organization")
    # ... etc for all entities

class User(Base):
    # ... existing fields ...
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    is_god_user = Column(Boolean, default=False)
    
    organization = relationship("Organization", back_populates="users")
```

#### 2.2 Authentication Updates
```python
# JWT token should include organization context
def create_access_token(user: User):
    payload = {
        "sub": user.email,
        "user_id": user.id,
        "organization_id": user.organization_id,
        "is_god_user": user.is_god_user,
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
```

#### 2.3 Dependency Injection for Organization Context
```python
def get_current_organization(
    current_user: User = Depends(get_current_user),
    organization_id: Optional[int] = Query(None)  # For god user to switch context
) -> Organization:
    if current_user.is_god_user and organization_id:
        # God user can access any organization
        org = db.query(Organization).filter(Organization.id == organization_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        return org
    elif current_user.organization_id:
        return current_user.organization
    else:
        raise HTTPException(status_code=403, detail="No organization context")
```

#### 2.4 Query Filtering
All queries must be filtered by organization:
```python
# Before
products = db.query(Product).all()

# After
def get_products(db: Session, org: Organization = Depends(get_current_organization)):
    return db.query(Product).filter(Product.organization_id == org.id).all()
```

### Phase 3: Registration & Setup Flow

#### 3.1 Self-Registration Endpoint
```python
@app.post("/auth/register", response_model=schemas.AuthResponse)
def register_organization(
    registration: schemas.OrganizationRegistration,
    db: Session = Depends(get_db)
):
    # Check if any organizations exist
    if db.query(Organization).count() == 0:
        raise HTTPException(
            status_code=400, 
            detail="Initial setup required. Use /setup endpoint."
        )
    
    # Create organization
    org_slug = generate_slug(registration.organization_name)
    organization = Organization(
        name=registration.organization_name,
        slug=org_slug
    )
    db.add(organization)
    db.flush()
    
    # Create super admin user
    hashed_password = get_password_hash(registration.password)
    user = User(
        email=registration.email,
        name=registration.name,
        hashed_password=hashed_password,
        organization_id=organization.id,
        is_superadmin=True,
        is_admin=True
    )
    db.add(user)
    db.commit()
    
    # Return auth token
    access_token = create_access_token(user)
    return {"access_token": access_token, "token_type": "bearer", "user": user}
```

#### 3.2 Update Setup Endpoint
```python
@app.post("/setup")
def setup(setup_data: schemas.SetupRequest, db: Session = Depends(get_db)):
    # Check if already setup
    if db.query(User).filter(User.is_god_user == True).first():
        raise HTTPException(status_code=400, detail="Setup already completed")
    
    # Create god organization
    god_org = Organization(
        name="System Administration",
        slug="system"
    )
    db.add(god_org)
    db.flush()
    
    # Create god user
    hashed_password = get_password_hash(setup_data.password)
    god_user = User(
        email=setup_data.email,
        name=setup_data.name,
        hashed_password=hashed_password,
        organization_id=god_org.id,
        is_god_user=True,
        is_superadmin=True,
        is_admin=True
    )
    db.add(god_user)
    db.commit()
    
    return {"message": "Setup completed successfully"}
```

### Phase 4: Frontend Updates

#### 4.1 Auth Context Updates
```typescript
interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  isGodUser: boolean;
  currentOrganizationId?: number; // For god user context switching
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegistrationData) => Promise<void>;
  logout: () => void;
  switchOrganization?: (orgId: number) => void; // For god user
}
```

#### 4.2 Registration Component
```tsx
// components/auth/register-form.tsx
export function RegisterForm() {
  const [formData, setFormData] = useState({
    organizationName: "",
    email: "",
    name: "",
    password: "",
    confirmPassword: ""
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    try {
      const response = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          organization_name: formData.organizationName,
          email: formData.email,
          name: formData.name,
          password: formData.password
        })
      });
      
      // Handle successful registration
      router.push("/dashboard");
    } catch (error) {
      toast.error("Registration failed");
    }
  };
  
  // ... form UI
}
```

#### 4.3 Update All API Calls
Every API call needs to include organization context:
```typescript
// For regular users, context is automatic from JWT
const products = await api("/products");

// For god users switching context
const products = await api("/products?organization_id=123");
```

### Phase 5: Migration Strategy

#### 5.1 Migration for Existing Data
```sql
-- Create default organization for existing data
INSERT INTO organizations (name, slug) VALUES ('Default Organization', 'default');

-- Get the organization ID
-- Then update all existing records
UPDATE users SET organization_id = 1 WHERE organization_id IS NULL AND is_god_user = FALSE;
UPDATE filaments SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE products SET organization_id = 1 WHERE organization_id IS NULL;
-- ... etc for all tables
```

#### 5.2 Migration Order
1. Create organizations table
2. Add organization_id columns to all tables (nullable initially)
3. Create default organization
4. Migrate existing data to default organization
5. Update the existing superadmin to be god_user
6. Make organization_id NOT NULL on all tables

### Phase 6: Testing Strategy

#### 6.1 Unit Tests
- Test organization creation
- Test data isolation between organizations
- Test god user access across organizations
- Test registration flow

#### 6.2 Integration Tests
- Test complete registration flow
- Test data visibility across organizations
- Test organization switching for god user
- Test prevention of cross-organization data access

#### 6.3 E2E Tests
- Test full registration and onboarding flow
- Test multi-organization scenarios
- Test god user organization management

## Security Considerations

1. **Data Isolation**: Ensure all queries are properly filtered by organization
2. **SQL Injection**: Use parameterized queries for organization filtering
3. **Authorization**: Verify organization membership on every request
4. **God User Protection**: Ensure god user cannot be deleted or modified by regular users
5. **Organization Switching**: Validate god user status before allowing org switch

## Rollback Plan

If issues arise:
1. All changes are in feature branch
2. Database migrations have DOWN scripts
3. Can revert to single-tenant mode by removing organization filters
4. Existing data remains intact in default organization

## Success Criteria

1. New users can self-register and create organizations
2. Complete data isolation between organizations
3. God user can access all organizations
4. No performance degradation
5. All existing features work within organization context
6. Clean migration of existing data

## Future Enhancements

1. Organization settings and customization
2. Billing and subscription management per organization
3. Organization-level API keys
4. Data export per organization
5. Organization deletion and data cleanup
6. Invitation system for adding users to organizations