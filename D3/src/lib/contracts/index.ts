// Canonical Contracts Frozen for SIH Prototype
// These objects must be used across all components.

export interface EntityV1 {
  id: string; // e.g. "P001"
  type: "PERSON" | "PHONE" | "IMEI" | "ACCOUNT" | "VEHICLE" | "LOCATION" | "ORGANIZATION" | "EVENT";
  canonical_name: string;
  aliases: string[];
  confidence: number;
}

export interface RelV1 {
  id: string; // e.g. "REL001"
  source: string; // Entity ID
  type: "CALLED" | "TRANSFERRED_MONEY" | "USED" | "OWNED" | "VISITED" | "MET_AT" | "TRAVELED_WITH" | "LINKED_TO" | "ASSOCIATED_WITH" | "PART_OF_CASE";
  target: string; // Entity ID
  valid_from?: string; // ISO DateTime
  valid_to?: string; // ISO DateTime
  confidence: number;
  evidence_ids: string[];
}

export interface EvidenceV1 {
  id: string; // DB ObjectId string
  case_id: string;
  source_type: "PDF" | "CSV" | "JSON" | "TXT" | "CDR";
  source_ref: string;
  sha256: string;
  classification: "PUBLIC_DEMO" | "CASE_RESTRICTED" | "SENSITIVE" | "SECRET";
}

export interface InsightV1 {
  id: string; // e.g. "INS-001"
  type: "POTENTIAL_BRIDGE" | "ANOMALY" | "TEMPORAL_CHANGE";
  entity_id: string; // or relationship_id depending on context
  confidence: number;
  reasons: string[];
  evidence_ids: string[];
}
