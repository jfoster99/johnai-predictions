import { Link, useLocation } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { TrendingUp, Plus, Wallet, Trophy, BarChart3, Sparkles, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Navbar = () => {
  const { user } = useUser();
  const location = useLocation();

  const links = [
    { to: '/', label: 'Markets', icon: BarChart3 },
    { to: '/create', label: 'Create', icon: Plus },
    { to: '/portfolio', label: 'Portfolio', icon: Wallet },
    { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { to: '/slots', label: 'Slots', icon: Sparkles },
    { to: '/lootbox', label: 'Boxes', icon: Package },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <span className="font-display text-xl font-bold tracking-tight">
            JohnAI<span className="text-primary"> Predictions</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}>
              <Button
                variant={location.pathname === to ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            </Link>
          ))}
        </nav>

        {user && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{user.display_name}</span>
            <span className="font-display font-bold text-primary">
              ${user.balance.toLocaleString()}
            </span>
          </div>
        )}

        {/* Mobile nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-xl flex justify-around py-2 z-50">
          {links.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex flex-col items-center gap-0.5">
              <Icon className={`h-5 w-5 ${location.pathname === to ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-[10px] ${location.pathname === to ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
};
