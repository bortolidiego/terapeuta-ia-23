import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, BookOpen, Plus, Edit, Trash2, Save, ArrowLeft, BarChart3 } from "lucide-react";
import { OpenAIMonitoring } from "@/components/OpenAIMonitoring";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TherapistConfig {
  id: string;
  main_prompt: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  template_version?: string;
}

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  keywords: string[];
  is_active: boolean;
  priority: number;
}

export const AdminPanel = () => {
  const [config, setConfig] = useState<TherapistConfig | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [editingKnowledge, setEditingKnowledge] = useState<KnowledgeItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [newKnowledge, setNewKnowledge] = useState({
    title: "",
    content: "",
    category: "general",
    keywords: "",
    priority: 1
  });

  useEffect(() => {
    loadConfig();
    loadKnowledge();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("therapist_config")
        .select("*")
        .eq("is_active", true)
        .single();
      if (error) throw error;
      setConfig(data);
    } catch (error) {
      console.error("Erro ao carregar configuração:", error);
    }
  };

  const loadKnowledge = async () => {
    try {
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("*")
        .order("priority", { ascending: false });
      if (error) throw error;
      setKnowledge(data || []);
    } catch (error) {
      console.error("Erro ao carregar base de conhecimento:", error);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("therapist_config")
        .update({
          main_prompt: config.main_prompt,
          model_name: config.model_name,
          temperature: config.temperature,
          max_tokens: config.max_tokens,
        })
        .eq("id", config.id);
      if (error) throw error;
      toast({
        title: "Configuração salva",
        description: "As configurações do terapeuta foram atualizadas."
      });
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addKnowledge = async () => {
    if (!newKnowledge.title || !newKnowledge.content) return;
    setIsLoading(true);
    try {
      const keywordsArray = newKnowledge.keywords.split(",").map(k => k.trim()).filter(k => k);
      const { error } = await supabase
        .from("knowledge_base")
        .insert({
          title: newKnowledge.title,
          content: newKnowledge.content,
          category: newKnowledge.category,
          keywords: keywordsArray,
          priority: newKnowledge.priority
        });
      if (error) throw error;
      setNewKnowledge({
        title: "",
        content: "",
        category: "general",
        keywords: "",
        priority: 1
      });
      loadKnowledge();
      toast({
        title: "Conhecimento adicionado",
        description: "Nova informação foi adicionada à base de conhecimento."
      });
    } catch (error) {
      console.error("Erro ao adicionar conhecimento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o conhecimento.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateKnowledge = async () => {
    if (!editingKnowledge) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("knowledge_base")
        .update(editingKnowledge)
        .eq("id", editingKnowledge.id);
      if (error) throw error;
      setEditingKnowledge(null);
      loadKnowledge();
      toast({
        title: "Conhecimento atualizado",
        description: "As informações foram atualizadas com sucesso."
      });
    } catch (error) {
      console.error("Erro ao atualizar conhecimento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o conhecimento.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteKnowledge = async (id: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("knowledge_base")
        .delete()
        .eq("id", id);
      if (error) throw error;
      loadKnowledge();
      toast({
        title: "Conhecimento removido",
        description: "A informação foi removida da base de conhecimento."
      });
    } catch (error) {
      console.error("Erro ao remover conhecimento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o conhecimento.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleKnowledgeStatus = async (item: KnowledgeItem) => {
    try {
      const { error } = await supabase
        .from("knowledge_base")
        .update({
          is_active: !item.is_active
        })
        .eq("id", item.id);
      if (error) throw error;
      loadKnowledge();
    } catch (error) {
      console.error("Erro ao alterar status:", error);
    }
  };

  if (!config) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p>Carregando configurações...</p>
        </div>
      </div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header com navegação */}
        <div className="flex items-center gap-6 mb-8">
          <Link to="/">
            <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Chat
            </Button>
          </Link>
          <div className="bg-card rounded-2xl p-6 flex-1 border border-border shadow-sm">
            <h1 className="text-3xl font-bold text-primary">
              MyHealing Admin
            </h1>
            <p className="text-muted-foreground mt-2">
              Configure o comportamento do terapeuta virtual e gerencie a base de conhecimento.
            </p>
          </div>
        </div>

        <Tabs defaultValue="config" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-card border border-border rounded-xl p-1">
            <TabsTrigger value="config" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BookOpen className="h-4 w-4" />
              Base de Conhecimento
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="h-4 w-4" />
              Monitoramento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config">
            <Card className="bg-card border border-border shadow-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="text-xl text-primary">
                  Configurações do Terapeuta Virtual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="prompt">Prompt Principal</Label>
                  <Textarea
                    id="prompt"
                    value={config.main_prompt}
                    onChange={e => setConfig({ ...config, main_prompt: e.target.value })}
                    rows={8}
                    className="mt-2"
                    placeholder="Descreva como o terapeuta deve se comportar..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="model">Modelo OpenAI</Label>
                    <select
                      id="model"
                      value={config.model_name}
                      onChange={e => setConfig({ ...config, model_name: e.target.value })}
                      className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="gpt-4.1-2025-04-14">GPT-4.1 (2025) - Mais Recente ⭐</option>
                      <option value="gpt-4o-mini">GPT-4o Mini - Rápido e Econômico</option>
                      <option value="gpt-4o">GPT-4o - Poderoso (Caro)</option>
                      <option value="o3-2025-04-16">O3 - Raciocínio Avançado</option>
                      <option value="o4-mini-2025-04-16">O4 Mini - Raciocínio Rápido</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {config.model_name === 'gpt-4.1-2025-04-14' && 'Modelo flagship mais recente da OpenAI'}
                      {config.model_name === 'gpt-4o-mini' && 'Ótima relação custo-benefício, rápido'}
                      {config.model_name === 'gpt-4o' && 'Modelo anterior, mais caro'}
                      {config.model_name === 'o3-2025-04-16' && 'Excelente para problemas complexos'}
                      {config.model_name === 'o4-mini-2025-04-16' && 'Raciocínio eficiente'}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="temperature">Temperatura</Label>
                    <Input
                      id="temperature"
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={config.temperature}
                      onChange={e => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="tokens">Máx. Tokens</Label>
                    <Input
                      id="tokens"
                      type="number"
                      value={config.max_tokens}
                      onChange={e => setConfig({ ...config, max_tokens: parseInt(e.target.value) })}
                      className="mt-2"
                    />
                  </div>
                </div>

                <Button
                  onClick={saveConfig}
                  disabled={isLoading}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="knowledge">
            <div className="space-y-6">
              {/* Adicionar novo conhecimento */}
              <Card className="bg-card border border-border shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-primary">
                    <Plus className="h-5 w-5" />
                    Adicionar Conhecimento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="title">Título</Label>
                      <Input
                        id="title"
                        value={newKnowledge.title}
                        onChange={e => setNewKnowledge({ ...newKnowledge, title: e.target.value })}
                        placeholder="Ex: Técnicas de Respiração"
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Categoria</Label>
                      <Input
                        id="category"
                        value={newKnowledge.category}
                        onChange={e => setNewKnowledge({ ...newKnowledge, category: e.target.value })}
                        placeholder="Ex: ansiedade, tcc, emergência"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="content">Conteúdo</Label>
                    <Textarea
                      id="content"
                      value={newKnowledge.content}
                      onChange={e => setNewKnowledge({ ...newKnowledge, content: e.target.value })}
                      rows={4}
                      placeholder="Descreva as informações que o terapeuta deve saber..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="keywords">Palavras-chave (separadas por vírgula)</Label>
                      <Input
                        id="keywords"
                        value={newKnowledge.keywords}
                        onChange={e => setNewKnowledge({ ...newKnowledge, keywords: e.target.value })}
                        placeholder="respiração, ansiedade, técnica"
                      />
                    </div>
                    <div>
                      <Label htmlFor="priority">Prioridade (1-10)</Label>
                      <Input
                        id="priority"
                        type="number"
                        min="1"
                        max="10"
                        value={newKnowledge.priority}
                        onChange={e => setNewKnowledge({ ...newKnowledge, priority: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={addKnowledge}
                    disabled={isLoading}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </CardContent>
              </Card>

              {/* Lista de conhecimentos */}
              <div className="grid gap-4">
                {knowledge.map(item => (
                  <Card key={item.id} className="bg-card border border-border shadow-sm rounded-2xl hover:shadow-md transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium">{item.title}</h3>
                            <Badge variant={item.is_active ? "default" : "secondary"}>
                              {item.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                            <Badge variant="outline">{item.category}</Badge>
                            <Badge variant="outline">Prioridade: {item.priority}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {item.content.substring(0, 150)}...
                          </p>
                          {item.keywords && item.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.keywords.map((keyword, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {keyword}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button size="sm" variant="outline" onClick={() => toggleKnowledgeStatus(item)}>
                            {item.is_active ? "Desativar" : "Ativar"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingKnowledge(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteKnowledge(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="monitoring">
            <div className="space-y-6">
              <Card className="bg-card border border-border shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl text-primary">
                    <BarChart3 className="h-5 w-5" />
                    Monitoramento OpenAI
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Acompanhe o uso da API OpenAI, custos e performance do sistema.
                  </p>
                </CardHeader>
                <CardContent>
                  <OpenAIMonitoring period="24h" />
                </CardContent>
              </Card>

              {/* Seção de configurações de cache e otimização */}
              
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de edição */}
      {editingKnowledge && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Editar Conhecimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={editingKnowledge.title} onChange={e => setEditingKnowledge({ ...editingKnowledge, title: e.target.value })} />
              </div>
              <div>
                <Label>Conteúdo</Label>
                <Textarea value={editingKnowledge.content} onChange={e => setEditingKnowledge({ ...editingKnowledge, content: e.target.value })} rows={6} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingKnowledge(null)}>
                  Cancelar
                </Button>
                <Button onClick={updateKnowledge} disabled={isLoading}>
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
