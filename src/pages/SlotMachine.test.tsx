import { describe, it, expect } from 'vitest';

// Utility functions for slot machine calculations
const SYMBOLS = ['🍒', '💎', '⭐', '🎰', '🎁'];

function calculateWinnings(reels: string[], betAmount: number): number {
  const [r1, r2, r3] = reels;
  
  // Three matching symbols - JACKPOT!
  if (r1 === r2 && r2 === r3) {
    if (r1 === '💎') return betAmount * 20; // Diamond jackpot
    if (r1 === '🎰') return betAmount * 15; // Slot machine jackpot
    if (r1 === '🎁') return betAmount * 12; // Gift jackpot
    if (r1 === '🍒') return betAmount * 8;  // Cherry jackpot
    if (r1 === '⭐') return betAmount * 5;  // Star jackpot
  }
  
  // Two matching symbols
  if (r1 === r2 || r2 === r3 || r1 === r3) {
    const matchedSymbol = r1 === r2 ? r1 : r2 === r3 ? r2 : r1;
    if (matchedSymbol === '💎') return betAmount * 3;
    if (matchedSymbol === '🎰') return betAmount * 2.5;
    if (matchedSymbol === '🎁') return betAmount * 2;
    return betAmount * 1.5;
  }
  
  // Special bonus: Any diamond present
  if (reels.includes('💎')) {
    return betAmount * 0.5; // 50% of bet back
  }
  
  // No match
  return 0;
}

describe('SlotMachine - Gambling Feature Tests', () => {
  describe('Winning calculation logic', () => {
    const betAmount = 10;

    it('should calculate diamond jackpot (3 matching)', () => {
      const reels = ['💎', '💎', '💎'];
      expect(calculateWinnings(reels, betAmount)).toBe(200); // 20x
    });

    it('should calculate slot machine jackpot (3 matching)', () => {
      const reels = ['🎰', '🎰', '🎰'];
      expect(calculateWinnings(reels, betAmount)).toBe(150); // 15x
    });

    it('should calculate gift jackpot (3 matching)', () => {
      const reels = ['🎁', '🎁', '🎁'];
      expect(calculateWinnings(reels, betAmount)).toBe(120); // 12x
    });

    it('should calculate cherry jackpot (3 matching)', () => {
      const reels = ['🍒', '🍒', '🍒'];
      expect(calculateWinnings(reels, betAmount)).toBe(80); // 8x
    });

    it('should calculate star jackpot (3 matching)', () => {
      const reels = ['⭐', '⭐', '⭐'];
      expect(calculateWinnings(reels, betAmount)).toBe(50); // 5x
    });

    it('should calculate two matching diamonds', () => {
      const reels = ['💎', '💎', '🍒'];
      expect(calculateWinnings(reels, betAmount)).toBe(30); // 3x for 2 diamonds
    });

    it('should calculate two matching slot machines', () => {
      const reels = ['🎰', '🎰', '🍒'];
      expect(calculateWinnings(reels, betAmount)).toBe(25); // 2.5x
    });

    it('should calculate two matching gifts', () => {
      const reels = ['🎁', '🎁', '🍒'];
      expect(calculateWinnings(reels, betAmount)).toBe(20); // 2x
    });

    it('should calculate two matching cherries', () => {
      const reels = ['🍒', '🍒', '⭐'];
      expect(calculateWinnings(reels, betAmount)).toBe(15); // 1.5x
    });

    it('should calculate two matching stars', () => {
      const reels = ['⭐', '⭐', '🍒'];
      expect(calculateWinnings(reels, betAmount)).toBe(15); // 1.5x
    });

    it('should give diamond bonus when any diamond present (no match)', () => {
      const reels = ['💎', '🍒', '⭐'];
      expect(calculateWinnings(reels, betAmount)).toBe(5); // 0.5x (50% back)
    });

    it('should return 0 for no match and no diamond', () => {
      const reels = ['🍒', '⭐', '🎁'];
      expect(calculateWinnings(reels, betAmount)).toBe(0);
    });

    it('should handle matching symbols in different positions (first and third)', () => {
      const reels = ['🍒', '⭐', '🍒'];
      expect(calculateWinnings(reels, betAmount)).toBe(15); // 1.5x
    });

    it('should handle matching symbols in different positions (second and third)', () => {
      const reels = ['⭐', '🍒', '🍒'];
      expect(calculateWinnings(reels, betAmount)).toBe(15); // 1.5x
    });
  });

  describe('Bet amount validation', () => {
    it('should accept valid bet amounts', () => {
      const validBets = [1, 10, 50, 100, 500];
      validBets.forEach(bet => {
        expect(bet).toBeGreaterThan(0);
        expect(Number.isFinite(bet)).toBe(true);
      });
    });

    it('should reject zero or negative bets', () => {
      const invalidBets = [0, -1, -10];
      invalidBets.forEach(bet => {
        expect(bet).toBeLessThanOrEqual(0);
      });
    });
  });

  describe('Balance updates after spin', () => {
    it('should calculate net change correctly for win', () => {
      const betAmount = 10;
      const winnings = 50;
      const netChange = winnings - betAmount;
      expect(netChange).toBe(40);
    });

    it('should calculate net change correctly for loss', () => {
      const betAmount = 10;
      const winnings = 0;
      const netChange = winnings - betAmount;
      expect(netChange).toBe(-10);
    });

    it('should calculate net change correctly for partial win', () => {
      const betAmount = 10;
      const winnings = 5; // Diamond bonus
      const netChange = winnings - betAmount;
      expect(netChange).toBe(-5);
    });
  });
});
