import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Eye } from 'lucide-react';
import { marketSchema, sanitizeString } from '@/lib/validation';

const CATEGORIES = ['Politics', 'Sports', 'Crypto', 'Memes', 'Tech', 'Entertainment', 'General'];

const CreateMarket = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [resolutionDate, setResolutionDate] = useState('');
  const [resolutionCriteria, setResolutionCriteria] = useState('');
  const [preview, setPreview] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Please set up your account first');

      // Sanitize inputs to prevent XSS
      const sanitizedQuestion = sanitizeString(question, 200);
      const sanitizedDescription = sanitizeString(description, 1000);
      const sanitizedCriteria = sanitizeString(resolutionCriteria, 500);

      // Validate input with Zod schema
      const validationResult = marketSchema.safeParse({
        question: sanitizedQuestion,
        description: sanitizedDescription || null,
        category,
        resolution_date: new Date(resolutionDate).toISOString(),
        resolution_criteria: sanitizedCriteria || null,
      });

      if (!validationResult.success) {
        const errorMessage = validationResult.error.errors[0]?.message || 'Invalid input';
        throw new Error(errorMessage);
      }

      const validatedData = validationResult.data;

      const { data, error } = await supabase
        .from('markets')
        .insert({
          creator_id: user.id,
          question: validatedData.question,
          description: validatedData.description,
          category: validatedData.category,
          resolution_date: validatedData.resolution_date,
          resolution_criteria: validatedData.resolution_criteria,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('Market created!');
      navigate(`/market/${data.id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <main className="container max-w-2xl py-8 pb-24 md:pb-8 space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold">Create Market</h1>
        <p className="text-muted-foreground">Launch a prediction market for the world to trade on.</p>
      </div>

      {preview ? (
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{category}</Badge>
              <Button variant="ghost" size="sm" onClick={() => setPreview(false)}>
                <Eye className="h-4 w-4 mr-1" /> Edit
              </Button>
            </div>
            <CardTitle className="font-display text-xl">{question || 'Your question here'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {description && <p className="text-muted-foreground text-sm">{description}</p>}
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 bg-primary/15 text-primary font-display font-bold" variant="outline">
                Yes 50¢
              </Button>
              <Button size="sm" className="flex-1 bg-destructive/15 text-destructive font-display font-bold" variant="outline">
                No 50¢
              </Button>
            </div>
            {resolutionCriteria && (
              <p className="text-xs text-muted-foreground"><strong>Resolution:</strong> {resolutionCriteria}</p>
            )}
            <Button className="w-full font-display font-bold" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              {createMutation.isPending ? 'Creating...' : 'Publish Market'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Question *</label>
              <Input
                placeholder="Will X happen by Y date?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="bg-secondary border-border"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Additional context about this market..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-secondary border-border min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Resolution Date *</label>
                <Input
                  type="date"
                  value={resolutionDate}
                  onChange={(e) => setResolutionDate(e.target.value)}
                  className="bg-secondary border-border"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Resolution Criteria</label>
              <Textarea
                placeholder="How will this market be resolved? What source of truth will be used?"
                value={resolutionCriteria}
                onChange={(e) => setResolutionCriteria(e.target.value)}
                className="bg-secondary border-border min-h-[60px]"
              />
            </div>

            <Button
              className="w-full font-display font-bold"
              onClick={() => setPreview(true)}
              disabled={!question.trim() || !resolutionDate}
            >
              Preview Market
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
};

export default CreateMarket;
