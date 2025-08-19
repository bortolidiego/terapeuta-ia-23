import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAudioDraft } from './useAudioDraft';

export const useVoiceRecording = (sessionId?: string) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();
  const { saveAudioDraft } = useAudioDraft(sessionId);

  const startRecording = useCallback(async () => {
    try {
      console.log('🎤 Iniciando gravação...');
      
      // Verificar se o navegador suporta getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Seu navegador não suporta gravação de áudio');
      }

      // Verificar permissões antes de tentar acessar o microfone
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log('🔒 Status da permissão do microfone:', permission.state);

      if (permission.state === 'denied') {
        throw new Error('Permissão do microfone foi negada. Permita o acesso nas configurações do navegador.');
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      console.log('✅ Microfone acessado com sucesso');
      streamRef.current = stream;
      audioChunksRef.current = [];

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('📊 Dados de áudio coletados:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);

      console.log('🔴 Gravação iniciada');

      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast({
        title: 'Gravação iniciada',
        description: 'Fale agora. O áudio está sendo capturado.',
      });

    } catch (error) {
      console.error('❌ Erro ao iniciar gravação:', error);
      
      let errorMessage = 'Não foi possível acessar o microfone.';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Permissão do microfone foi negada. Permita o acesso e tente novamente.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'Nenhum microfone foi encontrado. Verifique se há um microfone conectado.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Gravação de áudio não é suportada neste navegador.';
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: 'Erro na gravação',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [toast]);

  const stopRecording = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current || !isRecording) {
        reject(new Error('Recording not active'));
        return;
      }

      setIsProcessing(true);

      mediaRecorderRef.current.onstop = async () => {
        try {
          console.log('🛑 Parando gravação...');
          
          // Stop timer
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          // Stop stream
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }

          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: 'audio/webm;codecs=opus' 
          });

          console.log('📦 Blob de áudio criado:', audioBlob.size, 'bytes');

          if (audioBlob.size === 0) {
            throw new Error('Nenhum áudio foi gravado. Tente novamente.');
          }

          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64Audio = (reader.result as string).split(',')[1];
              
              console.log('🔄 Enviando áudio para transcrição...');

              // Send to Supabase edge function
              const { data, error } = await supabase.functions.invoke('voice-to-text', {
                body: { audio: base64Audio }
              });

              if (error) {
                console.error('❌ Erro na edge function:', error);
                throw new Error(error.message);
              }

              console.log('✅ Transcrição recebida:', data?.text?.substring(0, 50));

              setIsRecording(false);
              setIsProcessing(false);
              setRecordingTime(0);
              
              toast({
                title: 'Transcrição concluída',
                description: 'Áudio processado com sucesso.',
              });
              
              resolve(data.text || '');
            } catch (error) {
              console.error('❌ Erro no processamento:', error);
              setIsRecording(false);
              setIsProcessing(false);
              setRecordingTime(0);
              
              toast({
                title: 'Erro no processamento',
                description: 'Não foi possível processar o áudio. Tente novamente.',
                variant: 'destructive',
              });
              
              reject(error);
            }
          };

          reader.readAsDataURL(audioBlob);
        } catch (error) {
          console.error('❌ Erro fatal ao parar gravação:', error);
          setIsRecording(false);
          setIsProcessing(false);
          setRecordingTime(0);
          reject(error);
        }
      };

      mediaRecorderRef.current.stop();
    });
  }, [isRecording, toast]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      setIsRecording(false);
      setIsProcessing(false);
      setRecordingTime(0);
      audioChunksRef.current = [];
    }
  }, [isRecording]);

  const pauseRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !isRecording || isPaused) return;

    setIsPaused(true);
    setIsProcessing(true);

    try {
      // Create audio blob from current chunks
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: 'audio/webm;codecs=opus' 
      });

      // Save as draft
      await saveAudioDraft(audioBlob, recordingTime);
      
      toast({
        title: 'Gravação pausada',
        description: 'Áudio salvo como rascunho. Você pode continuar ou enviar depois.',
      });
    } catch (error) {
      console.error('Error saving audio draft:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o rascunho.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [isRecording, isPaused, recordingTime, saveAudioDraft, toast]);

  const resumeRecording = useCallback(() => {
    if (!isPaused) return;
    setIsPaused(false);
  }, [isPaused]);

  return {
    isRecording,
    isProcessing,
    recordingTime,
    isPaused,
    startRecording,
    stopRecording,
    cancelRecording,
    pauseRecording,
    resumeRecording,
  };
};