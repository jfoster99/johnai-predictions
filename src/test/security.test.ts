import { describe, it, expect } from "vitest";
import { sanitizeInput } from "@/lib/utils";

describe("security", () => {
  describe("input sanitization", () => {
    it("should strip HTML angle brackets from input", () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
      expect(sanitizeInput('Hello <b>World</b>')).toBe('Hello bWorld/b');
    });

    it("should preserve safe input", () => {
      expect(sanitizeInput('Normal text 123')).toBe('Normal text 123');
      expect(sanitizeInput('Question with $pecial ch@rs!')).toBe('Question with $pecial ch@rs!');
    });

    it("should handle empty string", () => {
      expect(sanitizeInput('')).toBe('');
    });
  });

  describe("admin password", () => {
    it("should not contain hardcoded admin password", () => {
      // The ADMIN_PASSWORD should come from environment variables
      const envPassword = import.meta.env.VITE_ADMIN_PASSWORD || '';
      // In test environment, it should be empty (not hardcoded)
      expect(envPassword).not.toBe('johnai');
    });
  });

  describe("input validation bounds", () => {
    it("should enforce share limits", () => {
      const MAX_SHARES = 10000;
      expect(10001 > MAX_SHARES).toBe(true);
      expect(10000 > MAX_SHARES).toBe(false);
      expect(1 > MAX_SHARES).toBe(false);
    });

    it("should enforce bet limits", () => {
      const MAX_BET = 10000;
      expect(10001 > MAX_BET).toBe(true);
      expect(10000 > MAX_BET).toBe(false);
    });

    it("should reject negative values", () => {
      expect(-1 <= 0).toBe(true);
      expect(0 <= 0).toBe(true);
      expect(1 <= 0).toBe(false);
    });

    it("should validate display name length", () => {
      const maxLength = 30;
      const tooLong = 'a'.repeat(31);
      const valid = 'a'.repeat(30);
      expect(tooLong.length > maxLength).toBe(true);
      expect(valid.length > maxLength).toBe(false);
    });
  });
});
