/**
 * API Configuration
 * Centralized configuration for API base URL
 */

export const API_BASE_URL: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Get the full API URL for an endpoint
 * @param endpoint - API endpoint path (e.g., '/api/users/upsert')
 * @returns Full URL (e.g., 'http://localhost:3001/api/users/upsert')
 */
export const getApiUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  // Remove trailing slash from base URL if present
  const cleanBaseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${cleanBaseUrl}${cleanEndpoint}`;
};
