import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';

const Portfolio = () => {
  const { user } = useUser();

  const { data: positions } = useQuery({
    queryKey: ['positions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('positions')
        .select('*, markets(question, yes_price, no_price, status)')
        .eq('user_id', user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: trades } = useQuery({
    queryKey: ['user-trades', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*, markets(question)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (!user) {
    return (
      <main className="container py-8 text-center">
        <p className="text-muted-foreground">Please set up your account to view your portfolio.</p>
      </main>
    );
  }

  const portfolioValue = (positions || []).reduce((sum: number, p: any) => {
    const currentPrice = p.side === 'yes' ? p.markets?.yes_price : p.markets?.no_price;
    return sum + (p.shares * (currentPrice || 0));
  }, 0);

  return (
    <main className="container py-8 pb-24 md:pb-8 space-y-6">
      <h1 className="font-display text-3xl font-bold">Portfolio</h1>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Wallet className="h-4 w-4" />
              Cash Balance
            </div>
            <p className="font-display text-3xl font-bold text-primary">${user.balance.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="h-4 w-4" />
              Portfolio Value
            </div>
            <p className="font-display text-3xl font-bold">${portfolioValue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              Total Value
            </div>
            <p className="font-display text-3xl font-bold">${(user.balance + portfolioValue).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Positions */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-display">Active Positions</CardTitle>
        </CardHeader>
        <CardContent>
          {positions && positions.length > 0 ? (
            <div className="space-y-3">
              {positions.map((p: any) => {
                const currentPrice = p.side === 'yes' ? p.markets?.yes_price : p.markets?.no_price;
                const pnl = (currentPrice - p.avg_price) * p.shares;
                return (
                  <Link key={p.id} to={`/market/${p.market_id}`} className="block">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary hover:bg-accent transition-colors">
                      <div className="space-y-1">
                        <p className="text-sm font-medium line-clamp-1">{p.markets?.question}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${p.side === 'yes' ? 'text-primary border-primary/30' : 'text-destructive border-destructive/30'}`}>
                            {p.side.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{p.shares} shares @ ${p.avg_price.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-display font-bold">${(p.shares * currentPrice).toFixed(2)}</p>
                        <p className={`text-xs font-semibold ${pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No active positions. Start trading!</p>
          )}
        </CardContent>
      </Card>

      {/* Trade History */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-display">Trade History</CardTitle>
        </CardHeader>
        <CardContent>
          {trades && trades.length > 0 ? (
            <div className="space-y-2">
              {trades.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                  <div className="space-y-0.5">
                    <p className="line-clamp-1">{t.markets?.question}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>{t.direction === 'buy' ? 'Bought' : 'Sold'}</span>
                      <span>{t.shares}</span>
                      <Badge variant="outline" className={`text-[9px] ${t.side === 'yes' ? 'text-primary border-primary/30' : 'text-destructive border-destructive/30'}`}>
                        {t.side.toUpperCase()}
                      </Badge>
                      <span>@ ${t.price.toFixed(2)}</span>
                    </div>
                  </div>
                  <span className="font-display font-semibold">${t.total_cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No trades yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default Portfolio;
