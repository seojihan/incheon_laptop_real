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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      internal_help_articles: {
        Row: {
          allowed_roles: string[]
          body: string
          created_at: string
          id: string
          published: boolean
          slug: string
          sort_order: number
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          allowed_roles: string[]
          body: string
          created_at?: string
          id?: string
          published?: boolean
          slug: string
          sort_order?: number
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          allowed_roles?: string[]
          body?: string
          created_at?: string
          id?: string
          published?: boolean
          slug?: string
          sort_order?: number
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      laptop_requests: {
        Row: {
          class_num: string
          created_at: string
          end_date: string | null
          id: string
          notebook_number: number | null
          reason: string | null
          rental_month: number | null
          rental_week: number | null
          rental_year: number | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slots: Json | null
          start_date: string
          status: string
          student_id: string
          type: string
          updated_at: string
          user_id: string
          user_name: string
          week_label: string | null
        }
        Insert: {
          class_num: string
          created_at?: string
          end_date?: string | null
          id?: string
          notebook_number?: number | null
          reason?: string | null
          rental_month?: number | null
          rental_week?: number | null
          rental_year?: number | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slots?: Json | null
          start_date: string
          status?: string
          student_id: string
          type: string
          updated_at?: string
          user_id: string
          user_name: string
          week_label?: string | null
        }
        Update: {
          class_num?: string
          created_at?: string
          end_date?: string | null
          id?: string
          notebook_number?: number | null
          reason?: string | null
          rental_month?: number | null
          rental_week?: number | null
          rental_year?: number | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slots?: Json | null
          start_date?: string
          status?: string
          student_id?: string
          type?: string
          updated_at?: string
          user_id?: string
          user_name?: string
          week_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laptop_requests_notebook_number_fkey"
            columns: ["notebook_number"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["number"]
          },
          {
            foreignKeyName: "laptop_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "laptop_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notebooks: {
        Row: {
          asset_tag: string
          condition: string
          created_at: string
          note: string | null
          number: number
          updated_at: string
        }
        Insert: {
          asset_tag: string
          condition?: string
          created_at?: string
          note?: string | null
          number: number
          updated_at?: string
        }
        Update: {
          asset_tag?: string
          condition?: string
          created_at?: string
          note?: string | null
          number?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read_at: string | null
          request_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          request_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          request_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "laptop_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          class_num: string | null
          created_at: string
          grade: string | null
          metadata: Json
          role: string
          student_id: string | null
          student_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          class_num?: string | null
          created_at?: string
          grade?: string | null
          metadata?: Json
          role?: string
          student_id?: string | null
          student_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          class_num?: string | null
          created_at?: string
          grade?: string | null
          metadata?: Json
          role?: string
          student_id?: string | null
          student_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_laptop_request: {
        Args: { p_request_id: string }
        Returns: {
          class_num: string
          created_at: string
          end_date: string | null
          id: string
          notebook_number: number | null
          reason: string | null
          rental_month: number | null
          rental_week: number | null
          rental_year: number | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slots: Json | null
          start_date: string
          status: string
          student_id: string
          type: string
          updated_at: string
          user_id: string
          user_name: string
          week_label: string | null
        }
        SetofOptions: {
          from: "*"
          to: "laptop_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      return_laptop_request: {
        Args: { p_request_id: string }
        Returns: {
          class_num: string
          created_at: string
          end_date: string | null
          id: string
          notebook_number: number | null
          reason: string | null
          rental_month: number | null
          rental_week: number | null
          rental_year: number | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slots: Json | null
          start_date: string
          status: string
          student_id: string
          type: string
          updated_at: string
          user_id: string
          user_name: string
          week_label: string | null
        }
        SetofOptions: {
          from: "*"
          to: "laptop_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_laptop_request: {
        Args: {
          p_decision: string
          p_request_id: string
          p_review_note?: string
        }
        Returns: {
          class_num: string
          created_at: string
          end_date: string | null
          id: string
          notebook_number: number | null
          reason: string | null
          rental_month: number | null
          rental_week: number | null
          rental_year: number | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slots: Json | null
          start_date: string
          status: string
          student_id: string
          type: string
          updated_at: string
          user_id: string
          user_name: string
          week_label: string | null
        }
        SetofOptions: {
          from: "*"
          to: "laptop_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_profile_role: {
        Args: { p_class_num?: string; p_role: string; p_user_id: string }
        Returns: {
          class_num: string | null
          created_at: string
          grade: string | null
          metadata: Json
          role: string
          student_id: string | null
          student_name: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
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
    Enums: {},
  },
} as const
