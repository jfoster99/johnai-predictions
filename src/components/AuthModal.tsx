import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export const AuthModal = ({ open, onClose }: AuthModalProps) => {
  const { signIn } = useUser();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      toast.error('Please enter a username');
      return;
    }

    if (username.length < 2 || username.length > 50) {
      toast.error('Username must be 2-50 characters');
      return;
    }

    // Validate username format (alphanumeric, underscore, hyphen only)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      toast.error('Username can only contain letters, numbers, underscores, and hyphens');
      return;
    }

    // Prevent XSS in username
    if (/<script|javascript:|on\w+=/i.test(username)) {
      toast.error('Invalid characters in username');
      return;
    }

    setLoading(true);
    try {
      await signIn(username.trim());
      toast.success(`Welcome, ${username}! You've been given 10,000 JohnBucks to start trading.`);
      setUsername('');
      onClose();
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Your Username</DialogTitle>
          <DialogDescription>
            Create an account to start trading on prediction markets
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
              maxLength={50}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Creating Account...' : 'Create Account & Start Trading'}
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            You'll receive 10,000 JohnBucks to start trading
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};
