# Frontend API Call Standards – **v0 Reference**

> **Document scope:** This file is the authoritative reference for **v0** of the HQ frontend → backend contract.  The goal is to let a code-generation tool (or human ↔ AI pair-programming session) refactor the current Next.js/Tailwind frontend and then _copy/paste_ the generated code straight into this repository **without breaking any existing integration**.  Every endpoint, method, payload contract and state-management rule that exists today is captured here verbatim.  All future changes MUST increment the version comment above and update the specs below in the same PR that changes either the backend contract or `DataProvider` logic.

## Quick-Reference Matrix (all endpoints in v0)

| Entity               | Purpose        | Method | Path                           | Helper    | Req Payload                              | Res Payload                     |
|----------------------|----------------|--------|--------------------------------|-----------|------------------------------------------|---------------------------------|
| Filaments            | Fetch all      | GET    | `/filaments`                   | `api`     | –                                        | `Filament[]`                    |
|                      | Add            | POST   | `/filaments`                   | `api`     | `Partial<Filament>` (JSON)               | `Filament`                      |
|                      | Update         | PATCH  | `/filaments/{id}`              | `api`     | `Partial<Filament>` (JSON)               | – / updated resource            |
|                      | Delete         | DELETE | `/filaments/{id}`              | `api`     | –                                        | –                               |
| Filament purchases   | Fetch all      | GET    | `/filament_purchases`          | `api`     | –                                        | `FilamentPurchase[]`            |
|                      | Add            | POST   | `/filament_purchases`          | `api`     | `Partial<FilamentPurchase>` (JSON)       | –                               |
|                      | Delete         | DELETE | `/filament_purchases/{id}`     | `api`     | –                                        | –                               |
|                      | Export CSV     | GET    | `/filament_purchases/export`   | **fetch** | –                                        | `Blob` (CSV)                    |
| Products             | Fetch all      | GET    | `/products`                    | `api`     | –                                        | `Product[]`                     |
|                      | Add (+ file)   | POST   | `/products`                    | `apiUpload` | `FormData` (see detailed spec)         | `Product`                       |
|                      | Delete         | DELETE | `/products/{id}`               | `api`     | –                                        | –                               |
| Printer profiles     | Fetch all      | GET    | `/printer_profiles`            | `api`     | –                                        | `Printer[]`                     |
|                      | Add            | POST   | `/printer_profiles`            | `api`     | `Partial<Printer>` (JSON)                | –                               |
|                      | Delete         | DELETE | `/printer_profiles/{id}`       | `api`     | –                                        | –                               |
| Subscriptions        | Fetch all      | GET    | `/subscriptions`               | `api`     | –                                        | `Subscription[]`                |
| (commercial licenses)| Add            | POST   | `/subscriptions`               | `api`     | `Partial<Subscription>` (JSON)           | –                               |

_All other HTTP actions **do not exist** in v0; adding one requires bumping this document's version and the backend contract in the same commit._

## Table of Contents

