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
          created_by: string | null
          deleted_at: string | null
          id: string
          jatuh_tempo: string
          nominal: number
          paid_at: string | null
          pinjaman_id: string
          status: Database["public"]["Enums"]["angsuran_status"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          bukti_url?: string | null
          cicilan_ke: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          jatuh_tempo: string
          nominal: number
          paid_at?: string | null
          pinjaman_id: string
          status?: Database["public"]["Enums"]["angsuran_status"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          bukti_url?: string | null
          cicilan_ke?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          jatuh_tempo?: string
          nominal?: number
          paid_at?: string | null
          pinjaman_id?: string
          status?: Database["public"]["Enums"]["angsuran_status"]
          updated_at?: string
          updated_by?: string | null
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
      approval_histories: {
        Row: {
          action: Database["public"]["Enums"]["approval_status"]
          actor_id: string
          actor_role: Database["public"]["Enums"]["app_role"] | null
          approval_id: string
          catatan: string | null
          created_at: string
          id: string
          signature_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["approval_status"]
          actor_id: string
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          approval_id: string
          catatan?: string | null
          created_at?: string
          id?: string
          signature_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["approval_status"]
          actor_id?: string
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          approval_id?: string
          catatan?: string | null
          created_at?: string
          id?: string
          signature_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_histories_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          acted_at: string | null
          approver_id: string | null
          catatan: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          required_role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["approval_status"]
          step_order: number
          target_id: string
          target_type: Database["public"]["Enums"]["approval_target"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          acted_at?: string | null
          approver_id?: string | null
          catatan?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          required_role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["approval_status"]
          step_order?: number
          target_id: string
          target_type: Database["public"]["Enums"]["approval_target"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          acted_at?: string | null
          approver_id?: string | null
          catatan?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          required_role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["approval_status"]
          step_order?: number
          target_id?: string
          target_type?: Database["public"]["Enums"]["approval_target"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["app_role"] | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          file_url: string
          id: string
          is_public: boolean
          kategori: string | null
          mime: string | null
          nama: string
          ref_id: string | null
          ref_table: string | null
          ukuran: number | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          file_url: string
          id?: string
          is_public?: boolean
          kategori?: string | null
          mime?: string | null
          nama: string
          ref_id?: string | null
          ref_table?: string | null
          ukuran?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          file_url?: string
          id?: string
          is_public?: boolean
          kategori?: string | null
          mime?: string | null
          nama?: string
          ref_id?: string | null
          ref_table?: string | null
          ukuran?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      meeting_attendances: {
        Row: {
          catatan: string | null
          created_at: string
          id: string
          meeting_id: string
          signature_id: string | null
          signed_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          id?: string
          meeting_id: string
          signature_id?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          catatan?: string | null
          created_at?: string
          id?: string
          meeting_id?: string
          signature_id?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendances_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attachment_url: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          isi: string
          keputusan: string | null
          meeting_id: string
          notulis_id: string | null
          signature_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          isi: string
          keputusan?: string | null
          meeting_id: string
          notulis_id?: string | null
          signature_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          isi?: string
          keputusan?: string | null
          meeting_id?: string
          notulis_id?: string | null
          signature_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          agenda: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          judul: string
          link_online: string | null
          lokasi: string | null
          mulai: string
          selesai: string | null
          status: Database["public"]["Enums"]["meeting_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agenda?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          judul: string
          link_online?: string | null
          lokasi?: string | null
          mulai: string
          selesai?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agenda?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          judul?: string
          link_online?: string | null
          lokasi?: string | null
          mulai?: string
          selesai?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      member_cards: {
        Row: {
          barcode: string | null
          card_number: string
          catatan: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expired_at: string | null
          id: string
          issued_at: string
          qr_code: string | null
          status: Database["public"]["Enums"]["card_status"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          barcode?: string | null
          card_number: string
          catatan?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expired_at?: string | null
          id?: string
          issued_at?: string
          qr_code?: string | null
          status?: Database["public"]["Enums"]["card_status"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          barcode?: string | null
          card_number?: string
          catatan?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expired_at?: string | null
          id?: string
          issued_at?: string
          qr_code?: string | null
          status?: Database["public"]["Enums"]["card_status"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_read: boolean
          judul: string
          kategori: Database["public"]["Enums"]["notif_kategori"]
          pesan: string
          read_at: string | null
          ref_id: string | null
          ref_table: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_read?: boolean
          judul: string
          kategori?: Database["public"]["Enums"]["notif_kategori"]
          pesan: string
          read_at?: string | null
          ref_id?: string | null
          ref_table?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_read?: boolean
          judul?: string
          kategori?: Database["public"]["Enums"]["notif_kategori"]
          pesan?: string
          read_at?: string | null
          ref_id?: string | null
          ref_table?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pengumuman: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expired_at: string | null
          id: string
          is_published: boolean
          isi: string
          judul: string
          pinned: boolean
          published_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expired_at?: string | null
          id?: string
          is_published?: boolean
          isi: string
          judul: string
          pinned?: boolean
          published_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expired_at?: string | null
          id?: string
          is_published?: boolean
          isi?: string
          judul?: string
          pinned?: boolean
          published_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      pinjaman: {
        Row: {
          approved_at: string | null
          bukti_pencairan_url: string | null
          bunga_jenis: Database["public"]["Enums"]["bunga_jenis"]
          bunga_persen: number
          cicilan_per_bulan: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          disbursed_at: string | null
          dokumen_url: string | null
          id: string
          nominal: number
          status: Database["public"]["Enums"]["pinjaman_status"]
          tenor_bulan: number
          total_bayar: number | null
          tujuan: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          bukti_pencairan_url?: string | null
          bunga_jenis?: Database["public"]["Enums"]["bunga_jenis"]
          bunga_persen?: number
          cicilan_per_bulan?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          disbursed_at?: string | null
          dokumen_url?: string | null
          id?: string
          nominal: number
          status?: Database["public"]["Enums"]["pinjaman_status"]
          tenor_bulan: number
          total_bayar?: number | null
          tujuan?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          bukti_pencairan_url?: string | null
          bunga_jenis?: Database["public"]["Enums"]["bunga_jenis"]
          bunga_persen?: number
          cicilan_per_bulan?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          disbursed_at?: string | null
          dokumen_url?: string | null
          id?: string
          nominal?: number
          status?: Database["public"]["Enums"]["pinjaman_status"]
          tenor_bulan?: number
          total_bayar?: number | null
          tujuan?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          alamat: string | null
          barcode: string | null
          card_expired_at: string | null
          card_status: Database["public"]["Enums"]["card_status"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          foto_url: string | null
          id: string
          jenis_kelamin: string | null
          joined_at: string
          ktp_url: string | null
          member_card_number: string | null
          nama_lengkap: string
          nik: string | null
          no_hp: string | null
          nomor_anggota: string | null
          pekerjaan: string | null
          qr_code: string | null
          status: Database["public"]["Enums"]["member_status"]
          tanggal_lahir: string | null
          tempat_lahir: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alamat?: string | null
          barcode?: string | null
          card_expired_at?: string | null
          card_status?: Database["public"]["Enums"]["card_status"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          foto_url?: string | null
          id: string
          jenis_kelamin?: string | null
          joined_at?: string
          ktp_url?: string | null
          member_card_number?: string | null
          nama_lengkap: string
          nik?: string | null
          no_hp?: string | null
          nomor_anggota?: string | null
          pekerjaan?: string | null
          qr_code?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          tanggal_lahir?: string | null
          tempat_lahir?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alamat?: string | null
          barcode?: string | null
          card_expired_at?: string | null
          card_status?: Database["public"]["Enums"]["card_status"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          jenis_kelamin?: string | null
          joined_at?: string
          ktp_url?: string | null
          member_card_number?: string | null
          nama_lengkap?: string
          nik?: string | null
          no_hp?: string | null
          nomor_anggota?: string | null
          pekerjaan?: string | null
          qr_code?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          tanggal_lahir?: string | null
          tempat_lahir?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      shu: {
        Row: {
          catatan: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          dibagikan_at: string | null
          id: string
          nominal: number
          tahun: number
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dibagikan_at?: string | null
          id?: string
          nominal?: number
          tahun: number
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          catatan?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dibagikan_at?: string | null
          id?: string
          nominal?: number
          tahun?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      signatures: {
        Row: {
          created_at: string
          deleted_at: string | null
          hash: string | null
          id: string
          ip_address: string | null
          ref_id: string | null
          ref_table: string | null
          signature_url: string
          signed_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          hash?: string | null
          id?: string
          ip_address?: string | null
          ref_id?: string | null
          ref_table?: string | null
          signature_url: string
          signed_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          hash?: string | null
          id?: string
          ip_address?: string | null
          ref_id?: string | null
          ref_table?: string | null
          signature_url?: string
          signed_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      simpanan: {
        Row: {
          bukti_url: string | null
          catatan: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          jenis: Database["public"]["Enums"]["simpanan_jenis"]
          nominal: number
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          updated_by: string | null
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          bukti_url?: string | null
          catatan?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          jenis: Database["public"]["Enums"]["simpanan_jenis"]
          nominal: number
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          bukti_url?: string | null
          catatan?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          jenis?: Database["public"]["Enums"]["simpanan_jenis"]
          nominal?: number
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      transaksi: {
        Row: {
          arah: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          jenis: Database["public"]["Enums"]["transaksi_jenis"]
          keterangan: string | null
          kode: string | null
          nominal: number
          ref_id: string | null
          ref_table: string | null
          tanggal: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          arah: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          jenis: Database["public"]["Enums"]["transaksi_jenis"]
          keterangan?: string | null
          kode?: string | null
          nominal: number
          ref_id?: string | null
          ref_table?: string | null
          tanggal?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          arah?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          jenis?: Database["public"]["Enums"]["transaksi_jenis"]
          keterangan?: string | null
          kode?: string | null
          nominal?: number
          ref_id?: string | null
          ref_table?: string | null
          tanggal?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
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
      get_public_koperasi_stats: { Args: never; Returns: Json }
      get_public_recent_activity: {
        Args: { limit_count?: number }
        Returns: {
          descr: string
          kind: string
          title: string
          ts: string
        }[]
      }
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
      approval_status: "pending" | "approved" | "rejected" | "cancelled"
      approval_target:
        | "pinjaman"
        | "simpanan"
        | "anggota"
        | "pengumuman"
        | "lainnya"
      bunga_jenis: "flat" | "efektif" | "menurun"
      card_status: "active" | "inactive" | "expired" | "blocked" | "lost"
      meeting_status: "scheduled" | "ongoing" | "completed" | "cancelled"
      member_status: "pending" | "active" | "suspended" | "rejected"
      notif_kategori:
        | "info"
        | "sukses"
        | "peringatan"
        | "error"
        | "approval"
        | "transaksi"
        | "sistem"
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
      transaksi_jenis:
        | "simpanan_masuk"
        | "simpanan_keluar"
        | "pinjaman_cair"
        | "angsuran_masuk"
        | "shu_keluar"
        | "biaya_admin"
        | "pendapatan_bunga"
        | "lainnya"
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
      approval_status: ["pending", "approved", "rejected", "cancelled"],
      approval_target: [
        "pinjaman",
        "simpanan",
        "anggota",
        "pengumuman",
        "lainnya",
      ],
      bunga_jenis: ["flat", "efektif", "menurun"],
      card_status: ["active", "inactive", "expired", "blocked", "lost"],
      meeting_status: ["scheduled", "ongoing", "completed", "cancelled"],
      member_status: ["pending", "active", "suspended", "rejected"],
      notif_kategori: [
        "info",
        "sukses",
        "peringatan",
        "error",
        "approval",
        "transaksi",
        "sistem",
      ],
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
      transaksi_jenis: [
        "simpanan_masuk",
        "simpanan_keluar",
        "pinjaman_cair",
        "angsuran_masuk",
        "shu_keluar",
        "biaya_admin",
        "pendapatan_bunga",
        "lainnya",
      ],
    },
  },
} as const
