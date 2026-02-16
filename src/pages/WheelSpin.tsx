import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { Sparkles, TrendingDown } from 'lucide-react';

const WHEEL_PRIZES = [
  { label: '5 JB', value: 5, color: '#ef4444', probability: 30 },
  { label: '10 JB', value: 10, color: '#f97316', probability: 25 },
  { label: 'BROKE', value: 0, color: '#000000', probability: 20 },
  { label: '25 JB', value: 25, color: '#22c55e', probability: 15 },
  { label: 'Tax Audit', value: 0, color: '#6b7280', probability: 8 },
  { label: '100 JB', value: 100, color: '#3b82f6', probability: 1.9 },
  { label: 'JACKPOT', value: 1000, color: '#fbbf24', probability: 0.1 },
];

const SPIN_COST = 50;

export default function WheelSpin() {
  const { user, refreshUser } = useUser();
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastSpin, setLastSpin] = useState<Date | null>(null);
  const [canSpin, setCanSpin] = useState(true);

  const getWeightedPrize = () => {
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (const prize of WHEEL_PRIZES) {
      cumulative += prize.probability;
      if (random <= cumulative) {
        return prize;
      }
    }
    return WHEEL_PRIZES[0];
  };

  const calculateRotation = (prizeIndex: number) => {
    const segmentAngle = 360 / WHEEL_PRIZES.length;
    const prizeAngle = segmentAngle * prizeIndex + segmentAngle / 2;
    const spins = 5 + Math.random() * 3; // 5-8 full rotations
    return 360 * spins + (360 - prizeAngle);
  };

  const spin = async () => {
    if (!user) {
      toast.error('Please sign in to spin');
      return;
    }

    if (parseFloat(user.balance) < SPIN_COST) {
      toast.error(`You need ${SPIN_COST} JohnBucks to spin!`);
      return;
    }

    setIsSpinning(true);

    // Deduct spin cost
    const { error: deductError } = await supabase
      .from('users')
      .update({ balance: parseFloat(user.balance) - SPIN_COST })
      .eq('id', user.id);

    if (deductError) {
      toast.error('Failed to spin');
      setIsSpinning(false);
      return;
    }

    // Determine prize
    const prize = getWeightedPrize();
    const prizeIndex = WHEEL_PRIZES.indexOf(prize);
    const newRotation = rotation + calculateRotation(prizeIndex);
    
    setRotation(newRotation);

    // Wait for spin animation
    setTimeout(async () => {
      const netWin = prize.value - SPIN_COST;
      
      // Update balance with prize
      if (prize.value !== 0) {
        const newBalance = parseFloat(user.balance) - SPIN_COST + prize.value;
        await supabase
          .from('users')
          .update({ balance: Math.max(0, newBalance) })
          .eq('id', user.id);
      }

      await refreshUser();
      setIsSpinning(false);
      setLastSpin(new Date());

      if (prize.label === 'BROKE' || prize.label === 'Tax Audit') {
        toast.error(`💀 ${prize.label}! You get nothing!`, {
          description: `Lost ${SPIN_COST} JB (skill issue)`,
        });
      } else if (prize.label === 'JACKPOT') {
        toast.success(`🎉 JACKPOT! Won ${prize.value} JB!`, {
          description: `Net: +${netWin} JB`,
        });
      } else {
        toast.success(`Won ${prize.value} JB!`, {
          description: `Net: ${netWin > 0 ? '+' : ''}${netWin} JB`,
        });
      }
    }, 4000);
  };

  return (
    <main className="container py-8 pb-24 md:pb-8 max-w-4xl">
      <Card className="border-2">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-3xl font-display">Daily Wheel of Misfortune</CardTitle>
            <TrendingDown className="h-5 w-5 text-red-500" />
          </div>
          <CardDescription className="text-base">
            Spin for {SPIN_COST} JB • House Edge: 69% • You Will Probably Lose
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Wheel */}
          <div className="relative mx-auto w-full max-w-md aspect-square flex items-center justify-center">
            {/* Arrow Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
              <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[40px] border-t-primary drop-shadow-lg" />
            </div>

            {/* Wheel */}
            <div
              className="relative w-[90%] aspect-square rounded-full border-8 border-primary shadow-2xl overflow-hidden"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
              }}
            >
              {WHEEL_PRIZES.map((prize, index) => {
                const segmentAngle = 360 / WHEEL_PRIZES.length;
                const startAngle = segmentAngle * index;
                
                return (
                  <div
                    key={index}
                    className="absolute inset-0 flex items-start justify-center origin-center"
                    style={{
                      transform: `rotate(${startAngle}deg)`,
                      clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.sin((segmentAngle * Math.PI) / 180)}% ${50 - 50 * Math.cos((segmentAngle * Math.PI) / 180)}%)`,
                      backgroundColor: prize.color,
                    }}
                  >
                    <div
                      className="text-white font-bold text-xs mt-12 drop-shadow-lg max-w-[60px] text-center leading-tight"
                      style={{
                        transform: `rotate(${segmentAngle / 2}deg)`,
                      }}
                    >
                      {prize.label}
                    </div>
                  </div>
                );
              })}
              
              {/* Center circle */}
              <div className="absolute inset-[35%] rounded-full bg-primary border-4 border-white shadow-inner flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <p className="text-2xl font-bold text-green-500">0.1%</p>
              <p className="text-sm text-muted-foreground">Jackpot Chance</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-red-500">28%</p>
              <p className="text-sm text-muted-foreground">Lose Money</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">{SPIN_COST} JB</p>
              <p className="text-sm text-muted-foreground">Cost to Spin</p>
            </div>
          </div>

          {/* Spin Button */}
          <div className="space-y-4">
            <Button
              onClick={spin}
              disabled={isSpinning || !user || parseFloat(user?.balance || '0') < SPIN_COST}
              className="w-full h-14 text-lg"
              size="lg"
            >
              {isSpinning ? 'Spinning...' : `Spin the Wheel (${SPIN_COST} JB)`}
            </Button>
            
            {user && parseFloat(user.balance) < SPIN_COST && (
              <p className="text-center text-sm text-red-500">
                Insufficient balance. You need {SPIN_COST - parseFloat(user.balance)} more JB.
              </p>
            )}
          </div>

          {/* Disclaimer */}
          <div className="text-center text-xs text-muted-foreground space-y-1 border-t pt-4">
            <p>⚠️ This game is rigged against you</p>
            <p>💸 Average loss per spin: 15 JB</p>
            <p>🎰 When you gamble, the house always wins</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
