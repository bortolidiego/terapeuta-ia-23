// Security utilities for data protection and validation
import { toast } from "@/hooks/use-toast";

// Encryption utilities for sensitive data
export class DataEncryption {
  private static readonly SECRET_KEY = 'myhealing-encrypt-key-2024';
  
  static async encrypt(text: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const key = await this.getKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption error:', error);
      return text; // Fallback to plain text if encryption fails
    }
  }
  
  static async decrypt(encryptedText: string): Promise<string> {
    try {
      const combined = new Uint8Array(
        atob(encryptedText).split('').map(char => char.charCodeAt(0))
      );
      
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      const key = await this.getKey();
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedText; // Fallback to encrypted text if decryption fails
    }
  }
  
  private static async getKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.SECRET_KEY);
    const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
    
    return crypto.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }
}

// Input validation and sanitization
export class InputValidator {
  // CPF validation with proper format
  static validateCPF(cpf: string): { isValid: boolean; message?: string } {
    if (!cpf) return { isValid: true }; // Optional field
    
    // Remove formatting
    const cleanCPF = cpf.replace(/[^\\d]/g, '');
    
    // Check length
    if (cleanCPF.length !== 11) {
      return { isValid: false, message: 'CPF deve ter 11 dígitos' };
    }
    
    // Check for repeated digits
    if (/^(\d)\1+$/.test(cleanCPF)) {
      return { isValid: false, message: 'CPF não pode ter todos os dígitos iguais' };
    }
    
    // Validate checksum
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF[i]) * (10 - i);
    }
    let firstDigit = 11 - (sum % 11);
    if (firstDigit >= 10) firstDigit = 0;
    
    if (parseInt(cleanCPF[9]) !== firstDigit) {
      return { isValid: false, message: 'CPF inválido' };
    }
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF[i]) * (11 - i);
    }
    let secondDigit = 11 - (sum % 11);
    if (secondDigit >= 10) secondDigit = 0;
    
    if (parseInt(cleanCPF[10]) !== secondDigit) {
      return { isValid: false, message: 'CPF inválido' };
    }
    
    return { isValid: true };
  }
  
  // Format CPF for display
  static formatCPF(cpf: string): string {
    const cleanCPF = cpf.replace(/[^\\d]/g, '');
    return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  
  // Sanitize text input to prevent XSS
  static sanitizeText(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
      .slice(0, 1000); // Limit length
  }
  
  // Validate name fields
  static validateName(name: string): { isValid: boolean; message?: string } {
    if (!name) return { isValid: true }; // Optional field
    
    const sanitized = this.sanitizeText(name);
    
    if (sanitized.length < 2) {
      return { isValid: false, message: 'Nome deve ter pelo menos 2 caracteres' };
    }
    
    if (sanitized.length > 100) {
      return { isValid: false, message: 'Nome muito longo (máximo 100 caracteres)' };
    }
    
    if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(sanitized)) {
      return { isValid: false, message: 'Nome deve conter apenas letras e espaços' };
    }
    
    return { isValid: true };
  }
  
  // Validate birth date
  static validateBirthDate(date: string): { isValid: boolean; message?: string } {
    if (!date) return { isValid: true }; // Optional field
    
    const birthDate = new Date(date);
    const today = new Date();
    const minDate = new Date(today.getFullYear() - 120, 0, 1);
    const maxDate = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
    
    if (isNaN(birthDate.getTime())) {
      return { isValid: false, message: 'Data de nascimento inválida' };
    }
    
    if (birthDate < minDate || birthDate > maxDate) {
      return { isValid: false, message: 'Data de nascimento deve estar entre 13 e 120 anos atrás' };
    }
    
    return { isValid: true };
  }
  
  // Validate city name
  static validateCity(city: string): { isValid: boolean; message?: string } {
    if (!city) return { isValid: true }; // Optional field
    
    const sanitized = this.sanitizeText(city);
    
    if (sanitized.length < 2) {
      return { isValid: false, message: 'Cidade deve ter pelo menos 2 caracteres' };
    }
    
    if (sanitized.length > 100) {
      return { isValid: false, message: 'Nome da cidade muito longo' };
    }
    
    return { isValid: true };
  }
}

// Rate limiting utilities
export class RateLimiter {
  private static attempts = new Map<string, { count: number; lastAttempt: number }>();
  
  static checkLimit(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now();
    const existing = this.attempts.get(key);
    
    if (!existing) {
      this.attempts.set(key, { count: 1, lastAttempt: now });
      return true;
    }
    
    // Reset if window has passed
    if (now - existing.lastAttempt > windowMs) {
      this.attempts.set(key, { count: 1, lastAttempt: now });
      return true;
    }
    
    // Increment attempts
    existing.count++;
    existing.lastAttempt = now;
    
    if (existing.count > maxAttempts) {
      toast({
        title: "Muitas tentativas",
        description: `Aguarde ${Math.ceil(windowMs / 1000 / 60)} minutos antes de tentar novamente`,
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  }
}

// Audit logging utilities
export class AuditLogger {
  static async logSecurityEvent(
    event: string,
    details: Record<string, any>,
    userId?: string
  ): Promise<void> {
    try {
      const logEntry = {
        event,
        details,
        userId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };
      
      console.log('🔒 Security Event:', logEntry);
      
      // In a real implementation, this would send to a secure logging service
      // For now, we'll store in localStorage for demonstration
      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      logs.push(logEntry);
      
      // Keep only last 100 logs
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      localStorage.setItem('security_logs', JSON.stringify(logs));
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
  
  static getSecurityLogs(): any[] {
    try {
      return JSON.parse(localStorage.getItem('security_logs') || '[]');
    } catch {
      return [];
    }
  }
}
