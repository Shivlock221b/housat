alter table properties
add column if not exists media_analysis jsonb,
add column if not exists user_facing_summary text,
add column if not exists admin_summary text,
add column if not exists enrichment_details jsonb;

alter table ticket_property_candidates
add column if not exists final_rank integer,
add column if not exists shortlist_bucket text,
add column if not exists final_score integer,
add column if not exists ranking_details jsonb;
