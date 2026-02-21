import { useState, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Share2, Repeat2, Flame, AlertTriangle, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type PostType = 'post' | 'news' | 'ad' | 'hot_take';

interface FeedItem {
  id: number;
  type: PostType;
  author: string;
  avatar: string;
  handle: string;
  content: string;
  likes: number;
  comments: number;
  reposts: number;
  timeAgo: string;
  badge?: string;
  image?: string;
}

const FUNNY_AUTHORS = [
  { name: 'Sigma Grindset', handle: '@sigmagrind99', avatar: '😤' },
  { name: 'Crypto Bro Kevin', handle: '@kevinmoon100x', avatar: '🚀' },
  { name: 'Your Mom', handle: '@ur_actual_mom', avatar: '👩' },
  { name: 'Local Man', handle: '@justanormaldude', avatar: '🧔' },
  { name: 'AI Overlord 3000', handle: '@definitely_human', avatar: '🤖' },
  { name: 'Gamer Goblin', handle: '@gamergoblin420', avatar: '👾' },
  { name: 'Finance Expert', handle: '@trustmebro_finance', avatar: '📈' },
  { name: 'Breaking News Bot', handle: '@veryrealcnn', avatar: '📺' },
  { name: 'Philosopher King', handle: '@bigbrain_vibes', avatar: '🧠' },
  { name: 'Flat Earther Steve', handle: '@globeisalieSteve', avatar: '🌍' },
  { name: 'Dog Whisperer', handle: '@woofgang_amadeus', avatar: '🐕' },
  { name: 'Conspiracy Carol', handle: '@carolknowsthetruth', avatar: '🕵️' },
];

const POST_TEMPLATES = [
  "Just realized that 'fun' is literally inside 'fundamental.' You're welcome. 🧠",
  "I asked my financial advisor if I should invest in JohnBucks. He cried and handed me a pamphlet.",
  "Wake up. Grind. Predict markets. Lose JohnBucks. Spiral existentially. Sleep. Repeat. ✨ #HustleCulture",
  "Bro the economy is literally just vibes at this point",
  "Not me spending 4 hours optimizing a portfolio that's entirely meme stocks 💀",
  "My trading strategy: buy high, sell lower, cry, repeat",
  "The best investment I ever made was therapy but honestly the slot machine is a close second",
  "Hot take: money printer go brrrr is actually a valid economic model",
  "Me explaining to my parents why I lost my rent money on a prediction market about whether a chicken would cross a road",
  "If I had a JohnBuck for every time I made a bad trade... I'd have way more JohnBucks than I started with tbh",
  "Society if we just taxed unrealized gains on vibes",
  "My portfolio is doing great if you measure it in 'learning experiences'",
  "Day 47 of pretending I understand what I'm doing in the markets",
  "Economists HATE this one weird trick (it's just guessing)",
  "Woke up, chose chaos, opened loot box, got Nuh Uh Card. Blessed day.",
  "The stock market is just astrology for men who own boat shoes",
  "I don't have a gambling problem I have a prediction market HOBBY",
  "Every time I think I've hit rock bottom, the slot machine adds a new floor",
  "My financial plan is 'vibes based' and I think that shows real entrepreneurial spirit",
  "Just checked my portfolio. It looked back at me with pity.",
];

const NEWS_TEMPLATES = [
  "BREAKING: Local Man Achieves Sigma Mindset, Still Can't Afford Avocado Toast",
  "EXCLUSIVE: Scientists Confirm That Your Ex Is Actually Fine Without You",
  "ALERT: The Economy Asks That You Please Stop Looking At It",
  "DEVELOPING: Flat Earth Theory Gains New Supporter After Man Stubs Toe On Globe",
  "REPORT: Area Slot Machine 'Just Needs To Warm Up,' Says Man On 47th Spin",
  "UPDATE: Dog Owners Confirm Dogs Are Genuinely Better Than People",
  "BREAKING: Man Who Said 'It's Not About The Money' Immediately Asked About The Money",
  "EXCLUSIVE: Crypto Influencer Has 'Totally Not Panicking' Face On All Day",
  "ALERT: Local Prediction Market Expert Is Wrong Again But Very Confidently",
  "DEVELOPING: JohnBucks Hit All-Time High Of Being Fake Internet Money",
  "REPORT: Economists Admit They've Just Been Guessing This Whole Time",
  "BREAKING: Area Millennial Still Not Sure What APR Means, Has Several Credit Cards",
];

const HOT_TAKES = [
  "Unpopular opinion: if your prediction market loses money it's actually a tax write-off for your soul",
  "Hot take: the real treasure was the JohnBucks we lost along the way",
  "Controversial: slot machines are just spinning wheels of capitalism and I am spiritually addicted to capitalism",
  "Take: the economy is a loot box and we're all just hoping for legendary",
  "Hot take: 'buy low sell high' is literally impossible advice and everyone who gives it is a war criminal (legally fine, morally adjacent)",
  "Unpopular opinion: we should replace GDP with 'national vibe score'",
  "Controversial: bears are not actually bearish, they are actually quite bullish on fish and honey",
  "Take: if the invisible hand of the market were visible it would be doing something embarrassing",
];

const AD_TEMPLATES = [
  { text: "💊 GRINDSET PILLS™ — Take 3 daily to unlock your inner sigma. Not FDA approved. Actually just Skittles.", badge: "SPONSORED" },
  { text: "📱 TrustMeBro™ Financial App — Turn your savings into LESSONS. Download now, regret later.", badge: "AD" },
  { text: "🧢 SIGMA HAT — Wear it and increase your prediction accuracy by 0%. Looks sick though.", badge: "SPONSORED" },
  { text: "🤖 AI Portfolio Manager — It's just a Magic 8-Ball in a blazer. Still better than your uncle's advice.", badge: "AD" },
  { text: "🍕 PizzaToken™ — Backed by actual pizza. No wait, just vibes. Buy now while floor price is 'low'.", badge: "SPONSORED" },
  { text: "📊 ChartBro Pro — Our AI draws lines on graphs. Your lines. Our AI. Same results.", badge: "AD" },
];

let nextId = 1;

const generatePost = (): FeedItem => {
  const author = FUNNY_AUTHORS[Math.floor(Math.random() * FUNNY_AUTHORS.length)];
  const type: PostType = Math.random() < 0.15
    ? 'ad'
    : Math.random() < 0.2
    ? 'news'
    : Math.random() < 0.2
    ? 'hot_take'
    : 'post';

  const timeOptions = ['just now', '1m', '3m', '7m', '12m', '23m', '1h', '2h', '4h', '8h', '1d'];
  const timeAgo = timeOptions[Math.floor(Math.random() * timeOptions.length)];

  if (type === 'news') {
    const template = NEWS_TEMPLATES[Math.floor(Math.random() * NEWS_TEMPLATES.length)];
    return {
      id: nextId++,
      type,
      author: 'Very Real News Network',
      avatar: '📺',
      handle: '@veryrealcnn',
      content: template,
      likes: Math.floor(Math.random() * 50000) + 1000,
      comments: Math.floor(Math.random() * 5000) + 100,
      reposts: Math.floor(Math.random() * 10000) + 500,
      timeAgo,
      badge: '🔴 BREAKING',
    };
  }

  if (type === 'ad') {
    const ad = AD_TEMPLATES[Math.floor(Math.random() * AD_TEMPLATES.length)];
    return {
      id: nextId++,
      type,
      author: 'Promoted Content',
      avatar: '💰',
      handle: '@totally_not_an_ad',
      content: ad.text,
      likes: Math.floor(Math.random() * 12),
      comments: Math.floor(Math.random() * 3),
      reposts: 0,
      timeAgo,
      badge: ad.badge,
    };
  }

  if (type === 'hot_take') {
    const template = HOT_TAKES[Math.floor(Math.random() * HOT_TAKES.length)];
    return {
      id: nextId++,
      type,
      author: author.name,
      avatar: author.avatar,
      handle: author.handle,
      content: template,
      likes: Math.floor(Math.random() * 200000) + 5000,
      comments: Math.floor(Math.random() * 80000) + 1000,
      reposts: Math.floor(Math.random() * 50000) + 500,
      timeAgo,
      badge: '🔥 HOT TAKE',
    };
  }

  const template = POST_TEMPLATES[Math.floor(Math.random() * POST_TEMPLATES.length)];
  return {
    id: nextId++,
    type: 'post',
    author: author.name,
    avatar: author.avatar,
    handle: author.handle,
    content: template,
    likes: Math.floor(Math.random() * 10000),
    comments: Math.floor(Math.random() * 2000),
    reposts: Math.floor(Math.random() * 3000),
    timeAgo,
  };
};

const generateBatch = (count = 8): FeedItem[] =>
  Array.from({ length: count }, generatePost);

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

export default function Doomscroll() {
  const [items, setItems] = useState<FeedItem[]>(() => generateBatch(10));
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [scrollTime, setScrollTime] = useState(0);

  // Track how long the user has been doomscrolling
  useEffect(() => {
    const interval = setInterval(() => setScrollTime((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadMore = useCallback(() => {
    if (isLoading) return;
    setIsLoading(true);
    setTimeout(() => {
      setItems((prev) => [...prev, ...generateBatch(6)]);
      setIsLoading(false);
    }, 800);
  }, [isLoading]);

  // Infinite scroll via IntersectionObserver on a sentinel div
  useEffect(() => {
    const sentinel = document.getElementById('doomscroll-sentinel');
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const toggleLike = (id: number) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const formatScrollTime = (secs: number): string => {
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-background py-6 pb-24 md:pb-8">
      <div className="max-w-xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl font-bold mb-1 bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
            📱 DoomFeed™
          </h1>
          <p className="text-muted-foreground text-sm">
            Algorithmically optimized to waste your time
          </p>
          <div className="mt-2 inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1 text-xs text-red-400">
            <Flame className="h-3 w-3" />
            Time doomscrolled: {formatScrollTime(scrollTime)}
          </div>
        </div>

        {/* Warning banner */}
        {scrollTime >= 60 && (
          <div className="mb-4 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-yellow-400 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>You've been doomscrolling for {formatScrollTime(scrollTime)}. Maybe touch some grass? 🌱 (jk keep scrolling)</span>
          </div>
        )}

        {/* Feed */}
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-4 ${
                item.type === 'ad'
                  ? 'bg-yellow-500/5 border-yellow-500/20'
                  : item.type === 'news'
                  ? 'bg-red-500/5 border-red-500/20'
                  : item.type === 'hot_take'
                  ? 'bg-orange-500/5 border-orange-500/20'
                  : 'bg-card border-border'
              }`}
            >
              {/* Post header */}
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0 mt-0.5">{item.avatar}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{item.author}</span>
                    <span className="text-muted-foreground text-xs">{item.handle}</span>
                    {item.badge && (
                      <Badge variant="outline" className="text-xs py-0 px-1.5">
                        {item.badge}
                      </Badge>
                    )}
                    <span className="text-muted-foreground text-xs ml-auto shrink-0">{item.timeAgo}</span>
                  </div>

                  {item.type === 'ad' && (
                    <div className="flex items-center gap-1 text-xs text-yellow-500/70 mb-1">
                      <Megaphone className="h-3 w-3" />
                      Sponsored
                    </div>
                  )}

                  <p className="mt-1.5 text-sm leading-relaxed">{item.content}</p>

                  {/* Engagement row */}
                  {item.type !== 'ad' && (
                    <div className="flex items-center gap-4 mt-3 text-muted-foreground">
                      <button
                        onClick={() => toggleLike(item.id)}
                        className={`flex items-center gap-1 text-xs hover:text-red-400 transition-colors ${likedIds.has(item.id) ? 'text-red-400' : ''}`}
                      >
                        <Heart className={`h-3.5 w-3.5 ${likedIds.has(item.id) ? 'fill-current' : ''}`} />
                        {formatCount(item.likes + (likedIds.has(item.id) ? 1 : 0))}
                      </button>
                      <button className="flex items-center gap-1 text-xs hover:text-blue-400 transition-colors">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {formatCount(item.comments)}
                      </button>
                      <button className="flex items-center gap-1 text-xs hover:text-green-400 transition-colors">
                        <Repeat2 className="h-3.5 w-3.5" />
                        {formatCount(item.reposts)}
                      </button>
                      <button className="flex items-center gap-1 text-xs hover:text-primary transition-colors ml-auto">
                        <Share2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Sentinel for infinite scroll */}
        <div id="doomscroll-sentinel" className="py-4 text-center">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Loading more content to ruin your productivity...
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={loadMore} className="text-muted-foreground">
              Load more 👇
            </Button>
          )}
        </div>

        {/* Bottom disclaimer */}
        <div className="text-center text-xs text-muted-foreground pb-4 space-y-1">
          <p>🧠 DoomFeed™ is powered by Pure Chaos™ and randomness</p>
          <p>No real news. No real people. 100% fake engagement numbers.</p>
        </div>
      </div>
    </div>
  );
}
