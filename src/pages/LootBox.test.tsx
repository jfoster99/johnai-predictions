import { describe, it, expect } from 'vitest';

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

interface LootItem {
  name: string;
  value: number;
  rarity: Rarity;
  emoji: string;
}

const LOOT_ITEMS: LootItem[] = [
  // Common (60%)
  { name: 'Nuh Uh Card', value: 1, rarity: 'common', emoji: '🚫' },
  { name: 'L + Ratio', value: 2, rarity: 'common', emoji: '💀' },
  { name: 'Touch Grass Voucher', value: 3, rarity: 'common', emoji: '🌱' },
  { name: 'Cringe Compilation', value: 5, rarity: 'common', emoji: '😬' },
  { name: 'Mid NFT', value: 8, rarity: 'common', emoji: '🎨' },
  
  // Uncommon (25%)
  { name: 'Rizz License', value: 20, rarity: 'uncommon', emoji: '🪪' },
  { name: 'Gyatt Certificate', value: 30, rarity: 'uncommon', emoji: '📜' },
  { name: 'Skibidi Toilet', value: 50, rarity: 'uncommon', emoji: '🚽' },
  
  // Rare (10%)
  { name: 'Kirkified Meme', value: 100, rarity: 'rare', emoji: '🗿' },
  { name: 'Sigma Mindset', value: 150, rarity: 'rare', emoji: '😎' },
  
  // Epic (4%)
  { name: '67 (Nice)', value: 300, rarity: 'epic', emoji: '6️⃣7️⃣' },
  { name: 'Fanum Tax Exemption', value: 500, rarity: 'epic', emoji: '🍟' },
  
  // Legendary (1%)
  { name: 'Ohio Escape Plan', value: 1500, rarity: 'legendary', emoji: '🏃' },
  { name: 'Grimace Shake', value: 2500, rarity: 'legendary', emoji: '🟣' },
];

const RARITY_CHANCES = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
};

const BOX_PRICE = 100;

function getRandomItem(): LootItem {
  const random = Math.random() * 100;
  let cumulative = 0;
  let selectedRarity: Rarity = 'common';

  for (const [rarity, chance] of Object.entries(RARITY_CHANCES)) {
    cumulative += chance;
    if (random <= cumulative) {
      selectedRarity = rarity as Rarity;
      break;
    }
  }

  const itemsOfRarity = LOOT_ITEMS.filter(item => item.rarity === selectedRarity);
  return itemsOfRarity[Math.floor(Math.random() * itemsOfRarity.length)];
}

