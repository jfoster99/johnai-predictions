// CSRF Protection Utility
// Generates and validates CSRF tokens for state-changing operations
// This provides additional protection beyond JWT authentication

const CSRF_TOKEN_KEY = 'csrf-token';
const CSRF_TOKEN_EXPIRY_KEY = 'csrf-token-expiry';
const TOKEN_VALIDITY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generates a cryptographically secure CSRF token
 * The token is stored in sessionStorage to be used for validating requests
 */
export function generateCsrfToken(): string {
  // Generate a random token using Web Crypto API
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  
  // Store token and expiry in sessionStorage (cleared on tab close)
  sessionStorage.setItem(CSRF_TOKEN_KEY, token);
  sessionStorage.setItem(CSRF_TOKEN_EXPIRY_KEY, String(Date.now() + TOKEN_VALIDITY_MS));
  
  return token;
}

/**
 * Gets the current CSRF token, generating a new one if needed
 */
export function getCsrfToken(): string {
  const token = sessionStorage.getItem(CSRF_TOKEN_KEY);
  const expiry = sessionStorage.getItem(CSRF_TOKEN_EXPIRY_KEY);
  
  // If no token exists or it's expired, generate a new one
  if (!token || !expiry || Date.now() > parseInt(expiry)) {
    return generateCsrfToken();
  }
  
  return token;
}

/**
 * Clears the CSRF token (e.g., on logout)
 */
export function clearCsrfToken(): void {
  sessionStorage.removeItem(CSRF_TOKEN_KEY);
  sessionStorage.removeItem(CSRF_TOKEN_EXPIRY_KEY);
}

/**
 * Validates a CSRF token (for local validation before sending request)
 */
export function validateCsrfToken(token: string): boolean {
  const storedToken = sessionStorage.getItem(CSRF_TOKEN_KEY);
  const expiry = sessionStorage.getItem(CSRF_TOKEN_EXPIRY_KEY);
  
  if (!storedToken || !expiry) {
    return false;
  }
  
  if (Date.now() > parseInt(expiry)) {
    clearCsrfToken();
    return false;
  }
  
  return token === storedToken;
}

/**
 * Gets CSRF headers to include in requests
 */
export function getCsrfHeaders(): Record<string, string> {
  return {
    'X-CSRF-Token': getCsrfToken(),
  };
}
