
-- ============================================================
-- MODUL 2.1: notification log
-- ============================================================
create type notif_channel as enum ('whatsapp','push','email','inapp');
create type notif_send_status as enum ('queued','sent','failed','skipped');

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  channel notif_channel not null,
  template text not null,
  target_user uuid,
  target_address text,
  payload jsonb,
  status notif_send_status not null default 'queued',
  error_message text,
  ref_table text,
  ref_id uuid,
  dedup_key text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notif_log_user on public.notification_log(target_user);
create index idx_notif_log_dedup on public.notification_log(dedup_key) where dedup_key is not null;
create index idx_notif_log_created on public.notification_log(created_at desc);

alter table public.notification_log enable row level security;
create policy "notif_log pengurus all" on public.notification_log
  for all to authenticated using (is_pengurus(auth.uid())) with check (is_pengurus(auth.uid()));
create policy "notif_log view own" on public.notification_log
  for select to authenticated using (target_user = auth.uid());

-- ============================================================
-- MODUL 2.2: pending iuran (tagihan auto-debet gagal)
-- ============================================================
create type pending_iuran_status as enum ('unpaid','paid','waived');

create table public.pending_iuran (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  periode date not null,
  jenis text not null default 'wajib',
  nominal numeric(15,2) not null,
  status pending_iuran_status not null default 'unpaid',
  catatan text,
  paid_at timestamptz,
  paid_simpanan_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, periode, jenis)
);
create index idx_pending_iuran_user on public.pending_iuran(user_id, status);

alter table public.pending_iuran enable row level security;
create policy "pending_iuran pengurus all" on public.pending_iuran
  for all to authenticated using (is_pengurus(auth.uid())) with check (is_pengurus(auth.uid()));
create policy "pending_iuran view own" on public.pending_iuran
  for select to authenticated using (auth.uid() = user_id);

create trigger pending_iuran_updated_at before update on public.pending_iuran
  for each row execute function set_updated_at();

-- ============================================================
-- MODUL 2.3: dana cadangan & sosial
-- ============================================================
create type reserve_fund_jenis as enum ('cadangan','sosial','pendidikan','pengembangan');
create type reserve_movement_tipe as enum ('setor','tarik');

