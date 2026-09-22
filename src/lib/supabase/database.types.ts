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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_capabilities: {
        Row: {
          api_version: string
          capability: string
          checked_at: string
          constraints: Json
          feature_flag: boolean
          id: string
          provider: string
          source_url: string
          status: string
        }
        Insert: {
          api_version: string
          capability: string
          checked_at: string
          constraints?: Json
          feature_flag?: boolean
          id?: string
          provider: string
          source_url: string
          status: string
        }
        Update: {
          api_version?: string
          capability?: string
          checked_at?: string
          constraints?: Json
          feature_flag?: boolean
          id?: string
          provider?: string
          source_url?: string
          status?: string
        }
        Relationships: []
      }
      api_watch_events: {
        Row: {
          action_status: string
          detected_at: string
          event_type: string
          id: string
          impact: string | null
          notes: string | null
          provider: string
          reviewed_at: string | null
          source_url: string
          title: string
        }
        Insert: {
          action_status?: string
          detected_at?: string
          event_type: string
          id?: string
          impact?: string | null
          notes?: string | null
          provider: string
          reviewed_at?: string | null
          source_url: string
          title: string
        }
        Update: {
          action_status?: string
          detected_at?: string
          event_type?: string
          id?: string
          impact?: string | null
          notes?: string | null
          provider?: string
          reviewed_at?: string | null
          source_url?: string
          title?: string
        }
        Relationships: []
      }
      approvals: {
        Row: {
          comment: string | null
          decided_at: string | null
          decided_by: string | null
          id: string
          organization_id: string
          post_id: string
          post_target_id: string | null
          requested_at: string
          requested_by: string
          status: string
        }
        Insert: {
          comment?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          organization_id: string
          post_id: string
          post_target_id?: string | null
          requested_at?: string
          requested_by: string
          status?: string
        }
        Update: {
          comment?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          organization_id?: string
          post_id?: string
          post_target_id?: string | null
          requested_at?: string
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_post_id_organization_id_fkey"
            columns: ["post_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "approvals_post_target_id_organization_id_fkey"
            columns: ["post_target_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "post_targets"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_hash: string | null
          metadata: Json
          organization_id: string
          user_agent_summary: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          organization_id: string
          user_agent_summary?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          organization_id?: string
          user_agent_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          locale: string
          name: string
          organization_id: string
          settings: Json
          slug: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          locale?: string
          name: string
          organization_id: string
          settings?: Json
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          locale?: string
          name?: string
          organization_id?: string
          settings?: Json
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_connections: {
        Row: {
          brand_id: string | null
          connection_status: string
          created_at: string
          display_name: string
          external_account_id: string
          id: string
          last_health_at: string | null
          metadata: Json
          organization_id: string
          provider: string
          scopes: string[]
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          connection_status?: string
          created_at?: string
          display_name: string
          external_account_id: string
          id?: string
          last_health_at?: string | null
          metadata?: Json
          organization_id: string
          provider: string
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          connection_status?: string
          created_at?: string
          display_name?: string
          external_account_id?: string
          id?: string
          last_health_at?: string | null
          metadata?: Json
          organization_id?: string
          provider?: string
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_connections_brand_id_organization_id_fkey"
            columns: ["brand_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "commerce_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_product_refs: {
        Row: {
          commerce_connection_id: string
          external_product_id: string
          id: string
          metadata: Json
          organization_id: string
          product_url: string | null
          status: string
          synced_at: string
          title: string
        }
        Insert: {
          commerce_connection_id: string
          external_product_id: string
          id?: string
          metadata?: Json
          organization_id: string
          product_url?: string | null
          status: string
          synced_at?: string
          title: string
        }
        Update: {
          commerce_connection_id?: string
          external_product_id?: string
          id?: string
          metadata?: Json
          organization_id?: string
          product_url?: string | null
          status?: string
          synced_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_product_refs_commerce_connection_id_organization__fkey"
            columns: ["commerce_connection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "commerce_connections"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "commerce_product_refs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          brand_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          duration_ms: number | null
          external_file_id: string | null
          filename: string
          height: number | null
          id: string
          media_source_id: string | null
          metadata: Json
          mime_type: string
          object_key: string | null
          organization_id: string
          origin: string
          processing_status: string
          retention_until: string | null
          sha256: string | null
          size_bytes: number
          storage_class: string
          updated_at: string
          width: number | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_ms?: number | null
          external_file_id?: string | null
          filename: string
          height?: number | null
          id?: string
          media_source_id?: string | null
          metadata?: Json
          mime_type: string
          object_key?: string | null
          organization_id: string
          origin?: string
          processing_status?: string
          retention_until?: string | null
          sha256?: string | null
          size_bytes: number
          storage_class?: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_ms?: number | null
          external_file_id?: string | null
          filename?: string
          height?: number | null
          id?: string
          media_source_id?: string | null
          metadata?: Json
          mime_type?: string
          object_key?: string | null
          organization_id?: string
          origin?: string
          processing_status?: string
          retention_until?: string | null
          sha256?: string | null
          size_bytes?: number
          storage_class?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_brand_id_organization_id_fkey"
            columns: ["brand_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "media_assets_media_source_id_organization_id_fkey"
            columns: ["media_source_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "media_sources"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "media_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_sources: {
        Row: {
          brand_id: string | null
          connection_status: string
          created_at: string
          display_name: string
          id: string
          kind: string
          metadata: Json
          organization_id: string
          provider_account_ref: string | null
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          connection_status?: string
          created_at?: string
          display_name: string
          id?: string
          kind: string
          metadata?: Json
          organization_id: string
          provider_account_ref?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          connection_status?: string
          created_at?: string
          display_name?: string
          id?: string
          kind?: string
          metadata?: Json
          organization_id?: string
          provider_account_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_sources_brand_id_organization_id_fkey"
            columns: ["brand_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "media_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          default_timezone: string
          deleted_at: string | null
          id: string
          name: string
          plan_code: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_timezone?: string
          deleted_at?: string | null
          id?: string
          name: string
          plan_code?: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_timezone?: string
          deleted_at?: string | null
          id?: string
          name?: string
          plan_code?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_entitlements: {
        Row: {
          entitlement_key: string
          organization_id: string
          source: string
          updated_at: string
          valid_from: string
          valid_until: string | null
          value_json: Json
        }
        Insert: {
          entitlement_key: string
          organization_id: string
          source?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          value_json: Json
        }
        Update: {
          entitlement_key?: string
          organization_id?: string
          source?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          value_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      post_target_media: {
        Row: {
          created_at: string
          media_asset_id: string
          organization_id: string
          position: number
          post_target_id: string
          role: string
        }
        Insert: {
          created_at?: string
          media_asset_id: string
          organization_id: string
          position: number
          post_target_id: string
          role?: string
        }
        Update: {
          created_at?: string
          media_asset_id?: string
          organization_id?: string
          position?: number
          post_target_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_target_media_media_asset_id_organization_id_fkey"
            columns: ["media_asset_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "post_target_media_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_target_media_post_target_id_organization_id_fkey"
            columns: ["post_target_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "post_targets"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      post_targets: {
        Row: {
          caption_override: string | null
          content_intent_override: string | null
          created_at: string
          id: string
          idempotency_key: string
          organization_id: string
          post_id: string
          prepare_at: string | null
          provider: string
          provider_config: Json
          publish_mode: string
          published_at: string | null
          schedule_version: number
          scheduled_at: string
          scheduled_timezone: string
          social_connection_id: string
          state: string
          title_override: string | null
          updated_at: string
        }
        Insert: {
          caption_override?: string | null
          content_intent_override?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          organization_id: string
          post_id: string
          prepare_at?: string | null
          provider: string
          provider_config?: Json
          publish_mode?: string
          published_at?: string | null
          schedule_version?: number
          scheduled_at: string
          scheduled_timezone: string
          social_connection_id: string
          state?: string
          title_override?: string | null
          updated_at?: string
        }
        Update: {
          caption_override?: string | null
          content_intent_override?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          organization_id?: string
          post_id?: string
          prepare_at?: string | null
          provider?: string
          provider_config?: Json
          publish_mode?: string
          published_at?: string | null
          schedule_version?: number
          scheduled_at?: string
          scheduled_timezone?: string
          social_connection_id?: string
          state?: string
          title_override?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_targets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_targets_post_id_organization_id_fkey"
            columns: ["post_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "post_targets_social_connection_id_organization_id_fkey"
            columns: ["social_connection_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "social_connections"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      posts: {
        Row: {
          base_caption: string | null
          brand_id: string
          content_intent: string
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          internal_title: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          base_caption?: string | null
          brand_id: string
          content_intent?: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          internal_title: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          base_caption?: string | null
          brand_id?: string
          content_intent?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          internal_title?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_brand_id_organization_id_fkey"
            columns: ["brand_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_assets: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          metadata: Json
          organization_id: string
          post_target_id: string
          provider: string
          provider_asset_id: string
          state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          kind: string
          metadata?: Json
          organization_id: string
          post_target_id: string
          provider: string
          provider_asset_id: string
          state: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          metadata?: Json
          organization_id?: string
          post_target_id?: string
          provider?: string
          provider_asset_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_assets_post_target_id_organization_id_fkey"
            columns: ["post_target_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "post_targets"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      provider_webhook_events: {
        Row: {
          id: string
          payload_hash: string
          processed_at: string | null
          processing_status: string
          provider: string
          provider_event_id: string
          received_at: string
          signature_valid: boolean
        }
        Insert: {
          id?: string
          payload_hash: string
          processed_at?: string | null
          processing_status?: string
          provider: string
          provider_event_id: string
          received_at?: string
          signature_valid?: boolean
        }
        Update: {
          id?: string
          payload_hash?: string
          processed_at?: string | null
          processing_status?: string
          provider?: string
          provider_event_id?: string
          received_at?: string
          signature_valid?: boolean
        }
        Relationships: []
      }
      publication_attempts: {
        Row: {
          attempt_no: number
          error_code: string | null
          error_message_safe: string | null
          finished_at: string | null
          http_status: number | null
          id: string
          job_id: string | null
          operation: string
          operation_key: string
          organization_id: string
          outcome: string
          post_target_id: string
          provider_request_id: string | null
          response_fingerprint: string | null
          started_at: string
        }
        Insert: {
          attempt_no: number
          error_code?: string | null
          error_message_safe?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          job_id?: string | null
          operation: string
          operation_key: string
          organization_id: string
          outcome: string
          post_target_id: string
          provider_request_id?: string | null
          response_fingerprint?: string | null
          started_at?: string
        }
        Update: {
          attempt_no?: number
          error_code?: string | null
          error_message_safe?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          job_id?: string | null
          operation?: string
          operation_key?: string
          organization_id?: string
          outcome?: string
          post_target_id?: string
          provider_request_id?: string | null
          response_fingerprint?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_attempts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scheduled_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_attempts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_attempts_post_target_id_organization_id_fkey"
            columns: ["post_target_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "post_targets"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      scheduled_jobs: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string
          id: string
          job_type: string
          last_error_code: string | null
          locked_until: string | null
          max_attempts: number
          organization_id: string
          payload: Json
          post_target_id: string | null
          run_at: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key: string
          id?: string
          job_type: string
          last_error_code?: string | null
          locked_until?: string | null
          max_attempts?: number
          organization_id: string
          payload?: Json
          post_target_id?: string | null
          run_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string
          id?: string
          job_type?: string
          last_error_code?: string | null
          locked_until?: string | null
          max_attempts?: number
          organization_id?: string
          payload?: Json
          post_target_id?: string | null
          run_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_jobs_post_target_id_organization_id_fkey"
            columns: ["post_target_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "post_targets"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      social_connections: {
        Row: {
          brand_id: string | null
          connection_status: string
          created_at: string
          display_name: string
          id: string
          last_health_at: string | null
          metadata: Json
          organization_id: string
          provider: string
          provider_account_id: string
          scopes: string[]
          token_expires_at: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          brand_id?: string | null
          connection_status?: string
          created_at?: string
          display_name: string
          id?: string
          last_health_at?: string | null
          metadata?: Json
          organization_id: string
          provider: string
          provider_account_id: string
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          brand_id?: string | null
          connection_status?: string
          created_at?: string
          display_name?: string
          id?: string
          last_health_at?: string | null
          metadata?: Json
          organization_id?: string
          provider?: string
          provider_account_id?: string
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_connections_brand_id_organization_id_fkey"
            columns: ["brand_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "social_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          metadata: Json
          organization_id: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          id: string
          organization_id: string
          period_end: string
          period_start: string
          quantity: number
          updated_at: string
          usage_key: string
        }
        Insert: {
          id?: string
          organization_id: string
          period_end: string
          period_start: string
          quantity?: number
          updated_at?: string
          usage_key: string
        }
        Update: {
          id?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          quantity?: number
          updated_at?: string
          usage_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_organization_id_fkey"
            columns: ["organization_id"]
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
      attach_media_to_post: {
        Args: { p_media_asset_id: string; p_post_id: string }
        Returns: number
      }
      bootstrap_account: {
        Args: { p_brand_name?: string }
        Returns: {
          brand_id: string
          organization_id: string
        }[]
      }
      cancel_post: { Args: { p_post_id: string }; Returns: number }
      disconnect_social_connection: {
        Args: { p_connection_id: string }
        Returns: boolean
      }
      retry_failed_targets: { Args: { p_post_id: string }; Returns: number }
      save_post_draft: {
        Args: {
          p_base_caption: string
          p_brand_id: string
          p_internal_title: string
          p_targets?: Json
        }
        Returns: string
      }
      server_upsert_oauth_connection: {
        Args: {
          p_access_token_ciphertext: string
          p_brand_id: string
          p_display_name: string
          p_key_version?: string
          p_metadata: Json
          p_organization_id: string
          p_provider: string
          p_provider_account_id: string
          p_refresh_token_ciphertext?: string
          p_scopes: string[]
          p_token_expires_at: string
          p_username: string
        }
        Returns: string
      }
      soft_delete_post: { Args: { p_post_id: string }; Returns: boolean }
      update_post_plan: {
        Args: {
          p_base_caption: string
          p_internal_title: string
          p_post_id: string
          p_targets?: Json
        }
        Returns: string
      }
      worker_claim_publication_jobs: {
        Args: { p_limit?: number; p_lock_seconds?: number }
        Returns: {
          attempt_no: number
          content_intent: string
          job_id: string
          organization_id: string
          payload: Json
          post_target_id: string
          provider: string
          scheduled_at: string
        }[]
      }
      worker_finish_publication_job: {
        Args: {
          p_error_code?: string
          p_error_message_safe?: string
          p_http_status?: number
          p_job_id: string
          p_outcome: string
          p_provider_request_id?: string
          p_retry_after_seconds?: number
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
