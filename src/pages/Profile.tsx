import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, User, Mic, Square, Trash2, Edit2, Check, X, AlertCircle,
  RotateCcw, CheckCircle, Clock, PlayCircle, Shield, AlertTriangle, Timer
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DataEncryption, InputValidator, RateLimiter, AuditLogger } from "@/lib/security";
import { AudioLibraryNew } from '@/components/AudioLibraryNew';
import { CityAutocomplete } from '@/components/CityAutocomplete';
import { MyProcedures } from '@/components/MyProcedures';

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
  const [selectedLanguage, setSelectedLanguage] = useState("Portuguese");
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [tempVoiceId, setTempVoiceId] = useState<string | null>(null);
  const [testAudio, setTestAudio] = useState<string | null>(null);
  const [testPhraseText, setTestPhraseText] = useState<string | null>(null);
  const [showVoiceTest, setShowVoiceTest] = useState(false);
  const [isGeneratingLibrary, setIsGeneratingLibrary] = useState(false);
  const [isRedoingCloning, setIsRedoingCloning] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showRecordingWarning, setShowRecordingWarning] = useState(false);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [isCalculatingAstro, setIsCalculatingAstro] = useState(false);
  const [astroData, setAstroData] = useState<any>(null);

  // Timer effect
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 60) {
            stopRecording();
            toast({
              title: "Tempo limite atingido",
              description: "A gravação foi encerrada automaticamente após 1 minuto.",
            });
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
      setTimerInterval(interval);
      return () => clearInterval(interval);
    } else {
      if (timerInterval) clearInterval(timerInterval);
    }
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

      // Buscar dados astrológicos
      const { data: astro } = await supabase
        .from('user_astro_data')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (astro) {
        setAstroData(astro);
      }

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
        birth_time: profile.birth_time,
        birth_latitude: profile.birth_latitude || null,
        birth_longitude: profile.birth_longitude || null,
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

  const calculateAstroChart = async () => {
    if (!user?.id) return;

    if (!profile.birth_date || !profile.birth_city) {
      toast({
        title: "Dados incompletos",
        description: "Preencha sua data e cidade de nascimento primeiro.",
        variant: "destructive",
      });
      return;
    }

    setIsCalculatingAstro(true);
    try {
      const { data, error } = await supabase.functions.invoke('astro-chart', {
        body: { userId: user.id }
      });

      if (error) throw error;

      setAstroData(data.data);
      toast({
        title: "Mapa Astral calculado!",
        description: `Seu Sol está em ${data.data.sun_sign}, Lua em ${data.data.moon_sign} e seu Ascendente é ${data.data.rising_sign}.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao calcular mapa",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCalculatingAstro(false);
    }
  };

  const handleProfileChange = (field: string, value: string) => {
    setProfile((prev: any) => ({ ...prev, [field]: value }));
  };

  // Handler especial para cidade que também salva coordenadas
  const handleCityChange = (value: string, selection?: { name: string; lat: number; lng: number }) => {
    if (selection) {
      // Se selecionou do autocomplete, salvar coordenadas também
      setProfile((prev: any) => ({
        ...prev,
        birth_city: selection.name,
        birth_latitude: selection.lat,
        birth_longitude: selection.lng
      }));
    } else {
      // Se apenas digitou, salvar só o nome
      setProfile((prev: any) => ({ ...prev, birth_city: value }));
    }
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
    const fields = ['full_name', 'gender', 'birth_city', 'birth_date', 'birth_time', 'cpf'];
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
    setShowRecordingWarning(false);
    setRecordingTime(0);
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

  const handleStartRecordingClick = () => {
    if (!sampleText) {
      toast({
        title: "Gere um texto primeiro",
        description: "Você precisa gerar um texto inspiracional para ler durante a gravação.",
        variant: "destructive",
      });
      return;
    }
    setShowRecordingWarning(true);
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
        body: { voiceId, language: selectedLanguage }
      });

      if (error) throw error;

      // Convert base64 to audio URL
      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0))],
        { type: 'audio/mp3' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      setTestAudio(audioUrl);
      setTestPhraseText(data.testPhrase);

      // Audio will be played through the visible player - no auto-play

      toast({
        title: "Teste de voz gerado!",
        description: "Ouça o áudio para conferir sua voz clonada.",
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

      // Convert blob to base64 for the Edge Function
      const reader = new FileReader();
      const audioBase64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]); // Remove data:audio/webm;base64, prefix
        };
        reader.readAsDataURL(audioBlob);
      });

      // Call voice-clone function
      const { data, error } = await supabase.functions.invoke('voice-clone', {
        body: {
          audioBase64: audioBase64,
          voiceName: voiceName,
          language: selectedLanguage, // Send selected language
          userId: user?.id
        }
      });

      if (error) throw error;

      setTempVoiceId(data.voice_id);
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

  const rejectVoice = async () => {
    // If we have a temp voice ID, delete it from ElevenLabs
    if (tempVoiceId) {
      try {
        await supabase.functions.invoke('voice-clone-confirm', {
          body: {
            voiceId: tempVoiceId,
            voiceName: voiceName,
            action: 'reject'
          }
        });
        toast({
          title: "Voz excluída",
          description: "Você pode refazer a gravação.",
        });
      } catch (error) {
        console.error('Error deleting voice:', error);
        // Continue anyway, just log the error
      }
    }

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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="personal">Dados Pessoais</TabsTrigger>
            <TabsTrigger value="voice">Clonagem de Voz</TabsTrigger>
            <TabsTrigger value="procedures">Procedimentos</TabsTrigger>
            <TabsTrigger value="library">Biblioteca</TabsTrigger>
            <TabsTrigger value="credits">Créditos</TabsTrigger>
            <TabsTrigger value="privacy">Privacidade</TabsTrigger>
          </TabsList>

          <TabsContent value="procedures">
            <MyProcedures />
          </TabsContent>

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
                    <Label htmlFor="birth_city" className="flex items-center gap-1">
                      Cidade de Nascimento
                      <span className="text-red-500">*</span>
                    </Label>
                    <CityAutocomplete
                      value={profile.birth_city || ''}
                      onChange={handleCityChange}
                      placeholder="Digite e selecione sua cidade"
                    />
                  </div>
                  <div>
                    <Label htmlFor="birth_date" className="flex items-center gap-1">
                      Data de Nascimento
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="birth_date"
                      type="date"
                      value={profile.birth_date || ''}
                      onChange={(e) => handleProfileChange('birth_date', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="birth_time" className="flex items-center gap-2">
                      Hora de Nascimento
                      <span className="text-red-500">*</span>
                      <span className="text-xs text-muted-foreground font-normal">(formato 24h)</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={profile.birth_time?.split(':')[0] || ''}
                        onValueChange={(hour) => {
                          const currentMinute = profile.birth_time?.split(':')[1] || '00';
                          handleProfileChange('birth_time', `${hour}:${currentMinute}`);
                        }}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue placeholder="Hora" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                              {i.toString().padStart(2, '0')}h
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-lg font-bold text-muted-foreground">:</span>
                      <Select
                        value={profile.birth_time?.split(':')[1]?.substring(0, 2) || ''}
                        onValueChange={(minute) => {
                          const currentHour = profile.birth_time?.split(':')[0] || '12';
                          handleProfileChange('birth_time', `${currentHour}:${minute}`);
                        }}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue placeholder="Min" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 60 }, (_, i) => (
                            <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                              {i.toString().padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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

                <div className="flex gap-4">
                  <Button onClick={updateProfile} disabled={isSaving}>
                    {isSaving ? "Salvando..." : "Salvar Alterações"}
                  </Button>

                  {profile.birth_date && profile.birth_city && profile.birth_time ? (
                    <Button
                      onClick={calculateAstroChart}
                      disabled={isCalculatingAstro}
                      variant="outline"
                      className="border-purple-200 hover:bg-purple-50 text-purple-700"
                    >
                      {isCalculatingAstro ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Calculando Mapa...
                        </>
                      ) : (
                        "Calcular Mapa Astral"
                      )}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      <span>Preencha cidade, data e hora de nascimento para calcular o mapa</span>
                    </div>
                  )}
                </div>

                {astroData && (
                  <div className="mt-6 animate-in fade-in slide-in-from-top-4">
                    {/* Header do Mapa Astral */}
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-700 p-6 text-white shadow-xl">
                      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-2xl">
                            ✨
                          </div>
                          <div>
                            <h4 className="text-xl font-bold">Seu Mapa Astral</h4>
                            <p className="text-purple-100 text-sm">Configurado e pronto para as sessões</p>
                          </div>
                        </div>

                        {/* Trindade Principal - Sol, Lua, Ascendente */}
                        <div className="grid grid-cols-3 gap-4 mt-4">
                          <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center border border-white/20 hover:bg-white/20 transition-all">
                            <span className="text-3xl mb-2 block">☀️</span>
                            <span className="text-xs text-purple-200 block">Sol</span>
                            <span className="font-bold text-lg">{astroData.sun_sign || '—'}</span>
                            <span className="text-xs text-purple-200 block mt-1">Essência</span>
                          </div>
                          <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center border border-white/20 hover:bg-white/20 transition-all">
                            <span className="text-3xl mb-2 block">🌙</span>
                            <span className="text-xs text-purple-200 block">Lua</span>
                            <span className="font-bold text-lg">{astroData.moon_sign || '—'}</span>
                            <span className="text-xs text-purple-200 block mt-1">Emoções</span>
                          </div>
                          <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center border border-white/20 hover:bg-white/20 transition-all">
                            <span className="text-3xl mb-2 block">⬆️</span>
                            <span className="text-xs text-purple-200 block">Ascendente</span>
                            <span className="font-bold text-lg">{astroData.rising_sign || '—'}</span>
                            <span className="text-xs text-purple-200 block mt-1">Personalidade</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Planetas Terapêuticos */}
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🔑</span>
                          <div>
                            <span className="text-xs text-amber-600 font-medium">Quíron</span>
                            <p className="font-bold text-amber-900">{astroData.chiron_sign || '—'}</p>
                          </div>
                        </div>
                        <p className="text-xs text-amber-700 mt-2">Sua ferida sagrada e potencial de cura</p>
                      </div>
                      <div className="bg-gradient-to-br from-slate-50 to-gray-100 border border-slate-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🪨</span>
                          <div>
                            <span className="text-xs text-slate-600 font-medium">Saturno</span>
                            <p className="font-bold text-slate-900">{astroData.saturn_sign || '—'}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 mt-2">Onde sente medo e precisa de estrutura</p>
                      </div>
                    </div>

                    {/* Pontos Especiais - Lilith, Nodo Norte, Fortuna, MC */}
                    {(astroData.lilith_sign || astroData.north_node_sign || astroData.fortune_sign || astroData.mc_sign) && (
                      <div className="mt-4 grid grid-cols-4 gap-2">
                        {astroData.lilith_sign && (
                          <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-lg p-3 text-center">
                            <span className="text-xl block">⚸</span>
                            <span className="text-xs text-violet-600">Lilith</span>
                            <p className="font-semibold text-violet-900 text-sm">{astroData.lilith_sign}</p>
                          </div>
                        )}
                        {astroData.north_node_sign && (
                          <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-lg p-3 text-center">
                            <span className="text-xl block">☊</span>
                            <span className="text-xs text-teal-600">Nodo Norte</span>
                            <p className="font-semibold text-teal-900 text-sm">{astroData.north_node_sign}</p>
                          </div>
                        )}
                        {astroData.fortune_sign && (
                          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-3 text-center">
                            <span className="text-xl block">⊕</span>
                            <span className="text-xs text-yellow-700">Fortuna</span>
                            <p className="font-semibold text-yellow-900 text-sm">{astroData.fortune_sign}</p>
                          </div>
                        )}
                        {astroData.mc_sign && (
                          <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 rounded-lg p-3 text-center">
                            <span className="text-xl block">🔝</span>
                            <span className="text-xs text-sky-600">Meio do Céu</span>
                            <p className="font-semibold text-sky-900 text-sm">{astroData.mc_sign}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Distribuição de Elementos */}
                    {astroData.element_distribution && Object.keys(astroData.element_distribution).length > 0 && (
                      <div className="mt-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xl">🌍</span>
                          <span className="font-semibold text-green-900 text-sm">Distribuição de Elementos</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="text-center bg-white/60 rounded-lg p-2">
                            <span className="text-2xl block">🔥</span>
                            <span className="text-xs text-orange-600 font-medium">Fogo</span>
                            <p className="font-bold text-orange-700">{astroData.element_distribution.Fogo || 0}%</p>
                          </div>
                          <div className="text-center bg-white/60 rounded-lg p-2">
                            <span className="text-2xl block">🌱</span>
                            <span className="text-xs text-green-600 font-medium">Terra</span>
                            <p className="font-bold text-green-700">{astroData.element_distribution.Terra || 0}%</p>
                          </div>
                          <div className="text-center bg-white/60 rounded-lg p-2">
                            <span className="text-2xl block">💨</span>
                            <span className="text-xs text-cyan-600 font-medium">Ar</span>
                            <p className="font-bold text-cyan-700">{astroData.element_distribution.Ar || 0}%</p>
                          </div>
                          <div className="text-center bg-white/60 rounded-lg p-2">
                            <span className="text-2xl block">💧</span>
                            <span className="text-xs text-blue-600 font-medium">Água</span>
                            <p className="font-bold text-blue-700">{astroData.element_distribution['Água'] || 0}%</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Qualidades e Polaridade */}
                    {(astroData.quality_distribution || astroData.polarity_distribution) && (
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        {astroData.quality_distribution && Object.keys(astroData.quality_distribution).length > 0 && (
                          <div className="bg-gradient-to-br from-fuchsia-50 to-pink-50 border border-fuchsia-200 rounded-xl p-4 shadow-sm">
                            <span className="font-semibold text-fuchsia-900 text-sm block mb-2">Qualidades</span>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-fuchsia-700">Cardinal</span>
                                <span className="font-bold">{astroData.quality_distribution.Cardinal || 0}%</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-fuchsia-700">Fixo</span>
                                <span className="font-bold">{astroData.quality_distribution.Fixo || 0}%</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-fuchsia-700">Mutável</span>
                                <span className="font-bold">{astroData.quality_distribution['Mutável'] || 0}%</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {astroData.polarity_distribution && Object.keys(astroData.polarity_distribution).length > 0 && (
                          <div className="bg-gradient-to-br from-gray-50 to-slate-100 border border-gray-200 rounded-xl p-4 shadow-sm">
                            <span className="font-semibold text-gray-900 text-sm block mb-2">Polaridade</span>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-700">☀️ Yang (Ativo)</span>
                                <span className="font-bold">{astroData.polarity_distribution.Yang || 0}%</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-700">🌙 Yin (Reativo)</span>
                                <span className="font-bold">{astroData.polarity_distribution.Yin || 0}%</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Planetas Retrógrados */}
                    {astroData.retrograde_planets && astroData.retrograde_planets.length > 0 && (
                      <div className="mt-4 bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">℞</span>
                          <span className="font-semibold text-amber-900 text-sm">Planetas Retrógrados</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {astroData.retrograde_planets.map((planet: string) => (
                            <span key={planet} className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                              {planet} ℞
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-amber-600 mt-2 italic">Planetas em movimento aparente reverso - energias internalizadas</p>
                      </div>
                    )}

                    {/* Aspectos de Tensão */}
                    {astroData.aspects_summary && astroData.aspects_summary.length > 0 && (
                      <div className="mt-4 bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xl">⚡</span>
                          <span className="font-semibold text-rose-900 text-sm">Pontos de Tensão (Padrões Sistêmicos)</span>
                        </div>
                        <div className="space-y-2">
                          {astroData.aspects_summary.map((aspect: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                              <span className="text-rose-800">
                                <strong>{aspect.p1}</strong> em <span className="text-rose-600">{aspect.type}</span> com <strong>{aspect.p2}</strong>
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-rose-500 mt-3 italic">
                          Esses aspectos indicam conflitos internos que aparecem como padrões repetitivos na sua vida.
                        </p>
                      </div>
                    )}



                    {/* Trânsitos do Dia (Horóscopo) */}
                    {astroData?.transits_data && (
                      <div className="mt-4 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xl">📅</span>
                          <div>
                            <span className="font-semibold text-indigo-900 text-sm block">Energia do Dia</span>
                            <span className="text-xs text-indigo-600">Influências astrológicas para hoje</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {(astroData.transits_data?.chart_data?.aspects || [])
                            .filter((a: any) => ['conjunction', 'square', 'opposition'].includes(a.aspect_type?.toLowerCase()))
                            .slice(0, 3)
                            .map((tr: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-sm bg-white/60 p-2 rounded-lg border border-indigo-100/50">
                                <span className="text-lg">
                                  {['square', 'opposition'].includes(tr.aspect_type?.toLowerCase()) ? '⚠️' : '✨'}
                                </span>
                                <span className="text-indigo-800">
                                  {tr.point1} (céu) em <strong>{tr.aspect_type}</strong> com {tr.point2} (natal)
                                </span>
                              </div>
                            ))}

                          {(!astroData.transits_data?.chart_data?.aspects ||
                            astroData.transits_data.chart_data.aspects.filter((a: any) => ['conjunction', 'square', 'opposition'].includes(a.aspect_type?.toLowerCase())).length === 0
                          ) && (
                              <div className="text-sm text-indigo-700 italic flex items-center gap-2">
                                <span>🕊️</span> O céu está calmo para você hoje. Aproveite o fluxo harmonioso.
                              </div>
                            )}
                        </div>
                      </div>
                    )}

                    {/* Todos os Planetas - Expandível com Graus e Retrógrado */}
                    {astroData.planet_positions && Object.keys(astroData.planet_positions).length > 0 ? (
                      <details className="mt-4 group">
                        <summary className="cursor-pointer bg-purple-50 hover:bg-purple-100 transition-all rounded-lg p-3 flex items-center justify-between text-purple-700 font-medium text-sm border border-purple-100">
                          <span className="flex items-center gap-2">
                            <span>🌌</span> Ver Todos os Planetas (com Graus)
                          </span>
                          <span className="text-purple-400 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4 bg-purple-50/50 rounded-lg border border-purple-100">
                          {Object.entries(astroData.planet_positions).map(([planet, data]: [string, any]) => data && (
                            <div key={planet} className="bg-white rounded-lg p-3 border border-purple-100 shadow-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xl">{data.emoji || '🔮'}</span>
                                <span className="text-xs text-muted-foreground capitalize flex-1">{planet}</span>
                                {data.isRetrograde && (
                                  <span className="text-amber-600 text-xs font-bold" title="Retrógrado">℞</span>
                                )}
                              </div>
                              <p className="font-semibold text-purple-800">{data.sign || '—'}</p>
                              {data.fullPosition && (
                                <p className="text-xs text-purple-600">{data.fullPosition}</p>
                              )}
                              {data.house && (
                                <p className="text-xs text-muted-foreground">Casa {data.house}</p>
                              )}
                              {data.dignity && (
                                <span className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${data.dignity === 'Domicílio' || data.dignity === 'Exaltação'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-rose-100 text-rose-700'
                                  }`}>
                                  {data.dignity}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : astroData.astro_chart?.all_planets && (
                      <details className="mt-4 group">
                        <summary className="cursor-pointer bg-purple-50 hover:bg-purple-100 transition-all rounded-lg p-3 flex items-center justify-between text-purple-700 font-medium text-sm border border-purple-100">
                          <span className="flex items-center gap-2">
                            <span>🌌</span> Ver Todos os Planetas
                          </span>
                          <span className="text-purple-400 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 p-4 bg-purple-50/50 rounded-lg border border-purple-100">
                          {Object.entries(astroData.astro_chart.all_planets).map(([planet, data]: [string, any]) => (
                            <div key={planet} className="bg-white rounded-lg p-2 text-center border border-purple-100 shadow-sm">
                              <span className="text-lg block">{data.emoji || '🔮'}</span>
                              <span className="text-xs text-muted-foreground capitalize">{planet}</span>
                              <span className="font-medium text-purple-800 text-sm block">{data.sign || '—'}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {/* Cúspides das 12 Casas */}
                    {astroData.house_cusps && Object.keys(astroData.house_cusps).length > 0 && (
                      <details className="mt-4 group">
                        <summary className="cursor-pointer bg-indigo-50 hover:bg-indigo-100 transition-all rounded-lg p-3 flex items-center justify-between text-indigo-700 font-medium text-sm border border-indigo-100">
                          <span className="flex items-center gap-2">
                            <span>🏠</span> Ver Cúspides das 12 Casas
                          </span>
                          <span className="text-indigo-400 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="mt-2 grid grid-cols-4 sm:grid-cols-6 gap-2 p-4 bg-indigo-50/50 rounded-lg border border-indigo-100">
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => {
                            const cusp = astroData.house_cusps[`house_${num}`];
                            return (
                              <div key={num} className="bg-white rounded-lg p-2 text-center border border-indigo-100 shadow-sm">
                                <span className="text-xs text-indigo-600 font-medium block">Casa {num}</span>
                                <span className="font-semibold text-indigo-800 text-sm block">{cusp?.sign || '—'}</span>
                                {cusp?.degree !== null && cusp?.degree !== undefined && (
                                  <span className="text-xs text-indigo-500">{cusp.degree}°</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    )}
                  </div>
                )}
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
                        <Label htmlFor="language">Idioma da Gravação</Label>
                        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                          <SelectTrigger className="mb-4">
                            <SelectValue placeholder="Selecione o idioma" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Portuguese">Português (Brasil)</SelectItem>
                            <SelectItem value="English">Inglês</SelectItem>
                            <SelectItem value="Spanish">Espanhol</SelectItem>
                            <SelectItem value="German">Alemão</SelectItem>
                            <SelectItem value="Italian">Italiano</SelectItem>
                            <SelectItem value="French">Francês</SelectItem>
                            <SelectItem value="Polish">Polonês</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

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
                        <div className="mt-6 space-y-2">
                          <Label className="text-base font-semibold">Roteiro para Gravação</Label>
                          <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-muted/30">
                            <article className="prose prose-sm dark:prose-invert max-w-none">
                              <div className="whitespace-pre-wrap text-base font-medium leading-relaxed font-serif text-foreground/90">
                                {sampleText}
                              </div>
                            </article>
                          </ScrollArea>
                          <div className="text-xs text-muted-foreground text-center">
                            Leia o texto acima com naturalidade e emoção. Pause brevemente nas pontuações.
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Button
                          onClick={isRecording ? stopRecording : handleStartRecordingClick}
                          variant={isRecording ? "destructive" : "default"}
                          className={isRecording ? "animate-pulse" : ""}
                        >
                          {isRecording ? <Square className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                          {isRecording ? `Parar (${formatTime(recordingTime)} / 1:00)` : "Gravar Voz"}
                        </Button>

                        {recordedAudio && !showVoiceTest && (
                          <Button
                            onClick={resetRecording}
                            variant="outline"
                            size="sm"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Refazer Gravação
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
                                <div className="space-y-3">
                                  <div className="p-3 bg-gray-50 border rounded-lg">
                                    <audio controls className="w-full" src={testAudio}>
                                      Seu navegador não suporta áudio.
                                    </audio>
                                  </div>

                                  {testPhraseText && (
                                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                                      <p className="text-xs font-medium text-indigo-700 mb-2">Texto lido pela voz clonada:</p>
                                      <ScrollArea className="h-24">
                                        <p className="text-sm text-indigo-900 whitespace-pre-line">{testPhraseText}</p>
                                      </ScrollArea>
                                    </div>
                                  )}
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

                {/* Alert Dialog for Recording Warning */}
                <AlertDialog open={showRecordingWarning} onOpenChange={setShowRecordingWarning}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Preparação para Gravação</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-4 text-sm text-muted-foreground">
                          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100 text-amber-900">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold block mb-1">Atenção ao Ambiente</span>
                              <span>Certifique-se de estar em um local silencioso, sem ruídos de fundo (trânsito, ventilador, outras pessoas falando).</span>
                            </div>
                          </div>

                          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100 text-blue-900">
                            <Mic className="w-5 h-5 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold block mb-1">Qualidade do Microfone</span>
                              <span>Use um microfone de boa qualidade e mantenha-o a uma distância constante da boca (aprox. 15cm).</span>
                            </div>
                          </div>

                          <span>A gravação terá duração máxima de <strong>1 minuto</strong>.</span>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={startRecording}>
                        Estou pronto, Iniciar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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

          <TabsContent value="privacy">
            <PrivacyTab userId={user?.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div >
  );
};



const AudioLibraryTab = () => {
  return <AudioLibraryNew />;
};

const PrivacyTab = ({ userId }: { userId?: string }) => {
  const [showDeleteConversations, setShowDeleteConversations] = useState(false);
  const [showDeleteSentiments, setShowDeleteSentiments] = useState(false);
  const [showDeleteVoice, setShowDeleteVoice] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [confirmConversations, setConfirmConversations] = useState("");
  const [confirmSentiments, setConfirmSentiments] = useState("");
  const [confirmVoice, setConfirmVoice] = useState("");
  const [confirmAll, setConfirmAll] = useState("");
  const [confirmAccount, setConfirmAccount] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [stats, setStats] = useState<{ sessions: number; messages: number; sentiments: number; audios: number; hasVoice: boolean }>({
    sessions: 0,
    messages: 0,
    sentiments: 0,
    audios: 0,
    hasVoice: false
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (userId) loadStats();
  }, [userId]);

  const loadStats = async () => {
    const { count: sessionsCount } = await (supabase
      .from('therapy_sessions' as any))
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { count: messagesCount } = await (supabase
      .from('session_messages' as any))
      .select('*', { count: 'exact', head: true });

    // Sentimentos personalizados (NÃO são base_contexto - são os criados durante sessões)
    const { count: sentimentsCount } = await (supabase
      .from('sentimentos' as any))
      .select('*', { count: 'exact', head: true })
      .neq('categoria', 'base_contexto');

    // Áudios do usuário
    const { count: audiosCount } = await (supabase
      .from('user_audio_library' as any))
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Verificar se tem voz clonada de forma resiliente
    let hasVoice = false;
    try {
      const { data: profile, error: profileError } = await (supabase
        .from('user_profiles' as any))
        .select('cloned_voice_id')
        .eq('id', userId)
        .maybeSingle();

      if (!profileError && (profile as any)?.cloned_voice_id) {
        hasVoice = true;
      }
    } catch (e) {
      console.warn("Could not load user_profile:", e.message);
    }

    setStats({
      sessions: sessionsCount || 0,
      messages: messagesCount || 0,
      sentiments: sentimentsCount || 0,
      audios: audiosCount || 0,
      hasVoice
    });
  };

  const deleteConversations = async () => {
    if (!userId) return;
    setIsDeleting(true);
    try {
      // Deletar assembly_jobs primeiro (FK para therapy_sessions)
      await (supabase.from('assembly_jobs' as any)).delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Deletar autocura_analytics (FK para therapy_sessions)
      await (supabase.from('autocura_analytics' as any)).delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Deletar mensagens (FK)
      await (supabase.from('session_messages' as any)).delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Deletar protocolos
      await (supabase.from('session_protocols' as any)).delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Deletar sessões
      await (supabase.from('therapy_sessions' as any)).delete().eq('user_id', userId);

      toast({
        title: "Conversas excluídas",
        description: "Todas as suas conversas foram excluídas com sucesso.",
      });

      setShowDeleteConversations(false);
      loadStats();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteSentiments = async () => {
    if (!userId) return;
    setIsDeleting(true);
    try {
      // Deletar apenas sentimentos NÃO padrão (personalizados e gerados por contexto)
      // Mantém os sentimentos base_contexto que são padrão para todos os perfis
      await (supabase
        .from('sentimentos' as any))
        .delete()
        .neq('categoria', 'base_contexto');

      toast({
        title: "Sentimentos excluídos",
        description: "Todos os sentimentos personalizados foram excluídos. Os sentimentos padrão foram mantidos.",
      });

      setShowDeleteSentiments(false);
      loadStats();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteVoiceAndAudios = async () => {
    if (!userId) return;
    setIsDeleting(true);
    try {
      // 1. Deletar arquivos de áudio do bucket voice_samples
      const { data: files } = await supabase.storage
        .from('voice_samples')
        .list(userId);

      if (files && files.length > 0) {
        const filesToDelete = files.map(f => `${userId}/${f.name}`);
        await supabase.storage
          .from('voice_samples')
          .remove(filesToDelete);
      }

      // 2. Limpar cloned_voice_id do perfil
      await (supabase
        .from('user_profiles' as any))
        .update({ cloned_voice_id: null })
        .eq('id', userId);

      // 3. Deletar biblioteca de áudios
      await (supabase
        .from('user_audio_library' as any))
        .delete()
        .eq('user_id', userId);

      toast({
        title: "Voz e áudios excluídos",
        description: "Seu perfil de voz clonada e biblioteca de áudios foram removidos.",
      });

      setShowDeleteVoice(false);
      loadStats();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteAllData = async () => {
    if (!userId) return;
    setIsDeleting(true);
    try {
      // Deletar tudo vinculado ao usuário em ordem de dependências
      try {
        await (supabase.from('assembly_jobs' as any)).delete().eq('user_id', userId);
      } catch (e: any) { console.warn("Failed to delete assembly_jobs:", e.message); }

      try {
        await (supabase.from('autocura_analytics' as any)).delete().eq('user_id', userId);
      } catch (e: any) { console.warn("Failed to delete autocura_analytics:", e.message); }

      // Deletar sessões (dispara delete em cascata se configurado, senão limpamos as mensagens depois)
      await (supabase.from('therapy_sessions' as any)).delete().eq('user_id', userId);

      // Limpar sentimentos criados pelo usuário
      await (supabase.from('sentimentos' as any)).delete().neq('categoria', 'base_contexto').eq('criado_por', userId);

      await (supabase.from('user_audio_library' as any)).delete().eq('user_id', userId);
      await (supabase.from('user_memory' as any)).delete().eq('user_id', userId);
      await (supabase.from('user_astro_data' as any)).delete().eq('user_id', userId);
      await (supabase.from('pending_topics' as any)).delete().eq('user_id', userId);

      // Deletar arquivos de voz do bucket
      const { data: files } = await supabase.storage
        .from('voice_samples')
        .list(userId);

      if (files && files.length > 0) {
        const filesToDelete = files.map(f => `${userId}/${f.name}`);
        await supabase.storage
          .from('voice_samples')
          .remove(filesToDelete);
      }

      // Limpar cloned_voice_id do perfil
      await (supabase
        .from('user_profiles' as any))
        .update({ cloned_voice_id: null })
        .eq('id', userId);

      toast({
        title: "Dados excluídos",
        description: "Todos os seus dados sensíveis foram excluídos permanentemente.",
      });

      setShowDeleteAll(false);
      setConfirmAll("");
      loadStats();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteAccount = async () => {
    if (!userId) return;
    setIsDeleting(true);
    try {
      // Deletar conversas, sentimentos e áudios
      try {
        await (supabase.from('assembly_jobs' as any)).delete().eq('user_id', userId);
      } catch (e: any) { console.warn("Failed to delete assembly_jobs:", e.message); }
      try {
        await (supabase.from('autocura_analytics' as any)).delete().eq('user_id', userId);
      } catch (e: any) { console.warn("Failed to delete autocura_analytics:", e.message); }
      try {
        await (supabase.from('therapy_sessions' as any)).delete().eq('user_id', userId);
      } catch (e: any) { console.warn("Failed to delete therapy_sessions:", e.message); }
      try {
        await (supabase.from('sentimentos' as any)).delete().neq('categoria', 'base_contexto').eq('criado_por', userId);
      } catch (e: any) { console.warn("Failed to delete sentiments:", e.message); }
      try {
        await (supabase.from('user_audio_library' as any)).delete().eq('user_id', userId);
      } catch (e: any) { console.warn("Failed to delete user_audio_library:", e.message); }
      try {
        await (supabase.from('user_memory' as any)).delete().eq('user_id', userId);
      } catch (e: any) { console.warn("Failed to delete user_memory:", e.message); }
      try {
        await (supabase.from('user_astro_data' as any)).delete().eq('user_id', userId);
      } catch (e: any) { console.warn("Failed to delete user_astro_data:", e.message); }
      try {
        await (supabase.from('pending_topics' as any)).delete().eq('user_id', userId);
      } catch (e: any) { console.warn("Failed to delete pending_topics:", e.message); }

      // Deletar arquivos de voz do buckets
      try {
        const { data: files } = await supabase.storage.from('voice_samples').list(userId);
        if (files && files.length > 0) {
          await supabase.storage.from('voice_samples').remove(files.map(f => `${userId}/${f.name}`));
        }
      } catch (e) { console.warn("Failed to delete voice_samples from bucket:", e.message); }

      // 3. Deletar Perfil definitivamente
      await (supabase.from('user_profiles' as any)).delete().eq('id', userId);
      try {
        await (supabase.from('profiles' as any)).delete().eq('id', userId);
      } catch (e: any) { console.warn("Failed to delete legacy profiles:", e.message); }

      // 4. Logout e Redirecionamento
      await supabase.auth.signOut();

      toast({
        title: "Conta excluída",
        description: "Seus dados foram removidos e sua sessão foi encerrada.",
      });

      navigate('/auth');
    } catch (error: any) {
      toast({
        title: "Erro ao encerrar conta",
        description: error.message,
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Privacidade e Dados
        </CardTitle>
        <CardDescription>
          Gerencie e exclua seus dados pessoais
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Estatísticas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-2xl font-bold">{stats.sessions}</p>
            <p className="text-sm text-muted-foreground">Sessões</p>
          </div>
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-2xl font-bold">{stats.messages}</p>
            <p className="text-sm text-muted-foreground">Mensagens</p>
          </div>
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-2xl font-bold">{stats.sentiments}</p>
            <p className="text-sm text-muted-foreground">Sentimentos</p>
          </div>
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-2xl font-bold">{stats.audios}</p>
            <p className="text-sm text-muted-foreground">Áudios</p>
            {stats.hasVoice && (
              <span className="text-xs text-green-600 font-medium block">✓ Voz clonada</span>
            )}
          </div>
        </div>

        {/* Excluir Conversas */}
        <div className="p-4 border rounded-lg space-y-3">
          <div className="flex items-start gap-3">
            <Trash2 className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium">Excluir Todas as Conversas</h4>
              <p className="text-sm text-muted-foreground">
                Remove todas as sessões de terapia e mensagens. Sentimentos e outros dados permanecem.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteConversations(true)}>
              Excluir
            </Button>
          </div>
        </div>

        {/* Excluir Sentimentos Personalizados (mantém os padrão) */}
        <div className="p-4 border rounded-lg space-y-3">
          <div className="flex items-start gap-3">
            <Trash2 className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium">Excluir Sentimentos Personalizados</h4>
              <p className="text-sm text-muted-foreground">
                Remove os sentimentos criados durante suas sessões. Os sentimentos padrão da lista base serão mantidos.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteSentiments(true)}>
              Excluir
            </Button>
          </div>
        </div>

        {/* Excluir Perfil de Voz e Áudios */}
        <div className="p-4 border rounded-lg space-y-3">
          <div className="flex items-start gap-3">
            <Mic className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium">Excluir Perfil de Voz e Áudios</h4>
              <p className="text-sm text-muted-foreground">
                Remove sua voz clonada e todos os áudios gerados ({stats.audios} áudios).
                {stats.hasVoice ? ' Inclui seu perfil de voz personalizado.' : ' Você não possui voz clonada no momento.'}
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteVoice(true)}
              disabled={stats.audios === 0 && !stats.hasVoice}
            >
              Excluir
            </Button>
          </div>
        </div>

        {/* Excluir Tudo (Mantendo Perfil) */}
        <div className="p-4 border border-destructive/50 bg-destructive/5 rounded-lg space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-destructive">Limpar Histórico e Dados Terapêuticos</h4>
              <p className="text-sm text-muted-foreground">
                Remove todas as conversas, sentimentos, áudios e fatos IA, mas <strong>mantém seu perfil e dados de nascimento</strong>.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteAll(true)}>
              Excluir Tudo
            </Button>
          </div>
        </div>

        {/* Excluir Conta Definitivamente */}
        <div className="p-4 border border-destructive bg-destructive/10 rounded-lg space-y-3">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-destructive">Encerrar e Excluir Conta</h4>
              <p className="text-sm text-muted-foreground">
                A opção mais rigorosa. Apaga seu perfil, todos os seus dados astrológicos, conversas, fatos conhecidos pela IA e sua voz. Sua conta deixará de existir.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteAccount(true)}>
              Excluir Conta
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Dialog: Excluir Conversas */}
      <AlertDialog open={showDeleteConversations} onOpenChange={(open) => {
        setShowDeleteConversations(open);
        if (!open) setConfirmConversations("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir todas as conversas?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Isso excluirá permanentemente {stats.sessions} sessões e {stats.messages} mensagens.
                  Esta ação não pode ser desfeita.
                </p>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Digite <span className="font-mono bg-muted px-1.5 py-0.5 rounded">EXCLUIR</span> para confirmar:
                  </p>
                  <Input
                    value={confirmConversations}
                    onChange={(e) => setConfirmConversations(e.target.value)}
                    placeholder="Digite EXCLUIR"
                    className="font-mono"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteConversations}
              disabled={isDeleting || confirmConversations !== "EXCLUIR"}
              className="bg-destructive text-destructive-foreground"
            >
              {isDeleting ? "Excluindo..." : "Excluir Conversas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Excluir Sentimentos */}
      <AlertDialog open={showDeleteSentiments} onOpenChange={(open) => {
        setShowDeleteSentiments(open);
        if (!open) setConfirmSentiments("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sentimentos personalizados?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <div>
                  <p>Isso excluirá os {stats.sentiments} sentimentos personalizados criados durante suas sessões.</p>
                  <strong className="block mt-2 text-green-700">✓ Os sentimentos padrão da lista base serão mantidos.</strong>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Digite <span className="font-mono bg-muted px-1.5 py-0.5 rounded">EXCLUIR</span> para confirmar:
                  </p>
                  <Input
                    value={confirmSentiments}
                    onChange={(e) => setConfirmSentiments(e.target.value)}
                    placeholder="Digite EXCLUIR"
                    className="font-mono"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteSentiments}
              disabled={isDeleting || confirmSentiments !== "EXCLUIR"}
              className="bg-destructive text-destructive-foreground"
            >
              {isDeleting ? "Excluindo..." : "Excluir Sentimentos"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Excluir Voz e Áudios */}
      <AlertDialog open={showDeleteVoice} onOpenChange={(open) => {
        setShowDeleteVoice(open);
        if (!open) setConfirmVoice("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir perfil de voz e áudios?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm text-muted-foreground">
                <div>
                  <p>Isso excluirá permanentemente:</p>
                  <ul className="list-disc list-inside mt-2">
                    {stats.hasVoice && <li>Seu perfil de voz clonada</li>}
                    <li>Todos os {stats.audios} áudios gerados na sua biblioteca</li>
                    <li>Arquivos de amostra de voz salvos</li>
                  </ul>
                  <p className="text-amber-600 font-medium mt-2">Você precisará refazer a clonagem de voz para gerar novos áudios.</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Digite <span className="font-mono bg-muted px-1.5 py-0.5 rounded">EXCLUIR</span> para confirmar:
                  </p>
                  <Input
                    value={confirmVoice}
                    onChange={(e) => setConfirmVoice(e.target.value)}
                    placeholder="Digite EXCLUIR"
                    className="font-mono"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteVoiceAndAudios}
              disabled={isDeleting || confirmVoice !== "EXCLUIR"}
              className="bg-destructive text-destructive-foreground"
            >
              {isDeleting ? "Excluindo..." : "Excluir Voz e Áudios"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Excluir Tudo */}
      <AlertDialog open={showDeleteAll} onOpenChange={(open) => {
        setShowDeleteAll(open);
        if (!open) setConfirmAll("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              ⚠️ Exclusão Total de Dados
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                  Esta é uma ação <strong>irreversível</strong>. Todos os seguintes dados serão excluídos permanentemente:
                </p>
                <ul className="list-disc list-inside">
                  <li>Todas as sessões de terapia ({stats.sessions})</li>
                  <li>Todas as mensagens ({stats.messages})</li>
                  <li>Todos os sentimentos personalizados ({stats.sentiments})</li>
                  <li>Sua biblioteca de áudios ({stats.audios} áudios)</li>
                  {stats.hasVoice && <li>Seu perfil de voz clonada</li>}
                </ul>
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-sm font-medium text-foreground">
                    Para confirmar, digite <span className="font-mono bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">EXCLUIR TUDO</span>:
                  </p>
                  <Input
                    value={confirmAll}
                    onChange={(e) => setConfirmAll(e.target.value)}
                    placeholder="Digite EXCLUIR TUDO"
                    className="font-mono border-destructive/50"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteAllData}
              disabled={isDeleting || confirmAll !== "EXCLUIR TUDO"}
              className="bg-destructive text-destructive-foreground"
            >
              {isDeleting ? "Excluindo..." : "Excluir TUDO"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Dialog: Excluir Conta Definitivamente */}
      <AlertDialog open={showDeleteAccount} onOpenChange={(open) => {
        setShowDeleteAccount(open);
        if (!open) setConfirmAccount("");
      }}>
        <AlertDialogContent className="border-destructive">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              ADEUS: Excluir Conta Definitivamente?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p className="font-bold text-destructive underline">
                  Esta ação é FINAL e IRREVERSÍVEL.
                </p>
                <p>
                  Ao confirmar, removeremos:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Seu perfil completo e dados de nascimento</li>
                  <li>Todas as {stats.sessions} sessões e {stats.messages} mensagens</li>
                  <li>Sua voz clonada e {stats.audios} áudios gerados</li>
                  <li>Seu saldo de créditos será perdido</li>
                </ul>
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-sm font-medium text-foreground">
                    Para confirmar a exclusão da sua conta, digite <span className="font-mono bg-destructive text-white px-1.5 py-0.5 rounded text-xs">EXCLUIR CONTA DEFINITIVAMENTE</span>:
                  </p>
                  <Input
                    value={confirmAccount}
                    onChange={(e) => setConfirmAccount(e.target.value)}
                    placeholder="Digite a frase de confirmação"
                    className="font-mono border-destructive focus-visible:ring-destructive"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mudei de idéia</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteAccount}
              disabled={isDeleting || confirmAccount !== "EXCLUIR CONTA DEFINITIVAMENTE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Excluindo tudo..." : "Confirmar Exclusão de Conta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};