create table public.reserve_funds (
  id uuid primary key default gen_random_uuid(),
  jenis reserve_fund_jenis not null unique,
  nama text not null,
  deskripsi text,
  saldo numeric(15,2) not null default 0,
  persen_dari_shu numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reserve_fund_movements (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.reserve_funds(id) on delete cascade,
  tipe reserve_movement_tipe not null,
  nominal numeric(15,2) not null check (nominal > 0),
  sumber text not null default 'manual',
  ref_table text,
  ref_id uuid,
  catatan text,
  tanggal date not null default current_date,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index idx_rfm_fund on public.reserve_fund_movements(fund_id, tanggal desc);

alter table public.reserve_funds enable row level security;
alter table public.reserve_fund_movements enable row level security;

create policy "rf pengurus all" on public.reserve_funds
  for all to authenticated using (is_pengurus(auth.uid())) with check (is_pengurus(auth.uid()));
create policy "rf read auth" on public.reserve_funds
  for select to authenticated using (true);

create policy "rfm pengurus all" on public.reserve_fund_movements
  for all to authenticated using (is_pengurus(auth.uid())) with check (is_pengurus(auth.uid()));

create trigger reserve_funds_updated_at before update on public.reserve_funds
  for each row execute function set_updated_at();

-- Trigger untuk auto-update saldo
create or replace function public.apply_reserve_movement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'INSERT') then
    update public.reserve_funds
      set saldo = saldo + case when NEW.tipe = 'setor' then NEW.nominal else -NEW.nominal end
      where id = NEW.fund_id;
  elsif (TG_OP = 'DELETE') then
    update public.reserve_funds
      set saldo = saldo - case when OLD.tipe = 'setor' then OLD.nominal else -OLD.nominal end
      where id = OLD.fund_id;
  end if;
  return coalesce(NEW, OLD);
end $$;

create trigger trg_apply_reserve_movement
  after insert or delete on public.reserve_fund_movements
  for each row execute function public.apply_reserve_movement();

-- Seed 3 dana default
insert into public.reserve_funds (jenis, nama, deskripsi, persen_dari_shu) values
  ('cadangan','Dana Cadangan','Cadangan umum koperasi sesuai UU',25),
  ('sosial','Dana Sosial','Bantuan sosial untuk anggota & masyarakat',5),
  ('pendidikan','Dana Pendidikan','Pelatihan & pengembangan anggota',5)
on conflict (jenis) do nothing;

-- ============================================================
-- MODUL 3.1: support tickets
-- ============================================================
create type ticket_status as enum ('open','in_progress','resolved','closed');
create type ticket_priority as enum ('low','medium','high','urgent');
create type ticket_kategori as enum ('umum','pinjaman','simpanan','marketplace','teknis','komplain');

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  subjek text not null,
  kategori ticket_kategori not null default 'umum',
  prioritas ticket_priority not null default 'medium',
  status ticket_status not null default 'open',
  assigned_to uuid,
  last_message_at timestamptz not null default now(),
  unread_for_user boolean not null default false,
  unread_for_admin boolean not null default true,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tickets_user on public.support_tickets(user_id, status);
create index idx_tickets_status on public.support_tickets(status, last_message_at desc);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null,
  is_pengurus boolean not null default false,
  body text not null,
  attachments jsonb,
  created_at timestamptz not null default now()
);
create index idx_smsg_ticket on public.support_messages(ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

create policy "tickets view own or pengurus" on public.support_tickets
  for select to authenticated using (auth.uid() = user_id or is_pengurus(auth.uid()));
create policy "tickets insert own" on public.support_tickets
  for insert to authenticated with check (auth.uid() = user_id);
create policy "tickets update own or pengurus" on public.support_tickets
  for update to authenticated using (auth.uid() = user_id or is_pengurus(auth.uid()));

create policy "smsg view via ticket" on public.support_messages
  for select to authenticated using (
    exists (select 1 from public.support_tickets t
      where t.id = ticket_id and (t.user_id = auth.uid() or is_pengurus(auth.uid())))
  );
create policy "smsg insert via ticket" on public.support_messages
  for insert to authenticated with check (
    sender_id = auth.uid() and
    exists (select 1 from public.support_tickets t
      where t.id = ticket_id and (t.user_id = auth.uid() or is_pengurus(auth.uid())))
  );

create trigger support_tickets_updated_at before update on public.support_tickets
  for each row execute function set_updated_at();

-- Trigger update last_message_at + unread flags
create or replace function public.touch_ticket_on_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.support_tickets
    set last_message_at = NEW.created_at,
        unread_for_user = case when NEW.is_pengurus then true else unread_for_user end,
        unread_for_admin = case when NEW.is_pengurus then unread_for_admin else true end,
        status = case when status = 'closed' then 'open' else status end
    where id = NEW.ticket_id;
  return NEW;
end $$;

create trigger trg_touch_ticket
  after insert on public.support_messages
  for each row execute function public.touch_ticket_on_message();

-- Realtime
alter publication supabase_realtime add table public.support_messages;
alter publication supabase_realtime add table public.support_tickets;

-- ============================================================
-- MODUL 3.4: survei kepuasan
-- ============================================================
create type survey_status as enum ('draft','active','closed');
create type survey_q_tipe as enum ('rating_5','skala_10','pilihan','multi','teks');
create type survey_target as enum ('semua','anggota','pengurus');

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  deskripsi text,
  target survey_target not null default 'semua',
  status survey_status not null default 'draft',
  mulai timestamptz,
  selesai timestamptz,
  anonim boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  urutan integer not null default 1,
  tipe survey_q_tipe not null,
  pertanyaan text not null,
  opsi jsonb,
  wajib boolean not null default true
);
create index idx_sq_survey on public.survey_questions(survey_id, urutan);

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  user_id uuid,
  jawaban jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (survey_id, user_id)
);
create index idx_sr_survey on public.survey_responses(survey_id);

alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;

create policy "surveys pengurus all" on public.surveys
  for all to authenticated using (is_pengurus(auth.uid())) with check (is_pengurus(auth.uid()));
create policy "surveys read active" on public.surveys
  for select to authenticated using (status = 'active' or is_pengurus(auth.uid()));

create policy "sq pengurus all" on public.survey_questions
  for all to authenticated using (is_pengurus(auth.uid())) with check (is_pengurus(auth.uid()));
create policy "sq read via survey" on public.survey_questions
  for select to authenticated using (
    exists (select 1 from public.surveys s where s.id = survey_id and (s.status = 'active' or is_pengurus(auth.uid())))
  );

create policy "sr insert own" on public.survey_responses
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.surveys s where s.id = survey_id and s.status = 'active')
  );
create policy "sr view own or pengurus" on public.survey_responses
  for select to authenticated using (user_id = auth.uid() or is_pengurus(auth.uid()));

