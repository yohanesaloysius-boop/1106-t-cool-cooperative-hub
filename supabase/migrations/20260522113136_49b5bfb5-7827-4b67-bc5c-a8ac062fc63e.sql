
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.rat_votings;
alter publication supabase_realtime add table public.rat_votes;
alter table public.notifications replica identity full;
alter table public.rat_votings replica identity full;
alter table public.rat_votes replica identity full;
