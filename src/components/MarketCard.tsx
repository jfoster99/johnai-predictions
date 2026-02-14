import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, BarChart3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type Market = Tables<'markets'>;

interface MarketCardProps {
  market: Market;
}

export const MarketCard = ({ market }: MarketCardProps) => {
  const yesPercent = Math.round(market.yes_price * 100);
  const noPercent = Math.round(market.no_price * 100);
  const isResolved = market.status !== 'active';
  const resolvedYes = market.status === 'resolved_yes';
  const resolvedNo = market.status === 'resolved_no';

  return (
    <Link to={`/market/${market.id}`}>
      <Card className={`group border-border bg-card hover:border-primary/30 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 ${isResolved ? 'opacity-90' : ''}`}>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {market.question}
            </h3>
            <Badge variant="outline" className="shrink-0 text-[10px] uppercase tracking-wider">
              {market.category}
            </Badge>
          </div>

          {isResolved && (
            <div className="flex items-center justify-center">
              <Badge className={`${resolvedYes ? 'bg-green-600' : 'bg-red-600'} text-white font-bold px-4 py-1`}>
                Resolved: {resolvedYes ? 'YES ✓' : 'NO ✗'}
              </Badge>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-primary/15 text-primary hover:bg-primary/25 border-0 font-display font-bold"
              variant="outline"
              disabled={isResolved}
            >
              Yes {yesPercent}¢
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-destructive/15 text-destructive hover:bg-destructive/25 border-0 font-display font-bold"
              variant="outline"
              disabled={isResolved}
            >
              No {noPercent}¢
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              <span>${market.total_volume.toLocaleString()} vol</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(market.resolution_date), { addSuffix: true })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
