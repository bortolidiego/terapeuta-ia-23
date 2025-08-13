import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Play, Clock, MessageCircle, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface PendingConsultation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface SearchResult {
  id: string;
  content: string;
  role: string;
  created_at: string;
  session_id: string;
  session_title: string;
}

interface PendingConsultationsProps {
  onBack: () => void;
}

export const PendingConsultations = ({ onBack }: PendingConsultationsProps) => {
  const [consultations, setConsultations] = useState<PendingConsultation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadPendingConsultations();
  }, []);

  const loadPendingConsultations = async () => {
    try {
      const { data, error } = await supabase
        .from("therapy_sessions")
        .select("id, title, created_at, updated_at")
        .eq("status", "paused")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setConsultations(data || []);
    } catch (error) {
      console.error("Erro ao carregar consultas pendentes:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as consultas pendentes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resumeConsultation = async (consultationId: string) => {
    try {
      const { error } = await supabase
        .from("therapy_sessions")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", consultationId);

      if (error) throw error;

      toast({
        title: "Consulta retomada",
        description: "Você pode continuar de onde parou.",
      });

      navigate(`/chat/${consultationId}`);
    } catch (error) {
      console.error("Erro ao retomar consulta:", error);
      toast({
        title: "Erro",
        description: "Não foi possível retomar a consulta",
        variant: "destructive",
      });
    }
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("session_messages")
        .select(`
          id, 
          content, 
          role, 
          created_at, 
          session_id,
          therapy_sessions!inner(title, status)
        `)
        .ilike("content", `%${query}%`)
        .eq("therapy_sessions.status", "paused")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const results = (data || []).map(item => ({
        id: item.id,
        content: item.content,
        role: item.role,
        created_at: item.created_at,
        session_id: item.session_id,
        session_title: (item.therapy_sessions as any).title,
      }));

      setSearchResults(results);

      if (results.length === 0) {
        toast({
          title: "Nenhum resultado encontrado",
          description: `Não foram encontradas mensagens contendo "${query}" nas consultas pausadas.`,
        });
      }
    } catch (error) {
      console.error("Erro na busca:", error);
      toast({
        title: "Erro",
        description: "Não foi possível realizar a pesquisa.",
        variant: "destructive",
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
  }, [searchQuery]);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query})`, "gi");
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
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSearchDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="text-xl">Consultas Pendentes</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {showSearch ? "Busque palavras nas consultas pausadas" : "Retome suas consultas pausadas"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowSearch(!showSearch);
                if (showSearch) {
                  setSearchQuery("");
                  setSearchResults([]);
                }
              }}
            >
              <Search className="h-4 w-4" />
            </Button>
          </CardHeader>

          {showSearch && (
            <div className="px-6 pb-4">
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
                  onClick={() => setSearchQuery("")}
                  disabled={!searchQuery}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <CardContent>
            {showSearch && searchQuery ? (
              // Exibir resultados da busca
              <div>
                {isSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-2 text-muted-foreground">Pesquisando...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-8">
                    <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Nenhum resultado encontrado para "{searchQuery}"
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 text-sm text-muted-foreground">
                      {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} encontrado{searchResults.length !== 1 ? 's' : ''}
                    </div>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {searchResults.map((result) => (
                          <Card key={result.id} className="hover:shadow-md transition-shadow cursor-pointer">
                            <CardContent className="p-4" onClick={() => resumeConsultation(result.session_id)}>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <MessageCircle className="h-4 w-4 text-primary" />
                                    <h4 className="font-medium text-sm">{result.session_title}</h4>
                                    <Badge variant="secondary" className="text-xs">
                                      Pausada
                                    </Badge>
                                  </div>
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      resumeConsultation(result.session_id);
                                    }}
                                    size="sm"
                                    variant="outline"
                                  >
                                    <Play className="h-4 w-4 mr-1" />
                                    Continuar
                                  </Button>
                                </div>
                                <div className="text-sm leading-relaxed bg-accent/30 p-3 rounded-lg">
                                  {highlightText(result.content, searchQuery)}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="font-medium">
                                    {result.role === 'user' ? 'Você' : 'Assistant'}
                                  </span>
                                  <span>•</span>
                                  <span>{formatSearchDate(result.created_at)}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            ) : (
              // Exibir lista normal de consultas
              isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : consultations.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma consulta pendente encontrada
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {consultations.map((consultation) => (
                      <Card key={consultation.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <MessageCircle className="h-4 w-4 text-primary" />
                                <h3 className="font-medium">{consultation.title}</h3>
                                <Badge variant="secondary" className="text-xs">
                                  Pausada
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Pausada em: {formatDate(consultation.updated_at)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Criada em: {formatDate(consultation.created_at)}
                              </p>
                            </div>
                            <Button
                              onClick={() => resumeConsultation(consultation.id)}
                              size="sm"
                              className="ml-4"
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Continuar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};