import { authStorage } from './auth'

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Handle 401 errors globally
function handle401Error() {
  if (typeof window !== 'undefined') {
    // Clear auth data
    authStorage.clear();
    // Redirect to login - we check if we're not already on the auth page to avoid redirect loops
    if (window.location.pathname !== '/auth') {
      window.location.href = '/auth';
    }
  }
}

/**
 * Fetches data from the API.
 * @param path The path to the API endpoint (e.g., "/filaments").
 * @param init Optional request init options (method, headers, body, etc.).
 * @returns A promise that resolves with the JSON response.
 * @throws An error if the fetch request fails or the response is not ok.
 */
export async function api<T = any>(
  path: string,
  init?: RequestInit
): Promise<T> {
  // Define a type for fetch options that includes Next.js specific properties
  type ExtendedRequestInit = RequestInit & { next?: { revalidate?: number | false } };

  // Get authentication token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  
  const fetchOptions: ExtendedRequestInit = {
    next: { revalidate: 0 }, // Default to no caching for API calls, can be overridden
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...init?.headers,
    },
  };

  const res = await fetch(`${API_BASE_URL}${path}`, fetchOptions);

  if (!res.ok) {
    // Handle 401 Unauthorized errors
    if (res.status === 401) {
      handle401Error();
    }
    
    // Attempt to parse error message from backend if available
    let errorDetail = `API request failed with status ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData && errorData.detail) {
        errorDetail = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch (e) {
      // Ignore if error response is not JSON or empty
      const textError = await res.text();
      if (textError) errorDetail = textError;
    }
    throw new Error(errorDetail);
  }

  if (res.status === 204) { // No Content
    return null as T; // Or Promise.resolve(null as T) if strictness requires
  }

  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }

  // For non-JSON responses (should be rare with this setup if API is consistent)
  // or if API sometimes returns empty body on success other than 204
  return res.text().then(text => {
    try {
      return text ? JSON.parse(text) : null;
    } catch (e) {
      return null; // Or handle as an error / return text itself if that's expected
    }
  }) as Promise<T>; 
} 

/**
 * Uploads data (including files) to the API using FormData.
 * @param path The path to the API endpoint.
 * @param formData The FormData object to send.
 * @param init Optional request init options (method, headers (excluding Content-Type), etc.).
 * @returns A promise that resolves with the JSON response from the server.
 * @throws An error if the fetch request fails or the response is not ok.
 */
export async function apiUpload<T = any>(
  path: string,
  formData: FormData,
  init?: Omit<RequestInit, 'body' | 'headers'> & { 
    headers?: Omit<HeadersInit, 'Content-Type'>,
    next?: { revalidate?: number | false } 
  }
): Promise<T> {
  // Get authentication token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  
  const fetchOptions: RequestInit & { next?: { revalidate?: number | false } } = {
    method: 'POST', // Default to POST for uploads
    next: { revalidate: 0 }, // Default Next.js caching behavior (no cache for API calls)
    ...init, // User's init can override method, next, and add other headers
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(init?.headers as HeadersInit),
      // Content-Type is deliberately NOT set here; the browser will set it
      // correctly for FormData, including the boundary.
    },
    body: formData,
  };

  const res = await fetch(`${API_BASE_URL}${path}`, fetchOptions);

  if (!res.ok) {
    // Handle 401 Unauthorized errors
    if (res.status === 401) {
      handle401Error();
    }
    
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
  
  // Fallback for non-JSON responses, similar to api()
  return res.text().then(text => {
    try {
      return text ? JSON.parse(text) : null;
    } catch (e) {
      return null;
    }
  }) as Promise<T>;
} 