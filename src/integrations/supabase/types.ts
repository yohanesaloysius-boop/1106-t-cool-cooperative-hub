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
          denda: number
          denda_updated_at: string | null
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
          denda?: number
          denda_updated_at?: string | null
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
          denda?: number
          denda_updated_at?: string | null
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
      asset_depreciations: {
        Row: {
          akumulasi: number
          asset_id: string
          beban_bulan: number
          created_at: string
          id: string
          nilai_buku: number
          periode: string
        }
        Insert: {
          akumulasi?: number
          asset_id: string
          beban_bulan?: number
          created_at?: string
          id?: string
          nilai_buku?: number
          periode: string
        }
        Update: {
          akumulasi?: number
          asset_id?: string
          beban_bulan?: number
          created_at?: string
          id?: string
          nilai_buku?: number
          periode?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_depreciations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          catatan: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deskripsi: string | null
          dokumen_url: string | null
          foto_url: string | null
          harga_perolehan: number
          id: string
          kategori: Database["public"]["Enums"]["asset_kategori"]
          kondisi: Database["public"]["Enums"]["asset_kondisi"]
          lokasi: string | null
          nama: string
          nilai_residu: number
          nomor_aset: string
          penanggung_jawab: string | null
          status: Database["public"]["Enums"]["asset_status"]
          tanggal_perolehan: string
          umur_ekonomis_bulan: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deskripsi?: string | null
          dokumen_url?: string | null
          foto_url?: string | null
          harga_perolehan?: number
          id?: string
          kategori?: Database["public"]["Enums"]["asset_kategori"]
          kondisi?: Database["public"]["Enums"]["asset_kondisi"]
          lokasi?: string | null
          nama: string
          nilai_residu?: number
          nomor_aset: string
          penanggung_jawab?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          tanggal_perolehan: string
          umur_ekonomis_bulan?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          catatan?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deskripsi?: string | null
          dokumen_url?: string | null
          foto_url?: string | null
          harga_perolehan?: number
          id?: string
          kategori?: Database["public"]["Enums"]["asset_kategori"]
          kondisi?: Database["public"]["Enums"]["asset_kondisi"]
          lokasi?: string | null
          nama?: string
          nilai_residu?: number
          nomor_aset?: string
          penanggung_jawab?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          tanggal_perolehan?: string
          umur_ekonomis_bulan?: number
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
      bank_mutations: {
        Row: {
          bank_name: string | null
          created_at: string
          created_by: string | null
          id: string
          jenis: string
          keterangan: string
          matched_at: string | null
          matched_by: string | null
          matched_id: string | null
          matched_table: string | null
          nominal: number
          raw_row: Json | null
          saldo: number | null
          source_file: string | null
          status: string
          tanggal: string
          updated_at: string
        }
        Insert: {
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jenis: string
          keterangan: string
          matched_at?: string | null
          matched_by?: string | null
          matched_id?: string | null
          matched_table?: string | null
          nominal: number
          raw_row?: Json | null
          saldo?: number | null
          source_file?: string | null
          status?: string
          tanggal: string
          updated_at?: string
        }
        Update: {
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jenis?: string
          keterangan?: string
          matched_at?: string | null
          matched_by?: string | null
          matched_id?: string | null
          matched_table?: string | null
          nominal?: number
          raw_row?: Json | null
          saldo?: number | null
          source_file?: string | null
          status?: string
          tanggal?: string
          updated_at?: string
        }
        Relationships: []
      }
      collection_cases: {
        Row: {
          catatan: string | null
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          created_by: string | null
          hari_terlambat: number
          id: string
          jumlah_cicilan_tertunggak: number
          opened_at: string
          pic_kolektor: string | null
          pinjaman_id: string
          priority: Database["public"]["Enums"]["collection_priority"]
          status: Database["public"]["Enums"]["collection_status"]
          total_denda: number
          total_tunggakan: number
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          catatan?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          created_by?: string | null
          hari_terlambat?: number
          id?: string
          jumlah_cicilan_tertunggak?: number
          opened_at?: string
          pic_kolektor?: string | null
          pinjaman_id: string
          priority?: Database["public"]["Enums"]["collection_priority"]
          status?: Database["public"]["Enums"]["collection_status"]
          total_denda?: number
          total_tunggakan?: number
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          catatan?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          created_by?: string | null
          hari_terlambat?: number
          id?: string
          jumlah_cicilan_tertunggak?: number
          opened_at?: string
          pic_kolektor?: string | null
          pinjaman_id?: string
          priority?: Database["public"]["Enums"]["collection_priority"]
          status?: Database["public"]["Enums"]["collection_status"]
          total_denda?: number
          total_tunggakan?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      collection_logs: {
        Row: {
          action: Database["public"]["Enums"]["collection_action"]
          case_id: string
          created_at: string
          created_by: string | null
          id: string
          isi_pembicaraan: string | null
          janji_bayar_nominal: number | null
          janji_bayar_tanggal: string | null
          kontak_oleh: string | null
          kontak_tanggal: string
          lampiran_url: string | null
          lokasi: string | null
          outcome: Database["public"]["Enums"]["collection_outcome"]
        }
        Insert: {
          action: Database["public"]["Enums"]["collection_action"]
          case_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          isi_pembicaraan?: string | null
          janji_bayar_nominal?: number | null
          janji_bayar_tanggal?: string | null
          kontak_oleh?: string | null
          kontak_tanggal?: string
          lampiran_url?: string | null
          lokasi?: string | null
          outcome?: Database["public"]["Enums"]["collection_outcome"]
        }
        Update: {
          action?: Database["public"]["Enums"]["collection_action"]
          case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          isi_pembicaraan?: string | null
          janji_bayar_nominal?: number | null
          janji_bayar_tanggal?: string | null
          kontak_oleh?: string | null
          kontak_tanggal?: string
          lampiran_url?: string | null
          lokasi?: string | null
          outcome?: Database["public"]["Enums"]["collection_outcome"]
        }
        Relationships: [
          {
            foreignKeyName: "collection_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "collection_cases"
            referencedColumns: ["id"]
          },
        ]
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
      loan_agreements: {
        Row: {
          content_hash: string | null
          created_at: string
          id: string
          member_signature_id: string | null
          member_signed_at: string | null
          pdf_path: string | null
          pengurus_id: string | null
          pengurus_signature_id: string | null
          pengurus_signed_at: string | null
          pinjaman_id: string
          snapshot: Json | null
          status: string
          terms_version: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          id?: string
          member_signature_id?: string | null
          member_signed_at?: string | null
          pdf_path?: string | null
          pengurus_id?: string | null
          pengurus_signature_id?: string | null
          pengurus_signed_at?: string | null
          pinjaman_id: string
          snapshot?: Json | null
          status?: string
          terms_version?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          id?: string
          member_signature_id?: string | null
          member_signed_at?: string | null
          pdf_path?: string | null
          pengurus_id?: string | null
          pengurus_signature_id?: string | null
          pengurus_signed_at?: string | null
          pinjaman_id?: string
          snapshot?: Json | null
          status?: string
          terms_version?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loan_guarantors: {
        Row: {
          borrower_id: string
          catatan: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          guarantee_amount: number
          guarantor_id: string
          id: string
          pinjaman_id: string
          rejected_reason: string | null
          requested_at: string
          responded_at: string | null
          status: Database["public"]["Enums"]["guarantor_status"]
          updated_at: string
        }
        Insert: {
          borrower_id: string
          catatan?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          guarantee_amount?: number
          guarantor_id: string
          id?: string
          pinjaman_id: string
          rejected_reason?: string | null
          requested_at?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["guarantor_status"]
          updated_at?: string
        }
        Update: {
          borrower_id?: string
          catatan?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          guarantee_amount?: number
          guarantor_id?: string
          id?: string
          pinjaman_id?: string
          rejected_reason?: string | null
          requested_at?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["guarantor_status"]
          updated_at?: string
        }
        Relationships: []
      }
      loan_restructures: {
        Row: {
          alasan: string
          approved_at: string | null
          approved_by: string | null
          case_id: string | null
          created_at: string
          created_by: string | null
          diskon_denda: number
          effective_at: string | null
          id: string
          new_bunga_persen: number
          new_cicilan_per_bulan: number
          new_jatuh_tempo_mulai: string
          new_pokok: number
          new_tenor_bulan: number
          old_bunga_persen: number
          old_cicilan: number
          old_sisa_pokok: number
          old_tenor_sisa: number
          pinjaman_id: string
          potongan_pokok: number
          rejected_reason: string | null
          status: Database["public"]["Enums"]["restructure_status"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          alasan: string
          approved_at?: string | null
          approved_by?: string | null
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          diskon_denda?: number
          effective_at?: string | null
          id?: string
          new_bunga_persen?: number
          new_cicilan_per_bulan?: number
          new_jatuh_tempo_mulai: string
          new_pokok: number
          new_tenor_bulan: number
          old_bunga_persen?: number
          old_cicilan?: number
          old_sisa_pokok?: number
          old_tenor_sisa?: number
          pinjaman_id: string
          potongan_pokok?: number
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["restructure_status"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          alasan?: string
          approved_at?: string | null
          approved_by?: string | null
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          diskon_denda?: number
          effective_at?: string | null
          id?: string
          new_bunga_persen?: number
          new_cicilan_per_bulan?: number
          new_jatuh_tempo_mulai?: string
          new_pokok?: number
          new_tenor_bulan?: number
          old_bunga_persen?: number
          old_cicilan?: number
          old_sisa_pokok?: number
          old_tenor_sisa?: number
          pinjaman_id?: string
          potongan_pokok?: number
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["restructure_status"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_restructures_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "collection_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_verifications: {
        Row: {
          admin_notes: string | null
          created_at: string
          face_match_score: number | null
          id: string
          ip_address: string | null
          ktp_image_path: string | null
          location: Json | null
          ocr_data: Json | null
          pinjaman_id: string | null
          rejected_reason: string | null
          selfie_image_path: string | null
          status: Database["public"]["Enums"]["verif_status"]
          updated_at: string
          user_agent: string | null
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          face_match_score?: number | null
          id?: string
          ip_address?: string | null
          ktp_image_path?: string | null
          location?: Json | null
          ocr_data?: Json | null
          pinjaman_id?: string | null
          rejected_reason?: string | null
          selfie_image_path?: string | null
          status?: Database["public"]["Enums"]["verif_status"]
          updated_at?: string
          user_agent?: string | null
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          face_match_score?: number | null
          id?: string
          ip_address?: string | null
          ktp_image_path?: string | null
          location?: Json | null
          ocr_data?: Json | null
          pinjaman_id?: string | null
          rejected_reason?: string | null
          selfie_image_path?: string | null
          status?: Database["public"]["Enums"]["verif_status"]
          updated_at?: string
          user_agent?: string | null
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      lowongan_kerja: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          deskripsi: string | null
          expired_at: string | null
          gender: string | null
          id: string
          judul: string
          kontak_email: string | null
          kontak_nama: string | null
          kontak_telepon: string
          lokasi: string | null
          perusahaan: string
          posisi: string
          status: Database["public"]["Enums"]["lowongan_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deskripsi?: string | null
          expired_at?: string | null
          gender?: string | null
          id?: string
          judul: string
          kontak_email?: string | null
          kontak_nama?: string | null
          kontak_telepon: string
          lokasi?: string | null
          perusahaan: string
          posisi: string
          status?: Database["public"]["Enums"]["lowongan_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deskripsi?: string | null
          expired_at?: string | null
          gender?: string | null
          id?: string
          judul?: string
          kontak_email?: string | null
          kontak_nama?: string | null
          kontak_telepon?: string
          lokasi?: string | null
          perusahaan?: string
          posisi?: string
          status?: Database["public"]["Enums"]["lowongan_status"]
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          nama_kategori: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          nama_kategori: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          nama_kategori?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_complaints: {
        Row: {
          alasan: string
          buyer_id: string
          created_at: string
          id: string
          lampiran_url: string | null
          resolusi: string | null
          resolved_at: string | null
          resolved_by: string | null
          seller_id: string
          status: string
          trx_id: string
          updated_at: string
        }
        Insert: {
          alasan: string
          buyer_id: string
          created_at?: string
          id?: string
          lampiran_url?: string | null
          resolusi?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id: string
          status?: string
          trx_id: string
          updated_at?: string
        }
        Update: {
          alasan?: string
          buyer_id?: string
          created_at?: string
          id?: string
          lampiran_url?: string | null
          resolusi?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id?: string
          status?: string
          trx_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_favorites: {
        Row: {
          created_at: string
          id: string
          member_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_favorites_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_products: {
        Row: {
          category_id: string | null
          created_at: string
          deskripsi: string | null
          diskon_persen: number
          gambar_produk: string[]
          harga: number
          id: string
          is_featured: boolean
          nama_produk: string
          slug: string
          status_produk: Database["public"]["Enums"]["product_status"]
          stok: number
          store_id: string
          updated_at: string
          view_count: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          deskripsi?: string | null
          diskon_persen?: number
          gambar_produk?: string[]
          harga?: number
          id?: string
          is_featured?: boolean
          nama_produk: string
          slug: string
          status_produk?: Database["public"]["Enums"]["product_status"]
          stok?: number
          store_id: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          deskripsi?: string | null
          diskon_persen?: number
          gambar_produk?: string[]
          harga?: number
          id?: string
          is_featured?: boolean
          nama_produk?: string
          slug?: string
          status_produk?: Database["public"]["Enums"]["product_status"]
          stok?: number
          store_id?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_reviews: {
        Row: {
          created_at: string
          id: string
          komentar: string | null
          member_id: string
          product_id: string
          rating: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          komentar?: string | null
          member_id: string
          product_id: string
          rating: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          komentar?: string | null
          member_id?: string
          product_id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_reviews_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_stores: {
        Row: {
          alamat: string | null
          banner: string | null
          created_at: string
          deskripsi: string | null
          facebook: string | null
          id: string
          instagram: string | null
          logo: string | null
          member_id: string
          nama_toko: string
          promo_banner: string | null
          promo_text: string | null
          shopee: string | null
          slug: string
          status_toko: Database["public"]["Enums"]["store_status"]
          tiktok: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          alamat?: string | null
          banner?: string | null
          created_at?: string
          deskripsi?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          logo?: string | null
          member_id: string
          nama_toko: string
          promo_banner?: string | null
          promo_text?: string | null
          shopee?: string | null
          slug: string
          status_toko?: Database["public"]["Enums"]["store_status"]
          tiktok?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          alamat?: string | null
          banner?: string | null
          created_at?: string
          deskripsi?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          logo?: string | null
          member_id?: string
          nama_toko?: string
          promo_banner?: string | null
          promo_text?: string | null
          shopee?: string | null
          slug?: string
          status_toko?: Database["public"]["Enums"]["store_status"]
          tiktok?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_stores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_transactions: {
        Row: {
          bukti_transfer_url: string | null
          buyer_id: string
          catatan: string | null
          created_at: string
          fee_nominal: number
          fee_persen: number
          harga_satuan: number
          id: string
          kurir: string | null
          paid_at: string | null
          product_id: string
          qty: number
          received_at: string | null
          resi: string | null
          seller_amount: number
          seller_id: string
          shipped_at: string | null
          status: Database["public"]["Enums"]["mp_trx_status"]
          store_id: string
          total: number
          updated_at: string
          verified_by: string | null
        }
        Insert: {
          bukti_transfer_url?: string | null
          buyer_id: string
          catatan?: string | null
          created_at?: string
          fee_nominal?: number
          fee_persen?: number
          harga_satuan: number
          id?: string
          kurir?: string | null
          paid_at?: string | null
          product_id: string
          qty: number
          received_at?: string | null
          resi?: string | null
          seller_amount?: number
          seller_id: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["mp_trx_status"]
          store_id: string
          total: number
          updated_at?: string
          verified_by?: string | null
        }
        Update: {
          bukti_transfer_url?: string | null
          buyer_id?: string
          catatan?: string | null
          created_at?: string
          fee_nominal?: number
          fee_persen?: number
          harga_satuan?: number
          id?: string
          kurir?: string | null
          paid_at?: string | null
          product_id?: string
          qty?: number
          received_at?: string | null
          resi?: string | null
          seller_amount?: number
          seller_id?: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["mp_trx_status"]
          store_id?: string
          total?: number
          updated_at?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_transactions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_transactions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "marketplace_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_withdrawals: {
        Row: {
          bank_atas_nama: string | null
          bank_nama: string | null
          bank_no_rek: string | null
          bukti_transfer_url: string | null
          catatan: string | null
          created_at: string
          id: string
          nominal: number
          processed_at: string | null
          processed_by: string | null
          requested_at: string
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_atas_nama?: string | null
          bank_nama?: string | null
          bank_no_rek?: string | null
          bukti_transfer_url?: string | null
          catatan?: string | null
          created_at?: string
          id?: string
          nominal: number
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_atas_nama?: string | null
          bank_nama?: string | null
          bank_no_rek?: string | null
          bukti_transfer_url?: string | null
          catatan?: string | null
          created_at?: string
          id?: string
          nominal?: number
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id?: string
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
      opex_categories: {
        Row: {
          created_at: string
          deskripsi: string | null
          id: string
          is_active: boolean
          kode: string
          nama: string
          pajak_jenis: string | null
          pajak_tarif: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deskripsi?: string | null
          id?: string
          is_active?: boolean
          kode: string
          nama: string
          pajak_jenis?: string | null
          pajak_tarif?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deskripsi?: string | null
          id?: string
          is_active?: boolean
          kode?: string
          nama?: string
          pajak_jenis?: string | null
          pajak_tarif?: number
          updated_at?: string
        }
        Relationships: []
      }
      opex_expenses: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bukti_url: string | null
          catatan: string | null
          category_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deskripsi: string
          id: string
          metode_bayar: Database["public"]["Enums"]["opex_metode_bayar"]
          nominal: number
          nomor_bukti: string | null
          paid_at: string | null
          paid_by: string | null
          pajak_meta: Json | null
          pajak_nominal: number
          penerima: string | null
          rejected_reason: string | null
          status: Database["public"]["Enums"]["opex_status"]
          tanggal: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bukti_url?: string | null
          catatan?: string | null
          category_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deskripsi: string
          id?: string
          metode_bayar?: Database["public"]["Enums"]["opex_metode_bayar"]
          nominal: number
          nomor_bukti?: string | null
          paid_at?: string | null
          paid_by?: string | null
          pajak_meta?: Json | null
          pajak_nominal?: number
          penerima?: string | null
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["opex_status"]
          tanggal?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bukti_url?: string | null
          catatan?: string | null
          category_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deskripsi?: string
          id?: string
          metode_bayar?: Database["public"]["Enums"]["opex_metode_bayar"]
          nominal?: number
          nomor_bukti?: string | null
          paid_at?: string | null
          paid_by?: string | null
          pajak_meta?: Json | null
          pajak_nominal?: number
          penerima?: string | null
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["opex_status"]
          tanggal?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opex_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "opex_categories"
            referencedColumns: ["id"]
          },
        ]
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
          verification_id: string | null
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
          verification_id?: string | null
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
          verification_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pinjaman_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "loan_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          alamat: string | null
          barcode: string | null
          card_expired_at: string | null
          card_status: Database["public"]["Enums"]["card_status"]
          country_code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          foto_url: string | null
          id: string
          jenis_kelamin: string | null
          joined_at: string
          ktp_url: string | null
          last_login: string | null
          member_card_number: string | null
          nama_lengkap: string
          nik: string | null
          no_hp: string | null
          nomor_anggota: string | null
          pekerjaan: string | null
          phone_verified: boolean
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
          country_code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          foto_url?: string | null
          id: string
          jenis_kelamin?: string | null
          joined_at?: string
          ktp_url?: string | null
          last_login?: string | null
          member_card_number?: string | null
          nama_lengkap: string
          nik?: string | null
          no_hp?: string | null
          nomor_anggota?: string | null
          pekerjaan?: string | null
          phone_verified?: boolean
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
          country_code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          jenis_kelamin?: string | null
          joined_at?: string
          ktp_url?: string | null
          last_login?: string | null
          member_card_number?: string | null
          nama_lengkap?: string
          nik?: string | null
          no_hp?: string | null
          nomor_anggota?: string | null
          pekerjaan?: string | null
          phone_verified?: boolean
          qr_code?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          tanggal_lahir?: string | null
          tempat_lahir?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      qris_payments: {
        Row: {
          created_at: string
          expired_at: string
          id: string
          invoice_no: string
          jenis: Database["public"]["Enums"]["qris_jenis"]
          keterangan: string | null
          metadata: Json
          nominal: number
          paid_at: string | null
          qr_string: string
          ref_id: string | null
          ref_table: string | null
          status: Database["public"]["Enums"]["qris_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expired_at?: string
          id?: string
          invoice_no?: string
          jenis: Database["public"]["Enums"]["qris_jenis"]
          keterangan?: string | null
          metadata?: Json
          nominal: number
          paid_at?: string | null
          qr_string: string
          ref_id?: string | null
          ref_table?: string | null
          status?: Database["public"]["Enums"]["qris_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expired_at?: string
          id?: string
          invoice_no?: string
          jenis?: Database["public"]["Enums"]["qris_jenis"]
          keterangan?: string | null
          metadata?: Json
          nominal?: number
          paid_at?: string | null
          qr_string?: string
          ref_id?: string | null
          ref_table?: string | null
          status?: Database["public"]["Enums"]["qris_status"]
          updated_at?: string
          user_id?: string
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
      shu_rewards: {
        Row: {
          bonus_loyalitas: number
          catatan: string | null
          created_at: string
          id: string
          poin_keaktifan: number
          poin_kehadiran_rapat: number
          poin_pelunasan_pinjaman: number
          poin_referral: number
          tahun: number
          total_bonus: number
          total_poin: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bonus_loyalitas?: number
          catatan?: string | null
          created_at?: string
          id?: string
          poin_keaktifan?: number
          poin_kehadiran_rapat?: number
          poin_pelunasan_pinjaman?: number
          poin_referral?: number
          tahun: number
          total_bonus?: number
          total_poin?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bonus_loyalitas?: number
          catatan?: string | null
          created_at?: string
          id?: string
          poin_keaktifan?: number
          poin_kehadiran_rapat?: number
          poin_pelunasan_pinjaman?: number
          poin_referral?: number
          tahun?: number
          total_bonus?: number
          total_poin?: number | null
          updated_at?: string
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
      tabungan_berjangka: {
        Row: {
          bukti_url: string | null
          bunga_persen: number
          catatan: string | null
          created_at: string
          deleted_at: string | null
          id: string
          nominal: number
          status: Database["public"]["Enums"]["tabungan_status"]
          tanggal_jatuh_tempo: string | null
          tanggal_mulai: string | null
          tenor_bulan: number
          total_bagi_hasil: number | null
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
          withdrawn_at: string | null
        }
        Insert: {
          bukti_url?: string | null
          bunga_persen?: number
          catatan?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          nominal: number
          status?: Database["public"]["Enums"]["tabungan_status"]
          tanggal_jatuh_tempo?: string | null
          tanggal_mulai?: string | null
          tenor_bulan: number
          total_bagi_hasil?: number | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          bukti_url?: string | null
          bunga_persen?: number
          catatan?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          nominal?: number
          status?: Database["public"]["Enums"]["tabungan_status"]
          tanggal_jatuh_tempo?: string | null
          tanggal_mulai?: string | null
          tenor_bulan?: number
          total_bagi_hasil?: number | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
          withdrawn_at?: string | null
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
      verification_logs: {
        Row: {
          action: string
          actor_id: string | null
          catatan: string | null
          created_at: string
          id: string
          meta: Json | null
          verification_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          catatan?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          verification_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          catatan?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_logs_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "loan_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          arah: string
          created_at: string
          created_by: string | null
          id: string
          jenis: string
          keterangan: string | null
          nominal: number
          ref_id: string | null
          ref_table: string | null
          user_id: string | null
          wallet_id: string
        }
        Insert: {
          arah: string
          created_at?: string
          created_by?: string | null
          id?: string
          jenis: string
          keterangan?: string | null
          nominal: number
          ref_id?: string | null
          ref_table?: string | null
          user_id?: string | null
          wallet_id: string
        }
        Update: {
          arah?: string
          created_at?: string
          created_by?: string | null
          id?: string
          jenis?: string
          keterangan?: string | null
          nominal?: number
          ref_id?: string | null
          ref_table?: string | null
          user_id?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          created_at: string
          id: string
          saldo: number
          saldo_escrow: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          saldo?: number
          saldo_escrow?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          saldo?: number
          saldo_escrow?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      act_on_guarantor_request: {
        Args: { _action: string; _id: string; _reason?: string }
        Returns: undefined
      }
      compute_asset_depreciation: {
        Args: { _asset_id: string }
        Returns: number
      }
      gen_qris_invoice_no: { Args: never; Returns: string }
      get_email_by_phone: { Args: { _phone: string }; Returns: string }
      get_featured_products: {
        Args: { _limit?: number }
        Returns: {
          diskon_persen: number
          gambar_produk: string[]
          harga: number
          id: string
          nama_produk: string
          slug: string
          store_id: string
          store_nama: string
          store_slug: string
        }[]
      }
      get_fee_breakdown: {
        Args: never
        Returns: {
          bulan: string
          jumlah_trx: number
          total_fee: number
          total_gmv: number
        }[]
      }
      get_jurnal_umum: {
        Args: { _from?: string; _to?: string }
        Returns: {
          arah: string
          debit: number
          jenis: string
          keterangan: string
          kredit: number
          nama_anggota: string
          nomor_anggota: string
          ref_id: string
          ref_table: string
          status: string
          tanggal: string
          user_id: string
        }[]
      }
      get_marketplace_admin_stats: { Args: never; Returns: Json }
      get_marketplace_stats: { Args: never; Returns: Json }
      get_member_ledger: {
        Args: { _from?: string; _to?: string; _user_id: string }
        Returns: {
          arah: string
          debit: number
          jenis: string
          keterangan: string
          kredit: number
          ref_id: string
          ref_table: string
          status: string
          tanggal: string
        }[]
      }
      get_or_create_wallet: { Args: { _user_id: string }; Returns: string }
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
      get_top_products: {
        Args: { _limit?: number }
        Returns: {
          gambar: string
          nama_produk: string
          product_id: string
          store_nama: string
          total_omset: number
          total_qty: number
        }[]
      }
      get_user_marketplace_activity: {
        Args: { _limit?: number; _user_id: string }
        Returns: {
          created_at: string
          gambar: string
          id: string
          nama_produk: string
          product_id: string
          qty: number
          role: string
          status: string
          store_id: string
          store_nama: string
          store_slug: string
          total: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_product_view: {
        Args: { _product_id: string }
        Returns: undefined
      }
      is_active_seller: { Args: { _user_id: string }; Returns: boolean }
      is_pengurus: { Args: { _user_id: string }; Returns: boolean }
      mp_auto_release_escrow: {
        Args: { _days?: number }
        Returns: {
          released_count: number
          total_released: number
        }[]
      }
      mp_confirm_received: { Args: { _trx_id: string }; Returns: undefined }
      mp_file_complaint: {
        Args: { _alasan: string; _lampiran_url: string; _trx_id: string }
        Returns: string
      }
      mp_process_withdrawal: {
        Args: { _bukti_url: string; _wd_id: string }
        Returns: undefined
      }
      mp_reject_withdrawal: {
        Args: { _alasan: string; _wd_id: string }
        Returns: undefined
      }
      mp_resolve_complaint: {
        Args: { _action: string; _catatan: string; _complaint_id: string }
        Returns: undefined
      }
      mp_review_loan_verification: {
        Args: { _action: string; _catatan: string; _id: string }
        Returns: undefined
      }
      mp_set_store_status: {
        Args: {
          _alasan: string
          _status: Database["public"]["Enums"]["store_status"]
          _store_id: string
        }
        Returns: undefined
      }
      mp_ship: {
        Args: { _kurir: string; _resi: string; _trx_id: string }
        Returns: undefined
      }
      mp_upload_bukti: {
        Args: { _bukti_url: string; _trx_id: string }
        Returns: undefined
      }
      mp_verify_payment: { Args: { _trx_id: string }; Returns: undefined }
      normalize_phone_id: { Args: { _raw: string }; Returns: string }
      qris_expire_pending: { Args: never; Returns: number }
      qris_mark_success: { Args: { _id: string }; Returns: undefined }
      sync_collection_cases: { Args: never; Returns: number }
      validate_guarantor: {
        Args: { _amount: number; _guarantor_id: string }
        Returns: Json
      }
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
      asset_kategori:
        | "kendaraan"
        | "properti"
        | "peralatan"
        | "elektronik"
        | "lainnya"
      asset_kondisi: "baik" | "perlu_perbaikan" | "rusak"
      asset_status: "aktif" | "dijual" | "rusak" | "dihapus"
      bunga_jenis: "flat" | "efektif" | "menurun"
      card_status: "active" | "inactive" | "expired" | "blocked" | "lost"
      collection_action:
        | "call"
        | "visit"
        | "whatsapp"
        | "sms"
        | "letter"
        | "email"
        | "other"
      collection_outcome:
        | "no_contact"
        | "contacted"
        | "promise_to_pay"
        | "partial_payment"
        | "full_payment"
        | "refused"
        | "escalate"
      collection_priority: "low" | "medium" | "high" | "critical"
      collection_status:
        | "open"
        | "in_progress"
        | "promised"
        | "restructured"
        | "written_off"
        | "closed"
      guarantor_status:
        | "pending"
        | "approved"
        | "rejected"
        | "expired"
        | "cancelled"
      lowongan_status: "pending" | "approved" | "rejected" | "expired"
      meeting_status: "scheduled" | "ongoing" | "completed" | "cancelled"
      member_status: "pending" | "active" | "suspended" | "rejected"
      mp_trx_status:
        | "pending"
        | "confirmed"
        | "paid"
        | "shipped"
        | "completed"
        | "cancelled"
        | "refunded"
      notif_kategori:
        | "info"
        | "sukses"
        | "peringatan"
        | "error"
        | "approval"
        | "transaksi"
        | "sistem"
      opex_metode_bayar: "tunai" | "transfer" | "wallet" | "lainnya"
      opex_status:
        | "draft"
        | "pending"
        | "approved"
        | "rejected"
        | "paid"
        | "cancelled"
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
      product_status: "draft" | "active" | "out_of_stock" | "archived"
      qris_jenis:
        | "simpanan"
        | "angsuran"
        | "topup"
        | "marketplace"
        | "admin"
        | "ppob"
      qris_status: "pending" | "success" | "expired" | "failed" | "cancelled"
      restructure_status:
        | "draft"
        | "pending"
        | "approved"
        | "rejected"
        | "active"
        | "completed"
      simpanan_jenis: "pokok" | "wajib" | "sukarela"
      store_status: "active" | "inactive" | "suspended" | "pending"
      tabungan_status:
        | "pending"
        | "active"
        | "matured"
        | "withdrawn"
        | "rejected"
      transaksi_jenis:
        | "simpanan_masuk"
        | "simpanan_keluar"
        | "pinjaman_cair"
        | "angsuran_masuk"
        | "shu_keluar"
        | "biaya_admin"
        | "pendapatan_bunga"
        | "lainnya"
      verif_status: "pending" | "verified" | "rejected"
      withdrawal_status: "pending" | "approved" | "rejected" | "paid"
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
      asset_kategori: [
        "kendaraan",
        "properti",
        "peralatan",
        "elektronik",
        "lainnya",
      ],
      asset_kondisi: ["baik", "perlu_perbaikan", "rusak"],
      asset_status: ["aktif", "dijual", "rusak", "dihapus"],
      bunga_jenis: ["flat", "efektif", "menurun"],
      card_status: ["active", "inactive", "expired", "blocked", "lost"],
      collection_action: [
        "call",
        "visit",
        "whatsapp",
        "sms",
        "letter",
        "email",
        "other",
      ],
      collection_outcome: [
        "no_contact",
        "contacted",
        "promise_to_pay",
        "partial_payment",
        "full_payment",
        "refused",
        "escalate",
      ],
      collection_priority: ["low", "medium", "high", "critical"],
      collection_status: [
        "open",
        "in_progress",
        "promised",
        "restructured",
        "written_off",
        "closed",
      ],
      guarantor_status: [
        "pending",
        "approved",
        "rejected",
        "expired",
        "cancelled",
      ],
      lowongan_status: ["pending", "approved", "rejected", "expired"],
      meeting_status: ["scheduled", "ongoing", "completed", "cancelled"],
      member_status: ["pending", "active", "suspended", "rejected"],
      mp_trx_status: [
        "pending",
        "confirmed",
        "paid",
        "shipped",
        "completed",
        "cancelled",
        "refunded",
      ],
      notif_kategori: [
        "info",
        "sukses",
        "peringatan",
        "error",
        "approval",
        "transaksi",
        "sistem",
      ],
      opex_metode_bayar: ["tunai", "transfer", "wallet", "lainnya"],
      opex_status: [
        "draft",
        "pending",
        "approved",
        "rejected",
        "paid",
        "cancelled",
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
      product_status: ["draft", "active", "out_of_stock", "archived"],
      qris_jenis: [
        "simpanan",
        "angsuran",
        "topup",
        "marketplace",
        "admin",
        "ppob",
      ],
      qris_status: ["pending", "success", "expired", "failed", "cancelled"],
      restructure_status: [
        "draft",
        "pending",
        "approved",
        "rejected",
        "active",
        "completed",
      ],
      simpanan_jenis: ["pokok", "wajib", "sukarela"],
      store_status: ["active", "inactive", "suspended", "pending"],
      tabungan_status: [
        "pending",
        "active",
        "matured",
        "withdrawn",
        "rejected",
      ],
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
      verif_status: ["pending", "verified", "rejected"],
      withdrawal_status: ["pending", "approved", "rejected", "paid"],
    },
  },
} as const
