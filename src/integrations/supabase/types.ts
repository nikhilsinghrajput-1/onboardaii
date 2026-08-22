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
          org_id: string
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
          org_id: string
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
          org_id?: string
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
            foreignKeyName: "alert_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string
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
          org_id: string
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
          org_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          flow_trigger_error: string | null
          flow_triggered_at: string | null
          full_name: string
          id: string
          location: string | null
          on_call: boolean
          org_id: string
          owning_team: string | null
          pii_access: boolean
          role: string
          seniority: string | null
          slack_channel_error: string | null
          slack_channel_id: string | null
          slack_channel_name: string | null
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
          flow_trigger_error?: string | null
          flow_triggered_at?: string | null
          full_name: string
          id?: string
          location?: string | null
          on_call?: boolean
          org_id: string
          owning_team?: string | null
          pii_access?: boolean
          role: string
          seniority?: string | null
          slack_channel_error?: string | null
          slack_channel_id?: string | null
          slack_channel_name?: string | null
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
          flow_trigger_error?: string | null
          flow_triggered_at?: string | null
          full_name?: string
          id?: string
          location?: string | null
          on_call?: boolean
          org_id?: string
          owning_team?: string | null
          pii_access?: boolean
          role?: string
          seniority?: string | null
          slack_channel_error?: string | null
          slack_channel_id?: string | null
          slack_channel_name?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hires_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          org_id: string
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
          org_id: string
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
          org_id?: string
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
          {
            foreignKeyName: "onboarding_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_connections: {
        Row: {
          connected_by: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          connected_by?: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          connected_by?: string | null
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          email: string | null
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          flow_trigger_url: string | null
          id: string
          name: string
          resume_url: string | null
          slack_alert_channel: string | null
          slack_approval_channel: string | null
          slug: string
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          created_at?: string
          created_by: string
          flow_trigger_url?: string | null
          id?: string
          name: string
          resume_url?: string | null
          slack_alert_channel?: string | null
          slack_approval_channel?: string | null
          slug: string
          updated_at?: string
          webhook_secret?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          flow_trigger_url?: string | null
          id?: string
          name?: string
          resume_url?: string | null
          slack_alert_channel?: string | null
          slack_approval_channel?: string | null
          slug?: string
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: []
      }
      relay_deliveries: {
        Row: {
          attempts: number
          callback_host: string
          callback_url: string
          created_at: string
          duration_ms: number | null
          employee_email: string | null
          endpoint_type: string
          error: string | null
          event: string | null
          hire_ref: string | null
          id: string
          ok: boolean
          payload_preview: string | null
          response_preview: string | null
          source: string
          status_code: number | null
        }
        Insert: {
          attempts?: number
          callback_host: string
          callback_url: string
          created_at?: string
          duration_ms?: number | null
          employee_email?: string | null
          endpoint_type: string
          error?: string | null
          event?: string | null
          hire_ref?: string | null
          id?: string
          ok?: boolean
          payload_preview?: string | null
          response_preview?: string | null
          source?: string
          status_code?: number | null
        }
        Update: {
          attempts?: number
          callback_host?: string
          callback_url?: string
          created_at?: string
          duration_ms?: number | null
          employee_email?: string | null
          endpoint_type?: string
          error?: string | null
          event?: string | null
          hire_ref?: string | null
          id?: string
          ok?: boolean
          payload_preview?: string | null
          response_preview?: string | null
          source?: string
          status_code?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_membership: { Args: never; Returns: boolean }
      is_org_member: { Args: { _org_id: string }; Returns: boolean }
      is_org_owner: { Args: { _org_id: string }; Returns: boolean }
    }
    Enums: {
      approval_decision: "approved" | "rejected"
      org_role: "owner" | "member"
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
      org_role: ["owner", "member"],
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
