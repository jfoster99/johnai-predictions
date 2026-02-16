
-- Users table for anonymous users
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 10000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Anyone can read users (for leaderboard)
CREATE POLICY "Anyone can read users" ON public.users FOR SELECT USING (true);
-- Anyone can insert (anonymous onboarding)
CREATE POLICY "Anyone can insert users" ON public.users FOR INSERT WITH CHECK (true);
-- Anyone can update their own user (balance changes keyed by app logic)
CREATE POLICY "Anyone can update users" ON public.users FOR UPDATE USING (true);

-- Markets table
CREATE TABLE public.markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  resolution_criteria TEXT,
  resolution_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved_yes', 'resolved_no', 'cancelled')),
  yes_price NUMERIC NOT NULL DEFAULT 0.50,
  no_price NUMERIC NOT NULL DEFAULT 0.50,
  total_volume NUMERIC NOT NULL DEFAULT 0,
  yes_shares_outstanding NUMERIC NOT NULL DEFAULT 0,
  no_shares_outstanding NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read markets" ON public.markets FOR SELECT USING (true);
CREATE POLICY "Anyone can create markets" ON public.markets FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update markets" ON public.markets FOR UPDATE USING (true);

-- Trades table
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES public.markets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('yes', 'no')),
  direction TEXT NOT NULL CHECK (direction IN ('buy', 'sell')),
  shares NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read trades" ON public.trades FOR SELECT USING (true);
CREATE POLICY "Anyone can insert trades" ON public.trades FOR INSERT WITH CHECK (true);

-- Positions table
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES public.markets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('yes', 'no')),
  shares NUMERIC NOT NULL DEFAULT 0,
  avg_price NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(market_id, user_id, side)
);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read positions" ON public.positions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert positions" ON public.positions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update positions" ON public.positions FOR UPDATE USING (true);

-- Enable realtime for markets and trades (only if publication exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.markets;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
  END IF;
END $$;
