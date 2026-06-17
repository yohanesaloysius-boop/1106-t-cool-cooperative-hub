import type { AppRole } from "@/hooks/use-auth";

// ===== Role sets per job-desc =====
export const PENGURUS_ROLES: AppRole[] = ["super_admin", "ketua", "sekretaris", "bendahara"];
// Pimpinan — akses penuh & boleh edit/tambah fitur & menu
export const LEADER_ROLES: AppRole[] = ["ketua", "super_admin"];
// Khusus super admin — pengelolaan paling sensitif (role/izin)
export const SUPER_ADMIN_ROLES: AppRole[] = ["super_admin"];
// Keuangan — bendahara + pimpinan
export const FINANCE_ROLES: AppRole[] = ["bendahara", "ketua", "super_admin"];
// Administrasi/kesekretariatan — sekretaris + pimpinan
export const SECRETARY_ROLES: AppRole[] = ["sekretaris", "ketua", "super_admin"];

/**
 * Peta akses tiap menu/route admin -> daftar role yang boleh.
 * Sumber kebenaran tunggal untuk menu (visibility) & guard route.
 */
export const ADMIN_ACCESS: Record<string, AppRole[]> = {
  // Dasbor admin: semua pengurus boleh lihat ringkasan
  "/admin": PENGURUS_ROLES,

  // Anggota / administrasi
  "/admin/anggota": SECRETARY_ROLES,
  "/admin/approval": SECRETARY_ROLES,
  "/admin/penagihan": FINANCE_ROLES,

  // Keuangan
  "/admin/simpanan": FINANCE_ROLES,
  "/admin/pinjaman": FINANCE_ROLES,
  "/admin/akad": FINANCE_ROLES,
  "/admin/verifikasi-pinjaman": FINANCE_ROLES,
  "/admin/angsuran": FINANCE_ROLES,
  "/admin/buku-besar": FINANCE_ROLES,
  "/admin/buku-kas": FINANCE_ROLES,
  "/admin/arsip-transaksi": FINANCE_ROLES,
  "/admin/rekonsiliasi": FINANCE_ROLES,
  "/admin/qris": FINANCE_ROLES,
  "/admin/tabungan-berjangka": FINANCE_ROLES,
  "/admin/dana-cadangan": FINANCE_ROLES,
  "/admin/shu": FINANCE_ROLES,
  "/admin/penjamin": FINANCE_ROLES,

  // Marketplace — hanya pimpinan
  "/admin/marketplace": LEADER_ROLES,
  "/admin/seller-verify": LEADER_ROLES,
  "/admin/escrow": LEADER_ROLES,
  "/admin/fee": LEADER_ROLES,
  "/admin/komplain": LEADER_ROLES,
  "/admin/kupon": LEADER_ROLES,
  "/admin/statistik": LEADER_ROLES,

  // Laporan keuangan
  "/admin/analitik": FINANCE_ROLES,
  "/admin/laporan": FINANCE_ROLES,
  "/admin/laporan-rat": FINANCE_ROLES,
  "/admin/laporan-sak": FINANCE_ROLES,
  "/admin/rapb": FINANCE_ROLES,

  // Operasional
  "/admin/pengaturan": LEADER_ROLES,
  "/admin/berita": LEADER_ROLES,
  "/admin/audit": LEADER_ROLES,
  "/admin/aktivitas": LEADER_ROLES,
  "/admin/backup": LEADER_ROLES,
  "/admin/role": SUPER_ADMIN_ROLES,
  "/admin/aset": FINANCE_ROLES,
  "/admin/opex": FINANCE_ROLES,
  "/admin/lowongan": SECRETARY_ROLES,
  "/admin/notifikasi-wa": SECRETARY_ROLES,
  "/admin/support": SECRETARY_ROLES,
  "/admin/surat": SECRETARY_ROLES,
  "/admin/survei": SECRETARY_ROLES,
  "/admin/voting": SECRETARY_ROLES,
  "/admin/gereja/pengadaan": LEADER_ROLES,
  "/admin/sekolah/pengadaan": LEADER_ROLES,
};

/** Role yang boleh untuk sebuah path admin (exact, lalu longest-prefix). */
export function rolesForAdminPath(pathname: string): AppRole[] {
  if (ADMIN_ACCESS[pathname]) return ADMIN_ACCESS[pathname];
  const keys = Object.keys(ADMIN_ACCESS)
    .filter((k) => k !== "/admin")
    .sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (pathname === k || pathname.startsWith(k + "/")) return ADMIN_ACCESS[k];
  }
  // Default: setiap path /admin/* tak terdaftar hanya untuk pimpinan
  return LEADER_ROLES;
}

/** Apakah daftar role user boleh mengakses path admin. */
export function canAccessAdminPath(roles: AppRole[], pathname: string): boolean {
  if (!roles.length) return false;
  const allowed = rolesForAdminPath(pathname);
  return roles.some((r) => allowed.includes(r));
}

/** Apakah user termasuk pimpinan (ketua / super_admin). */
export function isLeaderRoles(roles: AppRole[]): boolean {
  return roles.some((r) => LEADER_ROLES.includes(r));
}