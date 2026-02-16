import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { Package, Sparkles, TrendingUp } from 'lucide-react';

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

interface LootItem {
  name: string;
  value: number;
  rarity: Rarity;
  emoji: string;
}

const LOOT_ITEMS: LootItem[] = [
  // Common (60%)
  { name: 'Rusty Penny', value: 1, rarity: 'common', emoji: '🪙' },
  { name: 'Pocket Lint', value: 2, rarity: 'common', emoji: '🧶' },
  { name: 'Used Napkin', value: 3, rarity: 'common', emoji: '🧻' },
  { name: 'Expired Coupon', value: 5, rarity: 'common', emoji: '🎟️' },
  { name: 'Bottle Cap', value: 8, rarity: 'common', emoji: '🍾' },
  
  // Uncommon (25%)
  { name: 'Shiny Rock', value: 20, rarity: 'uncommon', emoji: '🪨' },
  { name: 'Participation Trophy', value: 30, rarity: 'uncommon', emoji: '🏆' },
  { name: 'Fake Gold', value: 50, rarity: 'uncommon', emoji: '🥇' },
  
  // Rare (10%)
  { name: 'Lucky Charm', value: 100, rarity: 'rare', emoji: '🍀' },
  { name: 'Magic Bean', value: 150, rarity: 'rare', emoji: '🫘' },
  
  // Epic (4%)
  { name: 'Diamond Hands', value: 300, rarity: 'epic', emoji: '💎' },
  { name: 'Rare Pepe', value: 500, rarity: 'epic', emoji: '🐸' },
  
  // Legendary (1%)
  { name: 'Money Printer', value: 1500, rarity: 'legendary', emoji: '🖨️' },
  { name: 'Lambo', value: 2500, rarity: 'legendary', emoji: '🏎️' },
];

const RARITY_CHANCES = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
};

const RARITY_COLORS = {
  common: 'from-gray-500 to-gray-600',
  uncommon: 'from-green-500 to-green-600',
  rare: 'from-blue-500 to-blue-600',
  epic: 'from-purple-500 to-purple-600',
  legendary: 'from-yellow-500 to-orange-500',
};

const BOX_PRICE = 100;

