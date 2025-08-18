import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assemblyInstructions, sessionId, userId } = await req.json();
    console.log(`Starting audio assembly for session: ${sessionId}, user: ${userId}`);

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role para operações admin
    );

    // Criar job de montagem
    const { data: job, error: jobError } = await supabase
      .from('assembly_jobs')
      .insert({
        session_id: sessionId,
        user_id: userId,
        assembly_instructions: assemblyInstructions,
        status: 'pending'
      })
      .select()
      .single();

    if (jobError) {
      console.error('Erro ao criar assembly job:', jobError);
      throw new Error('Falha ao criar job de montagem');
    }

    console.log(`Assembly job created: ${job.id}`);

    // Iniciar processamento em background (não aguardar)
    EdgeRuntime.waitUntil(processAudioAssembly(supabase, job));

    // Retornar resposta imediata
    return new Response(JSON.stringify({
      success: true,
      jobId: job.id,
      message: 'Montagem de áudio iniciada! Você receberá notificações sobre o progresso.',
      estimatedDuration: assemblyInstructions.estimatedDuration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in audio-assembly function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processAudioAssembly(supabase: any, job: any) {
  const jobId = job.id;
  const instructions = job.assembly_instructions;
  
  try {
    console.log(`Processing assembly job ${jobId}`);
    
    // Atualizar status para processing
    await updateJobStatus(supabase, jobId, 'processing', 0, 'Iniciando montagem...');

    // Buscar componentes necessários
    const componentKeys = instructions.baseComponents;
    const { data: components, error: componentsError } = await supabase
      .from('audio_components')
      .select('*')
      .in('component_key', componentKeys);

    if (componentsError) {
      throw new Error(`Erro ao buscar componentes: ${componentsError.message}`);
    }

    console.log(`Found ${components.length} components for assembly`);
    
    // Simular processamento de montagem de áudio
    // Em um cenário real, aqui seria feita a concatenação real dos arquivos de áudio
    const totalSteps = instructions.assemblyOrder.length;
    const assembledSegments = [];

    for (let i = 0; i < totalSteps; i++) {
      const step = instructions.assemblyOrder[i];
      const component = components.find(c => c.component_key === step.componentKey);
      
      if (!component) {
        throw new Error(`Componente não encontrado: ${step.componentKey}`);
      }

      // Aplicar substituições no texto
      let finalText = component.text_content;
      for (const [placeholder, replacement] of Object.entries(step.replacements)) {
        finalText = finalText.replace(placeholder, replacement);
      }

      assembledSegments.push({
        order: i + 1,
        componentKey: step.componentKey,
        finalText,
        type: step.type,
        estimatedDuration: 15 // segundos por segmento
      });

      // Atualizar progresso
      const progress = Math.round(((i + 1) / totalSteps) * 80); // 80% para montagem
      await updateJobStatus(supabase, jobId, 'processing', progress, 
        `Processando segmento ${i + 1} de ${totalSteps}`);

      // Simular tempo de processamento
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Assembly completed for job ${jobId}, ${assembledSegments.length} segments`);

    // Simular finalização (render final, upload, etc.)
    await updateJobStatus(supabase, jobId, 'processing', 90, 'Finalizando áudio...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Calcular métricas finais
    const totalDuration = assembledSegments.length * 15;
    const estimatedFileSize = totalDuration * 64000; // ~64KB por segundo para MP3 médio

    // Em um cenário real, aqui seria feito upload do arquivo final para o storage
    const resultAudioPath = `assembly-results/${jobId}/final-audio.mp3`;

    // Marcar como concluído
    await supabase
      .from('assembly_jobs')
      .update({
        status: 'completed',
        progress_percentage: 100,
        result_audio_path: resultAudioPath,
        total_duration_seconds: totalDuration,
        total_file_size_bytes: estimatedFileSize,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    console.log(`Assembly job ${jobId} completed successfully`);

  } catch (error) {
    console.error(`Error processing assembly job ${jobId}:`, error);
    
    await supabase
      .from('assembly_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

async function updateJobStatus(supabase: any, jobId: string, status: string, progress: number, message?: string) {
  const updateData: any = {
    status,
    progress_percentage: progress,
    updated_at: new Date().toISOString()
  };

  if (status === 'processing' && !updateData.started_at) {
    updateData.started_at = new Date().toISOString();
  }

  await supabase
    .from('assembly_jobs')
    .update(updateData)
    .eq('id', jobId);

  console.log(`Job ${jobId} status updated: ${status} (${progress}%) - ${message || ''}`);
}