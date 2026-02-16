import { z } from 'zod';

/**
 * Validation schemas for user inputs
 * Prevents injection attacks, type confusion, and invalid data
 */

// User creation/update validation
export const userSchema = z.object({
  display_name: z.string()
    .min(1, 'Display name is required')
    .max(30, 'Display name must be 30 characters or less')
    .trim()
    .regex(/^[a-zA-Z0-9_\s-]+$/, 'Display name can only contain letters, numbers, spaces, hyphens, and underscores'),
  balance: z.number()
    .nonnegative('Balance cannot be negative')
    .finite('Balance must be a valid number')
    .max(1000000000, 'Balance exceeds maximum allowed value'),
});

// Market creation validation
export const marketSchema = z.object({
  question: z.string()
    .min(10, 'Question must be at least 10 characters')
    .max(200, 'Question must be 200 characters or less')
    .trim(),
  description: z.string()
    .max(1000, 'Description must be 1000 characters or less')
    .trim()
    .optional()
    .nullable(),
  category: z.enum(['Politics', 'Sports', 'Crypto', 'Memes', 'Tech', 'Entertainment', 'General']),
  resolution_date: z.string()
    .datetime('Invalid date format')
    .refine((date) => new Date(date) > new Date(), {
      message: 'Resolution date must be in the future',
    }),
  resolution_criteria: z.string()
    .max(500, 'Resolution criteria must be 500 characters or less')
    .trim()
    .optional()
    .nullable(),
});

// Trade validation
export const tradeSchema = z.object({
  market_id: z.string().uuid('Invalid market ID'),
  side: z.enum(['yes', 'no']),
  shares: z.number()
    .int('Shares must be a whole number')
    .positive('Shares must be greater than 0')
    .max(1000000, 'Shares exceeds maximum allowed')
    .finite('Shares must be a valid number'),
  price: z.number()
    .nonnegative('Price cannot be negative')
    .max(1, 'Price cannot exceed $1.00')
    .finite('Price must be a valid number'),
});

// Admin operations validation
export const adminResolveSchema = z.object({
  market_id: z.string().uuid('Invalid market ID'),
  resolution: z.enum(['resolved_yes', 'resolved_no']),
});

export const adminGiveFundsSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  amount: z.number()
    .finite('Amount must be a valid number')
    .min(-1000000, 'Amount too low')
    .max(1000000, 'Amount too high'),
});

// Gambling input validation
export const gamblingInputSchema = z.object({
  bet: z.number()
    .positive('Bet must be greater than 0')
    .max(10000, 'Bet exceeds maximum allowed')
    .finite('Bet must be a valid number'),
});

/**
 * Safe number parsing with validation
 * Prevents NaN, Infinity, and type confusion attacks
 */
export function safeParseFloat(value: string | number | undefined | null, defaultValue: number = 0): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return defaultValue;
  }
  
  return parsed;
}

/**
 * Safe integer parsing with validation
 */
export function safeParseInt(value: string | number | undefined | null, defaultValue: number = 0): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  
  const parsed = typeof value === 'number' ? Math.floor(value) : parseInt(value, 10);
  
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return defaultValue;
  }
  
  return parsed;
}

/**
 * Basic input sanitization for display purposes
 * 
 * NOTE: This application relies on React's built-in JSX escaping for XSS prevention.
 * React automatically escapes all values rendered in JSX, preventing XSS attacks.
 * This function primarily removes HTML tags for cleaner text display.
 * 
 * For production, consider using DOMPurify for comprehensive sanitization if
 * rendering HTML from user input (which we don't do in this app).
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (!input) return '';
  
  // Simple tag removal for cleaner display
  // XSS protection is handled by React's JSX escaping
  const withoutTags = input.replace(/<[^>]*>/g, '');
  
  // Trim and limit length
  return withoutTags.trim().slice(0, maxLength);
}
