import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';

const Leaderboard = () => {
  const { data: users, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('balance', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const icons = [Trophy, Medal, Award];

  return (
    <main className="container max-w-2xl py-8 pb-24 md:pb-8 space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold">Leaderboard</h1>
        <p className="text-muted-foreground">Top JohnBucks holders. Who's the most degenerate?</p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-secondary rounded animate-pulse" />
              ))}
            </div>
          ) : users && users.length > 0 ? (
            <div>
              {users.map((u, i) => {
                const Icon = icons[i] || null;
                return (
                  <div
                    key={u.id}
                    className={`flex items-center justify-between px-5 py-4 border-b border-border last:border-0 ${i < 3 ? 'bg-secondary/50' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`font-display font-bold text-lg w-8 ${i < 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                        {i + 1}
                      </span>
                      {Icon && <Icon className="h-5 w-5 text-primary" />}
                      <span className="font-medium">{u.display_name}</span>
                    </div>
                    <span className="font-display font-bold text-lg">
                      ${u.balance.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No traders yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default Leaderboard;
