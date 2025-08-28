// FASE 3: Componente de Progress Tracking Visual
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Loader2,
  Volume2,
  Radio
} from 'lucide-react';
import { useAudioAssembly } from '@/hooks/useAudioAssembly';

interface AudioAssemblyProgressProps {
  sessionId?: string;
  className?: string;
}

export const AudioAssemblyProgress = ({ sessionId, className }: AudioAssemblyProgressProps) => {
  const { currentJob, isProcessing } = useAudioAssembly(sessionId);

  if (!currentJob || !isProcessing) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'processing':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const segments = (currentJob as any).assembly_instructions?.assemblyOrder || [];
  const currentProgress = currentJob.progress_percentage || 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Radio className="h-5 w-5" />
          Montagem de Áudio em Progresso
        </CardTitle>
          <Badge variant="outline" className="flex items-center gap-1">
            {getStatusIcon(currentJob.status)}
            {currentJob.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progresso Geral */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Progresso Geral</span>
            <span className="text-muted-foreground">{currentProgress}%</span>
          </div>
          <Progress value={currentProgress} className="h-2" />
          {currentJob.error_message && (
            <p className="text-sm text-red-600">{currentJob.error_message}</p>
          )}
        </div>

        {/* Segmentos Individuais */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Segmentos de Áudio</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {segments.map((segment: any, index: number) => {
              const segmentProgress = Math.min(100, Math.max(0, 
                ((currentProgress - (index * (100 / segments.length))) / (100 / segments.length)) * 100
              ));
              const isCompleted = segmentProgress >= 100;
              const isProcessing = segmentProgress > 0 && segmentProgress < 100;

              return (
                <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : isProcessing ? (
                      <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                    ) : (
                      <Clock className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">
                        {segment.type === 'base_word' ? 'Palavra Base' :
                         segment.type === 'sentiment' ? 'Sentimento' : 'Evento'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(segmentProgress)}%
                      </span>
                    </div>
                    
                    <Progress value={segmentProgress} className="h-1" />
                    
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {segment.componentKey || segment.sentiment || 'Evento específico'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Informações Adicionais */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Volume2 className="h-4 w-4" />
            <span>{segments.length} segmentos</span>
          </div>
          {currentJob.total_duration_seconds && (
            <span>~{Math.round(currentJob.total_duration_seconds / 60)} min</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};