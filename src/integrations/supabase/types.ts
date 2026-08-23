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
      activity_log: {
        Row: {
          action: string
          created_at: string
          detail: string | null
          hire_id: string | null
          id: string
          org_id: string
          outcome: string
          tool: string
        }
        Insert: {
          action: string
          created_at?: string
          detail?: string | null
          hire_id?: string | null
          id?: string
          org_id: string
          outcome: string
          tool: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string | null
          hire_id?: string | null
          id?: string
          org_id?: string
          outcome?: string
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_hire_id_fkey"
            columns: ["hire_id"]
            isOneToOne: false
            referencedRelation: "hires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_briefings: {
        Row: {
          briefing_date: string
          created_at: string
          id: string
          model: string | null
          next_actions: Json
          org_id: string
          summary: string
        }
        Insert: {
          briefing_date?: string
          created_at?: string
          id?: string
          model?: string | null
          next_actions?: Json
          org_id: string
          summary: string
        }
        Update: {
          briefing_date?: string
          created_at?: string
          id?: string
          model?: string | null
          next_actions?: Json
          org_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_briefings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
      assessment_answers: {
        Row: {
          ai_feedback: string | null
          ai_score: number | null
          answer_text: string | null
          assessment_id: string
          choice_index: number | null
          correct: boolean | null
          created_at: string
          id: string
          org_id: string
          question_id: string
          updated_at: string
        }
        Insert: {
          ai_feedback?: string | null
          ai_score?: number | null
          answer_text?: string | null
          assessment_id: string
          choice_index?: number | null
          correct?: boolean | null
          created_at?: string
          id?: string
          org_id: string
          question_id: string
          updated_at?: string
        }
        Update: {
          ai_feedback?: string | null
          ai_score?: number | null
          answer_text?: string | null
          assessment_id?: string
          choice_index?: number | null
          correct?: boolean | null
          created_at?: string
          id?: string
          org_id?: string
          question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_answers_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "candidate_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_answers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          correct_index: number | null
          created_at: string
          id: string
          kind: string
          options: Json
          org_id: string
          points: number
          position: number
          prompt: string
        }
        Insert: {
          assessment_id: string
          correct_index?: number | null
          created_at?: string
          id?: string
          kind?: string
          options?: Json
          org_id: string
          points?: number
          position?: number
          prompt: string
        }
        Update: {
          assessment_id?: string
          correct_index?: number | null
          created_at?: string
          id?: string
          kind?: string
          options?: Json
          org_id?: string
          points?: number
          position?: number
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "candidate_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_questions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      background_check_claims: {
        Row: {
          category: string
          check_id: string
          claim: string
          confidence: number | null
          created_at: string
          decided_by: string | null
          evidence: string | null
          finding: string | null
          id: string
          org_id: string
          updated_at: string
          verdict: string
        }
        Insert: {
          category: string
          check_id: string
          claim: string
          confidence?: number | null
          created_at?: string
          decided_by?: string | null
          evidence?: string | null
          finding?: string | null
          id?: string
          org_id: string
          updated_at?: string
          verdict?: string
        }
        Update: {
          category?: string
          check_id?: string
          claim?: string
          confidence?: number | null
          created_at?: string
          decided_by?: string | null
          evidence?: string | null
          finding?: string | null
          id?: string
          org_id?: string
          updated_at?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_check_claims_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "background_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_check_claims_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      background_checks: {
        Row: {
          ai_error: string | null
          completed_at: string | null
          created_at: string
          hire_id: string
          id: string
          org_id: string
          requested_by: string | null
          risk_score: number
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          ai_error?: string | null
          completed_at?: string | null
          created_at?: string
          hire_id: string
          id?: string
          org_id: string
          requested_by?: string | null
          risk_score?: number
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          ai_error?: string | null
          completed_at?: string | null
          created_at?: string
          hire_id?: string
          id?: string
          org_id?: string
          requested_by?: string | null
          risk_score?: number
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_checks_hire_id_fkey"
            columns: ["hire_id"]
            isOneToOne: true
            referencedRelation: "hires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_checks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_assessments: {
        Row: {
          ai_feedback: string | null
          candidate_id: string
          created_at: string
          graded_at: string | null
          id: string
          max_score: number | null
          org_id: string
          score: number | null
          status: string
          submitted_at: string | null
          track_id: string | null
          updated_at: string
        }
        Insert: {
          ai_feedback?: string | null
          candidate_id: string
          created_at?: string
          graded_at?: string | null
          id?: string
          max_score?: number | null
          org_id: string
          score?: number | null
          status?: string
          submitted_at?: string | null
          track_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_feedback?: string | null
          candidate_id?: string
          created_at?: string
          graded_at?: string | null
          id?: string
          max_score?: number | null
          org_id?: string
          score?: number | null
          status?: string
          submitted_at?: string | null
          track_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_assessments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_assessments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_assessments_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "module_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_module_progress: {
        Row: {
          candidate_id: string
          completed_at: string | null
          created_at: string
          id: string
          module_item_id: string
          org_id: string
          status: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          module_item_id: string
          org_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          module_item_id?: string
          org_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_module_progress_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_module_progress_module_item_id_fkey"
            columns: ["module_item_id"]
            isOneToOne: false
            referencedRelation: "module_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_module_progress_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          created_at: string
          created_by: string | null
          department: string
          email: string
          full_name: string
          id: string
          invite_error: string | null
          invite_sent_at: string | null
          notes: string | null
          org_id: string
          role: string
          stage: string
          track_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string
          email: string
          full_name: string
          id?: string
          invite_error?: string | null
          invite_sent_at?: string | null
          notes?: string | null
          org_id: string
          role: string
          stage?: string
          track_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string
          email?: string
          full_name?: string
          id?: string
          invite_error?: string | null
          invite_sent_at?: string | null
          notes?: string | null
          org_id?: string
          role?: string
          stage?: string
          track_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "module_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_signals: {
        Row: {
          captured_at: string
          created_at: string
          hire_id: string
          id: string
          live: boolean
          metrics: Json
          org_id: string
          source: string
          updated_at: string
        }
        Insert: {
          captured_at?: string
          created_at?: string
          hire_id: string
          id?: string
          live?: boolean
          metrics?: Json
          org_id: string
          source: string
          updated_at?: string
        }
        Update: {
          captured_at?: string
          created_at?: string
          hire_id?: string
          id?: string
          live?: boolean
          metrics?: Json
          org_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_signals_hire_id_fkey"
            columns: ["hire_id"]
            isOneToOne: false
            referencedRelation: "hires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_signals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hires: {
        Row: {
          calendar_first_1on1_event_id: string | null
          calendar_orientation_event_id: string | null
          created_at: string
          department: string
          direct_reports: boolean
          drive_folder_id: string | null
          drive_folder_url: string | null
          email: string | null
          employment_type: string | null
          external_id: string | null
          full_name: string
          id: string
          location: string | null
          notion_page_id: string | null
          notion_page_url: string | null
          on_call: boolean
          org_id: string
          owning_team: string | null
          pii_access: boolean
          role: string
          seniority: string | null
          sheets_row_synced_at: string | null
          slack_channel_error: string | null
          slack_channel_id: string | null
          slack_channel_name: string | null
          start_date: string | null
          teams_notified_at: string | null
          updated_at: string
        }
        Insert: {
          calendar_first_1on1_event_id?: string | null
          calendar_orientation_event_id?: string | null
          created_at?: string
          department: string
          direct_reports?: boolean
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          email?: string | null
          employment_type?: string | null
          external_id?: string | null
          full_name: string
          id?: string
          location?: string | null
          notion_page_id?: string | null
          notion_page_url?: string | null
          on_call?: boolean
          org_id: string
          owning_team?: string | null
          pii_access?: boolean
          role: string
          seniority?: string | null
          sheets_row_synced_at?: string | null
          slack_channel_error?: string | null
          slack_channel_id?: string | null
          slack_channel_name?: string | null
          start_date?: string | null
          teams_notified_at?: string | null
          updated_at?: string
        }
        Update: {
          calendar_first_1on1_event_id?: string | null
          calendar_orientation_event_id?: string | null
          created_at?: string
          department?: string
          direct_reports?: boolean
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          email?: string | null
          employment_type?: string | null
          external_id?: string | null
          full_name?: string
          id?: string
          location?: string | null
          notion_page_id?: string | null
          notion_page_url?: string | null
          on_call?: boolean
          org_id?: string
          owning_team?: string | null
          pii_access?: boolean
          role?: string
          seniority?: string | null
          sheets_row_synced_at?: string | null
          slack_channel_error?: string | null
          slack_channel_id?: string | null
          slack_channel_name?: string | null
          start_date?: string | null
          teams_notified_at?: string | null
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
      module_items: {
        Row: {
          content: string
          created_at: string
          duration_minutes: number
          id: string
          org_id: string
          position: number
          title: string
          track_id: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          org_id: string
          position?: number
          title: string
          track_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          org_id?: string
          position?: number
          title?: string
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_items_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "module_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      module_tracks: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          role_key: string
          source: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          role_key: string
          source?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          role_key?: string
          source?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_tracks_org_id_fkey"
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
          id: string
          name: string
          slack_alert_channel: string | null
          slack_approval_channel: string | null
          slug: string
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          slack_alert_channel?: string | null
          slack_approval_channel?: string | null
          slug: string
          updated_at?: string
          webhook_secret?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slack_alert_channel?: string | null
          slack_approval_channel?: string | null
          slug?: string
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: []
      }
      performance_briefs: {
        Row: {
          coaching: Json
          created_at: string
          headline: string
          hire_id: string
          id: string
          model: string | null
          org_id: string
          risks: Json
          score: number
          strengths: Json
          updated_at: string
        }
        Insert: {
          coaching?: Json
          created_at?: string
          headline: string
          hire_id: string
          id?: string
          model?: string | null
          org_id: string
          risks?: Json
          score?: number
          strengths?: Json
          updated_at?: string
        }
        Update: {
          coaching?: Json
          created_at?: string
          headline?: string
          hire_id?: string
          id?: string
          model?: string | null
          org_id?: string
          risks?: Json
          score?: number
          strengths?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_briefs_hire_id_fkey"
            columns: ["hire_id"]
            isOneToOne: true
            referencedRelation: "hires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_briefs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_membership: { Args: never; Returns: boolean }
      is_my_assessment: { Args: { _assessment_id: string }; Returns: boolean }
      is_my_candidate: { Args: { _candidate_id: string }; Returns: boolean }
      is_my_track: { Args: { _track_id: string }; Returns: boolean }
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
