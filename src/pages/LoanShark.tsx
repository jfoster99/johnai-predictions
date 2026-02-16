import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { DollarSign, TrendingUp, AlertTriangle, Skull } from 'lucide-react';

const INTEREST_RATE = 0.25; // 25% interest
const MAX_LOAN = 1000;

export default function LoanShark() {
  const { user, refreshUser } = useUser();
  const [loanAmount, setLoanAmount] = useState('100');
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadLoans();
    }
  }, [user]);

  const loadLoans = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setActiveLoans(data);
    }
  };

  const calculateRepayment = (amount: number) => {
    return Math.floor(amount * (1 + INTEREST_RATE));
  };

  const takeLoan = async () => {
    if (!user) {
      toast.error('Please sign in to borrow');
      return;
    }

    const amount = parseFloat(loanAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amount > MAX_LOAN) {
      toast.error(`Maximum loan is ${MAX_LOAN} JB`);
      return;
    }

    const totalOwed = activeLoans.reduce((sum, loan) => sum + loan.amount_owed, 0);
    if (totalOwed + calculateRepayment(amount) > MAX_LOAN * 2) {
      toast.error("You owe too much already! Pay back some loans first.");
      return;
    }

    setLoading(true);

    const repaymentAmount = calculateRepayment(amount);

    // Add money to balance
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: parseFloat(user.balance) + amount })
      .eq('id', user.id);

    if (updateError) {
      toast.error('Failed to process loan');
      setLoading(false);
      return;
    }

    // Create loan record
    const { error: loanError } = await supabase
      .from('loans')
      .insert({
        user_id: user.id,
        amount_borrowed: amount,
        amount_owed: repaymentAmount,
        interest_rate: INTEREST_RATE,
        status: 'active',
      });

    if (loanError) {
      toast.error('Failed to record loan');
      setLoading(false);
      return;
    }

    await refreshUser();
    await loadLoans();
    setLoading(false);

    toast.success(`💰 Loan approved! +${amount} JB`, {
      description: `You now owe ${repaymentAmount} JB (${INTEREST_RATE * 100}% interest)`,
    });
  };

  const repayLoan = async (loanId: string, amountOwed: number) => {
    if (!user) return;

    if (parseFloat(user.balance) < amountOwed) {
      toast.error("You don't have enough to repay this loan!");
      return;
    }

    setLoading(true);

    // Deduct from balance
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: parseFloat(user.balance) - amountOwed })
      .eq('id', user.id);

    if (updateError) {
      toast.error('Failed to process repayment');
      setLoading(false);
      return;
    }

    // Mark loan as repaid
    const { error: loanError } = await supabase
      .from('loans')
      .update({ status: 'repaid', repaid_at: new Date().toISOString() })
      .eq('id', loanId);

    if (loanError) {
      toast.error('Failed to record repayment');
      setLoading(false);
      return;
    }

    await refreshUser();
    await loadLoans();
    setLoading(false);

    toast.success(`Loan repaid! -${amountOwed} JB`, {
      description: "Don't come back... but you will.",
    });
  };

  const totalOwed = activeLoans.reduce((sum, loan) => sum + loan.amount_owed, 0);

  return (
    <main className="container py-8 pb-24 md:pb-8 max-w-4xl">
      <Card className="border-2 border-red-500/50">
        <CardHeader className="text-center bg-gradient-to-br from-gray-900 to-black text-white rounded-t-lg">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Skull className="h-6 w-6" />
            <CardTitle className="text-3xl font-display">Tony's Loan Office</CardTitle>
            <Skull className="h-6 w-6" />
          </div>
          <CardDescription className="text-gray-300 text-base">
            "We ain't the bank, but we're very interested in your well-being." - Tony
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Mob Guy Character */}
          <div className="flex items-center gap-4 p-4 bg-gray-900 rounded-lg border border-red-500/30">
            <div className="text-6xl">🤵</div>
            <div className="flex-1 text-sm space-y-1">
              <p className="font-semibold text-white">Tony "The Calculator" Soprano</p>
              <p className="text-gray-400 italic">
                "Listen kid, I like you. {INTEREST_RATE * 100}% is a <span className="line-through">steal</span> great rate. 
                My boys will make sure you remember to pay on time... capisce?"
              </p>
            </div>
          </div>

          {/* Active Loans Warning */}
          {activeLoans.length > 0 && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <h3 className="font-semibold text-red-500">Outstanding Debts</h3>
              </div>
              
              <div className="space-y-2">
                {activeLoans.map((loan) => (
                  <div key={loan.id} className="flex items-center justify-between p-3 bg-black/50 rounded">
                    <div className="space-y-1">
                      <p className="text-sm">
                        Borrowed: <span className="font-semibold text-green-500">{loan.amount_borrowed} JB</span>
                      </p>
                      <p className="text-sm">
                        Owe: <span className="font-semibold text-red-500">{loan.amount_owed} JB</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(loan.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      onClick={() => repayLoan(loan.id, loan.amount_owed)}
                      disabled={loading || parseFloat(user?.balance || '0') < loan.amount_owed}
                      variant="destructive"
                      size="sm"
                    >
                      Repay
                    </Button>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-red-500/30">
                <p className="text-sm font-semibold">
                  Total Owed: <span className="text-red-500">{totalOwed} JB</span>
                </p>
              </div>
            </div>
          )}

          {/* Loan Calculator */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="loan-amount">Loan Amount</Label>
              <Input
                id="loan-amount"
                type="number"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                placeholder="100"
                max={MAX_LOAN}
              />
              <p className="text-xs text-muted-foreground">Maximum: {MAX_LOAN} JB</p>
            </div>

            <div className="p-4 bg-muted rounded space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">You'll receive:</span>
                <span className="text-lg font-bold text-green-500">
                  {loanAmount ? parseFloat(loanAmount) : 0} JB
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Interest ({INTEREST_RATE * 100}%):</span>
                <span className="text-sm text-yellow-500">
                  +{loanAmount ? Math.floor(parseFloat(loanAmount) * INTEREST_RATE) : 0} JB
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-semibold">You'll owe:</span>
                <span className="text-xl font-bold text-red-500">
                  {loanAmount ? calculateRepayment(parseFloat(loanAmount)) : 0} JB
                </span>
              </div>
            </div>

            <Button
              onClick={takeLoan}
              disabled={loading || !user}
              className="w-full h-12"
              size="lg"
            >
              <DollarSign className="h-5 w-5 mr-2" />
              Take Loan
            </Button>
          </div>

          {/* Terms and Conditions */}
          <div className="text-xs text-muted-foreground space-y-1 border-t pt-4">
            <p className="font-semibold flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Terms & Conditions:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Interest rate: {INTEREST_RATE * 100}% (non-negotiable)</li>
              <li>No grace period, no excuses</li>
              <li>Late payments may result in "visits" from Tony's associates</li>
              <li>We know where you live (in the blockchain)</li>
              <li>Gambling your loan money? That's what we like to see!</li>
            </ul>
          </div>

          {/* Mob Quotes */}
          <div className="text-center text-sm italic text-muted-foreground p-4 bg-muted/50 rounded">
            💀 "A loan from Tony is like a boomerang - it always comes back... with interest." 💀
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
