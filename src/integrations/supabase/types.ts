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
      angsuran: {
        Row: {
          bukti_url: string | null
          cicilan_ke: number
          created_at: string
          id: string
          jatuh_tempo: string
          nominal: number
          paid_at: string | null
          pinjaman_id: string
          status: Database["public"]["Enums"]["angsuran_status"]
          user_id: string
        }
        Insert: {
          bukti_url?: string | null
          cicilan_ke: number
          created_at?: string
          id?: string
          jatuh_tempo: string
          nominal: number
          paid_at?: string | null
          pinjaman_id: string
          status?: Database["public"]["Enums"]["angsuran_status"]
          user_id: string
        }
        Update: {
          bukti_url?: string | null
          cicilan_ke?: number
          created_at?: string
          id?: string
          jatuh_tempo?: string
          nominal?: number
          paid_at?: string | null
          pinjaman_id?: string
          status?: Database["public"]["Enums"]["angsuran_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "angsuran_pinjaman_id_fkey"
            columns: ["pinjaman_id"]
            isOneToOne: false
            referencedRelation: "pinjaman"
            referencedColumns: ["id"]
          },
        ]
      }
      pinjaman: {
        Row: {
          approved_at: string | null
          bukti_pencairan_url: string | null
          bunga_jenis: Database["public"]["Enums"]["bunga_jenis"]
          bunga_persen: number
          cicilan_per_bulan: number | null
          created_at: string
          disbursed_at: string | null
          dokumen_url: string | null
          id: string
          nominal: number
          status: Database["public"]["Enums"]["pinjaman_status"]
          tenor_bulan: number
          total_bayar: number | null
          tujuan: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          bukti_pencairan_url?: string | null
          bunga_jenis?: Database["public"]["Enums"]["bunga_jenis"]
          bunga_persen?: number
          cicilan_per_bulan?: number | null
          created_at?: string
          disbursed_at?: string | null
          dokumen_url?: string | null
          id?: string
          nominal: number
          status?: Database["public"]["Enums"]["pinjaman_status"]
          tenor_bulan: number
          total_bayar?: number | null
          tujuan?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          bukti_pencairan_url?: string | null
          bunga_jenis?: Database["public"]["Enums"]["bunga_jenis"]
          bunga_persen?: number
          cicilan_per_bulan?: number | null
          created_at?: string
          disbursed_at?: string | null
          dokumen_url?: string | null
          id?: string
          nominal?: number
          status?: Database["public"]["Enums"]["pinjaman_status"]
          tenor_bulan?: number
          total_bayar?: number | null
          tujuan?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          alamat: string | null
          created_at: string
          email: string | null
          foto_url: string | null
          id: string
          jenis_kelamin: string | null
          joined_at: string
          ktp_url: string | null
          nama_lengkap: string
          nik: string | null
          no_hp: string | null
          nomor_anggota: string | null
          pekerjaan: string | null
          status: Database["public"]["Enums"]["member_status"]
          tanggal_lahir: string | null
          tempat_lahir: string | null
          updated_at: string
        }
        Insert: {
          alamat?: string | null
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id: string
          jenis_kelamin?: string | null
          joined_at?: string
          ktp_url?: string | null
          nama_lengkap: string
          nik?: string | null
          no_hp?: string | null
          nomor_anggota?: string | null
          pekerjaan?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          tanggal_lahir?: string | null
          tempat_lahir?: string | null
          updated_at?: string
        }
        Update: {
          alamat?: string | null
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id?: string
          jenis_kelamin?: string | null
          joined_at?: string
          ktp_url?: string | null
          nama_lengkap?: string
          nik?: string | null
          no_hp?: string | null
          nomor_anggota?: string | null
          pekerjaan?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          tanggal_lahir?: string | null
          tempat_lahir?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shu: {
        Row: {
          catatan: string | null
          created_at: string
          dibagikan_at: string | null
          id: string
          nominal: number
          tahun: number
          user_id: string
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          dibagikan_at?: string | null
          id?: string
          nominal?: number
          tahun: number
          user_id: string
        }
        Update: {
          catatan?: string | null
          created_at?: string
          dibagikan_at?: string | null
          id?: string
          nominal?: number
          tahun?: number
          user_id?: string
        }
        Relationships: []
      }
      simpanan: {
        Row: {
          bukti_url: string | null
          catatan: string | null
          created_at: string
          id: string
          jenis: Database["public"]["Enums"]["simpanan_jenis"]
          nominal: number
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          bukti_url?: string | null
          catatan?: string | null
          created_at?: string
          id?: string
          jenis: Database["public"]["Enums"]["simpanan_jenis"]
          nominal: number
          status?: Database["public"]["Enums"]["payment_status"]
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          bukti_url?: string | null
          catatan?: string | null
          created_at?: string
          id?: string
          jenis?: Database["public"]["Enums"]["simpanan_jenis"]
          nominal?: number
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_pengurus: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      angsuran_status: "unpaid" | "pending" | "paid" | "overdue"
      app_role: "super_admin" | "ketua" | "sekretaris" | "bendahara" | "anggota"
      bunga_jenis: "flat" | "efektif" | "menurun"
      member_status: "pending" | "active" | "suspended" | "rejected"
      payment_status: "pending" | "verified" | "rejected"
      pinjaman_status:
        | "draft"
        | "pending_sekretaris"
        | "pending_bendahara"
        | "pending_ketua"
        | "approved"
        | "rejected"
        | "disbursed"
        | "completed"
        | "cancelled"
      simpanan_jenis: "pokok" | "wajib" | "sukarela"
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
      angsuran_status: ["unpaid", "pending", "paid", "overdue"],
      app_role: ["super_admin", "ketua", "sekretaris", "bendahara", "anggota"],
      bunga_jenis: ["flat", "efektif", "menurun"],
      member_status: ["pending", "active", "suspended", "rejected"],
      payment_status: ["pending", "verified", "rejected"],
      pinjaman_status: [
        "draft",
        "pending_sekretaris",
        "pending_bendahara",
        "pending_ketua",
        "approved",
        "rejected",
        "disbursed",
        "completed",
        "cancelled",
      ],
      simpanan_jenis: ["pokok", "wajib", "sukarela"],
    },
  },
} as const
