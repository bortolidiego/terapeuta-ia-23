import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface SearchResult {
  id: string;
  content: string;
  role: string;
  created_at: string;
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultationId?: string;
}

export const SearchDialog = ({ open, onOpenChange, consultationId }: SearchDialogProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const performSearch = async (query: string) => {
    if (!query.trim() || !consultationId) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('session_messages')
        .select('id, content, role, created_at')
        .eq('session_id', consultationId)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      setResults(data || []);
    } catch (error) {
      console.error('Error searching messages:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível realizar a pesquisa.',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchQuery, consultationId]);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-primary/20 text-primary font-medium rounded px-1">
          {part}
        </mark>
      ) : part
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Pesquisar no Chat
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Digite sua pesquisa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setSearchQuery('')}
            disabled={!searchQuery}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0">
          {!consultationId ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Inicie uma conversa para pesquisar mensagens
            </div>
          ) : searchQuery && !isSearching && results.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Nenhum resultado encontrado para "{searchQuery}"
            </div>
          ) : !searchQuery ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Digite algo para pesquisar
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-3 p-1">
                {isSearching ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    Pesquisando...
                  </div>
                ) : (
                  results.map((result) => (
                    <div
                      key={result.id}
                      className="p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                        <span className="font-medium">
                          {result.role === 'user' ? 'Você' : 'Assistant'}
                        </span>
                        <span>•</span>
                        <span>{formatDate(result.created_at)}</span>
                      </div>
                      <div className="text-sm leading-relaxed">
                        {highlightText(result.content, searchQuery)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {results.length > 0 && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};