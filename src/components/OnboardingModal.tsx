import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { DollarSign } from 'lucide-react';

export const OnboardingModal = () => {
  const { user, loading, setUser } = useUser();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading || user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedName = name.trim().replace(/[<>]/g, '');
    if (!sanitizedName || sanitizedName.length < 1 || sanitizedName.length > 30) return;
    setSubmitting(true);

    const { data, error } = await supabase
      .from('users')
      .insert({ display_name: sanitizedName })
      .select()
      .single();

    if (data && !error) {
      localStorage.setItem('johnai_user_id', data.id);
      setUser(data);
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-center">
            Welcome to JohnAI Predictions
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Enter a display name to start trading. You'll receive <span className="text-primary font-semibold">$10,000 JohnBucks</span> to bet with.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Input
            placeholder="Your display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            className="bg-secondary border-border"
          />
          <Button type="submit" disabled={!name.trim() || submitting} className="w-full font-semibold">
            <DollarSign className="mr-1 h-4 w-4" />
            Claim $10,000 JohnBucks
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
