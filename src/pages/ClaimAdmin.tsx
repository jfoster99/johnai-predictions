import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ClaimAdmin() {
  const { authUser } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleClaimAdmin = async () => {
    if (!authUser) {
      toast.error('You must be logged in to claim admin status');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      console.log('Calling claim_admin_status...');
      const { data, error } = await supabase.rpc('claim_admin_status');
      
      console.log('RPC response:', { data, error });

      if (error) {
        console.error('RPC error:', error);
        throw error;
      }

      if (!data) {
        console.error('No data returned from RPC');
        throw new Error('No response from server');
      }

      setResult(data);
      console.log('Result set:', data);

      if (data.success) {
        toast.success('Admin status granted! Please refresh the page.');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        const errorMsg = data.error || data.message || 'Failed to claim admin status';
        console.error('Operation failed:', errorMsg);
        toast.error(errorMsg);
      }
    } catch (error: any) {
      console.error('Exception caught:', error);
      toast.error(error.message || 'Failed to claim admin status');
      setResult({ success: false, message: error.message });
    } finally {
      console.log('Finally block - setting loading to false');
      setLoading(false);
    }
  };

  if (!authUser) {
    return (
      <div className="container py-8">
        <Alert>
          <AlertDescription>
            You must be logged in to claim admin status. Please sign in first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <CardTitle>Claim Admin Status</CardTitle>
          </div>
          <CardDescription>
            This is a one-time setup function. The first user to claim admin status will become the administrator
            of this prediction market platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold">Admin Privileges:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Grant JohnBucks to users</li>
              <li>Resolve markets (Yes/No outcomes)</li>
              <li>Access admin panel</li>
            </ul>
          </div>

          <Button 
            onClick={handleClaimAdmin} 
            disabled={loading || (result?.success === true)}
            className="w-full"
            size="lg"
          >
            {loading ? 'Processing...' : 'Claim Admin Status'}
          </Button>

          {result && (
            <Alert variant={result.success ? 'default' : 'destructive'}>
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5" />
                )}
                <AlertDescription>{result.message || result.error}</AlertDescription>
              </div>
            </Alert>
          )}

          <div className="text-xs text-muted-foreground text-center">
            This function can only be used once. If an admin already exists, this will fail.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
