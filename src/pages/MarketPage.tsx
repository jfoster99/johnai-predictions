import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Clock, BarChart3, User, TrendingUp, TrendingDown } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

const MarketPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, refreshUser } = useUser();
  const queryClient = useQueryClient();
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [shares, setShares] = useState('10');

  const { data: market, isLoading } = useQuery({
    queryKey: ['market', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('markets')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: trades } = useQuery({
    queryKey: ['trades', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*, users(display_name)')
        .eq('market_id', id!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const buyMutation = useMutation({
    mutationFn: async () => {
      if (!user || !market) throw new Error('Not ready');
      const numShares = parseInt(shares);
      if (isNaN(numShares) || numShares <= 0) throw new Error('Invalid shares');
      if (numShares > 1_000_000) throw new Error('Shares exceed maximum limit');

      const price = side === 'yes' ? market.yes_price : market.no_price;

      // Use secure trade execution function
      const { data, error } = await supabase.rpc('execute_trade', {
        p_user_id: user.id,
        p_market_id: market.id,
        p_side: side,
        p_shares: numShares,
        p_price: price
      });

      if (error) {
        console.error('Trade execution error:', error);
        throw new Error('Failed to execute trade. Please try again.');
      }

      // Update market price (simple AMM: price moves 1% per 10 shares)
      const priceShift = (numShares / 10) * 0.01;
      const newYes = Math.min(0.99, Math.max(0.01, market.yes_price + (side === 'yes' ? priceShift : -priceShift)));
      const newNo = +(1 - newYes).toFixed(4);

      await supabase.from('markets').update({
        yes_price: +newYes.toFixed(4),
        no_price: newNo,
        [`${side}_shares_outstanding`]: market[`${side}_shares_outstanding`] + numShares,
      }).eq('id', market.id);
    },
    onSuccess: () => {
      toast.success(`Bought ${shares} ${side.toUpperCase()} shares!`);
      queryClient.invalidateQueries({ queryKey: ['market', id] });
      queryClient.invalidateQueries({ queryKey: ['trades', id] });
      refreshUser();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (isLoading) {
    return (
      <main className="container py-8">
        <div className="h-64 rounded-lg bg-secondary animate-pulse" />
      </main>
    );
  }

  if (!market) {
    return (
      <main className="container py-8 text-center">
        <p className="text-muted-foreground">Market not found</p>
      </main>
    );
  }

  const yesPercent = Math.round(market.yes_price * 100);
  const noPercent = Math.round(market.no_price * 100);
  const price = side === 'yes' ? market.yes_price : market.no_price;
  const numShares = parseInt(shares) || 0;
  const totalCost = numShares * price;

  return (
    <main className="container py-8 pb-24 md:pb-8 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-3">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              {market.category}
            </Badge>
            <h1 className="font-display text-2xl md:text-3xl font-bold">{market.question}</h1>
            {market.description && (
              <p className="text-muted-foreground">{market.description}</p>
            )}
          </div>

          {/* Price Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-display font-bold">
              <span className="text-primary">Yes {yesPercent}¢</span>
              <span className="text-destructive">No {noPercent}¢</span>
            </div>
            <div className="h-3 rounded-full bg-secondary overflow-hidden flex">
              <div
                className="bg-primary transition-all duration-500"
                style={{ width: `${yesPercent}%` }}
              />
              <div
                className="bg-destructive transition-all duration-500"
                style={{ width: `${noPercent}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-secondary border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Volume</p>
                <p className="font-display font-bold text-lg">${market.total_volume.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="bg-secondary border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Resolves</p>
                <p className="font-display font-bold text-sm">{format(new Date(market.resolution_date), 'MMM d, yyyy')}</p>
              </CardContent>
            </Card>
            <Card className="bg-secondary border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">YES Shares</p>
                <p className="font-display font-bold text-lg">{market.yes_shares_outstanding}</p>
              </CardContent>
            </Card>
            <Card className="bg-secondary border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">NO Shares</p>
                <p className="font-display font-bold text-lg">{market.no_shares_outstanding}</p>
              </CardContent>
            </Card>
          </div>

          {/* Resolution Criteria */}
          {market.resolution_criteria && (
            <Card className="bg-secondary border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">Resolution Criteria</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{market.resolution_criteria}</p>
              </CardContent>
            </Card>
          )}

          {/* Activity Feed */}
          <Card className="bg-secondary border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {trades && trades.length > 0 ? (
                trades.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{t.users?.display_name || 'Anon'}</span>
                      <span>{t.direction === 'buy' ? 'bought' : 'sold'}</span>
                      <span className="font-semibold">{t.shares}</span>
                      <Badge variant="outline" className={`text-[10px] ${t.side === 'yes' ? 'text-primary border-primary/30' : 'text-destructive border-destructive/30'}`}>
                        {t.side.toUpperCase()}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No trades yet. Be the first!</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Panel */}
        <div className="space-y-4">
          <Card className="border-border bg-card sticky top-20">
            <CardHeader>
              <CardTitle className="font-display text-lg">Trade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!user ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Enter a display name to start trading
                </p>
              ) : market.status !== 'active' ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  This market has been resolved
                </p>
              ) : (
                <>
                  {/* Side Selector */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={side === 'yes' ? 'default' : 'outline'}
                      onClick={() => setSide('yes')}
                      className={side === 'yes' ? 'bg-primary text-primary-foreground' : ''}
                    >
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Yes {yesPercent}¢
                    </Button>
                    <Button
                      variant={side === 'no' ? 'default' : 'outline'}
                      onClick={() => setSide('no')}
                      className={side === 'no' ? 'bg-destructive text-destructive-foreground' : ''}
                    >
                      <TrendingDown className="h-4 w-4 mr-1" />
                      No {noPercent}¢
                    </Button>
                  </div>

                  <Separator />

                  {/* Shares Input */}
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Shares</label>
                    <Input
                      type="number"
                      min="1"
                      value={shares}
                      onChange={(e) => setShares(e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>

                  {/* Cost Summary */}
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price per share</span>
                      <span className="font-display font-semibold">${price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total cost</span>
                      <span className="font-display font-bold text-lg">${totalCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Potential payout</span>
                      <span className="font-display font-semibold text-primary">${numShares.toFixed(2)}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full font-display font-bold"
                    onClick={() => buyMutation.mutate()}
                    disabled={buyMutation.isPending || numShares <= 0 || totalCost > (user?.balance ?? 0)}
                  >
                    {buyMutation.isPending ? 'Processing...' : `Buy ${side.toUpperCase()}`}
                  </Button>

                  <p className="text-[10px] text-muted-foreground text-center">
                    Balance: ${user.balance.toLocaleString()} JohnBucks
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default MarketPage;