1.  [**Critical: Constraints and Guidelines for Refactoring Service**](#critical-constraints-and-guidelines-for-refactoring-service)
2.  [General Principles](#general-principles)
    *   [Base URL](#base-url)
    *   [HTTP Methods](#http-methods)
    *   [Headers](#headers)
    *   [Data Format](#data-format)
    *   [Asynchronous Operations](#asynchronous-operations)
3.  [**Core API Helper Functions (`lib/api.ts`) - Exact Implementation**](#core-api-helper-functions-libapits---exact-implementation)
    *   [`api` Function (for JSON requests)](#api-function-for-json-requests)
    *   [`apiUpload` Function (for FormData/File requests)](#apiupload-function-for-formdatafile-requests)
4.  [**State Management: `DataProvider` (`components/data-provider.tsx`)**](#state-management-dataprovider-componentsdata-providertsx)
5.  [**Detailed API Endpoint Specifications**](#detailed-api-endpoint-specifications)
    *   [Filaments](#filaments)
    *   [Filament Purchases](#filament-purchases)
    *   [Products](#products)
    *   [Printer Profiles](#printer-profiles)
    *   [Subscriptions (Commercial Licenses)](#subscriptions-commercial-licenses)
6.  [Error Handling Details](#error-handling-details)
7.  [Loading State Management](#loading-state-management)
8.  [Type Definitions (`lib/types.ts`)](#type-definitions-libtypests)

---

## 1. Critical: Constraints and Guidelines for Refactoring Service

**The refactoring service MUST adhere to the following constraints:**

*   **Use Existing Helpers:** All API calls MUST utilize the provided `api` and `apiUpload` helper functions from `lib/api.ts`. Do NOT implement new base-level fetch calls.
*   **DataProvider Integrity:** All operations that modify or fetch data displayed globally (Filaments, Products, Purchases, etc.) MUST continue to be managed through the existing functions within `DataProvider` (`components/data-provider.tsx`).
    *   Refactored code within components should call these `DataProvider` methods (e.g., `addProduct`, `fetchFilaments`).
    *   If new API interactions are introduced that affect global state, they MUST be added as new methods within `DataProvider`, following the existing patterns.
*   **Type Safety:** All API interactions MUST use the TypeScript types defined in `lib/types.ts`. Ensure request payloads and expected responses conform to these types.
*   **Error Handling Pattern:** Error handling MUST follow the existing pattern: `try...catch` blocks, logging errors to the console, and using the `toast` component for user-facing messages, as demonstrated in `DataProvider` methods. The error messages from `api` and `apiUpload` helpers should be the primary source for toast descriptions.
*   **Loading State Pattern:** Loading states MUST be managed as demonstrated in `DataProvider` and relevant components, typically using boolean state variables and updating them in `try/catch/finally` blocks.
*   **Immutability:** When updating state (e.g., in `DataProvider` or local component state), ensure immutability.
*   **No Direct DOM Manipulation for Data Display:** Use React state and props to render data.
*   **Consistency with Existing Code Style:** Follow the established coding style, formatting, and conventions of the existing frontend codebase.
*   **Backend Contract Adherence:** The backend API contract (endpoints, methods, request/response schemas) is fixed. The refactored frontend MUST conform to this.
*   **File Handling:** File uploads (e.g., for Product models) MUST use the `apiUpload` function and `FormData`.
*   **Environment Variables:** The `API_BASE_URL` is configured via `process.env.NEXT_PUBLIC_API_URL`. This MUST NOT be changed.

---

## 2. General Principles

### Base URL
All API calls use the `API_BASE_URL`.
*   **Source File:** `lib/api.ts`
*   **Current Definition:** `export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";`
    *   Note: The document previously mentioned `/api/v1` as part of the base URL. The actual code in `lib/api.ts` shows it's just the host and port. API paths are appended in each call (e.g., `/filaments`, `/products`). **The refactoring must use the base URL as defined in `lib/api.ts` and append paths accordingly.**

### HTTP Methods
*   **GET:** Retrieve resources.
*   **POST:** Create new resources.
*   **PATCH:** Partially update existing resources (Preferred for updates).
*   **DELETE:** Delete resources.

### Headers
*   `api` function: Automatically sets `Content-Type: application/json`.
*   `apiUpload` function: Browser sets `Content-Type: multipart/form-data` automatically.

### Data Format
*   Request/Response: **JSON**.
*   File Uploads: `multipart/form-data`.

### Asynchronous Operations
*   Use `async/await`.

---

## 3. Core API Helper Functions (`lib/api.ts`) - Exact Implementation

These functions are the **ONLY** approved methods for direct API interaction.

### `api` Function (for JSON requests)
```typescript
// lib/api.ts
export async function api<T = any>(
  path: string,
  init?: RequestInit
): Promise<T> {
  type ExtendedRequestInit = RequestInit & { next?: { revalidate?: number | false } };

  const fetchOptions: ExtendedRequestInit = {
    next: { revalidate: 0 }, // Default to no caching
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  };

  const res = await fetch(`${API_BASE_URL}${path}`, fetchOptions);

  if (!res.ok) {
    let errorDetail = `API request failed with status ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData && errorData.detail) {
        errorDetail = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch (e) {
      const textError = await res.text();
      if (textError) errorDetail = textError;
    }
    throw new Error(errorDetail);
  }

  if (res.status === 204) { // No Content
    return null as T;
  }

  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }

  return res.text().then(text => {
    try {
      return text ? JSON.parse(text) : null;
    } catch (e) {
      return null;
    }
  }) as Promise<T>;
}
```

### `apiUpload` Function (for FormData/File requests)
```typescript
// lib/api.ts
export async function apiUpload<T = any>(
  path: string,
  formData: FormData,
  init?: Omit<RequestInit, 'body' | 'headers'> & { 
    headers?: Omit<HeadersInit, 'Content-Type'>,
    next?: { revalidate?: number | false } 
  }
): Promise<T> {
  const fetchOptions: RequestInit & { next?: { revalidate?: number | false } } = {
    method: 'POST', // Default to POST
    next: { revalidate: 0 }, // No cache
    ...init,
    headers: {
      ...(init?.headers as HeadersInit),
      // Content-Type is NOT set here; browser handles it for FormData
    },
    body: formData,
  };

  const res = await fetch(`${API_BASE_URL}${path}`, fetchOptions);

  if (!res.ok) {
    let errorDetail = `API upload failed with status ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData && errorData.detail) {
        errorDetail = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch (e) {
      const textError = await res.text();
      if (textError) errorDetail = textError;
    }
    throw new Error(errorDetail);
  }

  if (res.status === 204) { // No Content
    return null as T;
  }

  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  
  return res.text().then(text => {
    try {
      return text ? JSON.parse(text) : null;
    } catch (e) {
      return null;
    }
  }) as Promise<T>;
}
```

---

## 4. State Management: `DataProvider` (`components/data-provider.tsx`)

`DataProvider` is the central hub for managing shared application state derived from API calls.

*   It uses `useState` for storing lists of entities (filaments, products, etc.).
*   It provides functions (e.g., `fetchFilaments`, `addProduct`) that encapsulate API calls and subsequent state updates.
*   **Crucially, after any CUD (Create, Update, Delete) operation, the corresponding `fetch<Resource>` function (e.g., `fetchFilaments`) is called to refresh the data and ensure UI consistency.** This pattern MUST be maintained.

---

## 5. Detailed API Endpoint Specifications

For each entity, the following details are provided:
*   Endpoint Path
*   HTTP Method
*   Request Payload Contract (referencing `lib/types.ts`)
*   Response Payload Contract (referencing `lib/types.ts`)
*   **Exact `DataProvider` Implementation Snippet**
*   Notes on `DataProvider` state management.

### Filaments

*   **Type Definition (`lib/types.ts`):**
    ```typescript
    export interface Filament {
      id: number
      color: string
      brand: string
      material: string
      total_qty_kg: number
      price_per_kg: number
    }
    ```

*   **1. Fetch All Filaments**
    *   **Endpoint:** `/filaments`
    *   **Method:** `GET`
    *   **Request Payload:** N/A
    *   **Response Payload:** `Promise<Filament[]>`
    *   **`DataProvider` Implementation:**
        ```typescript
        // components/data-provider.tsx
        const fetchFilaments = async () => {
          setLoadingFilaments(true);
          try {
            const data = await api<Filament[]>("/filaments");
            setFilaments(data);
          } catch (error) {
            console.error("Error fetching filaments:", error);
            toast({
              title: "Error Fetching Filaments",
              description: (error as Error).message,
              variant: "destructive",
            });
          } finally {
            setLoadingFilaments(false);
          }
        };
        ```
    *   **State Management:** Updates `filaments` state. Sets `loadingFilaments`.

*   **2. Add Filament**
    *   **Endpoint:** `/filaments`
    *   **Method:** `POST`
    *   **Request Payload:** `Partial<Filament>` (JSON stringified)
        *   Example: `{ color: "Red", brand: "BrandX", material: "PLA" }`
    *   **Response Payload:** `Promise<Filament | void>` (Backend returns the created filament)
    *   **`DataProvider` Implementation:**
        ```typescript
        // components/data-provider.tsx
        const addFilament = async (filament: Partial<Filament>): Promise<Filament | void> => {
          try {
            const newFilament = await api<Filament>("/filaments", {
              method: "POST",
              body: JSON.stringify(filament),
            });
            await fetchFilaments(); // CRITICAL: Re-fetch after add
            toast({
              title: "Success",
              description: "Filament added successfully",
            });
            return newFilament;
          } catch (error) {
            console.error("Error adding filament:", error);
            toast({
              title: "Error Adding Filament",
              description: (error as Error).message,
              variant: "destructive",
            });
          }
        };
        ```
    *   **State Management:** Calls `fetchFilaments()` to update `filaments` state.

*   **3. Update Filament**
    *   **Endpoint:** `/filaments/{id}`
    *   **Method:** `PATCH`
    *   **Request Payload:** `Partial<Filament>` (JSON stringified)
        *   Example: `{ price_per_kg: 25.99 }`
    *   **Response Payload:** `Promise<void>` (Backend likely returns the updated filament or 200 OK with no body if successful, `api` helper handles this)
    *   **`DataProvider` Implementation:**
        ```typescript
        // components/data-provider.tsx
        const updateFilament = async (id: number, data: Partial<Filament>) => {
          try {
            await api(`/filaments/${id}`, {
              method: "PATCH",
              body: JSON.stringify(data),
            });
            await fetchFilaments(); // CRITICAL: Re-fetch after update
            toast({
              title: "Success",
              description: "Filament updated successfully",
            });
          } catch (error) {
            console.error("Error updating filament:", error);
            toast({
              title: "Error Updating Filament",
              description: (error as Error).message,
              variant: "destructive",
            });
          }
        };
        ```
    *   **State Management:** Calls `fetchFilaments()` to update `filaments` state.

*   **4. Delete Filament**
    *   **Endpoint:** `/filaments/{id}`
    *   **Method:** `DELETE`
    *   **Request Payload:** N/A
    *   **Response Payload:** `Promise<void>` (`api` helper returns `null` for 204 No Content)
    *   **`DataProvider` Implementation:**
        ```typescript
        // components/data-provider.tsx
        const deleteFilament = async (id: number) => {
          try {
            await api(`/filaments/${id}`, { method: "DELETE" });
            await fetchFilaments(); // CRITICAL: Re-fetch after delete
            toast({
              title: "Success",
              description: "Filament deleted successfully",
            });
          } catch (error) {
            console.error("Error deleting filament:", error);
            toast({
              title: "Error Deleting Filament",
              description: (error as Error).message,
              variant: "destructive",
            });
          }
        };
        ```
    *   **State Management:** Calls `fetchFilaments()` to update `filaments` state.

### Filament Purchases

*   **Type Definition (`lib/types.ts`):**
    ```typescript
    export interface FilamentPurchase {
      id: number
      filament_id: number
      filament: Filament // Nested Filament object
      quantity_kg: number
      price_per_kg: number
      purchase_date: string | null
      channel: string | null
      notes: string | null
    }
    ```

*   **1. Fetch All Filament Purchases**
    *   **Endpoint:** `/filament_purchases`
    *   **Method:** `GET`
    *   **Request Payload:** N/A
    *   **Response Payload:** `Promise<FilamentPurchase[]>`
    *   **`DataProvider` Implementation:**
        ```typescript
        // components/data-provider.tsx
        const fetchPurchases = async () => {
          try {
            const data = await api<FilamentPurchase[]>("/filament_purchases");
            const sortedData = data.sort((a: FilamentPurchase, b: FilamentPurchase) => {
              const da = a.purchase_date || "";
              const db = b.purchase_date || "";
              if (da === db) return b.id - a.id;
              return db.localeCompare(da);
            });
            setPurchases(sortedData);
          } catch (error) {
            console.error("Error fetching purchases:", error);
            toast({
              title: "Error Fetching Purchases",
              description: (error as Error).message,
              variant: "destructive",
            });
          }
        };
        ```
    *   **State Management:** Updates `purchases` state.

*   **2. Add Filament Purchase**
    *   **Endpoint:** `/filament_purchases`
    *   **Method:** `POST`
    *   **Request Payload:** `Partial<FilamentPurchase>` (JSON stringified). Note: `filament` object is not part of create payload, only `filament_id`.
        *   Schema Reference: Backend `FilamentPurchaseCreate` (e.g., `{ filament_id: 1, quantity_kg: 1, price_per_kg: 22.50 }`)
    *   **Response Payload:** `Promise<void>` (Backend returns created purchase, but frontend doesn't directly use it from `addPurchase` response)
    *   **`DataProvider` Implementation:**
        ```typescript
        // components/data-provider.tsx
        const addPurchase = async (purchase: Partial<FilamentPurchase>) => {
          try {
            await api("/filament_purchases", {
              method: "POST",
              body: JSON.stringify(purchase),
            });
            await Promise.all([fetchFilaments(), fetchPurchases()]); // CRITICAL: Re-fetch purchases and filaments (as qty might change)
            toast({
              title: "Success",
              description: "Purchase added successfully",
            });
          } catch (error) {
            console.error("Error adding purchase:", error);
            toast({
              title: "Error Adding Purchase",
              description: (error as Error).message,
              variant: "destructive",
            });
          }
        };
        ```
    *   **State Management:** Calls `fetchPurchases()` and `fetchFilaments()`.

*   **3. Delete Filament Purchase**
    *   **Endpoint:** `/filament_purchases/{id}`
    *   **Method:** `DELETE`
    *   **Request Payload:** N/A
    *   **Response Payload:** `Promise<void>`
    *   **`DataProvider` Implementation:**
        ```typescript
        // components/data-provider.tsx
        const deletePurchase = async (id: number) => {
          try {
            await api(`/filament_purchases/${id}`, { method: "DELETE" });
            await Promise.all([fetchFilaments(), fetchPurchases()]); // CRITICAL: Re-fetch
            toast({
              title: "Success",
              description: "Purchase deleted successfully",
            });
          } catch (error) {
            console.error("Error deleting purchase:", error);
            toast({
              title: "Error Deleting Purchase",
              description: (error as Error).message,
              variant: "destructive",
            });
          }
        };
        ```
    *   **State Management:** Calls `fetchPurchases()` and `fetchFilaments()`.

*   **4. Export Filament Purchases as CSV**
    *   **Endpoint:** `/filament_purchases/export`
    *   **Method:** `GET`
    *   **Request Payload:** N/A
    *   **Response Payload:** `Blob` (CSV file content)
    *   **`DataProvider` Implementation (Special Case - Direct Fetch):**
        ```typescript
        // components/data-provider.tsx
        const exportPurchasesCSV = async () => {
          try {
            // Uses direct fetch due to blob response
            const res = await fetch(`${API_BASE_URL}/filament_purchases/export`);
            if (!res.ok) {
              const errorText = await res.text();
              throw new Error(errorText || "Export failed");
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "filament_purchases.csv";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            toast({
              title: "Success",
              description: "CSV exported successfully",
            });
          } catch (error) {
            console.error("Error exporting CSV:", error);
            toast({
              title: "Error Exporting CSV",
              description: (error as Error).message,
              variant: "destructive",
            });
          }
        };
        ```
    *   **State Management:** No direct state update; triggers file download.

### Products

*   **Type Definitions (`lib/types.ts`):**
    ```typescript
    export interface FilamentUsage { // Used in Product
      filament_id: number
      grams_used: number
    }

    export interface Product {
      id: number
      sku: string
      name: string
      packaging_cost: number
      print_time_hrs: number
      printer_profile_id: number
      cogs: number
      filament_usages: FilamentUsage[]
      license_id?: number | null
      model_file?: string | null // Filename string
    }
    ```
    *   **Backend Schema for Create:** `ProductCreate` (includes `filament_usages: list[dict]`)

*   **1. Fetch All Products**
    *   **Endpoint:** `/products`
    *   **Method:** `GET`
    *   **Request Payload:** N/A
    *   **Response Payload:** `Promise<Product[]>`
    *   **`DataProvider` Implementation:**
        ```typescript
        // components/data-provider.tsx
        const fetchProducts = async () => {
          try {
            const data = await api<Product[]>("/products");
            setProducts(data);
          } catch (error) {
            console.error("Error fetching products:", error);
            toast({
              title: "Error Fetching Products",
              description: (error as Error).message,
              variant: "destructive",
            });
          }
        };
        ```
    *   **State Management:** Updates `products` state.

*   **2. Add Product (with potential file upload)**
    *   **Endpoint:** `/products`
    *   **Method:** `POST`
    *   **Request Payload:** `FormData`.
        *   **Fields:**
            *   `name: string`
            *   `packaging_cost: string` (number as string)
            *   `print_time_hrs: string` (number as string)
            *   `printer_profile_id: string` (number as string)
            *   `filament_usages: string` (JSON string of `FilamentUsage[]` e.g., `[{ "filament_id": 1, "grams_used": 100 }]`)
            *   `license_id: string` (number as string, or empty string for null)
            *   `model_file: File` (optional File object)
        *   **Construction Example (from `hq/frontend/components/tabs/products-tab.tsx`):**
            ```typescript
            // const productFields = { name: ..., filament_usages: JSON.stringify(usages), ... };
            // const formData = new FormData();
            // for (const key in productFields) { formData.append(key, ...); }
            // if (modelFileRef.current?.files?.[0]) {
            //   formData.append("model_file", modelFileRef.current.files[0]);
            // }
            ```
    *   **Response Payload:** `Promise<Product | void>` (Backend returns created product)
    *   **`DataProvider` Implementation:**
        ```typescript
        // components/data-provider.tsx
        const addProduct = async (productData: FormData) => { // productData is FormData
          try {
            await apiUpload<Product>("/products", productData); // Uses apiUpload
            await fetchProducts(); // CRITICAL: Re-fetch
            toast({
              title: "Success",
              description: "Product added successfully (including file if provided and backend supports it)",
            });
          } catch (error) {
            console.error("Error adding product:", error);
            toast({
              title: "Error Adding Product",
              description: (error as Error).message,
              variant: "destructive",
            });
          }
        };
        ```
    *   **State Management:** Calls `fetchProducts()`.

*   **3. Delete Product**
    *   **Endpoint:** `/products/{id}`
    *   **Method:** `DELETE`
    *   **Request Payload:** N/A
    *   **Response Payload:** `Promise<void>`
    *   **`DataProvider` Implementation:**
        ```typescript
        // components/data-provider.tsx
        const deleteProduct = async (id: number) => {
          try {
            await api(`/products/${id}`, { method: "DELETE" });
            await fetchProducts(); // CRITICAL: Re-fetch
            toast({
              title: "Success",
              description: "Product deleted successfully",
            });
          } catch (error) {
            console.error("Error deleting product:", error);
            toast({
              title: "Error Deleting Product",
              description: (error as Error).message,
              variant: "destructive",
            });
          }
        };
        ```
    *   **State Management:** Calls `fetchProducts()`.

### Printer Profiles

*   **Type Definition (`lib/types.ts`):**
    ```typescript
    export interface Printer { // Referred to as PrinterProfile in backend models/schemas
      id: number
      name: string
      price_eur: number
      expected_life_hours: number
    }
    ```
    *   Backend Schema: `PrinterProfileCreate`, `PrinterProfileRead`

*   **1. Fetch All Printer Profiles**
    *   **Endpoint:** `/printer_profiles`
    *   **Method:** `GET`
    *   **Request Payload:** N/A
    *   **Response Payload:** `Promise<Printer[]>`
    *   **`DataProvider` Implementation:**
        ```typescript
        // components/data-provider.tsx
        const fetchPrinters = async () => {
          try {
            const data = await api<Printer[]>("/printer_profiles");
            setPrinters(data);
          } catch (error) {
            console.error("Error fetching printers:", error);
            toast({
              title: "Error Fetching Printers",
              description: (error as Error).message,
              variant: "destructive",
            });
          }
        };
        ```
    *   **State Management:** Updates `printers` state.

*   **2. Add Printer Profile**
    *   **Endpoint:** `/printer_profiles`
    *   **Method:** `POST`
    *   **Request Payload:** `Partial<Printer>` (JSON stringified)
        *   Example: `{ name: "Prusa MK4", price_eur: 800, expected_life_hours: 20000 }`
    *   **Response Payload:** `Promise<void>` (Backend returns 201 Created with the new profile)
    *   **`DataProvider` Implementation:**
        ```typescript
        // components/data-provider.tsx
        const addPrinter = async (printer: Partial<Printer>) => {
          try {
            await api("/printer_profiles", {
              method: "POST",
              body: JSON.stringify(printer),
            });
            await fetchPrinters(); // CRITICAL: Re-fetch
            toast({
              title: "Success",
              description: "Printer profile added successfully",
            });
          } catch (error) {
            console.error("Error adding printer:", error);
            toast({
              title: "Error Adding Printer",
              description: (error as Error).message,
              variant: "destructive",
            });
          }
        };
        ```
    *   **State Management:** Calls `fetchPrinters()`.

*   **3. Delete Printer Profile**
    *   **Endpoint:** `/printer_profiles/{id}`
    *   **Method:** `DELETE`
    *   **Request Payload:** N/A
    *   **Response Payload:** `Promise<void>`
    *   **`DataProvider` Implementation:**
        ```typescript
        // components/data-provider.tsx
        const deletePrinter = async (id: number) => {
          try {
            await api(`/printer_profiles/${id}`, { method: "DELETE" });
            await fetchPrinters(); // CRITICAL: Re-fetch
            toast({
              title: "Success",
              description: "Printer profile deleted successfully",
            });
          } catch (error) {
            console.error("Error deleting printer:", error);
            toast({
              title: "Error Deleting Printer",
              description: (error as Error).message,
              variant: "destructive",
            });
          }
        };
        ```
    *   **State Management:** Calls `fetchPrinters()`.

### Subscriptions (Commercial Licenses)

*   **Type Definition (`lib/types.ts`):**
    ```typescript
    export interface Subscription {
      id: number
      name: string
      platform: "Thangs" | "Patreon" | "No Platform"
      license_uri?: string | null
      price_eur: number | null
      // Note: Backend model also has vendor, start_date, end_date.
      // Frontend type and `SubscriptionCreate` schema are simpler for now.
    }
    ```
    *   Backend Schema: `SubscriptionCreate`, `SubscriptionRead`

*   **1. Fetch All Subscriptions**
    *   **Endpoint:** `/subscriptions`
    *   **Method:** `GET`
    *   **Request Payload:** N/A
    *   **Response Payload:** `Promise<Subscription[]>`
    *   **`DataProvider` Implementation:**
        ```typescript
        // components/data-provider.tsx
        const fetchSubscriptions = async () => {
          try {
            const data = await api<Subscription[]>("/subscriptions");
            setSubscriptions(data);
          } catch (error) {
            console.error("Error fetching subscriptions:", error);
            toast({
              title: "Error Fetching Subscriptions",
              description: (error as Error).message,
              variant: "destructive",
            });
          }
        };
        ```
    *   **State Management:** Updates `subscriptions` state.

*   **2. Add Subscription**
    *   **Endpoint:** `/subscriptions`
    *   **Method:** `POST`
    *   **Request Payload:** `Partial<Subscription>` (JSON stringified)
        *   Example: `{ name: "Designer Monthly", platform: "Patreon", price_eur: 10 }`
        *   Corresponds to `SubscriptionCreate` schema on backend.
    *   **Response Payload:** `Promise<void>` (Backend returns 200 OK with created subscription)
    *   **`DataProvider` Implementation:**
        ```typescript
        // components/data-provider.tsx
        const addSubscription = async (subscription: Partial<Subscription>) => {
          try {
            await api("/subscriptions", {
              method: "POST",
              body: JSON.stringify(subscription),
            });
            await fetchSubscriptions(); // CRITICAL: Re-fetch
            toast({
              title: "Success",
              description: "Subscription added successfully",
            });
          } catch (error) {
            console.error("Error adding subscription:", error);
            toast({
              title: "Error Adding Subscription",
              description: (error as Error).message,
              variant: "destructive",
            });
          }
        };
        ```
    *   **State Management:** Calls `fetchSubscriptions()`.

---

## 6. Error Handling Details

As specified in `lib/api.ts` (`api` and `apiUpload` functions):
*   If `response.ok` is false, an attempt is made to parse a JSON error response from the backend.
*   The error message prioritizes `errorData.detail`. This field is commonly used by FastAPI to return validation error details or custom error messages.
    *   If `errorData.detail` is an object/array (e.g., Pydantic validation errors), it's JSON stringified.
    *   If it's a string, it's used directly.
*   If JSON parsing fails or `detail` is not present, `res.statusText` or the raw text response is used.
*   An `Error` object is thrown with this message.

**Refactoring Service Responsibility:**
*   Ensure all calls using `api` or `apiUpload` are within `try...catch` blocks.
*   The `catch (error)` block should receive the `Error` object thrown by the helpers.
*   Display `(error as Error).message` in the `toast` description.
*   Log the full `error` object to `console.error` for debugging.

**Example for 422 Unprocessable Entity (FastAPI Pydantic Validation):**
If backend returns:
```json
{
  "detail": [
    { "loc": ["body", "name"], "msg": "Name cannot be empty", "type": "value_error" },
    { "loc": ["body", "price_eur"], "msg": "ensure this value is greater than 0", "type": "value_error.number.not_gt" }
  ]
}
```
The `(error as Error).message` in the frontend will be a JSON string representation of this `detail` array. The toast will display this string. While not perfectly user-friendly for multiple errors, this is the current behavior. **No changes to this specific error message presentation are required unless explicitly requested.**

---

## 7. Loading State Management

*   Track loading states using boolean React state variables (e.g., `const [isLoading, setIsLoading] = useState(false);`).
*   Set to `true` before an API call.
*   Set to `false` in a `finally` block to ensure it's reset whether the call succeeds or fails.
*   Use this state to disable buttons, show spinners, etc.

---

## 8. Type Definitions (`lib/types.ts`)

All relevant type definitions from `hq/frontend/lib/types.ts` have been included within each entity's section above. The refactoring service **MUST** use these types for request payloads, response handling, and state management to maintain type safety.

**Frontend-specific Form Data Types (e.g., `ProductFormData`, `FilamentRowData`):**
These types (like `ProductFormData`) are used for managing form state within components *before* data is transformed for an API call (e.g., converting string inputs to numbers, constructing `FormData`). They are distinct from the types sent directly in API call bodies (like `Product` or `Partial<Filament>`). The refactoring should maintain this separation if it encounters such form-specific types.

This comprehensive document provides the strict guidelines and existing code patterns that **MUST** be followed during the frontend API interaction refactoring. 