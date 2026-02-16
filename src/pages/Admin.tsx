import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, TrendingUp, DollarSign } from 'lucide-react';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export default function Admin() {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [markets, setMarkets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedMarket, setSelectedMarket] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [johnbucksAmount, setJohnbucksAmount] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  useEffect(() => {
    const isAuth = sessionStorage.getItem('admin_auth') === 'true';
    if (isAuth) {
      setAuthenticated(true);
      loadData();
    }
  }, []);

  const loadData = async () => {
    const { data: marketsData } = await supabase
      .from('markets')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    
    const { data: usersData } = await supabase
      .from('users')
      .select('*')
      .order('display_name');
    
    if (marketsData) setMarkets(marketsData);
    if (usersData) setUsers(usersData);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remainingSec = Math.ceil((lockoutUntil - Date.now()) / 1000);
      toast.error(`Too many attempts. Try again in ${remainingSec}s`);
      return;
    }

    if (!ADMIN_PASSWORD) {
      toast.error('Admin access is not configured');
      return;
    }

    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_auth', 'true');
      setAuthenticated(true);
      setLoginAttempts(0);
      setLockoutUntil(null);
      loadData();
      toast.success('Admin access granted');
    } else {
      const attempts = loginAttempts + 1;
      setLoginAttempts(attempts);
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
        toast.error('Too many failed attempts. Locked out for 5 minutes.');
      } else {
        toast.error('Invalid password');
      }
    }
  };

  const resolveMarket = async (resolution: 'resolved_yes' | 'resolved_no') => {
    if (!selectedMarket) {
      toast.error('Please select a market');
      return;
    }

    try {
      console.log('Resolving market:', selectedMarket, 'as', resolution);
      
      // Get all positions for this market
      const { data: positions, error: positionsError } = await supabase
        .from('positions')
        .select('*')
        .eq('market_id', selectedMarket);

      console.log('Positions found:', positions);
      if (positionsError) {
        console.error('Error fetching positions:', positionsError);
        throw positionsError;
      }

      // Calculate payouts
      const winningSide = resolution === 'resolved_yes' ? 'yes' : 'no';
      const payouts: { [userId: string]: number } = {};

      positions?.forEach(position => {
        console.log('Checking position:', position.side, 'vs winning side:', winningSide, 'shares:', position.shares);
        if (position.side === winningSide && parseFloat(position.shares) > 0) {
          // Each winning share pays $1
          const payout = parseFloat(position.shares);
          payouts[position.user_id] = (payouts[position.user_id] || 0) + payout;
          console.log('Added payout:', payout, 'for user:', position.user_id);
        }
      });

      console.log('Total payouts:', payouts);

      // Update user balances
      for (const [userId, payout] of Object.entries(payouts)) {
        const { data: userData, error: userFetchError } = await supabase
          .from('users')
          .select('balance')
          .eq('id', userId)
          .single();

        if (userFetchError) {
          console.error('Error fetching user:', userFetchError);
          throw userFetchError;
        }

        console.log('Current balance for user', userId, ':', userData.balance);
        const newBalance = parseFloat(userData.balance) + payout;
        console.log('New balance:', newBalance);
        
        const { error: updateError } = await supabase.rpc('update_user_balance', {
          user_id_param: userId,
          new_balance: newBalance
        });

        if (updateError) {
          console.error('Error updating balance:', updateError);
          throw updateError;
        }
        console.log('Balance updated successfully');
      }

      // Update market status
      const { error: marketError } = await supabase
        .from('markets')
        .update({ status: resolution })
        .eq('id', selectedMarket);

      if (marketError) {
        console.error('Error updating market:', marketError);
        throw marketError;
      }

      const totalPaidOut = Object.values(payouts).reduce((sum, val) => sum + val, 0);
      const numWinners = Object.keys(payouts).length;
      
      if (numWinners > 0) {
        toast.success(
          `Market resolved as ${resolution === 'resolved_yes' ? 'YES' : 'NO'}. ` +
          `Paid out $${totalPaidOut.toFixed(2)} to ${numWinners} winner(s).`
        );
      } else {
        toast.success(
          `Market resolved as ${resolution === 'resolved_yes' ? 'YES' : 'NO'}. ` +
          `No winning positions found.`
        );
      }
      
      loadData();
      setSelectedMarket('');
    } catch (error) {
      console.error('Resolution error:', error);
      toast.error('Failed to resolve market. Please try again.');
    }
  };

  const giveJohnbucks = async () => {
    if (!selectedUser || !johnbucksAmount) {
      toast.error('Please select a user and enter an amount');
      return;
    }

    const amount = parseFloat(johnbucksAmount);
    if (isNaN(amount) || amount === 0) {
      toast.error('Invalid amount');
      return;
    }

    if (Math.abs(amount) > 1_000_000) {
      toast.error('Amount exceeds maximum limit');
      return;
    }

    const user = users.find(u => u.id === selectedUser);
    if (!user) return;

    const newBalance = parseFloat(user.balance) + amount;
    const { error } = await supabase.rpc('update_user_balance', {
      user_id_param: selectedUser,
      new_balance: newBalance
    });

    if (error) {
      toast.error('Failed to update balance');
    } else {
      toast.success(`Added ${amount} JohnBucks to ${user.display_name}`);
      loadData();
      setSelectedUser('');
      setJohnbucksAmount('');
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-primary/20">
          <CardHeader className="text-center">
            <Shield className="mx-auto h-12 w-12 text-primary mb-4" />
            <CardTitle className="font-display text-3xl">Admin Access</CardTitle>
            <CardDescription>Enter password to access admin panel</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="bg-secondary"
                />
              </div>
              <Button type="submit" className="w-full">
                Login
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/')}
              >
                Back to Home
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="font-display text-4xl font-bold">
            <Shield className="inline mr-2 h-8 w-8 text-primary" />
            Admin Panel
          </h1>
          <Button variant="outline" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Resolve Markets */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Resolve Market
              </CardTitle>
              <CardDescription>
                Manually resolve prediction markets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Select Market</Label>
                <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                  <SelectTrigger className="bg-secondary">
                    <SelectValue placeholder="Choose a market" />
                  </SelectTrigger>
                  <SelectContent>
                    {markets.map((market) => (
                      <SelectItem key={market.id} value={market.id}>
                        {market.question}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => resolveMarket('resolved_yes')}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Resolve YES
                </Button>
                <Button
                  onClick={() => resolveMarket('resolved_no')}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  Resolve NO
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Give JohnBucks */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Give JohnBucks
              </CardTitle>
              <CardDescription>
                Add JohnBucks to user accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Select User</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="bg-secondary">
                    <SelectValue placeholder="Choose a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.display_name} (${parseFloat(user.balance).toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={johnbucksAmount}
                  onChange={(e) => setJohnbucksAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="bg-secondary"
                />
              </div>
              <Button onClick={giveJohnbucks} className="w-full">
                Add JohnBucks
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Markets Overview */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Active Markets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {markets.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No active markets</p>
              ) : (
                markets.map((market) => (
                  <div key={market.id} className="p-3 bg-secondary rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{market.question}</p>
                      <p className="text-sm text-muted-foreground">
                        Resolves: {new Date(market.resolution_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Volume</p>
                      <p className="font-bold">${parseFloat(market.total_volume).toFixed(0)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
