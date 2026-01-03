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
      console.log('🎤 Starting recording...');

      // Check microphone permissions
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');

        if (audioInputs.length === 0) {
          throw new Error('Nenhum microfone encontrado');
        }

        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('🎤 Microphone permissions granted');
      } catch (permissionError: any) {
        console.error('🎤 Permission error:', permissionError);

        if (permissionError.name === 'NotAllowedError') {
          throw new Error('Permissão de microfone negada. Permita o acesso ao microfone.');
        } else if (permissionError.name === 'NotFoundError') {
          throw new Error('Microfone não encontrado');
        } else {
          throw new Error(`Erro ao acessar microfone: ${permissionError.message}`);
        }
      }

      if (isRecording) return;

      if (!window.MediaRecorder) {
        throw new Error('Navegador não suporta gravação de áudio');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });

      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 192000
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event: any) => {
        console.error('🎤 MediaRecorder error:', event.error);
        setIsRecording(false);
        setIsProcessing(false);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      setIsPaused(false);

      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      console.log('🎤 Recording started successfully');

    } catch (error: any) {
      console.error('🎤 Failed to start recording:', error);
      setIsRecording(false);
      setIsProcessing(false);
      throw error;
    }
  }, [toast]);

  const stopRecordingBlob = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current || !isRecording) {
        reject(new Error('Recording not active'));
        return;
      }

      setIsProcessing(true);

      mediaRecorderRef.current.onstop = () => {
        try {
          console.log('🛑 Parando gravação (blob)...');

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }

          const audioBlob = new Blob(audioChunksRef.current, {
            type: 'audio/webm;codecs=opus'
          });

          console.log('📦 Blob de áudio extraído:', audioBlob.size, 'bytes');

          setIsRecording(false);
          setIsProcessing(false);
          setRecordingTime(0);

          if (audioBlob.size === 0) {
            reject(new Error('Nenhum áudio foi gravado'));
          } else {
            resolve(audioBlob);
          }
        } catch (error) {
          console.error('❌ Erro ao extrair blob:', error);
          setIsRecording(false);
          setIsProcessing(false);
          setRecordingTime(0);
          reject(error);
        }
      };

      mediaRecorderRef.current.stop();
    });
  }, [isRecording]);

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
    stopRecordingBlob,
    cancelRecording,
    pauseRecording,
    resumeRecording,
  };
};