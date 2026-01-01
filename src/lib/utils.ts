import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Security headers for enhanced protection
export const securityHeaders = {
  'Content-Security-Policy': `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ${import.meta.env.VITE_SUPABASE_URL} https://api.elevenlabs.io https://api.openai.com;`,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
};

// Data anonymization utilities
export function anonymizeData(data: any, fields: string[]): any {
  const anonymized = { ...data };

  fields.forEach(field => {
    if (anonymized[field]) {
      if (field === 'cpf') {
        // Show only first 3 and last 2 digits
        const cpf = anonymized[field].replace(/[^\d]/g, '');
        anonymized[field] = `${cpf.slice(0, 3)}.***.***-${cpf.slice(-2)}`;
      } else if (field === 'full_name' || field === 'display_name') {
        // Show only first name
        const names = anonymized[field].split(' ');
        anonymized[field] = `${names[0]} ${'*'.repeat(names.slice(1).join(' ').length)}`;
      } else {
        // Generic anonymization
        anonymized[field] = '*'.repeat(anonymized[field].length);
      }
    }
  });

  return anonymized;
}

// Session timeout utilities
export class SessionManager {
  private static readonly TIMEOUT_DURATION = 30 * 60 * 1000; // 30 minutes
  private static readonly WARNING_DURATION = 5 * 60 * 1000; // 5 minutes before timeout
  private static timeoutId: number | null = null;
  private static warningId: number | null = null;

  static startSession(onTimeout: () => void, onWarning: () => void): void {
    this.clearTimers();

    this.warningId = window.setTimeout(() => {
      onWarning();
    }, this.TIMEOUT_DURATION - this.WARNING_DURATION);

    this.timeoutId = window.setTimeout(() => {
      onTimeout();
    }, this.TIMEOUT_DURATION);
  }

  static resetSession(onTimeout: () => void, onWarning: () => void): void {
    this.startSession(onTimeout, onWarning);
  }

  static clearSession(): void {
    this.clearTimers();
  }

  private static clearTimers(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.warningId) {
      clearTimeout(this.warningId);
      this.warningId = null;
    }
  }
}
