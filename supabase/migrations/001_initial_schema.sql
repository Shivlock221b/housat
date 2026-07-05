create extension if not exists "pgcrypto";

create table if not exists rental_tickets (
  id uuid primary key default gen_random_uuid(),
  public_token text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  status text default 'new',
  original_prompt text not null,
  user_name text,
  phone text not null,
  email text,
  city text,
  preferred_localities text[] default '{}',
  budget_min integer,
  budget_max integer,
  bhk text,
  furnishing text,
  move_in_date date,
  tenant_type text,
  brokerage_preference text,
  visit_availability text,
  parking_required boolean,
  pets_required boolean,
  must_haves text[] default '{}',
  nice_to_haves text[] default '{}',
  deal_breakers text[] default '{}',
  notes text,
  parsed_requirements jsonb,
  clarifying_questions text[] default '{}',
  subjective_preferences jsonb,
  parse_confidence numeric,
  shortlist_ready boolean default false
);

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  source text,
  source_url text,
  title text,
  description text,
  city text,
  locality text,
  address_hint text,
  rent integer,
  maintenance integer,
  deposit text,
  brokerage text,
  bhk text,
  furnishing text,
  carpet_area text,
  floor text,
  total_floors text,
  parking text,
  available_from text,
  tenant_allowed text,
  pets_allowed text,
  property_type text,
  photos text[] default '{}',
  video_url text,
  contact_name text,
  contact_phone text,
  contact_type text,
  verification_status text default 'unverified',
  availability_status text default 'unknown',
  global_status text default 'active',
  verified_notes text,
  spaciousness_score integer,
  sunlight_score integer,
  maintenance_condition_score integer,
  general_quality_score integer,
  pros text[] default '{}',
  cons text[] default '{}',
  missing_info text[] default '{}',
  admin_notes text,
  search_document text,
  vision_analysis jsonb,
  vision_confidence numeric,
  is_global_inventory boolean default true,
  is_published boolean default false,
  last_verified_at timestamptz,
  raw_import jsonb
);

create table if not exists ticket_properties (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references rental_tickets(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  created_at timestamptz default now(),
  source text default 'admin_upload',
  is_published boolean default false,
  admin_status text default 'draft',
  unique(ticket_id, property_id)
);

create table if not exists ticket_property_candidates (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references rental_tickets(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  created_at timestamptz default now(),
  source text default 'existing_database',
  deterministic_score integer,
  match_score integer,
  recommendation text,
  hard_filter_status text,
  matched_requirements text[] default '{}',
  missing_information text[] default '{}',
  risks text[] default '{}',
  pros text[] default '{}',
  cons text[] default '{}',
  verification_questions text[] default '{}',
  subjective_assessments jsonb,
  ai_score_details jsonb,
  admin_status text default 'suggested',
  is_published boolean default false,
  unique(ticket_id, property_id)
);

create table if not exists property_actions (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references rental_tickets(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  created_at timestamptz default now(),
  action text not null,
  notes text,
  metadata jsonb
);

create table if not exists admin_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references rental_tickets(id) on delete cascade,
  created_at timestamptz default now(),
  note text not null
);

create index if not exists properties_city_idx on properties(city);
create index if not exists properties_bhk_idx on properties(bhk);
create index if not exists properties_rent_idx on properties(rent);
create index if not exists candidates_ticket_idx on ticket_property_candidates(ticket_id);
create index if not exists actions_ticket_idx on property_actions(ticket_id);

alter table rental_tickets enable row level security;
alter table properties enable row level security;
alter table ticket_properties enable row level security;
alter table ticket_property_candidates enable row level security;
alter table property_actions enable row level security;
alter table admin_notes enable row level security;
