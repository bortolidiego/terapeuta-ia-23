import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Edit, Save, RotateCcw, Trash2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Sentimento {
  id: string;
  nome: string;
  categoria: string;
  frequencia_uso: number;
  ultima_selecao?: string;
}

interface FiltroPersonalizado {
  id: string;
  nome: string;
  sentimentos: string[];
  created_at?: string;
  updated_at?: string;
}

interface SentimentosPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sentimentos: string[]) => void;
  context?: string;
}

const SentimentosPopup: React.FC<SentimentosPopupProps> = ({
  isOpen,
  onClose,
  onConfirm,
  context = ''
}) => {
  const [sentimentos, setSentimentos] = useState<Sentimento[]>([]);
  const [sentimentosSelecionados, setSentimentosSelecionados] = useState<string[]>([]);
  const [termoBuscaEAdicao, setTermoBuscaEAdicao] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSentimentos, setLoadingSentimentos] = useState(false);
  const [filtrosPersonalizados, setFiltrosPersonalizados] = useState<FiltroPersonalizado[]>([]);
  const [novoFiltroNome, setNovoFiltroNome] = useState('');
  const [filtroEmEdicao, setFiltroEmEdicao] = useState<string | null>(null);
  const [sentimentosOriginaisEdicao, setSentimentosOriginaisEdicao] = useState<string[]>([]);
  const [filtroAtivo, setFiltroAtivo] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadSentimentos();
      loadFiltrosPersonalizados();
    }
  }, [isOpen, context]);

  const loadSentimentos = async () => {
    setLoading(true);
    try {
      if (context && context.trim()) {
        setLoadingSentimentos(true);

        const { data: functionData, error: functionError } = await supabase.functions.invoke('generate-sentiments', {
          body: { context }
        });

        if (functionError) {
          console.error('Error calling generate-sentiments function:', functionError);
          toast({
            title: "Aviso",
            description: "Erro ao gerar sentimentos contextuais. Usando sentimentos padrão.",
            variant: "default",
          });

          const { data, error } = await supabase
            .from('sentimentos')
            .select('*')
            .order('frequencia_uso', { ascending: false });

          if (error) {
            throw error;
          }
          setSentimentos(data || []);
        } else {
          setSentimentos(functionData.sentiments || []);

          if (functionData.newSentimentsGenerated > 0) {
            toast({
              title: "Sentimentos gerados!",
              description: `${functionData.newSentimentsGenerated} sentimentos contextuais foram criados com base na sua situação.`,
            });
          }
          if (functionData.usedFallback) {
            toast({
              title: "Usando sentimentos padrão",
              description: "Não foi possível gerar sentimentos contextuais; usando a base geral.",
            });
          }
        }
        setLoadingSentimentos(false);
      } else {
        const { data, error } = await supabase
          .from('sentimentos')
          .select('*')
          .order('frequencia_uso', { ascending: false });

        if (error) {
          throw error;
        }
        setSentimentos(data || []);
      }
    } catch (error) {
      console.error('Error loading sentimentos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os sentimentos.",
        variant: "destructive",
      });
      setLoadingSentimentos(false);
    } finally {
      setLoading(false);
    }
  };

  const regenerarSentimentos = async () => {
    if (!context || !context.trim()) return;

    setLoadingSentimentos(true);
    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke('generate-sentiments', {
        body: { context }
      });

      if (!functionError && functionData) {
        setSentimentos(functionData.sentiments || []);

        toast({
          title: "Sentimentos regenerados!",
          description: `${functionData.newSentimentsGenerated} novos sentimentos contextuais foram criados.`,
        });
        if (functionData.usedFallback) {
          toast({
            title: "Usando sentimentos padrão",
            description: "Não foi possível gerar sentimentos contextuais; usando a base geral.",
          });
        }
      }
    } catch (error) {
      console.error('Error regenerating sentiments:', error);
      toast({
        title: "Erro",
        description: "Não foi possível regenerar os sentimentos.",
        variant: "destructive",
      });
    } finally {
      setLoadingSentimentos(false);
    }
  };

  const loadFiltrosPersonalizados = async () => {
    try {
      const { data: filtros, error } = await supabase
        .from('user_sentiment_filters')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar filtros:', error);
        return;
      }

      const filtrosFormatados = filtros?.map(filtro => ({
        id: filtro.id,
        nome: filtro.nome,
        sentimentos: filtro.sentimentos,
        created_at: filtro.created_at,
        updated_at: filtro.updated_at
      })) || [];

      setFiltrosPersonalizados(filtrosFormatados);
    } catch (error) {
      console.error('Erro ao carregar filtros:', error);
    }
  };

  const salvarFiltroNoBanco = async (filtro: Omit<FiltroPersonalizado, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('user_sentiment_filters')
        .insert({
          nome: filtro.nome,
          sentimentos: filtro.sentimentos
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao salvar filtro:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Erro ao salvar filtro:', error);
      return null;
    }
  };

  const converterParaPlural = (sentimento: string): string => {
    if (sentimento.trim().length === 0) return sentimento;

    const palavra = sentimento.trim().toLowerCase();

    if (palavra.endsWith('s')) return palavra;

    if (palavra.endsWith('ão')) {
      return palavra.slice(0, -2) + 'ões';
    }
    if (palavra.endsWith('l')) {
      return palavra.slice(0, -1) + 'is';
    }
    if (palavra.endsWith('r') || palavra.endsWith('z')) {
      return palavra + 'es';
    }

    return palavra + 's';
  };

  const adicionarSentimento = async () => {
    if (!termoBuscaEAdicao.trim()) return;

    try {
      const sentimentoPlural = converterParaPlural(termoBuscaEAdicao);

      const { error } = await supabase
        .from('sentimentos')
        .insert({
          nome: sentimentoPlural,
          categoria: 'personalizado',
          criado_por: 'usuario',
          contexto: context
        });

      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          toast({
            title: "Sentimento já existe",
            description: "Este sentimento já foi adicionado anteriormente.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else {
        setTermoBuscaEAdicao('');
        loadSentimentos();
        toast({
          title: "Sucesso",
          description: "Sentimento adicionado com sucesso.",
        });
      }
    } catch (error) {
      console.error('Error adding sentimento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o sentimento.",
        variant: "destructive",
      });
    }
  };

  const toggleSentimento = (nome: string) => {
    if (sentimentosSelecionados.includes(nome)) {
      setSentimentosSelecionados(sentimentosSelecionados.filter(s => s !== nome));
    } else {
      setSentimentosSelecionados([...sentimentosSelecionados, nome]);
    }
  };

  const criarFiltroPersonalizado = async () => {
    if (novoFiltroNome.trim() && sentimentosSelecionados.length > 0) {
      try {
        // Primeiro, garantir que todos os sentimentos selecionados existem no BD
        const sentimentosExistentes = sentimentos.map(s => s.nome);
        const sentimentosNaoExistentes = sentimentosSelecionados.filter(s =>
          !sentimentosExistentes.includes(s)
        );

        // Inserir sentimentos que ainda não existem
        if (sentimentosNaoExistentes.length > 0) {
          const { error: insertError } = await supabase
            .from('sentimentos')
            .insert(
              sentimentosNaoExistentes.map(nome => ({
                nome,
                categoria: 'personalizado',
                criado_por: 'usuario',
                contexto: context
              }))
            );

          if (insertError) {
            console.error('Erro ao inserir sentimentos faltantes:', insertError);
          }
        }

        const novoFiltroData = {
          nome: novoFiltroNome.trim(),
          sentimentos: [...sentimentosSelecionados]
        };

        const filtroSalvo = await salvarFiltroNoBanco(novoFiltroData);

        if (filtroSalvo) {
          const novoFiltro: FiltroPersonalizado = {
            id: filtroSalvo.id,
            nome: filtroSalvo.nome,
            sentimentos: filtroSalvo.sentimentos,
            created_at: filtroSalvo.created_at,
            updated_at: filtroSalvo.updated_at
          };

          setFiltrosPersonalizados([...filtrosPersonalizados, novoFiltro]);
          setNovoFiltroNome('');

          toast({
            title: "Filtro criado com sucesso!",
            description: `O filtro "${novoFiltro.nome}" foi salvo com ${novoFiltro.sentimentos.length} sentimentos.`,
          });
        } else {
          toast({
            title: "Erro ao criar filtro",
            description: "Não foi possível salvar o filtro. Tente novamente.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Erro ao criar filtro:', error);
        toast({
          title: "Erro ao criar filtro",
          description: "Ocorreu um erro inesperado. Tente novamente.",
          variant: "destructive"
        });
      }
    }
  };

  const aplicarFiltroPersonalizado = (filtro: FiltroPersonalizado) => {
    // Verificar quais sentimentos do filtro estão disponíveis na tela atual
    const sentimentosDisponiveis = sentimentosOrdenadosEFiltrados.map(s => s.nome);
    const sentimentosDoFiltroDisponiveis = filtro.sentimentos.filter(s =>
      sentimentosDisponiveis.includes(s)
    );

    setSentimentosSelecionados(sentimentosDoFiltroDisponiveis);
    setFiltroAtivo(filtro.id);

    const total = filtro.sentimentos.length;
    const aplicados = sentimentosDoFiltroDisponiveis.length;

    toast({
      title: "Filtro aplicado",
      description: aplicados === total
        ? `${aplicados} sentimentos selecionados.`
        : `${aplicados} de ${total} sentimentos aplicados (alguns não estão disponíveis na tela atual).`,
    });
  };

  const aplicarFiltroMaisFrequentes = () => {
    // Algoritmo melhorado que considera frequência + recência
    const agora = new Date();
    const sentimentosComScore = sentimentosOrdenadosEFiltrados
      .filter(s => s.frequencia_uso > 0)
      .map(s => {
        // Calcular score combinando frequência e recência
        const diasDesdeUltimaSelecao = s.ultima_selecao
          ? Math.floor((agora.getTime() - new Date(s.ultima_selecao).getTime()) / (1000 * 60 * 60 * 24))
          : 365; // Se nunca foi selecionado, considerar muito antigo

        // Score: frequência ponderada pela recência (quanto mais recente, maior o peso)
        const pesoRecencia = Math.max(0.1, 1 - (diasDesdeUltimaSelecao / 30)); // Peso diminui ao longo de 30 dias
        const score = s.frequencia_uso * pesoRecencia;

        return { ...s, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map(s => s.nome);

    setSentimentosSelecionados(sentimentosComScore);
    setFiltroAtivo('mais-frequentes');

    toast({
      title: "Filtro aplicado",
      description: `${sentimentosComScore.length} sentimentos mais relevantes selecionados (baseado em frequência + recência).`,
    });
  };

  const limparFiltro = () => {
    setFiltroAtivo(null);
    setSentimentosSelecionados([]);

    toast({
      title: "Filtro limpo",
      description: "Todos os sentimentos foram desmarcados.",
    });
  };

  const excluirFiltroPersonalizado = async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_sentiment_filters')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao excluir filtro:', error);
        toast({
          title: "Erro ao excluir filtro",
          description: "Não foi possível excluir o filtro. Tente novamente.",
          variant: "destructive"
        });
        return;
      }

      const novosFiltros = filtrosPersonalizados.filter(f => f.id !== id);
      setFiltrosPersonalizados(novosFiltros);

      // Se estávamos editando este filtro, cancelar a edição
      if (filtroEmEdicao === id) {
        cancelarEdicaoFiltro();
      }

      toast({
        title: "Filtro excluído",
        description: "O filtro foi removido com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao excluir filtro:', error);
      toast({
        title: "Erro ao excluir filtro",
        description: "Não foi possível excluir o filtro. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const iniciarEdicaoFiltro = (filtro: FiltroPersonalizado) => {
    setFiltroEmEdicao(filtro.id);
    setSentimentosOriginaisEdicao([...sentimentosSelecionados]);
    setFiltroAtivo(null);

    // Carregar sentimentos do filtro como selecionados
    const sentimentosDisponiveis = sentimentosOrdenadosEFiltrados.map(s => s.nome);
    const sentimentosDoFiltroDisponiveis = filtro.sentimentos.filter(s =>
      sentimentosDisponiveis.includes(s)
    );
    setSentimentosSelecionados(sentimentosDoFiltroDisponiveis);

    toast({
      title: "Modo de edição ativado",
      description: `Editando o filtro "${filtro.nome}". Selecione/deselecione sentimentos e clique em "Salvar Alterações".`,
    });
  };

  const cancelarEdicaoFiltro = () => {
    setFiltroEmEdicao(null);
    setSentimentosSelecionados(sentimentosOriginaisEdicao);
    setSentimentosOriginaisEdicao([]);

    toast({
      title: "Edição cancelada",
      description: "As alterações foram descartadas.",
    });
  };

  const salvarAlteracoesFiltro = async () => {
    if (!filtroEmEdicao) return;

    if (sentimentosSelecionados.length === 0) {
      toast({
        title: "Erro",
        description: "Um filtro deve ter pelo menos 1 sentimento.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('user_sentiment_filters')
        .update({ sentimentos: sentimentosSelecionados })
        .eq('id', filtroEmEdicao);

      if (error) {
        console.error('Erro ao atualizar filtro:', error);
        toast({
          title: "Erro ao salvar alterações",
          description: "Não foi possível atualizar o filtro. Tente novamente.",
          variant: "destructive"
        });
        return;
      }

      // Atualizar lista local
      const filtrosAtualizados = filtrosPersonalizados.map(f =>
        f.id === filtroEmEdicao
          ? { ...f, sentimentos: [...sentimentosSelecionados] }
          : f
      );
      setFiltrosPersonalizados(filtrosAtualizados);

      const sentimentosAdicionados = sentimentosSelecionados.filter(s =>
        !sentimentosOriginaisEdicao.includes(s)
      ).length;
      const sentimentosRemovidos = sentimentosOriginaisEdicao.filter(s =>
        !sentimentosSelecionados.includes(s)
      ).length;

      setFiltroEmEdicao(null);
      setSentimentosOriginaisEdicao([]);

      toast({
        title: "Filtro atualizado!",
        description: `${sentimentosAdicionados} adicionados, ${sentimentosRemovidos} removidos.`,
      });
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      toast({
        title: "Erro ao salvar alterações",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const confirmar = async () => {
    if (sentimentosSelecionados.length < 20) {
      toast({
        title: "Seleção insuficiente",
        description: "Selecione pelo menos 20 sentimentos.",
        variant: "destructive",
      });
      return;
    }

    try {
      for (const nome of sentimentosSelecionados) {
        const { error } = await supabase
          .rpc('increment_sentiment_usage', { sentiment_name: nome });

        if (error) {
          console.error('Error updating sentiment frequency:', error);
        }
      }

      onConfirm(sentimentosSelecionados);
      onClose();
    } catch (error) {
      console.error('Error updating frequencies:', error);
      onConfirm(sentimentosSelecionados);
      onClose();
    }
  };

  // Memoizar busca e resultados para performance
  const sentimentosOrdenadosEFiltrados = useMemo(() => {
    let resultado = sentimentos;

    // Aplicar busca se houver termo
    if (termoBuscaEAdicao.trim()) {
      resultado = resultado.filter(s =>
        s.nome.toLowerCase().includes(termoBuscaEAdicao.toLowerCase())
      );
    }

    // Ordenar: contextuais primeiro, depois por frequência
    return resultado.sort((a, b) => {
      if (a.categoria === 'gerado_contexto' && b.categoria !== 'gerado_contexto') return -1;
      if (b.categoria === 'gerado_contexto' && a.categoria !== 'gerado_contexto') return 1;
      return b.frequencia_uso - a.frequencia_uso;
    });
  }, [sentimentos, termoBuscaEAdicao]);

  // Verificar se o termo de busca não encontrou resultados
  const podeAdicionarSentimento = termoBuscaEAdicao.trim() &&
    !sentimentosOrdenadosEFiltrados.some(s =>
      s.nome.toLowerCase() === termoBuscaEAdicao.toLowerCase()
    );

  const renderSentimentButton = (sentimento: Sentimento) => {
    const isSelected = sentimentosSelecionados.includes(sentimento.nome);

    return (
      <Button
        key={sentimento.id}
        variant="outline"
        size="sm"
        onClick={() => toggleSentimento(sentimento.nome)}
        className={cn(
          "text-xs h-8 transition-all duration-200 hover:scale-105",
          isSelected && "bg-slate-800 text-white dark:bg-slate-200 dark:text-black ring-2 ring-blue-500 border-blue-500"
        )}
      >
        {isSelected && <Check className="w-3 h-3 mr-1" />}
        {sentimento.nome}
      </Button>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[85vh] max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Selecione os Sentimentos
            <div className="flex items-center gap-2">
              <div className="text-sm font-normal bg-primary/10 px-3 py-1 rounded-full">
                {sentimentosSelecionados.length} selecionados (mín. 20)
              </div>
              {sentimentosSelecionados.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={limparFiltro}
                  className="h-7 text-xs"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Desmarcar Todos
                </Button>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>
            Escolha pelo menos 20 sentimentos negativos relacionados ao seu fato para gerar a autocura.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border-b pb-3">
          {/* Campo unificado de busca e adição */}
          <div className="flex gap-2">
            <Input
              placeholder="Buscar sentimentos ou digite para adicionar..."
              value={termoBuscaEAdicao}
              onChange={(e) => setTermoBuscaEAdicao(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && podeAdicionarSentimento && adicionarSentimento()}
              className="flex-1 h-8"
            />
            {podeAdicionarSentimento && (
              <Button onClick={adicionarSentimento} size="sm" className="h-8">
                Adicionar "{termoBuscaEAdicao}"
              </Button>
            )}
            {context && (
              <Button
                onClick={regenerarSentimentos}
                size="sm"
                variant="outline"
                className="h-8"
                disabled={loadingSentimentos}
              >
                <RefreshCw className={cn("w-3 h-3 mr-1", loadingSentimentos && "animate-spin")} />
                Contextuais
              </Button>
            )}
          </div>

          {/* Filtros salvos e automáticos */}
          {(filtrosPersonalizados.length > 0 || sentimentos.some(s => s.frequencia_uso > 0)) && (
            <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
              {/* Filtro automático "Mais Frequentes" */}
              {sentimentos.some(s => s.frequencia_uso > 0) && (
                <Button
                  variant={filtroAtivo === 'mais-frequentes' ? 'default' : 'outline'}
                  size="sm"
                  onClick={aplicarFiltroMaisFrequentes}
                  className="h-7 text-xs"
                >
                  Mais Frequentes ({sentimentos.filter(s => s.frequencia_uso > 0).length})
                </Button>
              )}

              {/* Filtros personalizados */}
              {filtrosPersonalizados.map((filtro) => {
                const sentimentosDisponiveis = sentimentosOrdenadosEFiltrados.map(s => s.nome);
                const sentimentosDoFiltroDisponiveis = filtro.sentimentos.filter(s =>
                  sentimentosDisponiveis.includes(s)
                );
                const total = filtro.sentimentos.length;
                const disponiveis = sentimentosDoFiltroDisponiveis.length;
                const estaEditando = filtroEmEdicao === filtro.id;
                const estaAtivo = filtroAtivo === filtro.id;

                return (
                  <div
                    key={filtro.id}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 border rounded-lg transition-all",
                      estaEditando ? "bg-blue-50 border-blue-300 ring-1 ring-blue-200" :
                        estaAtivo ? "bg-primary/10 border-primary" : "bg-background"
                    )}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => estaEditando ? null : aplicarFiltroPersonalizado(filtro)}
                      className={cn(
                        "h-6 text-xs px-2 py-0 font-medium",
                        estaEditando ? "cursor-default" : "hover:bg-transparent"
                      )}
                      disabled={disponiveis === 0 || estaEditando}
                    >
                      {filtro.nome}
                      <span className="ml-1 text-muted-foreground font-normal">
                        ({disponiveis === total ? total : `${disponiveis}/${total}`})
                      </span>
                    </Button>
                    {!estaEditando && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => iniciarEdicaoFiltro(filtro)}
                          className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                          title="Editar filtro"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => excluirFiltroPersonalizado(filtro.id)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                          title="Excluir filtro"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Botões de ação para filtro em edição */}
          {filtroEmEdicao && (
            <div className="flex gap-2 p-2 bg-blue-50 border border-blue-200 rounded">
              <p className="text-xs text-blue-700 flex-1">
                <strong>Editando filtro:</strong> Selecione/deselecione sentimentos e salve as alterações.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={salvarAlteracoesFiltro}
                className="h-6 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              >
                <Save className="w-3 h-3 mr-1" />
                Salvar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={cancelarEdicaoFiltro}
                className="h-6 text-xs"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Cancelar
              </Button>
            </div>
          )}

          {/* Criar novo filtro */}
          {sentimentosSelecionados.length >= 3 && !filtroEmEdicao && (
            <div className="flex gap-2 items-center p-2 bg-primary/5 border border-primary/20 rounded">
              <Input
                placeholder="Nome do filtro..."
                value={novoFiltroNome}
                onChange={(e) => setNovoFiltroNome(e.target.value)}
                className="flex-1 h-7 text-xs"
                onKeyPress={(e) => e.key === 'Enter' && criarFiltroPersonalizado()}
              />
              <Button onClick={criarFiltroPersonalizado} size="sm" className="h-7 text-xs">
                Criar Filtro
              </Button>
            </div>
          )}
        </div>

        {/* Conteúdo principal - Grid de sentimentos unificado */}
        <div className="flex-1 overflow-hidden min-h-0">
          {loadingSentimentos ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <div className="animate-spin text-2xl">⏳</div>
              <p className="text-muted-foreground">Gerando sentimentos contextuais...</p>
              <p className="text-sm text-muted-foreground">Analisando sua situação para criar sentimentos específicos</p>
            </div>
          ) : (
            <div className="h-full p-2 overflow-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {sentimentosOrdenadosEFiltrados.map(sentimento => renderSentimentButton(sentimento))}
              </div>

              {sentimentosOrdenadosEFiltrados.length === 0 && !loadingSentimentos && (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <p className="text-muted-foreground">Nenhum sentimento encontrado</p>
                  {termoBuscaEAdicao && (
                    <p className="text-sm text-muted-foreground">
                      Tente um termo diferente ou adicione "{termoBuscaEAdicao}"
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between pt-3 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={sentimentosSelecionados.length < 20}
          >
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SentimentosPopup;