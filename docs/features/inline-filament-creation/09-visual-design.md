# Visual Design Guidelines

## Overview

Comprehensive visual design specifications for the inline filament creation feature, ensuring consistency with the existing PrintFarmHQ design system.

## Design Tokens

### Colors

```scss
// Primary Palette
$primary-500: #3B82F6;  // Primary actions, links
$primary-600: #2563EB;  // Hover states
$primary-100: #DBEAFE;  // Light backgrounds

// Semantic Colors
$success-500: #10B981;  // Success states
$error-500: #EF4444;    // Error states
$warning-500: #F59E0B;  // Warning states

// Neutral Palette
$gray-50: #F9FAFB;      // Modal backgrounds
$gray-100: #F3F4F6;     // Hover backgrounds
$gray-200: #E5E7EB;     // Borders
$gray-500: #6B7280;     // Secondary text
$gray-900: #111827;     // Primary text

// Dark Mode
$dark-bg: #1F2937;      // Modal background
$dark-surface: #374151; // Card surfaces
$dark-border: #4B5563;  // Borders
```

### Typography

```scss
// Font Family
$font-sans: 'Inter', system-ui, -apple-system, sans-serif;

// Font Sizes
$text-xs: 0.75rem;    // 12px - Help text
$text-sm: 0.875rem;   // 14px - Body text, inputs
$text-base: 1rem;     // 16px - Default
$text-lg: 1.125rem;   // 18px - Modal titles
$text-xl: 1.25rem;    // 20px - Page headings

// Font Weights
$font-normal: 400;    // Body text
$font-medium: 500;    // Labels, buttons
$font-semibold: 600;  // Headings
$font-bold: 700;      // Emphasis

// Line Heights
$leading-tight: 1.25;
$leading-normal: 1.5;
$leading-relaxed: 1.75;
```

### Spacing

```scss
// Base unit: 4px
$space-1: 0.25rem;   // 4px
$space-2: 0.5rem;    // 8px
$space-3: 0.75rem;   // 12px
$space-4: 1rem;      // 16px
$space-5: 1.25rem;   // 20px
$space-6: 1.5rem;    // 24px
$space-8: 2rem;      // 32px
```

## Component Specifications

### Select Dropdown with "Add New" Option

```scss
.filament-select {
  // Trigger button
  &__trigger {
    height: 36px;
    padding: 0 12px;
    border: 1px solid $gray-200;
    border-radius: 6px;
    font-size: $text-sm;
    background: white;
    
    &:hover {
      border-color: $gray-300;
    }
    
    &:focus {
      outline: 2px solid $primary-500;
      outline-offset: 2px;
    }
  }
  
  // Dropdown content
  &__content {
    margin-top: 4px;
    padding: 4px;
    background: white;
    border: 1px solid $gray-200;
    border-radius: 8px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    max-height: 300px;
    overflow-y: auto;
  }
  
  // Regular items
  &__item {
    padding: 8px 12px;
    border-radius: 4px;
    font-size: $text-sm;
    cursor: pointer;
    
    &:hover {
      background: $gray-50;
    }
    
    &--selected {
      background: $primary-50;
      color: $primary-700;
    }
  }
  
  // Color indicator
  &__color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid $gray-300;
    display: inline-block;
    margin-right: 8px;
  }
  
  // Separator
  &__separator {
    height: 1px;
    background: $gray-200;
    margin: 4px 0;
  }
  
  // Add new option
  &__add-new {
    color: $primary-600;
    font-weight: $font-medium;
    
    &:hover {
      background: $primary-50;
    }
    
    .icon {
      width: 16px;
      height: 16px;
      margin-right: 8px;
    }
  }
}
```

### Modal Design

```scss
.quick-filament-modal {
  // Overlay
  &__overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    animation: fade-in 200ms ease-out;
  }
  
  // Content
  &__content {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90vw;
    max-width: 500px;
    max-height: 90vh;
    padding: 24px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    animation: modal-enter 200ms ease-out;
    overflow-y: auto;
    
    @media (max-width: 640px) {
      width: 100%;
      height: 100%;
      max-width: none;
      max-height: none;
      border-radius: 0;
    }
  }
  
  // Header
  &__header {
    margin-bottom: 16px;
    
    h2 {
      font-size: $text-lg;
      font-weight: $font-semibold;
      color: $gray-900;
    }
    
    p {
      font-size: $text-sm;
      color: $gray-500;
      margin-top: 4px;
    }
  }
  
  // Form sections
  &__form-group {
    margin-bottom: 20px;
    
    label {
      display: block;
      font-size: $text-sm;
      font-weight: $font-medium;
      color: $gray-700;
      margin-bottom: 6px;
      
      .required {
        color: $error-500;
      }
    }
    
    input, select, textarea {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid $gray-200;
      border-radius: 6px;
      font-size: $text-sm;
      
      &:focus {
        outline: 2px solid $primary-500;
        outline-offset: 2px;
        border-color: $primary-500;
      }
      
      &.error {
        border-color: $error-500;
      }
    }
    
    .error-message {
      font-size: $text-xs;
      color: $error-500;
      margin-top: 4px;
    }
  }
  
  // Actions
  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid $gray-200;
    
    button {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: $text-sm;
      font-weight: $font-medium;
      transition: all 150ms ease;
      
      &.cancel {
        background: white;
        border: 1px solid $gray-300;
        color: $gray-700;
        
        &:hover {
          background: $gray-50;
        }
      }
      
      &.submit {
        background: $primary-600;
        color: white;
        border: 1px solid $primary-600;
        
        &:hover {
          background: $primary-700;
        }
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }
  }
}
```

