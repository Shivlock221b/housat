alter table properties
  add column if not exists vision_analysis jsonb,
  add column if not exists vision_confidence numeric;
