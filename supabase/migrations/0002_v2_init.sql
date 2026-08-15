-- edumanager V2 — Schéma complémentaire Supabase (PostgreSQL)
-- À exécuter dans l'éditeur SQL de Supabase : Dashboard → SQL Editor → New query

-- Cycles / groupes de classes
create table if not exists cycles (
  id bigserial primary key,
  name text not null,
  sort_order integer not null default 0
);

alter table classes add column if not exists cycle_id bigint references cycles(id) on delete set null;
alter table classes add column if not exists archived boolean not null default false;
alter table students add column if not exists archived boolean not null default false;

-- Catégorie de frais sur les paiements de scolarité (scolarite, inscription, transport, autres)
alter table tuition_payments add column if not exists category text not null default 'scolarite';

-- Coefficient par classe (surcharge du coefficient global d'une matière)
alter table class_subjects add column if not exists coefficient integer;

-- Périodes : groupe (T1/T2/T3 pour compiler les séquences en trimestres) + verrouillage
alter table periods add column if not exists group_name text default '';
alter table periods add column if not exists locked boolean not null default false;

-- Moratoires (dérogation de paiement accordée à un élève)
create table if not exists moratoires (
  id bigserial primary key,
  enrollment_id bigint not null references enrollments(id) on delete cascade,
  reason text not null default '',
  start_date date not null default current_date,
  end_date date,
  note text default '',
  created_by bigint references users(id) on delete set null,
  created_at timestamptz default now()
);

-- Affectation : enseignant → matière dans une classe
create table if not exists teacher_subjects (
  id bigserial primary key,
  class_id bigint not null references classes(id) on delete cascade,
  subject_id bigint not null references subjects(id) on delete cascade,
  teacher_user_id bigint not null references users(id) on delete cascade,
  unique (class_id, subject_id)
);

-- Évaluations
create table if not exists evaluations (
  id bigserial primary key,
  name text not null,
  subject_id bigint not null references subjects(id) on delete cascade,
  class_id bigint not null references classes(id) on delete cascade,
  period_id bigint not null references periods(id) on delete cascade,
  date date,
  locked boolean not null default false,
  created_by bigint references users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_eval_class on evaluations(class_id);
create index if not exists idx_eval_period on evaluations(period_id);

-- Notes : rattachement optionnel à une évaluation
alter table grades add column if not exists evaluation_id bigint references evaluations(id) on delete cascade;

-- Appréciations par élève et période
create table if not exists appreciations (
  id bigserial primary key,
  enrollment_id bigint not null references enrollments(id) on delete cascade,
  period_id bigint not null references periods(id) on delete cascade,
  text text not null default '',
  unique (enrollment_id, period_id)
);

-- Observations générales d'une classe pour une période
create table if not exists class_observations (
  id bigserial primary key,
  class_id bigint not null references classes(id) on delete cascade,
  period_id bigint not null references periods(id) on delete cascade,
  text text not null default '',
  unique (class_id, period_id)
);

-- Sécurité : RLS activé sur les nouvelles tables
alter table cycles enable row level security;
alter table moratoires enable row level security;
alter table teacher_subjects enable row level security;
alter table evaluations enable row level security;
alter table appreciations enable row level security;
alter table class_observations enable row level security;
