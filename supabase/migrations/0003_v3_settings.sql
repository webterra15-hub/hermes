-- edumanager V3 — Verrouillage automatique + coefficients par cycle + date de période
-- À exécuter dans l'éditeur SQL de Supabase : Dashboard → SQL Editor → New query

-- Verrouillage automatique : délai (jours) après lequel une évaluation/période
-- datée se verrouille pour les professeurs (0 = désactivé). Stocké dans `settings`.
alter table periods add column if not exists date date;

-- Coefficients par cycle (surcharges : classe > cycle > établissement)
create table if not exists cycle_subjects (
  id bigserial primary key,
  cycle_id bigint not null references cycles(id) on delete cascade,
  subject_id bigint not null references subjects(id) on delete cascade,
  coefficient integer,
  unique (cycle_id, subject_id)
);

create index if not exists idx_cycle_subjects_cycle on cycle_subjects(cycle_id);
