import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MarketCard } from '@/components/MarketCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, TrendingUp, Zap } from 'lucide-react';

const CATEGORIES = ['All', 'Politics', 'Sports', 'Crypto', 'Memes', 'Tech', 'Entertainment', 'General'];

const Index = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const { data: markets, isLoading } = useQuery({
    queryKey: ['markets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('markets')
        .select('*')
        .in('status', ['active', 'resolved_yes', 'resolved_no'])
        .order('total_volume', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = markets?.filter((m) => {
    const matchesSearch = m.question.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'All' || m.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <main className="container py-8 pb-24 md:pb-8 space-y-8">
      {/* Hero */}
      <section className="text-center space-y-4 py-8">
        <div className="flex items-center justify-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <Badge variant="outline" className="text-xs uppercase tracking-widest border-primary/30 text-primary">
            Powered by Advanced AI™
          </Badge>
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          Predict. Trade. <span className="text-primary">Profit.</span>
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          The world's most sophisticated prediction market platform. Trade shares on future events using JohnBucks™.
        </p>
      </section>

      {/* Search & Filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={category === cat ? 'default' : 'ghost'}
              onClick={() => setCategory(cat)}
              className="shrink-0 text-xs"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Trending */}
      {markets && markets.length > 0 && !search && category === 'All' && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold text-lg">Trending Markets</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {markets.slice(0, 3).map((m) => (
              <MarketCard key={m.id} market={m} />
            ))}
          </div>
        </section>
      )}

      {/* All Markets */}
      <section className="space-y-3">
        <h2 className="font-display font-semibold text-lg">
          {category === 'All' ? 'All Markets' : category}
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-40 rounded-lg bg-secondary animate-pulse" />
            ))}
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m) => (
              <MarketCard key={m.id} market={m} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <p className="font-display text-lg">No markets found</p>
            <p className="text-sm mt-1">Be the first to create one!</p>
          </div>
        )}
      </section>
    </main>
  );
};

export default Index;
