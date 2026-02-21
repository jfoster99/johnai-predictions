import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { Coins, TrendingUp, Sparkles, X } from 'lucide-react';

const POP_UP_ADS = [
  {
    title: "🚨 CONGRATULATIONS! 🚨",
    body: "You are the 1,000,000th visitor! Click here to claim your free JohnBucks* \n\n*JohnBucks not included.",
    cta: "CLAIM NOW (don't)",
  },
  {
    title: "💊 Grindset Pills™",
    body: "Tired of winning? Try our new Grindset Pills™ and lose even faster! Side effects include: more gambling.",
    cta: "Buy 3 Get 0 Free",
  },
  {
    title: "📈 Hot Stock Tip!",
    body: "Our AI predicts the market will go UP or DOWN today. Subscribe to TrustMeBro Premium to find out which!",
    cta: "Subscribe ($99/mo)",
  },
  {
    title: "🤖 Meet SlotsBot™",
    body: "SlotsBot plays the slots FOR you while you sleep! It loses money automatically so you don't have to be awake for the disappointment.",
    cta: "Let it lose for me",
  },
  {
    title: "🧘 Gambling Mindfulness™",
    body: "Have you tried being present in the moment as you watch your JohnBucks disappear? It's very calming actually.",
    cta: "Namaste (spin again)",
  },
  {
    title: "🏆 You're a Winner!",
    body: "Not at slots necessarily. But somewhere, somehow, you are winning at something. We just can't say what.",
    cta: "Thanks I needed that",
  },
  {
    title: "🍕 PizzaToken™ ICO",
    body: "Back a cryptocurrency backed by REAL pizza. Floor price: 1 slice. Market cap: whatever's in the box.",
    cta: "Invest in pizza",
  },
  {
    title: "📞 Your Mom Called",
    body: "She wants to know if you've eaten. She also said you should stop gambling but she said it nicely.",
    cta: "I'll call her later",
  },
];

interface PopUpAd {
  title: string;
  body: string;
  cta: string;
}

function AdPopup({ ad, onClose }: { ad: PopUpAd; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border-2 border-primary/40 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative animate-in zoom-in duration-300">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close ad"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-center space-y-3">
          <h3 className="font-display text-xl font-bold">{ad.title}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{ad.body}</p>
          <Button onClick={onClose} className="w-full" size="sm">
            {ad.cta}
          </Button>
          <p className="text-xs text-muted-foreground/50">
            Advertisement • Definitely Real™
          </p>
        </div>
      </div>
    </div>
  );
}

const SYMBOLS = ['🍒', '💎', '⭐', '🎰', '🎁'];

// Vegas-realistic weighted probabilities: 🍒=40%, ⭐=30%, 🎰=15%, 🎁=10%, 💎=5%
const SYMBOL_WEIGHTS = [40, 5, 30, 15, 10]; // Percentages

export default function SlotMachine() {
  const { user, refreshUser } = useUser();
  const [bet, setBet] = useState('10');
  const [reels, setReels] = useState(['🎰', '🎰', '🎰']);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [stats, setStats] = useState({ totalSpins: 0, totalWon: 0, totalBet: 0 });
  const [activeAd, setActiveAd] = useState<PopUpAd | null>(null);

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
    
    // Only three matching symbols pay (Vegas-style)
    if (r1 === r2 && r2 === r3) {
      if (r1 === '💎') return betAmount * 50; // Diamond jackpot (rare: ~0.01%)
      if (r1 === '🎁') return betAmount * 20; // Gift jackpot (~0.1%)
      if (r1 === '🎰') return betAmount * 15; // Slot machine jackpot (~0.34%)
      if (r1 === '🍒') return betAmount * 10; // Cherry jackpot (~6.4%)
      if (r1 === '⭐') return betAmount * 8;  // Star jackpot (~2.7%)
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
        
        // SECURITY FIX: Call secure server-side function instead of client-side calculation
        // The server generates random symbols and calculates winnings to prevent manipulation
        // User ID is derived from auth token on server-side for security
        supabase.rpc('play_slots', {
          p_bet_amount: betAmount
        }).then(({ data, error }) => {
          if (error) {
            toast.error(error.message || 'Failed to play slots');
            setIsSpinning(false);
            return;
          }
          
          if (!data || data.length === 0) {
            toast.error('Invalid response from server');
            setIsSpinning(false);
            return;
          }

          const result = data[0];
          
          // Display server-determined symbols
          const finalReels = [result.symbol1, result.symbol2, result.symbol3];
          setReels(finalReels);
          setLastWin(result.payout);
          
          // Refresh user balance
          refreshUser();
          
          // Show appropriate toast message
          if (result.won && result.payout > 0) {
            const profit = result.payout - betAmount;
            if (profit > 0) {
              toast.success(`🎉 You won $${result.payout.toFixed(2)}! (Profit: $${profit.toFixed(2)})`);
            } else {
              toast.info(`You won $${result.payout.toFixed(2)} back!`);
            }
          } else {
            toast.error(`No match. You lost $${betAmount.toFixed(2)}`);
          }
          
          // Update stats
          setStats(prev => ({
            totalSpins: prev.totalSpins + 1,
            totalWon: prev.totalWon + (result.payout || 0),
            totalBet: prev.totalBet + betAmount,
          }));
          
          setIsSpinning(false);

          // ~30% chance to show a funny pop-up ad after each spin
          if (Math.random() < 0.3) {
            const ad = POP_UP_ADS[Math.floor(Math.random() * POP_UP_ADS.length)];
            setActiveAd(ad);
          }
        });
      }
    }, spinInterval);
  };

  const quickBet = (amount: number) => {
    setBet(amount.toString());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8">
      {activeAd && <AdPopup ad={activeAd} onClose={() => setActiveAd(null)} />}
      <div className="container max-w-4xl">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            🎰 JohnBucks Slots
          </h1>
          <p className="text-muted-foreground">
            Try your luck! Vegas-style odds with ~94% return to player.
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
                    <span className="font-bold text-yellow-400">50x</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gradient-to-r from-purple-500/20 to-purple-600/20 rounded">
                    <span className="text-lg">🎁 🎁 🎁</span>
                    <span className="font-bold text-purple-400">20x</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gradient-to-r from-pink-500/20 to-pink-600/20 rounded">
                    <span className="text-lg">🎰 🎰 🎰</span>
                    <span className="font-bold text-pink-400">15x</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gradient-to-r from-red-500/20 to-red-600/20 rounded">
                    <span className="text-lg">🍒 🍒 🍒</span>
                    <span className="font-bold text-red-400">10x</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded">
                    <span className="text-lg">⭐ ⭐ ⭐</span>
                    <span className="font-bold text-blue-400">8x</span>
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
