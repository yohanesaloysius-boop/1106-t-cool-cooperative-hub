
create type voting_status as enum ('draft','active','closed');

create table public.rat_votings (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  deskripsi text,
  opsi jsonb not null default '[]'::jsonb,
  mulai timestamptz not null default now(),
  selesai timestamptz not null,
  status voting_status not null default 'draft',
  multi_select boolean not null default false,
  kuorum_min int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rat_votes (
  id uuid primary key default gen_random_uuid(),
  voting_id uuid not null references public.rat_votings(id) on delete cascade,
  user_id uuid not null,
  pilihan jsonb not null,
  voted_at timestamptz not null default now(),
  unique (voting_id, user_id)
);

create index idx_rat_votes_voting on public.rat_votes(voting_id);

alter table public.rat_votings enable row level security;
alter table public.rat_votes enable row level security;

create policy "all auth view active/closed votings"
  on public.rat_votings for select to authenticated
  using (status in ('active','closed') or public.is_pengurus(auth.uid()));

create policy "pengurus manage votings"
  on public.rat_votings for all to authenticated
  using (public.is_pengurus(auth.uid()))
  with check (public.is_pengurus(auth.uid()));

create policy "user view own votes; pengurus view all"
  on public.rat_votes for select to authenticated
  using (user_id = auth.uid() or public.is_pengurus(auth.uid()));

create policy "user insert own vote"
  on public.rat_votes for insert to authenticated
  with check (user_id = auth.uid());

create trigger trg_rat_votings_updated
  before update on public.rat_votings
  for each row execute function public.touch_updated_at();

create or replace function public.cast_rat_vote(_voting_id uuid, _pilihan jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.rat_votings%rowtype;
  v_status member_status;
begin
  select * into v from public.rat_votings where id = _voting_id;
  if not found then raise exception 'Voting tidak ditemukan'; end if;
  if v.status <> 'active' then raise exception 'Voting tidak aktif'; end if;
  if now() < v.mulai or now() > v.selesai then raise exception 'Di luar periode voting'; end if;

  select status into v_status from public.profiles where id = auth.uid();
  if v_status <> 'active' then raise exception 'Hanya anggota aktif yang boleh vote'; end if;

  insert into public.rat_votes (voting_id, user_id, pilihan)
    values (_voting_id, auth.uid(), _pilihan);
end $$;

create or replace function public.get_rat_voting_result(_voting_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v public.rat_votings%rowtype;
  v_total int;
  v_result jsonb;
begin
  select * into v from public.rat_votings where id = _voting_id;
  if not found then raise exception 'Voting tidak ditemukan'; end if;
  if v.status = 'active' and not public.is_pengurus(auth.uid()) then
    raise exception 'Hasil tersedia setelah voting ditutup';
  end if;

  select count(*) into v_total from public.rat_votes where voting_id = _voting_id;

  with opt as (
    select jsonb_array_elements_text(v.opsi) as o
  ),
  hitung as (
    select o,
      (select count(*) from public.rat_votes rv
        where rv.voting_id = _voting_id
          and rv.pilihan ? o) as jumlah
    from opt
  )
  select jsonb_agg(jsonb_build_object('opsi', o, 'jumlah', jumlah) order by jumlah desc) into v_result from hitung;

  return jsonb_build_object('total_pemilih', v_total, 'hasil', coalesce(v_result,'[]'::jsonb), 'voting', to_jsonb(v));
end $$;
