// Mirrors the Pydantic models in backend/app/models.py and backend/app/api.py.

export type LocalizedText = { en: string; hi: string };

export type FieldKind = "bool" | "int" | "enum" | "str";
export type ProfileValue = boolean | number | string;
export type Profile = Partial<Record<string, ProfileValue>>;

export type FieldOption = { value: string; label: LocalizedText };

export type FieldMeta = {
  field: string;
  kind: FieldKind;
  label: LocalizedText;
  question: LocalizedText;
  hint: LocalizedText | null;
  options: FieldOption[];
  min: number | null;
  max: number | null;
  unit: "inr" | "years" | null;
};

export type Op = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "not_in";

export type Rule = {
  id: string;
  field: string;
  op: Op;
  value: unknown;
  description: string;
  description_hi: string;
  clause: string;
  source_url: string | null;
  group: string | null;
};

export type Kind =
  | "scholarship"
  | "internship"
  | "apprenticeship"
  | "skill_training"
  | "education_loan"
  | "business_loan"
  | "startup_funding"
  | "income_support"
  | "pension"
  | "insurance"
  | "health_cover"
  | "savings"
  | "housing"
  | "household"
  | "maternity";

export type KindInfo = { kind: Kind; label: LocalizedText };

export type Topic = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  icon: string;
  scheme_count: number;
  kinds: (KindInfo & { count: number })[];
};

export type Scheme = {
  id: string;
  name: string;
  name_hi: string;
  level: "central" | "state";
  ministry: string;
  ministry_hi: string | null;
  topics: string[];
  kind: Kind;
  benefit: LocalizedText;
  documents: LocalizedText[];
  notes: LocalizedText | null;
  source_url: string;
  rules: Rule[];
  verified: boolean;
  last_verified: string | null;
};

export type SchemeStatus = "eligible" | "needs_info" | "not_eligible";
export type RuleOutcome = "pass" | "fail" | "unknown";

export type RuleResult = {
  rule_id: string;
  field: string;
  op: Op;
  expected: unknown;
  actual: ProfileValue | null;
  outcome: RuleOutcome;
  description: string;
  description_hi: string;
  clause: string;
  source_url: string;
  group: string | null;
};

export type SchemeResult = {
  scheme_id: string;
  name: string;
  name_hi: string;
  topics: string[];
  kind: Kind;
  status: SchemeStatus;
  rule_results: RuleResult[];
  passed_count: number;
  total_rules: number;
  missing_fields: string[];
  failed_reasons: LocalizedText[];
  benefit: LocalizedText;
  documents: LocalizedText[];
  notes: LocalizedText | null;
  source_url: string;
  verified: boolean;
  last_verified: string | null;
};

export type SchemesResponse = { data_note: string; schemes: Scheme[] };

export type EligibilityRequest = { profile: Profile; skipped: string[]; topic?: string | null };

export type EligibilityResponse = {
  results: SchemeResult[];
  next_fields: string[];
  summary: Record<SchemeStatus, number>;
  data_note: string;
};

// --------------------------------------------------------------------------- chat (backend/app/ai/assistant.py)

export type ChatLanguage = "en" | "hi" | "hinglish";

export type ChatRequest = {
  message: string;
  lang: "en" | "hi";
  topic?: string | null;
  profile: Profile;
  skipped: string[];
  pending_field: string | null;
  history: { role: "user" | "assistant"; text: string }[];
  /** The reply will be spoken aloud (voice mode): asks for a shorter, spoken style. */
  voice?: boolean;
};

export type ChatResponse = {
  reply: string;
  language: ChatLanguage;
  profile: Profile;
  skipped: string[];
  pending_field: string | null;
  understood: { field: string; label: LocalizedText; value: LocalizedText }[];
  decided: { scheme_id: string; name: LocalizedText; status: "eligible" | "not_eligible" }[];
  schemes: string[];
  results: SchemeResult[];
  summary: Record<SchemeStatus, number>;
  ai_mode: "llm" | "basic";
  model: string | null;
};

export type ChatStatus = { ai_mode: "llm" | "basic"; model: string | null };

// --------------------------------------------------------------------------- accounts (backend/app/accounts.py)

export type SavedAnswers = { profile: Profile; skipped: string[]; updated_at: string | null };

export type Me = {
  phone: string | null;
  username: string | null;
  lang: string;
  whatsapp_opt_in: boolean;
  saved: SavedAnswers | null;
};

export type OtpSent = { sent: boolean; channel: string };
