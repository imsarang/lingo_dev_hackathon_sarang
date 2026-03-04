/**
 * API Configuration
 * Centralized configuration for API base URL.
 *
 * In production (Vercel), we proxy all backend calls through
 * Next.js API route `/api/backend/*`, which then talks to the
 * EC2 backend over HTTP using BACKEND_INTERNAL_URL (server-side).
 *
 * So on the client we only ever call relative URLs like:
 *   /api/backend/api/ingest/rag/stream
 */

export const API_BASE_URL = ''; // use relative URLs via proxy

/**
 * Get the full API URL for an endpoint.
 * Example: getApiUrl('/api/ingest/rag/stream')
 *   => '/api/backend/api/ingest/rag/stream'
 */
export const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `/api/backend${cleanEndpoint}`;
};
