import React from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface PasswordStrengthIndicatorProps {
  password: string;
  onStrengthChange: (isValid: boolean, score: number) => void;
}

const PasswordStrengthIndicator = ({ password, onStrengthChange }: PasswordStrengthIndicatorProps) => {
  const validatePasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, message: '', isValid: false, requirements: [] };
    
    let score = 0;
    const requirements = [];
    const checks = {
      length: { test: pwd.length >= 12, text: 'Mínimo 12 caracteres', points: 25 },
      lowercase: { test: /[a-z]/.test(pwd), text: 'Letras minúsculas', points: 15 },
      uppercase: { test: /[A-Z]/.test(pwd), text: 'Letras maiúsculas', points: 15 },
      numbers: { test: /\d/.test(pwd), text: 'Números', points: 15 },
      special: { test: /[!@#$%^&*(),.?":{}|<>]/.test(pwd), text: 'Símbolos especiais', points: 15 },
      noSequential: { test: !/123|abc|qwe|password|senha/i.test(pwd), text: 'Evitar sequências óbvias', points: 10 },
      noRepeated: { test: !/(.)\1{2,}/.test(pwd), text: 'Evitar caracteres repetidos', points: 5 }
    };

    Object.entries(checks).forEach(([key, check]) => {
      if (check.test) {
        score += check.points;
      } else {
        requirements.push(check.text);
      }
    });

    score = Math.max(0, Math.min(100, score));
    
    let message = '';
    let isValid = false;
    let color = 'bg-destructive';

    if (score < 40) {
      message = 'Senha muito fraca';
      color = 'bg-destructive';
    } else if (score < 60) {
      message = 'Senha fraca';
      color = 'bg-yellow-500';
    } else if (score < 80) {
      message = 'Senha moderada';
      color = 'bg-orange-500';
      isValid = true;
    } else {
      message = 'Senha forte';
      color = 'bg-green-500';
      isValid = true;
    }

    return { score, message, isValid, requirements, color };
  };

  const strength = validatePasswordStrength(password);

  // Notify parent component of strength change
  React.useEffect(() => {
    onStrengthChange(strength.isValid, strength.score);
  }, [strength.isValid, strength.score, onStrengthChange]);

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Progress value={strength.score} className="flex-1" />
        {strength.isValid ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        <div 
          className={`h-2 rounded-full transition-all ${strength.color}`}
          style={{ width: `${strength.score}%`, minWidth: '20px' }}
        />
        <span className="text-sm font-medium">{strength.message}</span>
      </div>

      {strength.requirements.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>Requisitos em falta:</span>
          </div>
          <ul className="text-xs text-muted-foreground ml-4 space-y-1">
            {strength.requirements.map((req, index) => (
              <li key={index} className="flex items-center space-x-1">
                <span className="w-1 h-1 bg-muted-foreground rounded-full" />
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;