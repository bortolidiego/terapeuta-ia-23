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
import { DataEncryption, InputValidator, RateLimiter, AuditLogger } from "@/lib/security";

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

    if (data) {
      // Decrypt sensitive data for display
      const decryptedProfile = { ...data };
      if (data.cpf) {
        try {
          const decryptedCPF = await DataEncryption.decrypt(data.cpf);
          decryptedProfile.cpf = InputValidator.formatCPF(decryptedCPF);
        } catch (error) {
          console.error('Failed to decrypt CPF:', error);
          decryptedProfile.cpf = data.cpf; // Fallback to original if decryption fails
        }
      }
      setProfile(decryptedProfile);

      // Log profile access
      AuditLogger.logSecurityEvent('profile_accessed', {
        hasPersonalData: !!(data.cpf || data.full_name || data.birth_date)
      }, user?.id);
    } else {
      setProfile({});
    }
  };

  const updateProfile = async () => {
    if (!user?.id) return;

    // Rate limiting check
    if (!RateLimiter.checkLimit(`profile_update_${user.id}`, 10, 60000)) {
      return;
    }

    // Validate all inputs
    const cpfValidation = InputValidator.validateCPF(profile.cpf);
    const nameValidation = InputValidator.validateName(profile.full_name);
    const birthDateValidation = InputValidator.validateBirthDate(profile.birth_date);
    const cityValidation = InputValidator.validateCity(profile.birth_city);

    if (!cpfValidation.isValid) {
      toast({
        title: "CPF inválido",
        description: cpfValidation.message,
        variant: "destructive",
      });
      return;
    }

    if (!nameValidation.isValid) {
      toast({
        title: "Nome inválido",
        description: nameValidation.message,
        variant: "destructive",
      });
      return;
    }

    if (!birthDateValidation.isValid) {
      toast({
        title: "Data inválida",
        description: birthDateValidation.message,
        variant: "destructive",
      });
      return;
    }

    if (!cityValidation.isValid) {
      toast({
        title: "Cidade inválida",
        description: cityValidation.message,
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Sanitize and encrypt sensitive data
      const sanitizedData = {
        full_name: InputValidator.sanitizeText(profile.full_name),
        gender: InputValidator.sanitizeText(profile.gender),
        birth_city: InputValidator.sanitizeText(profile.birth_city),
        birth_date: profile.birth_date,
        cpf: profile.cpf ? await DataEncryption.encrypt(profile.cpf.replace(/[^\d]/g, '')) : null,
      };

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
            ...sanitizedData,
          });

        if (insertError) throw insertError;

        // Log profile creation
        AuditLogger.logSecurityEvent('profile_created', {
          fields: Object.keys(sanitizedData).filter(key => sanitizedData[key as keyof typeof sanitizedData])
        }, user.id);
      } else {
        // Atualizar perfil existente
        const { error } = await supabase
          .from('user_profiles')
          .update(sanitizedData)
          .eq('user_id', user.id);

        if (error) throw error;

        // Log profile update
        AuditLogger.logSecurityEvent('profile_updated', {
          fields: Object.keys(sanitizedData).filter(key => sanitizedData[key as keyof typeof sanitizedData])
        }, user.id);
      }

      toast({
        title: "Perfil salvo!",
        description: "Suas informações foram atualizadas com sucesso.",
      });

      await loadProfile();
    } catch (error: any) {
      // Log failed update
      AuditLogger.logSecurityEvent('profile_update_failed', {
        error: error.message
      }, user.id);

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

  const resetRecording = () => {
    setRecordedAudio(null);
    setMediaRecorder(null);
    setTestAudio(null);
    setShowVoiceTest(false);
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
      // Upload audio to storage first
      const audioBlob = await (await fetch(recordedAudio)).blob();
      const fileExt = 'webm';
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('voice_samples')
        .upload(filePath, audioBlob);

      if (uploadError) throw uploadError;

      // Call voice-clone function
      const { data, error } = await supabase.functions.invoke('voice-clone', {
        body: {
          audioUrl: filePath,
          voiceName: voiceName,
          userId: user?.id
        }
      });

      if (error) throw error;

      setTempVoiceId(data.voiceId);
      setShowVoiceTest(true);

      toast({
        title: "Voz clonada!",
        description: "Agora você pode testar sua voz antes de salvar.",
      });

    } catch (error: any) {
      console.error('Error cloning voice:', error);
      toast({
        title: "Erro na clonagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCloning(false);
    }
  };

  const confirmVoice = async () => {
    if (!tempVoiceId) return;

    setIsSaving(true);
    try {
      // Update profile with new voice ID
      const { error } = await supabase
        .from('user_profiles')
        .update({
          cloned_voice_id: tempVoiceId,
          voice_name: voiceName
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      // Trigger pre-generation of audio cache
      toast({
        title: "Voz salva com sucesso!",
        description: "Iniciando geração da sua biblioteca de áudio...",
      });

      // Trigger background generation
      supabase.functions.invoke('pre-generate-audio', {
        body: {
          userId: user?.id,
          voiceId: tempVoiceId
        }
      });

      setProfile((prev: any) => ({ ...prev, cloned_voice_id: tempVoiceId }));
      setTempVoiceId(null);
      setShowVoiceTest(false);
      setIsRedoingCloning(false);

      // Refresh library
      loadAudioLibrary();

    } catch (error: any) {
      toast({
        title: "Erro ao salvar voz",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const rejectVoice = () => {
    setTempVoiceId(null);
    setShowVoiceTest(false);
    setTestAudio(null);
    setIsRedoingCloning(true);
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
                <CardTitle>Seus Créditos</CardTitle>
                <CardDescription>
                  Gerencie seus créditos para geração de áudios
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="font-medium">Minutos Disponíveis</span>
                    </div>
                    <p className="text-2xl font-bold">{credits.minutes_balance || 0} min</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-primary" />
                      <span className="font-medium">Status</span>
                    </div>
                    <p className="text-2xl font-bold capitalize">{credits.subscription_status || 'Free'}</p>
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