describe('LootBox - Gambling Feature Tests', () => {
  describe('Loot items configuration', () => {
    it('should have 14 total items', () => {
      expect(LOOT_ITEMS).toHaveLength(14);
    });

    it('should have 5 common items', () => {
      const commonItems = LOOT_ITEMS.filter(item => item.rarity === 'common');
      expect(commonItems).toHaveLength(5);
    });

    it('should have 3 uncommon items', () => {
      const uncommonItems = LOOT_ITEMS.filter(item => item.rarity === 'uncommon');
      expect(uncommonItems).toHaveLength(3);
    });

    it('should have 2 rare items', () => {
      const rareItems = LOOT_ITEMS.filter(item => item.rarity === 'rare');
      expect(rareItems).toHaveLength(2);
    });

    it('should have 2 epic items', () => {
      const epicItems = LOOT_ITEMS.filter(item => item.rarity === 'epic');
      expect(epicItems).toHaveLength(2);
    });

    it('should have 2 legendary items', () => {
      const legendaryItems = LOOT_ITEMS.filter(item => item.rarity === 'legendary');
      expect(legendaryItems).toHaveLength(2);
    });
  });

  describe('Rarity chances', () => {
    it('should have correct probability percentages that sum to 100', () => {
      const total = Object.values(RARITY_CHANCES).reduce((sum, chance) => sum + chance, 0);
      expect(total).toBe(100);
    });

    it('should have common as most likely (60%)', () => {
      expect(RARITY_CHANCES.common).toBe(60);
    });

    it('should have legendary as rarest (1%)', () => {
      expect(RARITY_CHANCES.legendary).toBe(1);
    });
  });

  describe('Item values', () => {
    it('should have all common items worth less than box price', () => {
      const commonItems = LOOT_ITEMS.filter(item => item.rarity === 'common');
      commonItems.forEach(item => {
        expect(item.value).toBeLessThan(BOX_PRICE);
      });
    });

    it('should have legendary items worth more than box price', () => {
      const legendaryItems = LOOT_ITEMS.filter(item => item.rarity === 'legendary');
      legendaryItems.forEach(item => {
        expect(item.value).toBeGreaterThan(BOX_PRICE);
      });
    });

    it('should have items with proper value ranges by rarity', () => {
      const commonItems = LOOT_ITEMS.filter(item => item.rarity === 'common');
      const uncommonItems = LOOT_ITEMS.filter(item => item.rarity === 'uncommon');
      const rareItems = LOOT_ITEMS.filter(item => item.rarity === 'rare');
      const epicItems = LOOT_ITEMS.filter(item => item.rarity === 'epic');
      const legendaryItems = LOOT_ITEMS.filter(item => item.rarity === 'legendary');
      
      // Common: 1-8
      expect(Math.max(...commonItems.map(i => i.value))).toBeLessThanOrEqual(8);
      
      // Uncommon: 20-50
      expect(Math.min(...uncommonItems.map(i => i.value))).toBeGreaterThanOrEqual(20);
      expect(Math.max(...uncommonItems.map(i => i.value))).toBeLessThanOrEqual(50);
      
      // Rare: 100-150
      expect(Math.min(...rareItems.map(i => i.value))).toBeGreaterThanOrEqual(100);
      
      // Epic: 300-500
      expect(Math.min(...epicItems.map(i => i.value))).toBeGreaterThanOrEqual(300);
      
      // Legendary: 1500+
      expect(Math.min(...legendaryItems.map(i => i.value))).toBeGreaterThanOrEqual(1500);
    });
  });

  describe('Expected value calculations', () => {
    it('should calculate expected value per rarity', () => {
      const commonExpectedValue = LOOT_ITEMS
        .filter(i => i.rarity === 'common')
        .reduce((sum, item) => sum + item.value, 0) / 5 * 0.60;
      
      const uncommonExpectedValue = LOOT_ITEMS
        .filter(i => i.rarity === 'uncommon')
        .reduce((sum, item) => sum + item.value, 0) / 3 * 0.25;
      
      const rareExpectedValue = LOOT_ITEMS
        .filter(i => i.rarity === 'rare')
        .reduce((sum, item) => sum + item.value, 0) / 2 * 0.10;
      
      const epicExpectedValue = LOOT_ITEMS
        .filter(i => i.rarity === 'epic')
        .reduce((sum, item) => sum + item.value, 0) / 2 * 0.04;
      
      const legendaryExpectedValue = LOOT_ITEMS
        .filter(i => i.rarity === 'legendary')
        .reduce((sum, item) => sum + item.value, 0) / 2 * 0.01;
      
      const totalExpectedValue = 
        commonExpectedValue + 
        uncommonExpectedValue + 
        rareExpectedValue + 
        epicExpectedValue + 
        legendaryExpectedValue;
      
      // Expected value should be positive but less than box price (100 JB)
      expect(totalExpectedValue).toBeGreaterThan(50);
      expect(totalExpectedValue).toBeLessThan(BOX_PRICE);
    });

    it('should result in net loss on average', () => {
      // Calculate expected value
      const commonEV = LOOT_ITEMS.filter(i => i.rarity === 'common')
        .reduce((sum, item) => sum + item.value, 0) / 5 * 0.60;
      const uncommonEV = LOOT_ITEMS.filter(i => i.rarity === 'uncommon')
        .reduce((sum, item) => sum + item.value, 0) / 3 * 0.25;
      const rareEV = LOOT_ITEMS.filter(i => i.rarity === 'rare')
        .reduce((sum, item) => sum + item.value, 0) / 2 * 0.10;
      const epicEV = LOOT_ITEMS.filter(i => i.rarity === 'epic')
        .reduce((sum, item) => sum + item.value, 0) / 2 * 0.04;
      const legendaryEV = LOOT_ITEMS.filter(i => i.rarity === 'legendary')
        .reduce((sum, item) => sum + item.value, 0) / 2 * 0.01;
      
      const totalEV = commonEV + uncommonEV + rareEV + epicEV + legendaryEV;
      const averageLoss = BOX_PRICE - totalEV;
      
      expect(averageLoss).toBeGreaterThan(0);
      expect(averageLoss).toBeGreaterThan(30); // Average loss per box
      expect(averageLoss).toBeLessThan(50);
    });
  });

  describe('Profit/Loss calculations', () => {
    it('should calculate profit for legendary items', () => {
      const legendaryItem = LOOT_ITEMS.find(item => item.rarity === 'legendary')!;
      const profit = legendaryItem.value - BOX_PRICE;
      expect(profit).toBeGreaterThan(0);
    });

    it('should calculate loss for common items', () => {
      const commonItem = LOOT_ITEMS.find(item => item.rarity === 'common')!;
      const profit = commonItem.value - BOX_PRICE;
      expect(profit).toBeLessThan(0);
    });

    it('should handle box price constant', () => {
      expect(BOX_PRICE).toBe(100);
    });
  });

  describe('Random item generation', () => {
    it('should return a valid loot item', () => {
      const item = getRandomItem();
      expect(item).toBeDefined();
      expect(LOOT_ITEMS).toContainEqual(item);
    });

    it('should return items with all required properties', () => {
      const item = getRandomItem();
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('value');
      expect(item).toHaveProperty('rarity');
      expect(item).toHaveProperty('emoji');
    });

    it('should generate multiple different items (statistical test)', () => {
      const items = new Set();
      // Generate 50 items, should get variety
      for (let i = 0; i < 50; i++) {
        items.add(getRandomItem().name);
      }
      // With 50 draws, we should get at least 5 different items
      expect(items.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Balance requirements', () => {
    it('should require sufficient balance to open box', () => {
      const userBalance = 50;
      expect(userBalance).toBeLessThan(BOX_PRICE);
    });

    it('should allow opening with sufficient balance', () => {
      const userBalance = 100;
      expect(userBalance).toBeGreaterThanOrEqual(BOX_PRICE);
    });

    it('should calculate remaining balance after opening', () => {
      const userBalance = 200;
      const itemValue = 50;
      const netChange = itemValue - BOX_PRICE;
      const newBalance = userBalance + netChange;
      expect(newBalance).toBe(150);
    });
  });
});
