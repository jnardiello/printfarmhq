# Changelog

## v2.0.0 (2025-06-05)

- fix: support plate-based inventory deduction in print jobs
- feat: upgrade Administration filament creation to advanced QuickFilamentForm
- refactor: rename "Administration" to "Configurations" in main menu
- feat: enhance printer management with manufacturer field and UI improvements
- fix: add missing printer update endpoint and fix HTTP method
- feat: add printer cloning functionality
- feat: add model field to printers
- fix: decouple printer lifecycle from print jobs
- fix: update SQLAlchemy relationships for decoupled printer lifecycle
- fix: add foreign() annotation to SQLAlchemy relationships
- feat: implement comprehensive multi-tenancy with God Dashboard and enhanced user management
- feat: complete frontend implementation for multi-tenancy and God Dashboard
- feat: implement professional password reset modals and comprehensive audit ledger
- feat: implement enhanced God Admin metrics system with comprehensive user analytics
- feat: add smart printer management with working hours tracking
- refactor: simplify printers table and add detailed info modal
- fix: resolve print job COGS calculation and data display issues
- feat: implement comprehensive user-controlled table sorting with session persistence
- refactor: complete plates system removal and simplify product architecture
- feat: implement print job active tracking with real-time progress monitoring
- fix: add automatic migration for print job active tracking columns
- fix: ensure print jobs have minimum 1 hour duration for visible progress
- fix: auto-complete print jobs when estimated time expires
- feat: add stop button for currently printing jobs
- fix: resolve print job progress showing 100% on start
- refactor: replace alerts with modal dialogs in Print Jobs page
- feat: redesign stop button for better visibility and aesthetics
- fix: resolve product update error by using correct HTTP method
- feat: add migrations to remove multiple printer support
- refactor: remove printers_qty from database models
- refactor: update API schemas for single printer per job
- refactor: update API endpoints for single printer assignment
- refactor: remove printers_qty from frontend types
- refactor: remove printer quantity selection from UI
- test: add comprehensive tests for printer working hours
- chore: update migration runner imports
- fix: update alerts to handle printer type relationships
- feat: add printer types system migrations
- fix: add printer unique constraints and fixes
- test: add printer types and deletion tests
- feat: add printer types UI components
- refactor: update printers tab for printer types
- refactor: update frontend components for printer types
- docs: update AI guidelines
- fix: resolve all failing tests after printer types refactoring


## v1.5.0 (2025-06-02)

- refactor: rename "Print Jobs" to "Print Queue" throughout UI
- refactor: remove plates from Products tab UI while preserving backend structure
- feat: improve form styling consistency and layout optimization
- feat: add additional parts cost field and optimize product form layout
- Removing euro sign
- feat: standardize UI components for consistent user experience
- fix: update print job backend to calculate print time from products
- feat: implement full CRUD operations for commercial licenses
- feat: refactor inventory forms from dropdowns to modal dialogs
- feat: enhance filament inventory management and fix alert system
- feat: implement additional parts cost with full CRUD and COP calculation


## v1.4.0 (2025-06-01)

- fix: display formatted time in product info and plate edit modals
- feat: implement filament type/inventory separation architecture
- fix: temporarily disable frontend tests in publish process


## v1.3.0 (2025-05-31)

- feat: add CHANGELOG review step to publish workflow
- Auto-logout after session expires
- feat: add flexible time format support for print times


## v1.2.0 (2025-05-30)

- Adding asciiart with current version running from make dev
- feat: integrate PlateManager into product update modal
- feat: improve product and plate management UI
- feat: improve button hierarchy in product form


## v1.1.4 (2025-05-30)

- Fixing failing delete of product
- Removing base images, not very useful


## v1.1.3 (2025-05-29)

- fix: Update publish script to handle existing versions in docker-compose.yml


## v1.1.2 (2025-05-29)

- fix: Add CHANGELOG.md update to publish process
- feat: Keep released version in docker-compose.yml for stable deployments
- fix: Resolve all failing tests for plates architecture
- fix: Resolve test import errors preventing publish
- fix: Standardize button styles across tabs for consistency
- feat: Enhance plate UI with distinct blue theme and improved visual hierarchy
- feat: Implement comprehensive product plates architecture with G-code support

## v1.1.1 (2025-05-28)

- feat: Add interactive mode to publish command
- feat: Implement enhanced publish workflow with complete automation

## v1.1.0 (2025-05-28)

- Major release with product plates architecture

## v1.0.12 (2025-05-28)

## v1.0.11 (2025-05-28)

## v1.0.11 (2025-05-28)

## v1.0.10 (2025-05-28)

## v1.0.9 (2025-05-28)

## v1.0.8 (2025-05-28)

## v1.0.7 (2025-05-28)

## v1.0.6 (2025-05-28)

## v1.0.5 (2025-05-28)

## v1.0.4 (2025-05-28)

## v1.0.3 (2025-05-28)

## v1.0.2 (2025-05-28)

## v1.0.1 (2025-05-28)

## v1.0.0 (2025-05-28)

- Initial release