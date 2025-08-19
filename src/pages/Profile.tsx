import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Mic, Play, Pause, RotateCcw, CheckCircle, AlertCircle, Clock, PlayCircle, Library } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<any>({});
  const [credits, setCredits] = useState<any>({});
  const [audioLibrary, setAudioLibrary] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [sampleText, setSampleText] = useState("");
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [tempVoiceId, setTempVoiceId] = useState<string | null>(null);
  const [testAudio, setTestAudio] = useState<string | null>(null);
  const [showVoiceTest, setShowVoiceTest] = useState(false);
  const [isGeneratingLibrary, setIsGeneratingLibrary] = useState(false);
  const [isRedoingCloning, setIsRedoingCloning] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadProfile();
    loadCredits();
    loadAudioLibrary();
  }, [user, navigate]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user?.id)
      .single();
    
    setProfile(data || {});
  };

  const updateProfile = async () => {
    if (!user?.id) return;
    
    setIsSaving(true);
    try {
      // Verificar se o perfil existe, se não, criar um
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingProfile) {
        // Criar perfil se não existir
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            display_name: user.email,
            preferred_language: 'pt-BR',
            full_name: profile.full_name,
            gender: profile.gender,
            birth_city: profile.birth_city,
            birth_date: profile.birth_date,
            cpf: profile.cpf,
          });

        if (insertError) throw insertError;
      } else {
        // Atualizar perfil existente
        const { error } = await supabase
          .from('user_profiles')
          .update({
            full_name: profile.full_name,
            gender: profile.gender,
            birth_city: profile.birth_city,
            birth_date: profile.birth_date,
            cpf: profile.cpf,
          })
          .eq('user_id', user.id);

        if (error) throw error;
      }

      toast({
        title: "Perfil salvo!",
        description: "Suas informações foram atualizadas com sucesso.",
      });
      
      await loadProfile();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfileChange = (field: string, value: string) => {
    setProfile((prev: any) => ({ ...prev, [field]: value }));
  };

  const loadCredits = async () => {
    const { data } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user?.id)
      .single();
    
    setCredits(data || {});
  };

  const loadAudioLibrary = async () => {
    const { data } = await supabase
      .from('user_audio_library')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    
    setAudioLibrary(data || []);
  };

  const getProfileCompleteness = () => {
    const fields = ['full_name', 'gender', 'birth_city', 'birth_date', 'cpf'];
    const completed = fields.filter(field => profile[field]).length;
    return Math.round((completed / fields.length) * 100);
  };

  const generateSampleText = async () => {
    setIsGeneratingText(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-voice-sample-text');
      
      if (error) throw error;
      setSampleText(data.text);
    } catch (error: any) {
      toast({
        title: "Erro ao gerar texto",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingText(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true 
        }
      });
      
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          setRecordedAudio(reader.result as string);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      toast({
        title: "Erro ao acessar microfone",
        description: "Verifique as permissões do navegador",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const testVoice = async () => {
    const voiceId = tempVoiceId || profile.cloned_voice_id;
    
    if (!voiceId) {
      toast({
        title: "Voz não disponível",
        description: "Você precisa clonar sua voz primeiro para poder testá-la.",
        variant: "destructive",
      });
      return;
    }
    
    setIsTestingVoice(true);
    console.log('Testing voice with ID:', voiceId);
    
    try {
      const { data, error } = await supabase.functions.invoke('voice-clone-test', {
        body: { voiceId }
      });

      if (error) throw error;

      // Convert base64 to audio URL
      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0))],
        { type: 'audio/mp3' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      
      setTestAudio(audioUrl);
      
      // Auto-play the test audio
      const audio = new Audio(audioUrl);
      audio.play();
      
      toast({
        title: "Teste de voz gerado!",
        description: `Frase: "${data.testPhrase}"`,
      });
    } catch (error: any) {
      console.error('Voice test error:', error);
      toast({
        title: "Erro ao gerar teste de voz",
        description: error.message || "Erro desconhecido. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsTestingVoice(false);
    }
  };

  const cloneVoice = async () => {
    if (!recordedAudio || !voiceName.trim()) {
      toast({
        title: "Dados incompletos",
        description: "Nome da voz e áudio são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setIsCloning(true);
    try {
      // Convert recordedAudio (data URL) to base64
      const base64Audio = recordedAudio.split(',')[1];
      
      const { data, error } = await supabase.functions.invoke('voice-cloning', {
        body: {
          audioBase64: base64Audio,
          voiceName: voiceName.trim(),
          description: `Voz clonada de ${profile?.display_name || 'usuário'} - Português Brasileiro`
        }
      });

      if (error) throw error;

      // Store temporary voice ID for testing
      setTempVoiceId(data.voice_id);
      setShowVoiceTest(true);
      
      toast({
        title: "Voz clonada!",
        description: "Agora teste sua qualidade antes de confirmar.",
      });
      
    } catch (error: any) {
      toast({
        title: "Erro ao clonar voz",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCloning(false);
    }
  };

  const confirmVoice = async () => {
    if (!tempVoiceId) return;
    
    try {
      const { error } = await supabase.functions.invoke('voice-clone-confirm', {
        body: {
          voiceId: tempVoiceId,
          voiceName: voiceName,
          action: 'confirm'
        }
      });

      if (error) throw error;

      setShowVoiceTest(false);
      setTempVoiceId(null);
      setTestAudio(null);
      resetRecording();
      
      toast({
        title: "Voz confirmada!",
        description: "Sua voz foi salva e está pronta para uso.",
      });
      
      await loadProfile();
      setIsRedoingCloning(false); // Reset flag após confirmação
    } catch (error: any) {
      toast({
        title: "Erro ao confirmar voz",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const rejectVoice = async () => {
    console.log('🔄 Iniciando rejeição da voz:', { tempVoiceId });
    
    // Reset do estado SEMPRE acontece, independente do sucesso da exclusão
    const performReset = () => {
      console.log('🧹 Limpando estados da gravação');
      setTempVoiceId(null);
      setTestAudioUrl(null);
      setSampleText("");
      resetRecording();
      setIsCloning(false);
      setIsTestingVoice(false);
      setShowVoiceTest(false); // Volta para a tela inicial de clonagem
      setIsRedoingCloning(true); // Força volta para tela inicial
    };
    
    // Se não há tempVoiceId, apenas reseta o estado e volta para clonagem
    if (!tempVoiceId) {
      console.log('ℹ️ Nenhum tempVoiceId encontrado, apenas resetando interface');
      toast({
        title: "Voltando para clonagem",
        description: "Retornando à tela inicial de clonagem de voz",
      });
      performReset();
      return;
    }
    
    try {
      console.log('📡 Chamando voice-clone-confirm para rejeitar');
      
      // Timeout de 10 segundos para evitar travamentos
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout na conexão')), 10000)
      );
      
      const rejectPromise = supabase.functions.invoke('voice-clone-confirm', {
        body: {
          voiceId: tempVoiceId,
          action: 'reject'
        }
      });

      const { error } = await Promise.race([rejectPromise, timeoutPromise]) as any;

      if (error) {
        console.error('❌ Erro na rejeição da voz:', error);
        throw error;
      }

      console.log('✅ Voz rejeitada com sucesso');
      performReset();
      
      toast({
        title: "Voz rejeitada",
        description: "Agora você pode gravar uma nova voz.",
      });
      
    } catch (error: any) {
      console.error('❌ Falha na rejeição:', error);
      
      // IMPORTANTE: Fazer reset mesmo se a exclusão falhar
      performReset();
      
      // Mensagem mais específica baseada no tipo de erro
      let errorMessage = "Erro desconhecido";
      if (error.message?.includes('Timeout')) {
        errorMessage = "Conexão lenta. A interface foi resetada para você tentar novamente.";
      } else if (error.message?.includes('Connection')) {
        errorMessage = "Problema de conexão. A interface foi resetada para nova tentativa.";
      } else {
        errorMessage = "Falha na exclusão, mas você já pode gravar novamente.";
      }
      
      toast({
        title: "Reset realizado",
        description: errorMessage,
        variant: "default", // Não é destructive pois o reset funcionou
      });
    }
  };

  const resetRecording = () => {
    setRecordedAudio(null);
    setTestAudioUrl(null);
    setVoiceName("");
    setShowVoiceTest(false);
    setTempVoiceId(null);
    setTestAudio(null);
  };

  const generateAudioLibrary = async () => {
    if (!profile.cloned_voice_id) {
      toast({
        title: "Voz não clonada",
        description: "Clone sua voz primeiro para gerar a biblioteca personalizada",
        variant: "destructive",
      });
      return;
    }

    if (isGeneratingLibrary) {
      // Parar geração (implementar lógica de cancelamento)
      setIsGeneratingLibrary(false);
      toast({
        title: "Geração interrompida",
        description: "A geração de áudios foi cancelada.",
      });
      return;
    }

    try {
      setIsGeneratingLibrary(true);
      
      // Buscar sentimentos disponíveis
      const { data: sentiments } = await supabase
        .from('sentimentos')
        .select('nome')
        .limit(10);

      if (!sentiments || sentiments.length === 0) {
        throw new Error('Nenhum sentimento encontrado para gerar áudios');
      }

      const sentimentNames = sentiments.map(s => s.nome);

      await supabase.functions.invoke('batch-generate-audio-items', {
        body: {
          sessionId: 'profile-generation',
          sentiments: sentimentNames,
          userId: user?.id
        }
      });

      toast({
        title: "Gerando biblioteca",
        description: "Suas bibliotecas de áudios estão sendo geradas. Você receberá uma notificação quando estiverem prontas.",
      });

      // Polling para atualizar progresso
      const pollInterval = setInterval(async () => {
        await loadAudioLibrary();
        
        // Verificar se geração foi completada ou parada
        if (!isGeneratingLibrary) {
          clearInterval(pollInterval);
        }
      }, 5000);

      // Auto-stop após 5 minutos
      setTimeout(() => {
        setIsGeneratingLibrary(false);
        clearInterval(pollInterval);
      }, 300000);

    } catch (error: any) {
      toast({
        title: "Erro ao gerar biblioteca",
        description: error.message,
        variant: "destructive",
      });
      setIsGeneratingLibrary(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Perfil</h1>
        
        <Tabs defaultValue="personal" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="personal">Dados Pessoais</TabsTrigger>
            <TabsTrigger value="voice">Clonagem de Voz</TabsTrigger>
            <TabsTrigger value="library">Biblioteca de Áudios</TabsTrigger>
            <TabsTrigger value="credits">Créditos</TabsTrigger>
          </TabsList>

          <TabsContent value="personal">
            <Card>
              <CardHeader>
                <CardTitle>Dados Pessoais</CardTitle>
                <CardDescription>
                  Complete suas informações para uma experiência mais personalizada
                </CardDescription>
                <div className="flex items-center gap-2">
                  <Progress value={getProfileCompleteness()} className="flex-1" />
                  <span className="text-sm text-muted-foreground">
                    {getProfileCompleteness()}% completo
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="full_name">Nome Completo</Label>
                    <Input 
                      id="full_name" 
                      value={profile.full_name || ''} 
                      onChange={(e) => handleProfileChange('full_name', e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gender">Gênero</Label>
                    <Select value={profile.gender || ''} onValueChange={(value) => handleProfileChange('gender', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="birth_city">Cidade de Nascimento</Label>
                    <Input 
                      id="birth_city" 
                      value={profile.birth_city || ''} 
                      onChange={(e) => handleProfileChange('birth_city', e.target.value)}
                      placeholder="Onde você nasceu"
                    />
                  </div>
                  <div>
                    <Label htmlFor="birth_date">Data de Nascimento</Label>
                    <Input 
                      id="birth_date" 
                      type="date" 
                      value={profile.birth_date || ''} 
                      onChange={(e) => handleProfileChange('birth_date', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cpf">CPF</Label>
                    <Input 
                      id="cpf" 
                      value={profile.cpf || ''} 
                      onChange={(e) => handleProfileChange('cpf', e.target.value)}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>
                <Button onClick={updateProfile} disabled={isSaving}>
                  {isSaving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="voice">
            <Card>
              <CardHeader>
                <CardTitle>Clonagem de Voz</CardTitle>
                <CardDescription>
                  Clone sua voz para criar áudios personalizados de auto-cura
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {(!profile.cloned_voice_id || isRedoingCloning) ? (
                  <>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="voice_name">Nome da Voz</Label>
                        <Input 
                          id="voice_name"
                          value={voiceName}
                          onChange={(e) => setVoiceName(e.target.value)}
                          placeholder="Ex: Minha Voz Terapêutica"
                          className="mb-4"
                        />
                      </div>
                      
                      <Button 
                        onClick={generateSampleText}
                        disabled={isGeneratingText}
                        variant="outline"
                      >
                        {isGeneratingText ? "Gerando..." : "Gerar Texto Inspiracional"}
                      </Button>
                      
                      {sampleText && (
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-sm leading-relaxed">{sampleText}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Button
                          onClick={isRecording ? stopRecording : startRecording}
                          disabled={!sampleText}
                          variant={isRecording ? "destructive" : "default"}
                        >
                          <Mic className="h-4 w-4 mr-2" />
                          {isRecording ? "Parar Gravação" : "Gravar Voz"}
                        </Button>
                        
                        {recordedAudio && (
                          <Button
                            onClick={resetRecording}
                            variant="outline"
                            size="sm"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Refazer
                          </Button>
                        )}
                      </div>

                      {recordedAudio && !showVoiceTest && (
                        <div className="space-y-4">
                          <audio controls src={recordedAudio} className="w-full" />
                          
                          <Button 
                            onClick={cloneVoice}
                            disabled={!voiceName.trim() || isCloning}
                            className="w-full"
                          >
                            {isCloning ? "Processando Clonagem..." : "Processar Clonagem"}
                          </Button>
                        </div>
                      )}

                      {showVoiceTest && (
                        <div className="space-y-4">
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="font-medium text-blue-900 mb-2">Teste sua voz clonada</h4>
                            <p className="text-sm text-blue-700 mb-3">
                              Ouça como ficou sua voz clonada e decida se quer mantê-la ou refazer a gravação.
                            </p>
                            
                            <div className="space-y-3">
                              <Button 
                                onClick={testVoice}
                                disabled={isTestingVoice}
                                variant="outline"
                                className="w-full"
                              >
                                {isTestingVoice ? "Gerando teste..." : "Ouvir Teste da Voz Clonada"}
                              </Button>

                              {testAudio && (
                                <div className="p-3 bg-gray-50 border rounded-lg">
                                  <audio controls className="w-full" src={testAudio}>
                                    Seu navegador não suporta áudio.
                                  </audio>
                                </div>
                              )}
                              
                              <div className="flex gap-2">
                                <Button 
                                  onClick={confirmVoice}
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Salvar Voz
                                </Button>
                                <Button 
                                  onClick={rejectVoice}
                                  variant="outline"
                                  className="flex-1"
                                >
                                  Refazer
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-6">
                    <div className="text-center space-y-4">
                      <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                      <h3 className="text-lg font-semibold">Voz Clonada com Sucesso!</h3>
                      <p className="text-muted-foreground">
                        Sua voz foi clonada e está pronta para gerar áudios personalizados
                      </p>
                    </div>

                    <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                          <Mic className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-purple-900">Perfil de Voz</h4>
                          <p className="text-sm text-purple-700">Sua voz personalizada está pronta</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Button 
                          onClick={testVoice}
                          disabled={isTestingVoice}
                          variant="outline"
                          className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                        >
                          <PlayCircle className="w-4 h-4 mr-2" />
                          {isTestingVoice ? "Gerando teste..." : "Ouvir Áudio Teste"}
                        </Button>

                        {testAudio && (
                          <div className="p-3 bg-white border border-purple-200 rounded-lg">
                            <audio controls className="w-full" src={testAudio}>
                              Seu navegador não suporta áudio.
                            </audio>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button 
                            onClick={rejectVoice}
                            variant="outline"
                            className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Refazer Clonagem
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="library">
            <AudioLibraryTab />
          </TabsContent>

          <TabsContent value="credits">
            <Card>
              <CardHeader>
                <CardTitle>Créditos</CardTitle>
                <CardDescription>
                  Gerencie seus créditos OpenAI e ElevenLabs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">OpenAI</h3>
                    <p className="text-2xl font-bold text-primary">
                      {credits.openai_credits || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">créditos disponíveis</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">ElevenLabs</h3>
                    <p className="text-2xl font-bold text-secondary">
                      {credits.elevenlabs_credits || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">créditos disponíveis</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Gastos Totais</h4>
                  <p className="text-sm text-muted-foreground">
                    OpenAI: ${(credits.total_spent_openai || 0).toFixed(2)} | 
                    ElevenLabs: ${(credits.total_spent_elevenlabs || 0).toFixed(2)}
                  </p>
                </div>

                <Button className="w-full">
                  Comprar Mais Créditos
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

import { AudioLibraryNew } from '@/components/AudioLibraryNew';

const AudioLibraryTab = () => {
  return <AudioLibraryNew />;
};