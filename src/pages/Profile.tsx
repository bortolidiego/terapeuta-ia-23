import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Mic, Play, Pause, RotateCcw, CheckCircle, AlertCircle, Clock } from "lucide-react";
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

  const cloneVoice = async () => {
    if (!recordedAudio || !profile.full_name) {
      toast({
        title: "Dados incompletos",
        description: "Complete seu perfil e grave um áudio primeiro",
        variant: "destructive",
      });
      return;
    }

    setIsCloning(true);
    try {
      const audioBase64 = recordedAudio.split(',')[1]; // Remove data:audio/webm;base64,
      
      const { data, error } = await supabase.functions.invoke('voice-cloning', {
        body: {
          audioBase64,
          voiceName: `${profile.full_name} - MyHealing`,
          description: `Voz clonada para terapia personalizada de ${profile.full_name}`
        }
      });

      if (error) throw error;

      toast({
        title: "Voz clonada com sucesso!",
        description: "Agora você pode gerar sua biblioteca personalizada de áudios",
      });
      
      loadProfile();
      loadCredits();
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

  const generateAudioLibrary = async () => {
    if (!profile.cloned_voice_id) {
      toast({
        title: "Voz não clonada",
        description: "Clone sua voz primeiro para gerar a biblioteca personalizada",
        variant: "destructive",
      });
      return;
    }

    try {
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

      // Recarregar biblioteca após alguns segundos
      setTimeout(() => {
        loadAudioLibrary();
      }, 3000);

    } catch (error: any) {
      toast({
        title: "Erro ao gerar biblioteca",
        description: error.message,
        variant: "destructive",
      });
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
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gender">Gênero</Label>
                    <Select value={profile.gender || ''}>
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
                      placeholder="Onde você nasceu"
                    />
                  </div>
                  <div>
                    <Label htmlFor="birth_date">Data de Nascimento</Label>
                    <Input 
                      id="birth_date" 
                      type="date" 
                      value={profile.birth_date || ''} 
                    />
                  </div>
                  <div>
                    <Label htmlFor="cpf">CPF</Label>
                    <Input 
                      id="cpf" 
                      value={profile.cpf || ''} 
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>
                <Button>Salvar Alterações</Button>
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
                {!profile.cloned_voice_id ? (
                  <>
                    <div className="space-y-4">
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
                          <audio controls src={recordedAudio} className="flex-1" />
                        )}
                      </div>

                      <Button 
                        onClick={cloneVoice}
                        disabled={!recordedAudio || isCloning}
                        className="w-full"
                      >
                        {isCloning ? "Clonando..." : "Clonar Minha Voz"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center space-y-4">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                    <h3 className="text-lg font-semibold">Voz Clonada com Sucesso!</h3>
                    <p className="text-muted-foreground">
                      Sua voz foi clonada e está pronta para gerar áudios personalizados
                    </p>
                    <Button onClick={generateAudioLibrary}>
                      Gerar Biblioteca de Áudios
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="library">
            <Card>
              <CardHeader>
                <CardTitle>Biblioteca de Áudios Personalizada</CardTitle>
                <CardDescription>
                  Gerencie seus componentes de áudio personalizados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {audioLibrary.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      Nenhum áudio gerado ainda
                    </p>
                    <Button 
                      onClick={generateAudioLibrary}
                      disabled={!profile.cloned_voice_id}
                    >
                      Gerar Biblioteca Personalizada
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {audioLibrary.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(item.status)}
                          <div>
                            <p className="font-medium">{item.component_key}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.component_type === 'sentiment' ? 'Sentimento' : 'Componente Base'}
                              {item.sentiment_name && ` - ${item.sentiment_name}`}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {item.status === 'completed' && item.audio_path && (
                            <Button size="sm" variant="outline">
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="outline">
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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