### Color Picker Design

```scss
.color-picker {
  &__trigger {
    width: 40px;
    height: 36px;
    padding: 6px;
    border: 1px solid $gray-200;
    border-radius: 6px;
    cursor: pointer;
    
    &:hover {
      background: $gray-50;
    }
  }
  
  &__grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    padding: 12px;
    background: white;
    border: 1px solid $gray-200;
    border-radius: 8px;
    margin-top: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  
  &__swatch {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    
    &:hover {
      background: $gray-50;
      transform: scale(1.05);
    }
    
    &-color {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid $gray-300;
      
      &--white {
        border-color: $gray-400;
      }
    }
    
    &-label {
      font-size: $text-xs;
      color: $gray-600;
    }
  }
}
```

## Animation Specifications

### Modal Animations

```scss
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modal-enter {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes modal-exit {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.95);
  }
}

// Success checkmark
@keyframes checkmark {
  0% {
    stroke-dashoffset: 100;
  }
  100% {
    stroke-dashoffset: 0;
  }
}

// Loading spinner
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

### Micro-interactions

```scss
// Button hover
.button {
  transition: all 150ms ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  
  &:active {
    transform: translateY(0);
    box-shadow: none;
  }
}

// Input focus
.input {
  transition: border-color 150ms ease;
  
  &:focus {
    animation: focus-pulse 2s infinite;
  }
}

@keyframes focus-pulse {
  0%, 100% {
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  50% {
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }
}
```

## Dark Mode Adaptations

```scss
.dark {
  .quick-filament-modal {
    &__overlay {
      background: rgba(0, 0, 0, 0.8);
    }
    
    &__content {
      background: $dark-bg;
      border: 1px solid $dark-border;
    }
    
    &__header {
      h2 {
        color: white;
      }
      
      p {
        color: $gray-400;
      }
    }
    
    &__form-group {
      label {
        color: $gray-300;
      }
      
      input, select, textarea {
        background: $dark-surface;
        border-color: $dark-border;
        color: white;
        
        &::placeholder {
          color: $gray-500;
        }
      }
    }
  }
  
  .filament-select {
    &__trigger {
      background: $dark-surface;
      border-color: $dark-border;
      color: white;
    }
    
    &__content {
      background: $dark-surface;
      border-color: $dark-border;
    }
    
    &__item {
      color: $gray-200;
      
      &:hover {
        background: $dark-bg;
      }
    }
  }
}
```

## Responsive Design

### Breakpoints

```scss
$breakpoints: (
  'sm': 640px,   // Mobile landscape
  'md': 768px,   // Tablet portrait
  'lg': 1024px,  // Tablet landscape
  'xl': 1280px,  // Desktop
  '2xl': 1536px  // Large desktop
);
```

### Mobile Adaptations

```scss
@media (max-width: 640px) {
  .quick-filament-modal {
    &__content {
      position: fixed;
      inset: 0;
      border-radius: 0;
      padding: 20px;
      display: flex;
      flex-direction: column;
    }
    
    &__form {
      flex: 1;
      overflow-y: auto;
    }
    
    &__actions {
      position: sticky;
      bottom: 0;
      background: white;
      padding: 16px 0;
      margin: 0 -20px -20px;
      padding: 16px 20px;
      
      button {
        flex: 1;
      }
    }
  }
  
  .color-picker__grid {
    grid-template-columns: repeat(4, 1fr);
  }
  
  // Stack quantity and price fields
  .form-row {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
```

## Loading States

```html
<!-- Button loading -->
<button class="submit loading">
  <svg class="spinner" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" />
  </svg>
  Creating...
</button>

<!-- Skeleton loading -->
<div class="skeleton">
  <div class="skeleton-line"></div>
  <div class="skeleton-line short"></div>
</div>
```

```scss
.skeleton {
  &-line {
    height: 20px;
    background: linear-gradient(90deg, $gray-200 25%, $gray-300 50%, $gray-200 75%);
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
    border-radius: 4px;
    margin-bottom: 8px;
    
    &.short {
      width: 60%;
    }
  }
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

## Success States

```html
<!-- Success toast -->
<div class="toast success">
  <svg class="icon"><!-- checkmark --></svg>
  <div class="content">
    <h4>Filament Created</h4>
    <p>Black PLA has been added to your inventory</p>
  </div>
</div>
```

```scss
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 12px;
  animation: slide-in 300ms ease-out;
  
  &.success {
    border-left: 4px solid $success-500;
    
    .icon {
      color: $success-500;
    }
  }
}

@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```