import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { Coins, TrendingUp, Sparkles } from 'lucide-react';

const SYMBOLS = ['🍒', '💎', '⭐', '🎰', '🎁'];

// Weighted probabilities for each symbol
const SYMBOL_WEIGHTS = [25, 15, 30, 20, 10]; // Percentages

export default function SlotMachine() {
  const { user, refreshUser } = useUser();
  const [bet, setBet] = useState('10');
  const [reels, setReels] = useState(['🎰', '🎰', '🎰']);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [stats, setStats] = useState({ totalSpins: 0, totalWon: 0, totalBet: 0 });

  const getWeightedSymbol = () => {
    const totalWeight = SYMBOL_WEIGHTS.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < SYMBOLS.length; i++) {
      random -= SYMBOL_WEIGHTS[i];
      if (random <= 0) {
        return SYMBOLS[i];
      }
    }
    return SYMBOLS[0];
  };

  const calculateWinnings = (reels: string[], betAmount: number) => {
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
  };

  const spin = async () => {
    if (!user) {
      toast.error('Please sign in to play');
      return;
    }

    const betAmount = parseFloat(bet);
    if (isNaN(betAmount) || betAmount <= 0) {
      toast.error('Please enter a valid bet amount');
      return;
    }

    if (betAmount > 10000) {
      toast.error('Maximum bet is 10,000 JohnBucks');
      return;
    }

    if (betAmount > parseFloat(user.balance)) {
      toast.error('Insufficient balance');
      return;
    }

    setIsSpinning(true);
    setLastWin(null);

    // Animate spinning
    const spinDuration = 2000;
    const spinInterval = 100;
    const spinCount = spinDuration / spinInterval;
    let currentSpin = 0;

    const spinAnimation = setInterval(() => {
      setReels([getWeightedSymbol(), getWeightedSymbol(), getWeightedSymbol()]);
      currentSpin++;

      if (currentSpin >= spinCount) {
        clearInterval(spinAnimation);
        
        // Final result
        const finalReels = [getWeightedSymbol(), getWeightedSymbol(), getWeightedSymbol()];
        setReels(finalReels);
        
        const winnings = calculateWinnings(finalReels, betAmount);
        setLastWin(winnings);
        
        // Use secure function to handle balance updates
        const netChange = winnings - betAmount;
        const newBalance = parseFloat(user.balance) + netChange;
        
        supabase.rpc('update_user_balance', {
          user_id_param: user.id,
          new_balance: Math.max(0, newBalance)
        }).then(({ error }) => {
          if (error) {
            toast.error('Failed to update balance');
            return;
          }
          
          refreshUser();
          
          if (winnings > 0) {
            const profit = winnings - betAmount;
            if (profit > 0) {
              toast.success(`🎉 You won $${winnings.toFixed(2)}! (Profit: $${profit.toFixed(2)})`);
            } else {
              toast.info(`You won $${winnings.toFixed(2)} back!`);
            }
          } else {
            toast.error(`No match. You lost $${betAmount.toFixed(2)}`);
          }
          
          setStats(prev => ({
            totalSpins: prev.totalSpins + 1,
            totalWon: prev.totalWon + winnings,
            totalBet: prev.totalBet + betAmount,
          }));
        });
        
        setIsSpinning(false);
      }
    }, spinInterval);
  };

  const quickBet = (amount: number) => {
    setBet(amount.toString());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8">
      <div className="container max-w-4xl">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            🎰 JohnBucks Slots
          </h1>
          <p className="text-muted-foreground">
            Try your luck! The odds are in your favor with 110% expected returns!
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Slot Machine */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Spin to Win
              </CardTitle>
              <CardDescription>Match symbols to multiply your bet!</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Reels */}
              <div className="bg-gradient-to-br from-purple-900/20 to-primary/20 rounded-lg p-8 border-2 border-primary/30">
                <div className="flex justify-center items-center gap-4">
                  {reels.map((symbol, index) => (
                    <div
                      key={index}
                      className={`text-6xl bg-background rounded-lg p-4 shadow-lg transition-all duration-100 ${
                        isSpinning ? 'animate-pulse scale-105' : 'scale-100'
                      }`}
                    >
                      {symbol}
                    </div>
                  ))}
                </div>
              </div>

              {/* Bet Controls */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="bet">Bet Amount</Label>
                  <Input
                    id="bet"
                    type="number"
                    value={bet}
                    onChange={(e) => setBet(e.target.value)}
                    min="1"
                    max={user?.balance || 0}
                    disabled={isSpinning}
                    className="text-lg"
                  />
                </div>

                <div className="flex gap-2">
                  {[10, 50, 100, 500].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => quickBet(amount)}
                      disabled={isSpinning || (user && parseFloat(user.balance) < amount)}
                      className="flex-1"
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>

                <Button
                  onClick={spin}
                  disabled={isSpinning || !user}
                  className="w-full h-14 text-lg font-bold"
                  size="lg"
                >
                  {isSpinning ? (
                    <>
                      <span className="animate-spin mr-2">🎰</span>
                      Spinning...
                    </>
                  ) : (
                    <>
                      <Coins className="mr-2 h-5 w-5" />
                      Spin ${bet}
                    </>
                  )}
                </Button>
              </div>

              {/* Last Result */}
              {lastWin !== null && (
                <div
                  className={`text-center p-4 rounded-lg font-bold text-lg ${
                    lastWin > parseFloat(bet)
                      ? 'bg-green-500/20 text-green-400'
                      : lastWin > 0
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {lastWin > 0
                    ? `Won $${lastWin.toFixed(2)}!`
                    : 'No match - Try again!'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Paytable & Stats */}
          <div className="space-y-6">
            {/* Paytable */}
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Paytable
                </CardTitle>
                <CardDescription>Winning combinations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-2 bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 rounded">
                    <span className="text-lg">💎 💎 💎</span>
                    <span className="font-bold text-yellow-400">20x</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gradient-to-r from-purple-500/20 to-purple-600/20 rounded">
                    <span className="text-lg">🎰 🎰 🎰</span>
                    <span className="font-bold text-purple-400">15x</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gradient-to-r from-pink-500/20 to-pink-600/20 rounded">
                    <span className="text-lg">🎁 🎁 🎁</span>
                    <span className="font-bold text-pink-400">12x</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gradient-to-r from-red-500/20 to-red-600/20 rounded">
                    <span className="text-lg">🍒 🍒 🍒</span>
                    <span className="font-bold text-red-400">8x</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded">
                    <span className="text-lg">⭐ ⭐ ⭐</span>
                    <span className="font-bold text-blue-400">5x</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-secondary rounded">
                    <span className="text-lg">Any 2 matching</span>
                    <span className="font-bold">1.5-3x</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-secondary rounded">
                    <span className="text-lg">Any 💎</span>
                    <span className="font-bold">0.5x</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Session Stats */}
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle>Session Stats</CardTitle>
                <CardDescription>Your current session</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Spins:</span>
                    <span className="font-bold">{stats.totalSpins}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Bet:</span>
                    <span className="font-bold">${stats.totalBet.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Won:</span>
                    <span className="font-bold">${stats.totalWon.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <span className="text-muted-foreground">Net Profit:</span>
                    <span
                      className={`font-bold ${
                        stats.totalWon - stats.totalBet > 0
                          ? 'text-green-400'
                          : stats.totalWon - stats.totalBet < 0
                          ? 'text-red-400'
                          : ''
                      }`}
                    >
                      ${(stats.totalWon - stats.totalBet).toFixed(2)}
                    </span>
                  </div>
                  {stats.totalSpins > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Return:</span>
                      <span className="font-bold">
                        {((stats.totalWon / stats.totalBet) * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Balance */}
            {user && (
              <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-purple-600/10">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Your Balance</p>
                    <p className="text-3xl font-bold font-display">
                      ${parseFloat(user.balance).toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
