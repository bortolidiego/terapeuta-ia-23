export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      assembly_jobs: {
        Row: {
          assembly_instructions: Json
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          progress_percentage: number | null
          result_audio_path: string | null
          session_id: string | null
          started_at: string | null
          status: string
          total_duration_seconds: number | null
          total_file_size_bytes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assembly_instructions: Json
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          progress_percentage?: number | null
          result_audio_path?: string | null
          session_id?: string | null
          started_at?: string | null
          status?: string
          total_duration_seconds?: number | null
          total_file_size_bytes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assembly_instructions?: Json
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          progress_percentage?: number | null
          result_audio_path?: string | null
          session_id?: string | null
          started_at?: string | null
          status?: string
          total_duration_seconds?: number | null
          total_file_size_bytes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assembly_jobs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "therapy_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_components: {
        Row: {
          audio_path: string | null
          component_key: string
          component_type: string
          created_at: string
          duration_seconds: number | null
          file_size_bytes: number | null
          id: string
          is_available: boolean | null
          protocol_type: string | null
          text_content: string
          updated_at: string
        }
        Insert: {
          audio_path?: string | null
          component_key: string
          component_type: string
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          is_available?: boolean | null
          protocol_type?: string | null
          text_content: string
          updated_at?: string
        }
        Update: {
          audio_path?: string | null
          component_key?: string
          component_type?: string
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          is_available?: boolean | null
          protocol_type?: string | null
          text_content?: string
          updated_at?: string
        }
        Relationships: []
      }
      audio_templates: {
        Row: {
          audio_url: string | null
          created_at: string
          id: string
          is_fixed: boolean
          template_key: string
          template_text: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          id?: string
          is_fixed?: boolean
          template_key: string
          template_text: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          id?: string
          is_fixed?: boolean
          template_key?: string
          template_text?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          operation: string
          table_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          table_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          table_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          keywords: string[] | null
          priority: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          priority?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          priority?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      protocol_steps: {
        Row: {
          content: Json
          created_at: string
          id: string
          next_conditions: Json | null
          protocol_id: string
          step_number: number
          step_type: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          next_conditions?: Json | null
          protocol_id: string
          step_number: number
          step_type: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          next_conditions?: Json | null
          protocol_id?: string
          step_number?: number
          step_type?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action_type: string
          attempt_count: number
          created_at: string
          id: string
          user_id: string
          window_start: string
        }
        Insert: {
          action_type: string
          attempt_count?: number
          created_at?: string
          id?: string
          user_id: string
          window_start?: string
        }
        Update: {
          action_type?: string
          attempt_count?: number
          created_at?: string
          id?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      sentimentos: {
        Row: {
          categoria: string
          contexto: string | null
          created_at: string
          criado_por: string
          frequencia_uso: number
          id: string
          nome: string
          ultima_selecao: string | null
          updated_at: string
        }
        Insert: {
          categoria: string
          contexto?: string | null
          created_at?: string
          criado_por: string
          frequencia_uso?: number
          id?: string
          nome: string
          ultima_selecao?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string
          contexto?: string | null
          created_at?: string
          criado_por?: string
          frequencia_uso?: number
          id?: string
          nome?: string
          ultima_selecao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      session_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "therapy_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_protocols: {
        Row: {
          created_at: string
          current_step: number
          id: string
          protocol_data: Json
          protocol_id: string
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          id?: string
          protocol_data?: Json
          protocol_id: string
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_step?: number
          id?: string
          protocol_data?: Json
          protocol_id?: string
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      therapist_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          main_prompt: string
          max_tokens: number
          model_name: string
          temperature: number
          template_version: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          main_prompt?: string
          max_tokens?: number
          model_name?: string
          temperature?: number
          template_version?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          main_prompt?: string
          max_tokens?: number
          model_name?: string
          temperature?: number
          template_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      therapy_facts: {
        Row: {
          created_at: string
          fact_text: string
          id: string
          sentiments: Json | null
          session_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fact_text: string
          id?: string
          sentiments?: Json | null
          session_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fact_text?: string
          id?: string
          sentiments?: Json | null
          session_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      therapy_protocols: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          steps_config: Json
          trigger_keywords: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          name: string
          steps_config?: Json
          trigger_keywords?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          steps_config?: Json
          trigger_keywords?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      therapy_sessions: {
        Row: {
          auto_generated_title: string | null
          created_at: string
          id: string
          session_summary: string | null
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          auto_generated_title?: string | null
          created_at?: string
          id?: string
          session_summary?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          auto_generated_title?: string | null
          created_at?: string
          id?: string
          session_summary?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      usage_tracking: {
        Row: {
          cost_usd: number
          created_at: string
          id: string
          metadata: Json | null
          operation_type: string
          service: string
          tokens_used: number
          user_id: string
        }
        Insert: {
          cost_usd: number
          created_at?: string
          id?: string
          metadata?: Json | null
          operation_type: string
          service: string
          tokens_used: number
          user_id: string
        }
        Update: {
          cost_usd?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          operation_type?: string
          service?: string
          tokens_used?: number
          user_id?: string
        }
        Relationships: []
      }
      user_audio_drafts: {
        Row: {
          audio_duration: number | null
          audio_path: string
          audio_size: number | null
          created_at: string
          id: string
          mime_type: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          audio_duration?: number | null
          audio_path: string
          audio_size?: number | null
          created_at?: string
          id?: string
          mime_type?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          audio_duration?: number | null
          audio_path?: string
          audio_size?: number | null
          created_at?: string
          id?: string
          mime_type?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_audio_library: {
        Row: {
          audio_path: string | null
          component_key: string
          component_type: string | null
          created_at: string
          generation_method: string | null
          id: string
          sentiment_name: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_path?: string | null
          component_key: string
          component_type?: string | null
          created_at?: string
          generation_method?: string | null
          id?: string
          sentiment_name?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_path?: string | null
          component_key?: string
          component_type?: string | null
          created_at?: string
          generation_method?: string | null
          id?: string
          sentiment_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          created_at: string
          elevenlabs_credits: number
          openai_credits: number
          total_spent_elevenlabs: number
          total_spent_openai: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          elevenlabs_credits?: number
          openai_credits?: number
          total_spent_elevenlabs?: number
          total_spent_openai?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          elevenlabs_credits?: number
          openai_credits?: number
          total_spent_elevenlabs?: number
          total_spent_openai?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_drafts: {
        Row: {
          created_at: string
          draft_content: string
          id: string
          session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          draft_content: string
          id?: string
          session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          draft_content?: string
          id?: string
          session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          birth_city: string | null
          birth_date: string | null
          cloned_voice_id: string | null
          cpf: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          gender: string | null
          id: string
          preferred_language: string | null
          session_count: number
          updated_at: string
          user_id: string | null
          voice_library_status: string | null
        }
        Insert: {
          birth_city?: string | null
          birth_date?: string | null
          cloned_voice_id?: string | null
          cpf?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          preferred_language?: string | null
          session_count?: number
          updated_at?: string
          user_id?: string | null
          voice_library_status?: string | null
        }
        Update: {
          birth_city?: string | null
          birth_date?: string | null
          cloned_voice_id?: string | null
          cpf?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          preferred_language?: string | null
          session_count?: number
          updated_at?: string
          user_id?: string | null
          voice_library_status?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sentiment_filters: {
        Row: {
          created_at: string
          id: string
          nome: string
          sentimentos: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          sentimentos: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          sentimentos?: string[]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      classify_protocol: {
        Args: { user_message: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_sentiment_usage: {
        Args: { sentiment_name: string }
        Returns: undefined
      }
      is_session_owner: {
        Args: { session_uuid: string }
        Returns: boolean
      }
      pause_consultation: {
        Args: { consultation_uuid: string }
        Returns: undefined
      }
      require_admin: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