create trigger surveys_updated_at before update on public.surveys
  for each row execute function set_updated_at();

-- ============================================================
-- RPC: auto-debet simpanan wajib
-- ============================================================
create or replace function public.auto_debet_simpanan_wajib(_periode date default null)
returns table(
  total_anggota integer,
  berhasil integer,
  gagal integer,
  total_terdebit numeric
)
language plpgsql security definer set search_path = public as $$
declare
  v_periode date := coalesce(_periode, date_trunc('month', current_date)::date);
  v_nominal numeric;
  v_setting jsonb;
  v_total integer := 0;
  v_ok integer := 0;
  v_fail integer := 0;
  v_sum numeric := 0;
  r record;
  v_wallet_saldo numeric;
  v_simpanan_id uuid;
begin
  select value into v_setting from public.settings where key = 'iuran_wajib_default';
  v_nominal := coalesce((v_setting->>'nominal')::numeric, 50000);

  for r in
    select p.id as user_id, p.nama_lengkap
    from public.profiles p
    where p.status = 'active'
      and not exists (
        select 1 from public.simpanan s
        where s.user_id = p.id
          and s.jenis = 'wajib'
          and date_trunc('month', s.created_at) = v_periode
          and s.status in ('pending','approved')
      )
      and not exists (
        select 1 from public.pending_iuran pi
        where pi.user_id = p.id and pi.periode = v_periode and pi.jenis = 'wajib'
      )
  loop
    v_total := v_total + 1;
    select saldo into v_wallet_saldo from public.wallets where user_id = r.user_id;

    if v_wallet_saldo is not null and v_wallet_saldo >= v_nominal then
      -- Potong saldo
      update public.wallets set saldo = saldo - v_nominal where user_id = r.user_id;
      -- Catat simpanan
      insert into public.simpanan (user_id, jenis, nominal, status, catatan, created_by)
        values (r.user_id, 'wajib', v_nominal, 'approved', 'Auto-debet ' || to_char(v_periode,'YYYY-MM'), null)
        returning id into v_simpanan_id;
      v_ok := v_ok + 1;
      v_sum := v_sum + v_nominal;

      insert into public.notification_log (channel, template, target_user, status, ref_table, ref_id, dedup_key, sent_at, payload)
      values ('inapp', 'simpanan_wajib_terdebit', r.user_id, 'sent', 'simpanan', v_simpanan_id,
              'auto_debet_'||r.user_id||'_'||v_periode, now(),
              jsonb_build_object('nominal', v_nominal, 'periode', v_periode));

      insert into public.notifications (user_id, judul, pesan, kategori, ref_table, ref_id, url)
      values (r.user_id, 'Simpanan wajib terdebit',
              'Saldo Anda terdebet Rp '||to_char(v_nominal,'FM999G999G999')||' untuk simpanan wajib '||to_char(v_periode,'YYYY-MM'),
              'info', 'simpanan', v_simpanan_id, '/simpanan');
    else
      -- Buat tagihan tertunggak
      insert into public.pending_iuran (user_id, periode, jenis, nominal, catatan)
        values (r.user_id, v_periode, 'wajib', v_nominal,
          'Saldo tidak mencukupi saat auto-debet ' || to_char(v_periode,'YYYY-MM'))
        on conflict do nothing;
      v_fail := v_fail + 1;

      insert into public.notification_log (channel, template, target_user, status, ref_table, dedup_key, sent_at, payload)
      values ('inapp', 'simpanan_wajib_gagal', r.user_id, 'sent', 'pending_iuran',
              'auto_debet_fail_'||r.user_id||'_'||v_periode, now(),
              jsonb_build_object('nominal', v_nominal, 'periode', v_periode));

      insert into public.notifications (user_id, judul, pesan, kategori, url)
      values (r.user_id, 'Simpanan wajib belum terbayar',
              'Saldo dompet tidak cukup untuk auto-debet simpanan wajib '||to_char(v_periode,'YYYY-MM')||
              '. Mohon top-up saldo Rp '||to_char(v_nominal,'FM999G999G999'),
              'peringatan', '/simpanan');
    end if;
  end loop;

  return query select v_total, v_ok, v_fail, v_sum;
end $$;

grant execute on function public.auto_debet_simpanan_wajib(date) to authenticated;

-- Pastikan setting default iuran wajib ada
insert into public.settings (key, value, description, is_public)
values ('iuran_wajib_default', '{"nominal": 50000}'::jsonb, 'Nominal default simpanan wajib bulanan', true)
on conflict (key) do nothing;