export default function LootBox() {
  const { user, refreshUser } = useUser();
  const [isOpening, setIsOpening] = useState(false);
  const [revealedItem, setRevealedItem] = useState<LootItem | null>(null);
  const [openingAnimation, setOpeningAnimation] = useState(false);

  const getRandomItem = (): LootItem => {
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
  };

  const openBox = async () => {
    if (!user) {
      toast.error('Please sign in to open boxes');
      return;
    }

    if (parseFloat(user.balance) < BOX_PRICE) {
      toast.error(`You need ${BOX_PRICE} JohnBucks to open a box!`);
      return;
    }

    setIsOpening(true);
    setOpeningAnimation(true);
    setRevealedItem(null);

    // Deduct box price
    const { error: deductError } = await supabase
      .from('users')
      .update({ balance: parseFloat(user.balance) - BOX_PRICE })
      .eq('id', user.id);

    if (deductError) {
      toast.error('Failed to open box');
      setIsOpening(false);
      setOpeningAnimation(false);
      return;
    }

    // Wait for opening animation
    setTimeout(async () => {
      const item = getRandomItem();
      setRevealedItem(item);
      setOpeningAnimation(false);

      // Add item value to balance
      const newBalance = parseFloat(user.balance) - BOX_PRICE + item.value;
      await supabase
        .from('users')
        .update({ balance: newBalance })
        .eq('id', user.id);

      await refreshUser();
      setIsOpening(false);

      const profit = item.value - BOX_PRICE;
      if (item.rarity === 'legendary') {
        toast.success(`🎉 LEGENDARY! ${item.emoji} ${item.name}!`, {
          description: `Worth ${item.value} JB (Profit: +${profit} JB)`,
          duration: 5000,
        });
      } else if (profit > 0) {
        toast.success(`${item.emoji} ${item.name}!`, {
          description: `Worth ${item.value} JB (Profit: +${profit} JB)`,
        });
      } else {
        toast.error(`${item.emoji} ${item.name}...`, {
          description: `Worth ${item.value} JB (Loss: ${profit} JB)`,
        });
      }
    }, 3000);
  };

  return (
    <main className="container py-8 pb-24 md:pb-8 max-w-4xl">
      <Card className="border-2">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <CardTitle className="text-3xl font-display">Mystery Loot Boxes</CardTitle>
            <Sparkles className="h-5 w-5 text-yellow-500" />
          </div>
          <CardDescription className="text-base">
            Definitely Not Gambling™ • {BOX_PRICE} JB per box
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Box Display */}
          <div className="relative mx-auto w-64 h-64 flex items-center justify-center">
            {openingAnimation ? (
              <div className="relative w-full h-full animate-bounce">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-purple-600 rounded-2xl shadow-2xl animate-pulse" />
                <div className="absolute inset-4 bg-gradient-to-br from-primary/50 to-purple-600/50 rounded-xl animate-spin" />
                <Package className="absolute inset-0 m-auto h-32 w-32 text-white animate-pulse" />
                <Sparkles className="absolute top-4 right-4 h-8 w-8 text-yellow-400 animate-ping" />
                <Sparkles className="absolute bottom-4 left-4 h-6 w-6 text-yellow-400 animate-ping" />
              </div>
            ) : revealedItem ? (
              <div className={`relative w-full h-full bg-gradient-to-br ${RARITY_COLORS[revealedItem.rarity]} rounded-2xl shadow-2xl flex flex-col items-center justify-center p-8 animate-in zoom-in duration-500`}>
                <div className="text-8xl mb-4 animate-bounce">{revealedItem.emoji}</div>
                <div className="text-white text-center space-y-2">
                  <p className="text-xs uppercase tracking-widest font-bold opacity-80">{revealedItem.rarity}</p>
                  <p className="text-xl font-bold">{revealedItem.name}</p>
                  <p className="text-2xl font-display">{revealedItem.value} JB</p>
                </div>
                <div className="absolute inset-0 border-4 border-white/20 rounded-2xl" />
              </div>
            ) : (
              <div className="relative w-full h-full bg-gradient-to-br from-primary to-primary/80 rounded-2xl shadow-xl hover:shadow-2xl transition-all cursor-pointer hover:scale-105 flex items-center justify-center">
                <Package className="h-32 w-32 text-white" />
                <Sparkles className="absolute top-4 right-4 h-8 w-8 text-yellow-400" />
              </div>
            )}
          </div>

          {/* Drop Rates */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-center mb-3">Drop Rates</h3>
            {Object.entries(RARITY_CHANCES).map(([rarity, chance]) => (
              <div key={rarity} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${RARITY_COLORS[rarity as Rarity]}`} />
                  <span className="text-sm capitalize">{rarity}</span>
                </div>
                <span className="text-sm text-muted-foreground">{chance}%</span>
              </div>
            ))}
          </div>

          {/* Open Button */}
          <div className="space-y-4">
            <Button
              onClick={openBox}
              disabled={isOpening || !user || parseFloat(user?.balance || '0') < BOX_PRICE}
              className="w-full h-14 text-lg"
              size="lg"
            >
              {isOpening ? 'Opening...' : `Open Box (${BOX_PRICE} JB)`}
            </Button>
            
            {user && parseFloat(user.balance) < BOX_PRICE && (
              <p className="text-center text-sm text-red-500">
                Insufficient balance. You need {BOX_PRICE - parseFloat(user.balance)} more JB.
              </p>
            )}
          </div>

          {/* Expected Value Disclaimer */}
          <div className="text-center text-xs text-muted-foreground space-y-1 border-t pt-4">
            <p>📊 Expected Value: ~85 JB per box</p>
            <p>💸 Average Loss: 15 JB per box</p>
            <p>🎰 This is literally gambling</p>
            <p>⚠️ Please gamble responsibly (jk go broke)</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
