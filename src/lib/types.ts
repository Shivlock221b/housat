export type TicketStatus =
  | "new"
  | "matching_existing_inventory"
  | "sourcing"
  | "shortlist_uploaded"
  | "visits_requested"
  | "closed"
  | "abandoned";

export type RentalTicket = {
  id: string;
  public_token: string;
  created_at?: string;
  updated_at?: string;
  status: TicketStatus;
  original_prompt: string;
  user_name?: string | null;
  phone: string;
  email?: string | null;
  city?: string | null;
  preferred_localities?: string[];
  budget_min?: number | null;
  budget_max?: number | null;
  bhk?: string | null;
  furnishing?: string | null;
  move_in_date?: string | null;
  tenant_type?: string | null;
  brokerage_preference?: string | null;
  visit_availability?: string | null;
  parking_required?: boolean | null;
  pets_required?: boolean | null;
  must_haves?: string[];
  nice_to_haves?: string[];
  deal_breakers?: string[];
  notes?: string | null;
  parsed_requirements?: unknown;
  clarifying_questions?: string[];
  subjective_preferences?: unknown;
  parse_confidence?: number | null;
  shortlist_ready?: boolean;
};

export type Property = {
  id: string;
  title?: string | null;
  description?: string | null;
  city?: string | null;
  locality?: string | null;
  address_hint?: string | null;
  rent?: number | null;
  maintenance?: number | null;
  deposit?: string | null;
  brokerage?: string | null;
  bhk?: string | null;
  furnishing?: string | null;
  carpet_area?: string | null;
  floor?: string | null;
  total_floors?: string | null;
  parking?: string | null;
  available_from?: string | null;
  tenant_allowed?: string | null;
  pets_allowed?: string | null;
  property_type?: string | null;
  photos?: string[];
  video_url?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_type?: string | null;
  verification_status?: string | null;
  availability_status?: string | null;
  global_status?: string | null;
  verified_notes?: string | null;
  spaciousness_score?: number | null;
  sunlight_score?: number | null;
  maintenance_condition_score?: number | null;
  general_quality_score?: number | null;
  pros?: string[];
  cons?: string[];
  missing_info?: string[];
  admin_notes?: string | null;
  search_document?: string | null;
  vision_analysis?: unknown;
  vision_confidence?: number | null;
  is_global_inventory?: boolean;
  is_published?: boolean;
  raw_import?: unknown;
};

export type Candidate = {
  id: string;
  ticket_id: string;
  property_id: string;
  source: "existing_database" | "admin_upload" | string;
  deterministic_score?: number | null;
  match_score?: number | null;
  recommendation?: string | null;
  hard_filter_status?: string | null;
  matched_requirements?: string[];
  missing_information?: string[];
  risks?: string[];
  pros?: string[];
  cons?: string[];
  verification_questions?: string[];
  subjective_assessments?: unknown;
  ai_score_details?: unknown;
  admin_status?: string | null;
  is_published?: boolean;
  properties?: Property;
};

export type PropertyAction = {
  id: string;
  ticket_id: string;
  property_id: string;
  action: "rejected" | "maybe" | "interested" | "ask_video" | "request_visit";
  created_at?: string;
  notes?: string | null;
};
