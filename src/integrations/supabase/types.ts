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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agreement_acknowledgments: {
        Row: {
          acknowledged_at: string
          agreement_id: string
          id: string
          participant_id: string
        }
        Insert: {
          acknowledged_at?: string
          agreement_id: string
          id?: string
          participant_id: string
        }
        Update: {
          acknowledged_at?: string
          agreement_id?: string
          id?: string
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_acknowledgments_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "program_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_acknowledgments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      assessment_domain_levels: {
        Row: {
          description: string | null
          domain_id: string
          id: string
          label: string
          score: number
        }
        Insert: {
          description?: string | null
          domain_id: string
          id?: string
          label: string
          score: number
        }
        Update: {
          description?: string | null
          domain_id?: string
          id?: string
          label?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_domain_levels_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "assessment_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_domains: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      assessment_scores: {
        Row: {
          domain_id: string
          id: string
          note: string | null
          score: number
          session_id: string
        }
        Insert: {
          domain_id: string
          id?: string
          note?: string | null
          score: number
          session_id: string
        }
        Update: {
          domain_id?: string
          id?: string
          note?: string | null
          score?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_scores_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "assessment_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_sessions: {
        Row: {
          completed_at: string
          confirmed_by: string | null
          created_at: string
          id: string
          initiated_by: string
          overall_score: number | null
          participant_id: string
        }
        Insert: {
          completed_at?: string
          confirmed_by?: string | null
          created_at?: string
          id?: string
          initiated_by: string
          overall_score?: number | null
          participant_id: string
        }
        Update: {
          completed_at?: string
          confirmed_by?: string | null
          created_at?: string
          id?: string
          initiated_by?: string
          overall_score?: number | null
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sessions_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sessions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      community_partners: {
        Row: {
          address: string | null
          availability_status: string | null
          city: string | null
          created_at: string
          description: string | null
          id: string
          is_approved: boolean
          last_updated_at: string
          logo_url: string | null
          name: string
          phone: string | null
          services_offered: string[] | null
          state: string | null
          submitted_by: string | null
          type: string | null
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          availability_status?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_approved?: boolean
          last_updated_at?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          services_offered?: string[] | null
          state?: string | null
          submitted_by?: string | null
          type?: string | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          availability_status?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_approved?: boolean
          last_updated_at?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          services_offered?: string[] | null
          state?: string | null
          submitted_by?: string | null
          type?: string | null
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_partners_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          consented_at: string
          created_at: string
          expires_at: string | null
          id: string
          is_revoked: boolean
          participant_id: string
          purpose: string
          recipient_description: string
          revoked_at: string | null
          sections_disclosed: Json
          shared_link_id: string | null
        }
        Insert: {
          consented_at?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_revoked?: boolean
          participant_id: string
          purpose: string
          recipient_description: string
          revoked_at?: string | null
          sections_disclosed: Json
          shared_link_id?: string | null
        }
        Update: {
          consented_at?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_revoked?: boolean
          participant_id?: string
          purpose?: string
          recipient_description?: string
          revoked_at?: string | null
          sections_disclosed?: Json
          shared_link_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_shared_link_id_fkey"
            columns: ["shared_link_id"]
            isOneToOne: false
            referencedRelation: "shared_links"
            referencedColumns: ["id"]
          },
        ]
      }
      crisis_protocol: {
        Row: {
          content: string
          id: string
          is_current: boolean
          updated_at: string
          version: number
        }
        Insert: {
          content: string
          id?: string
          is_current?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          content?: string
          id?: string
          is_current?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      crps_competency_milestones: {
        Row: {
          created_at: string
          id: string
          peer_specialist_id: string
          status: Database["public"]["Enums"]["crps_competency_status"]
          tool_or_skill: string
          type: Database["public"]["Enums"]["crps_competency_type"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          peer_specialist_id: string
          status?: Database["public"]["Enums"]["crps_competency_status"]
          tool_or_skill: string
          type: Database["public"]["Enums"]["crps_competency_type"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          peer_specialist_id?: string
          status?: Database["public"]["Enums"]["crps_competency_status"]
          tool_or_skill?: string
          type?: Database["public"]["Enums"]["crps_competency_type"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crps_competency_milestones_peer_specialist_id_fkey"
            columns: ["peer_specialist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crps_competency_milestones_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      crps_hours_log: {
        Row: {
          category: Database["public"]["Enums"]["crps_hour_category"]
          hours: number
          id: string
          logged_at: string
          peer_specialist_id: string
          source_id: string | null
          source_type: Database["public"]["Enums"]["crps_source_type"]
          verified_by: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["crps_hour_category"]
          hours: number
          id?: string
          logged_at?: string
          peer_specialist_id: string
          source_id?: string | null
          source_type: Database["public"]["Enums"]["crps_source_type"]
          verified_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["crps_hour_category"]
          hours?: number
          id?: string
          logged_at?: string
          peer_specialist_id?: string
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["crps_source_type"]
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crps_hours_log_peer_specialist_id_fkey"
            columns: ["peer_specialist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crps_hours_log_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mi_prompts: {
        Row: {
          created_at: string
          explanation: string | null
          helpful_count: number
          id: string
          is_active: boolean
          not_relevant_count: number
          situation_tag: Database["public"]["Enums"]["mi_situation_tag"]
          text: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          helpful_count?: number
          id?: string
          is_active?: boolean
          not_relevant_count?: number
          situation_tag: Database["public"]["Enums"]["mi_situation_tag"]
          text: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          explanation?: string | null
          helpful_count?: number
          id?: string
          is_active?: boolean
          not_relevant_count?: number
          situation_tag?: Database["public"]["Enums"]["mi_situation_tag"]
          text?: string
          usage_count?: number
        }
        Relationships: []
      }
      milestone_definitions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          level_threshold: number | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level_threshold?: number | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level_threshold?: number | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      note_templates: {
        Row: {
          guiding_prompts: string
          id: string
          note_type: Database["public"]["Enums"]["note_type"]
          updated_at: string
        }
        Insert: {
          guiding_prompts: string
          id?: string
          note_type: Database["public"]["Enums"]["note_type"]
          updated_at?: string
        }
        Update: {
          guiding_prompts?: string
          id?: string
          note_type?: Database["public"]["Enums"]["note_type"]
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          read_at: string | null
          related_id: string | null
          related_type: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_milestones: {
        Row: {
          id: string
          milestone_id: string
          note: string | null
          participant_id: string
          unlocked_at: string
          unlocked_by: string
        }
        Insert: {
          id?: string
          milestone_id: string
          note?: string | null
          participant_id: string
          unlocked_at?: string
          unlocked_by: string
        }
        Update: {
          id?: string
          milestone_id?: string
          note?: string | null
          participant_id?: string
          unlocked_at?: string
          unlocked_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_milestones_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestone_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_milestones_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_milestones_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_profiles: {
        Row: {
          assigned_peer_id: string | null
          card_level: Database["public"]["Enums"]["card_level"]
          created_at: string
          current_program_id: string | null
          date_of_birth: string | null
          deleted_at: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          id: string
          last_name: string
          pathway: Database["public"]["Enums"]["recovery_pathway"] | null
          photo_url: string | null
          recovery_start_date: string | null
          substances: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_peer_id?: string | null
          card_level?: Database["public"]["Enums"]["card_level"]
          created_at?: string
          current_program_id?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          id?: string
          last_name: string
          pathway?: Database["public"]["Enums"]["recovery_pathway"] | null
          photo_url?: string | null
          recovery_start_date?: string | null
          substances?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_peer_id?: string | null
          card_level?: Database["public"]["Enums"]["card_level"]
          created_at?: string
          current_program_id?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          id?: string
          last_name?: string
          pathway?: Database["public"]["Enums"]["recovery_pathway"] | null
          photo_url?: string | null
          recovery_start_date?: string | null
          substances?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_participant_assigned_peer"
            columns: ["assigned_peer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_participant_program"
            columns: ["current_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          participant_id: string
          recorded_by: string
          type: Database["public"]["Enums"]["payment_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          participant_id: string
          recorded_by: string
          type: Database["public"]["Enums"]["payment_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          participant_id?: string
          recorded_by?: string
          type?: Database["public"]["Enums"]["payment_type"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_requests: {
        Row: {
          id: string
          participant_id: string
          peer_specialist_id: string
          requested_at: string
          responded_at: string | null
          status: Database["public"]["Enums"]["peer_request_status"]
        }
        Insert: {
          id?: string
          participant_id: string
          peer_specialist_id: string
          requested_at?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["peer_request_status"]
        }
        Update: {
          id?: string
          participant_id?: string
          peer_specialist_id?: string
          requested_at?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["peer_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "peer_requests_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peer_requests_peer_specialist_id_fkey"
            columns: ["peer_specialist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_specialist_profiles: {
        Row: {
          approval_status: Database["public"]["Enums"]["peer_approval_status"]
          approved_at: string | null
          approved_by: string | null
          bio: string | null
          created_at: string
          crps_status: Database["public"]["Enums"]["crps_certification_status"]
          first_name: string
          id: string
          is_available: boolean
          last_name: string
          pending_edits: Json | null
          photo_url: string | null
          rejection_reason: string | null
          specialties: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["peer_approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          bio?: string | null
          created_at?: string
          crps_status?: Database["public"]["Enums"]["crps_certification_status"]
          first_name: string
          id?: string
          is_available?: boolean
          last_name: string
          pending_edits?: Json | null
          photo_url?: string | null
          rejection_reason?: string | null
          specialties?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["peer_approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          bio?: string | null
          created_at?: string
          crps_status?: Database["public"]["Enums"]["crps_certification_status"]
          first_name?: string
          id?: string
          is_available?: boolean
          last_name?: string
          pending_edits?: Json | null
          photo_url?: string | null
          rejection_reason?: string | null
          specialties?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_specialist_profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peer_specialist_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_action_steps: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string
          id: string
          is_completed: boolean
          phase_id: string
          sort_order: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description: string
          id?: string
          is_completed?: boolean
          phase_id: string
          sort_order?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          is_completed?: boolean
          phase_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_action_steps_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "plan_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_phases: {
        Row: {
          created_at: string
          focus_description: string | null
          id: string
          is_active: boolean
          phase: Database["public"]["Enums"]["plan_phase"]
          plan_id: string
          title: string
        }
        Insert: {
          created_at?: string
          focus_description?: string | null
          id?: string
          is_active?: boolean
          phase: Database["public"]["Enums"]["plan_phase"]
          plan_id: string
          title: string
        }
        Update: {
          created_at?: string
          focus_description?: string | null
          id?: string
          is_active?: boolean
          phase?: Database["public"]["Enums"]["plan_phase"]
          plan_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_phases_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "recovery_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_template_steps: {
        Row: {
          description: string
          domain_tag: string | null
          id: string
          is_default: boolean
          sort_order: number
          template_id: string
        }
        Insert: {
          description: string
          domain_tag?: string | null
          id?: string
          is_default?: boolean
          sort_order?: number
          template_id: string
        }
        Update: {
          description?: string
          domain_tag?: string | null
          id?: string
          is_default?: boolean
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_template_steps_domain_tag_fkey"
            columns: ["domain_tag"]
            isOneToOne: false
            referencedRelation: "assessment_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_template_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "plan_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_templates: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          phase: Database["public"]["Enums"]["plan_phase"]
          program_type: Database["public"]["Enums"]["template_program_type"]
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          phase: Database["public"]["Enums"]["plan_phase"]
          program_type: Database["public"]["Enums"]["template_program_type"]
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          phase?: Database["public"]["Enums"]["plan_phase"]
          program_type?: Database["public"]["Enums"]["template_program_type"]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      program_agreements: {
        Row: {
          content: string
          created_at: string
          id: string
          program_id: string
          version: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          program_id: string
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          program_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_agreements_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          state: string | null
          type: Database["public"]["Enums"]["program_type"]
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          state?: string | null
          type: Database["public"]["Enums"]["program_type"]
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          state?: string | null
          type?: Database["public"]["Enums"]["program_type"]
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
      progress_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          note_type: Database["public"]["Enums"]["note_type"]
          participant_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          note_type?: Database["public"]["Enums"]["note_type"]
          participant_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          note_type?: Database["public"]["Enums"]["note_type"]
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_notes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_plans: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          participant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          participant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          participant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recovery_plans_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          participant_id: string
          partner_id: string
          passport_link_id: string | null
          referred_by: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          participant_id: string
          partner_id: string
          passport_link_id?: string | null
          referred_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          participant_id?: string
          partner_id?: string
          passport_link_id?: string | null
          referred_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "community_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_passport_link_id_fkey"
            columns: ["passport_link_id"]
            isOneToOne: false
            referencedRelation: "shared_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      self_care_checks: {
        Row: {
          created_at: string
          energy: number
          id: string
          is_flagged: boolean
          mood: number
          notes: string | null
          peer_specialist_id: string
          stress: number
        }
        Insert: {
          created_at?: string
          energy: number
          id?: string
          is_flagged?: boolean
          mood: number
          notes?: string | null
          peer_specialist_id: string
          stress: number
        }
        Update: {
          created_at?: string
          energy?: number
          id?: string
          is_flagged?: boolean
          mood?: number
          notes?: string | null
          peer_specialist_id?: string
          stress?: number
        }
        Relationships: [
          {
            foreignKeyName: "self_care_checks_peer_specialist_id_fkey"
            columns: ["peer_specialist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_links: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_revoked: boolean
          participant_id: string
          token: string
          visible_sections: Json
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_revoked?: boolean
          participant_id: string
          token: string
          visible_sections?: Json
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_revoked?: boolean
          participant_id?: string
          token?: string
          visible_sections?: Json
        }
        Relationships: [
          {
            foreignKeyName: "shared_links_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_feedback: {
        Row: {
          created_at: string
          feedback: string
          id: string
          supervisor_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["feedback_target_type"]
        }
        Insert: {
          created_at?: string
          feedback: string
          id?: string
          supervisor_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["feedback_target_type"]
        }
        Update: {
          created_at?: string
          feedback?: string
          id?: string
          supervisor_id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["feedback_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_feedback_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      weekly_checkins: {
        Row: {
          barriers: string | null
          checkin_date: string
          created_at: string
          id: string
          mi_techniques_used: string[] | null
          mood_status: number
          next_steps: string | null
          participant_id: string
          peer_specialist_id: string
          plan_progress_notes: string | null
          summary: string | null
        }
        Insert: {
          barriers?: string | null
          checkin_date?: string
          created_at?: string
          id?: string
          mi_techniques_used?: string[] | null
          mood_status: number
          next_steps?: string | null
          participant_id: string
          peer_specialist_id: string
          plan_progress_notes?: string | null
          summary?: string | null
        }
        Update: {
          barriers?: string | null
          checkin_date?: string
          created_at?: string
          id?: string
          mi_techniques_used?: string[] | null
          mood_status?: number
          next_steps?: string | null
          participant_id?: string
          peer_specialist_id?: string
          plan_progress_notes?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_checkins_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_checkins_peer_specialist_id_fkey"
            columns: ["peer_specialist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_recovery_plan: {
        Args: { p_participant_id: string }
        Returns: string
      }
      get_participant_profile_id: { Args: never; Returns: string }
      get_shared_link_by_token: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          expires_at: string
          id: string
          is_revoked: boolean
          participant_id: string
          token: string
          visible_sections: Json
        }[]
      }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_assigned_peer: { Args: { p_participant_id: string }; Returns: boolean }
      log_checkin_crps_hours: {
        Args: { p_checkin_id: string; p_peer_id: string }
        Returns: undefined
      }
      log_passport_view: { Args: { p_token: string }; Returns: undefined }
      recalculate_card_level: {
        Args: { p_participant_id: string }
        Returns: Database["public"]["Enums"]["card_level"]
      }
    }
    Enums: {
      card_level: "rookie" | "starter" | "veteran" | "all_star"
      crps_certification_status: "in_training" | "eligible" | "certified"
      crps_competency_status:
        | "not_started"
        | "in_progress"
        | "demonstrated"
        | "verified"
      crps_competency_type: "tool" | "skill"
      crps_hour_category:
        | "training"
        | "work_experience"
        | "direct_peer_services"
        | "supervised_advocacy"
        | "supervised_mentoring"
        | "supervised_recovery_support"
        | "supervised_professional_responsibility"
      crps_source_type:
        | "checkin"
        | "assessment"
        | "referral"
        | "crisis"
        | "milestone"
        | "manual"
      feedback_target_type: "checkin" | "progress_note" | "milestone"
      mi_situation_tag:
        | "first_checkin"
        | "ambivalence"
        | "barriers"
        | "crisis"
        | "motivation"
        | "planning"
        | "general"
      note_type: "general" | "crisis" | "referral" | "milestone" | "transition"
      notification_type:
        | "milestone_unlocked"
        | "level_up"
        | "peer_request_received"
        | "peer_request_approved"
        | "peer_request_declined"
        | "peer_application_submitted"
        | "peer_application_approved"
        | "peer_application_rejected"
        | "peer_edits_pending_review"
        | "peer_edits_approved"
        | "checkin_reminder"
        | "checkin_overdue"
        | "assessment_ready_for_review"
        | "plan_updated"
        | "agreement_updated"
        | "referral_received"
        | "supervisor_feedback"
        | "crps_eligible"
        | "new_participant"
        | "general"
      payment_type: "payment" | "charge" | "adjustment"
      peer_approval_status: "pending" | "approved" | "rejected" | "suspended"
      peer_request_status: "pending" | "approved" | "declined"
      plan_phase: "thirty_day" | "sixty_day" | "ninety_day" | "six_month"
      program_type:
        | "respite_house"
        | "sober_living"
        | "treatment"
        | "outpatient"
      recovery_pathway:
        | "twelve_step"
        | "mat"
        | "faith_based"
        | "holistic"
        | "other"
      template_program_type:
        | "respite_house"
        | "sober_living"
        | "treatment"
        | "outpatient"
        | "universal"
      user_role: "participant" | "peer_specialist" | "admin"
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
      card_level: ["rookie", "starter", "veteran", "all_star"],
      crps_certification_status: ["in_training", "eligible", "certified"],
      crps_competency_status: [
        "not_started",
        "in_progress",
        "demonstrated",
        "verified",
      ],
      crps_competency_type: ["tool", "skill"],
      crps_hour_category: [
        "training",
        "work_experience",
        "direct_peer_services",
        "supervised_advocacy",
        "supervised_mentoring",
        "supervised_recovery_support",
        "supervised_professional_responsibility",
      ],
      crps_source_type: [
        "checkin",
        "assessment",
        "referral",
        "crisis",
        "milestone",
        "manual",
      ],
      feedback_target_type: ["checkin", "progress_note", "milestone"],
      mi_situation_tag: [
        "first_checkin",
        "ambivalence",
        "barriers",
        "crisis",
        "motivation",
        "planning",
        "general",
      ],
      note_type: ["general", "crisis", "referral", "milestone", "transition"],
      notification_type: [
        "milestone_unlocked",
        "level_up",
        "peer_request_received",
        "peer_request_approved",
        "peer_request_declined",
        "peer_application_submitted",
        "peer_application_approved",
        "peer_application_rejected",
        "peer_edits_pending_review",
        "peer_edits_approved",
        "checkin_reminder",
        "checkin_overdue",
        "assessment_ready_for_review",
        "plan_updated",
        "agreement_updated",
        "referral_received",
        "supervisor_feedback",
        "crps_eligible",
        "new_participant",
        "general",
      ],
      payment_type: ["payment", "charge", "adjustment"],
      peer_approval_status: ["pending", "approved", "rejected", "suspended"],
      peer_request_status: ["pending", "approved", "declined"],
      plan_phase: ["thirty_day", "sixty_day", "ninety_day", "six_month"],
      program_type: [
        "respite_house",
        "sober_living",
        "treatment",
        "outpatient",
      ],
      recovery_pathway: [
        "twelve_step",
        "mat",
        "faith_based",
        "holistic",
        "other",
      ],
      template_program_type: [
        "respite_house",
        "sober_living",
        "treatment",
        "outpatient",
        "universal",
      ],
      user_role: ["participant", "peer_specialist", "admin"],
    },
  },
} as const
