import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, DollarSign, AlertTriangle } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';

export default function Admin() {
  const navigate = useNavigate();
  const { authUser } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [markets, setMarkets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedMarket, setSelectedMarket] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [johnbucksAmount, setJohnbucksAmount] = useState('');

  useEffect(() => {
    checkAdminAccess();
  }, [authUser]);

  const checkAdminAccess = async () => {
    if (!authUser) {
      setLoading(false);
      return;
    }

    // Check if user has admin role in metadata
    const role = authUser.user_metadata?.role;
    if (role === 'admin') {
      setIsAdmin(true);
      loadData();
    }
    setLoading(false);
  };

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

  const grantJohnbucks = async () => {
    if (!selectedUser || !johnbucksAmount) {
      toast.error('Please select a user and enter an amount');
      return;
    }

    const amount = parseFloat(johnbucksAmount);
    if (isNaN(amount)) {
      toast.error('Invalid amount: must be a number');
      return;
    }
    if (amount < 0) {
      toast.error('Invalid amount: cannot be negative');
      return;
    }
    if (amount > 1000000) {
      toast.error('Invalid amount: maximum is 1,000,000');
      return;
    }
    if (!Number.isFinite(amount)) {
      toast.error('Invalid amount: must be a finite number');
      return;
    }
    if (amount !== Math.floor(amount)) {
      toast.error('Invalid amount: must be a whole number');
      return;
    }

    try {
      const { error } = await supabase.rpc('admin_grant_johnbucks', {
        p_user_id: selectedUser,
        p_amount: amount,
      });

      if (error) throw error;

      toast.success(`Granted ${amount.toLocaleString()} JohnBucks!`);
      setJohnbucksAmount('');
      setSelectedUser('');
      loadData();
    } catch (error: any) {
      console.error('Grant error:', error);
      const errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('Unauthorized')) {
        toast.error('Admin access required');
      } else if (errorMessage.includes('not found')) {
        toast.error('User not found');
      } else {
        toast.error('Failed to grant JohnBucks');
      }
    }
  };

  const resolveMarket = async (outcome: 'yes' | 'no') => {
    if (!selectedMarket) {
      toast.error('Please select a market');
      return;
    }

    try {
      const { error } = await supabase.rpc('resolve_market', {
        p_market_id: selectedMarket,
        p_outcome: outcome,
      });

      if (error) throw error;

      toast.success(`Market resolved as ${outcome.toUpperCase()}!`);
      setSelectedMarket('');
      loadData();
    } catch (error: any) {
      console.error('Resolution error:', error);
      const errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('Unauthorized')) {
        toast.error('Only creator or admin can resolve markets');
      } else if (errorMessage.includes('not found')) {
        toast.error('Market not found');
      } else {
        toast.error(`Failed to resolve market: ${errorMessage}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="container py-8">
        <div className="max-w-2xl mx-auto text-center">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="container py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
              <CardTitle>Authentication Required</CardTitle>
            </div>
            <CardDescription>
              You must be signed in to access the admin panel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')}>
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-red-500" />
              <CardTitle>Access Denied</CardTitle>
            </div>
            <CardDescription>
              You do not have admin privileges. This incident has been logged.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')}>
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <CardTitle>Admin Panel</CardTitle>
            </div>
            <CardDescription>
              Manage markets and grant JohnBucks
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Grant JohnBucks */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              <CardTitle>Grant JohnBucks</CardTitle>
            </div>
            <CardDescription>
              Give JohnBucks to users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grant-user">Select User</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger id="grant-user">
                  <SelectValue placeholder="Choose a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.display_name} (${user.balance})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="grant-amount">Amount (max 1,000,000)</Label>
              <Input
                id="grant-amount"
                type="number"
                min="1"
                max="1000000"
                step="1"
                value={johnbucksAmount}
                onChange={(e) => setJohnbucksAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>

            <Button onClick={grantJohnbucks} className="w-full">
              Grant JohnBucks
            </Button>
          </CardContent>
        </Card>

        {/* Resolve Markets */}
        <Card>
          <CardHeader>
            <CardTitle>Resolve Markets</CardTitle>
            <CardDescription>
              Set the outcome of active markets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resolve-market">Select Market</Label>
              <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                <SelectTrigger id="resolve-market">
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

            <div className="grid grid-cols-2 gap-4">
              <Button onClick={() => resolveMarket('yes')} className="w-full">
                Resolve YES
              </Button>
              <Button onClick={() => resolveMarket('no')} variant="secondary" className="w-full">
                Resolve NO
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
