-- edumanager — Schéma Supabase (PostgreSQL)
-- À exécuter dans l'éditeur SQL de Supabase : Dashboard → SQL Editor → New query

create table if not exists school (
  id integer primary key check (id = 1),
  name text not null,
  type text not null default 'primaire',
  address text default '',
  phone text default '',
  email text default '',
  currency text not null default 'FCFA',
  logo_path text default null,
  motto text default '',
  created_at timestamptz default now()
);

create table if not exists settings (
  key text primary key,
  value text
);

create table if not exists academic_years (
  id bigserial primary key,
  label text not null,
  is_active boolean not null default false
);

create table if not exists users (
  id bigserial primary key,
  username text not null unique,
  password_hash text not null,
  full_name text not null,
  role text not null check (role in ('admin','secretaire','professeur')),
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists levels (
  id bigserial primary key,
  name text not null,
  sort_order integer not null default 0
);

create table if not exists subjects (
  id bigserial primary key,
  name text not null,
  coefficient integer not null default 1
);

create table if not exists classes (
  id bigserial primary key,
  level_id bigint not null references levels(id) on delete cascade,
  academic_year_id bigint not null references academic_years(id) on delete cascade,
  name text not null,
  tuition_fee integer not null default 0,
  teacher_user_id bigint references users(id) on delete set null
);

create table if not exists class_subjects (
  id bigserial primary key,
  class_id bigint not null references classes(id) on delete cascade,
  subject_id bigint not null references subjects(id) on delete cascade
);

create table if not exists students (
  id bigserial primary key,
  first_name text not null,
  last_name text not null,
  gender text not null default 'M',
  birth_date text default '',
  birth_place text default '',
  parent_name text default '',
  parent_phone text default '',
  parent_email text default '',
  address text default '',
  created_at timestamptz default now()
);

create table if not exists enrollments (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  class_id bigint not null references classes(id) on delete cascade,
  academic_year_id bigint not null references academic_years(id) on delete cascade,
  enrollment_date date not null default current_date,
  is_reenrollment boolean not null default false,
  status text not null default 'actif'
);

create table if not exists tuition_payments (
  id bigserial primary key,
  enrollment_id bigint not null references enrollments(id) on delete cascade,
  amount integer not null,
  payment_date date not null default current_date,
  method text not null default 'especes',
  receipt_number text not null unique,
  note text default '',
  recorded_by bigint references users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists transactions (
  id bigserial primary key,
  type text not null check (type in ('entree','sortie')),
  category text not null default '',
  label text not null,
  amount integer not null,
  transaction_date date not null default current_date,
  invoice_number text not null unique,
  description text default '',
  recorded_by bigint references users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists periods (
  id bigserial primary key,
  academic_year_id bigint not null references academic_years(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);

create table if not exists grades (
  id bigserial primary key,
  enrollment_id bigint not null references enrollments(id) on delete cascade,
  subject_id bigint not null references subjects(id) on delete cascade,
  period_id bigint not null references periods(id) on delete cascade,
  value numeric not null,
  unique (enrollment_id, subject_id, period_id)
);

create index if not exists idx_enroll_year on enrollments(academic_year_id);
create index if not exists idx_payments_enroll on tuition_payments(enrollment_id);
create index if not exists idx_tx_date on transactions(transaction_date);

-- Données initiales
insert into school (id, name, type, currency)
values (1, 'Mon Établissement', 'primaire', 'FCFA')
on conflict (id) do nothing;

insert into users (username, password_hash, full_name, role)
values ('admin', '$2a$10$AXOBRzJ.MYj.UqOTLTIkQ.eKoNBQhp14QDi9JvVu/UKg73Sf/cGRi', 'Administrateur', 'admin')
on conflict (username) do nothing;

insert into academic_years (label, is_active)
select to_char(current_date, 'YYYY') || '-' || to_char(current_date + interval '1 year', 'YYYY'), true
where not exists (select 1 from academic_years);

-- Compteurs de numérotation des documents
create table if not exists counters (
  name text primary key,
  last_value integer not null default 0
);

insert into counters (name, last_value) values
  ('receipt', 0),
  ('entree', 0),
  ('sortie', 0)
on conflict (name) do nothing;

create or replace function next_counter(counter_name text)
returns integer
language plpgsql
security definer
as $$
declare
  next_value integer;
begin
  insert into counters (name, last_value) values (counter_name, 0)
  on conflict (name) do nothing;
  update counters set last_value = last_value + 1
  where name = counter_name
  returning last_value into next_value;
  return next_value;
end;
$$;

grant execute on function next_counter(text) to authenticated;
grant execute on function next_counter(text) to anon;

-- Sécurité : RLS activé sur toutes les tables (le service role du backend les contourne)
alter table school enable row level security;
alter table academic_years enable row level security;
alter table users enable row level security;
alter table levels enable row level security;
alter table subjects enable row level security;
alter table classes enable row level security;
alter table class_subjects enable row level security;
alter table students enable row level security;
alter table enrollments enable row level security;
alter table tuition_payments enable row level security;
alter table transactions enable row level security;
alter table periods enable row level security;
alter table grades enable row level security;
alter table counters enable row level security;

-- Bucket de stockage pour les logos (public)
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "logos_public_read" on storage.objects
for select using (bucket_id = 'logos');

