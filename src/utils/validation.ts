/**
 * Security validation utilities for user inputs
 */

// Maximum values to prevent resource exhaustion
export const MAX_SHARES_PER_TRADE = 10000;
export const MAX_BALANCE = 1000000000; // 1 billion
export const MIN_SHARES = 0.01;
export const MAX_MARKET_QUESTION_LENGTH = 500;
export const MAX_MARKET_DESCRIPTION_LENGTH = 5000;

/**
 * Validates numeric input for shares
 * @param value - The value to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validateShares(value: string | number): { isValid: boolean; error?: string } {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return { isValid: false, error: 'Invalid number format' };
  }
  
  if (numValue < MIN_SHARES) {
    return { isValid: false, error: `Minimum shares is ${MIN_SHARES}` };
  }
  
  if (numValue > MAX_SHARES_PER_TRADE) {
    return { isValid: false, error: `Maximum shares per trade is ${MAX_SHARES_PER_TRADE}` };
  }
  
  if (!Number.isFinite(numValue)) {
    return { isValid: false, error: 'Invalid number value' };
  }
  
  return { isValid: true };
}

/**
 * Validates price value
 * @param value - The price to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validatePrice(value: number): { isValid: boolean; error?: string } {
  if (isNaN(value) || !Number.isFinite(value)) {
    return { isValid: false, error: 'Invalid price value' };
  }
  
  if (value < 0 || value > 1) {
    return { isValid: false, error: 'Price must be between 0 and 1' };
  }
  
  return { isValid: true };
}

/**
 * Validates balance value
 * @param value - The balance to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validateBalance(value: number): { isValid: boolean; error?: string } {
  if (isNaN(value) || !Number.isFinite(value)) {
    return { isValid: false, error: 'Invalid balance value' };
  }
  
  if (value < 0) {
    return { isValid: false, error: 'Balance cannot be negative' };
  }
  
  if (value > MAX_BALANCE) {
    return { isValid: false, error: `Balance cannot exceed ${MAX_BALANCE}` };
  }
  
  return { isValid: true };
}

/**
 * Sanitizes string input to prevent XSS
 * @param input - The string to sanitize
 * @param maxLength - Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeString(input: string, maxLength: number): string {
  if (!input) return '';
  
  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength);
  
  // Remove any potential XSS patterns
  sanitized = sanitized
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
  
  return sanitized;
}

/**
 * Validates market creation data
 * @param question - Market question
 * @param description - Market description
 * @returns Object with isValid boolean and optional error message
 */
export function validateMarketData(
  question: string,
  description?: string
): { isValid: boolean; error?: string } {
  if (!question || question.trim().length === 0) {
    return { isValid: false, error: 'Question is required' };
  }
  
  if (question.length > MAX_MARKET_QUESTION_LENGTH) {
    return { 
      isValid: false, 
      error: `Question must be less than ${MAX_MARKET_QUESTION_LENGTH} characters` 
    };
  }
  
  if (description && description.length > MAX_MARKET_DESCRIPTION_LENGTH) {
    return { 
      isValid: false, 
      error: `Description must be less than ${MAX_MARKET_DESCRIPTION_LENGTH} characters` 
    };
  }
  
  return { isValid: true };
}

/**
 * Validates that calculated cost matches expected value to prevent manipulation
 * @param shares - Number of shares
 * @param price - Price per share
 * @param totalCost - Claimed total cost
 * @returns Object with isValid boolean and optional error message
 */
export function validateCostCalculation(
  shares: number,
  price: number,
  totalCost: number
): { isValid: boolean; error?: string } {
  const expectedCost = shares * price;
  const tolerance = 0.01; // Allow small floating point differences
  
  if (Math.abs(expectedCost - totalCost) > tolerance) {
    return { 
      isValid: false, 
      error: 'Cost calculation mismatch - possible manipulation attempt' 
    };
  }
  
  return { isValid: true };
}
