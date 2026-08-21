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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      alert_log: {
        Row: {
          channel: string
          created_at: string
          detail: string | null
          hire_id: string | null
          id: string
          kind: string
          send_error: string | null
          task_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          detail?: string | null
          hire_id?: string | null
          id?: string
          kind: string
          send_error?: string | null
          task_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          detail?: string | null
          hire_id?: string | null
          id?: string
          kind?: string
          send_error?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_log_hire_id_fkey"
            columns: ["hire_id"]
            isOneToOne: false
            referencedRelation: "hires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          channel: string
          created_at: string
          decided_by: string | null
          decided_by_label: string | null
          decision: Database["public"]["Enums"]["approval_decision"]
          id: string
          note: string
          task_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          decided_by?: string | null
          decided_by_label?: string | null
          decision: Database["public"]["Enums"]["approval_decision"]
          id?: string
          note: string
          task_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          decided_by?: string | null
          decided_by_label?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"]
          id?: string
          note?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      hires: {
        Row: {
          created_at: string
          department: string
          direct_reports: boolean
          email: string | null
          employment_type: string | null
          external_id: string | null
          full_name: string
          id: string
          location: string | null
          on_call: boolean
          owning_team: string | null
          pii_access: boolean
          role: string
          seniority: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department: string
          direct_reports?: boolean
          email?: string | null
          employment_type?: string | null
          external_id?: string | null
          full_name: string
          id?: string
          location?: string | null
          on_call?: boolean
          owning_team?: string | null
          pii_access?: boolean
          role: string
          seniority?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string
          direct_reports?: boolean
          email?: string | null
          employment_type?: string | null
          external_id?: string | null
          full_name?: string
          id?: string
          location?: string | null
          on_call?: boolean
          owning_team?: string | null
          pii_access?: boolean
          role?: string
          seniority?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_tasks: {
        Row: {
          action: string
          confidence: number | null
          created_at: string
          error_message: string | null
          external_task_id: string | null
          hire_id: string
          id: string
          raw_response: string | null
          reason: string | null
          retry_count: number
          sensitive: boolean
          status: Database["public"]["Enums"]["task_status"]
          system: string
          updated_at: string
        }
        Insert: {
          action: string
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          external_task_id?: string | null
          hire_id: string
          id?: string
          raw_response?: string | null
          reason?: string | null
          retry_count?: number
          sensitive?: boolean
          status?: Database["public"]["Enums"]["task_status"]
          system: string
          updated_at?: string
        }
        Update: {
          action?: string
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          external_task_id?: string | null
          hire_id?: string
          id?: string
          raw_response?: string | null
          reason?: string | null
          retry_count?: number
          sensitive?: boolean
          status?: Database["public"]["Enums"]["task_status"]
          system?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_hire_id_fkey"
            columns: ["hire_id"]
            isOneToOne: false
            referencedRelation: "hires"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      approval_decision: "approved" | "rejected"
      task_status:
        | "not_started"
        | "in_progress"
        | "completed"
        | "failed"
        | "needs_human"
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
      approval_decision: ["approved", "rejected"],
      task_status: [
        "not_started",
        "in_progress",
        "completed",
        "failed",
        "needs_human",
      ],
    },
  },
} as const
