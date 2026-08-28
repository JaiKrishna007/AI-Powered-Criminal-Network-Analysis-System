import { EntityV1, RelV1 } from '@/lib/contracts';
import { v4 as uuidv4 } from 'uuid';

/**
 * NLP Extractor Module
 * Simulates NER and Relationship Extraction for the SIH Prototype.
 * In a production scenario, this would invoke a fine-tuned model or external NLP service.
 */

export async function extractEntitiesAndRelationships(text: string, evidenceId: string): Promise<{ entities: EntityV1[], relationships: RelV1[] }> {
  const entities: EntityV1[] = [];
  const relationships: RelV1[] = [];

  // Simple deterministic regex extraction for phones to satisfy T05
  const phoneRegex = /\b(?:\+91|91)?[789]\d{9}\b/g;
  let match;
  while ((match = phoneRegex.exec(text)) !== null) {
    const phoneNumber = match[0];
    entities.push({
      id: `PHONE-${uuidv4()}`,
      type: "PHONE",
      canonical_name: phoneNumber,
      aliases: [],
      confidence: 0.95,
    });
  }

  // Example heuristic rule: "A called B on date X"
  if (text.toLowerCase().includes("called")) {
    if (entities.length >= 2) {
      relationships.push({
        id: `REL-${uuidv4()}`,
        source: entities[0].id,
        target: entities[1].id,
        type: "CALLED",
        confidence: 0.88,
        evidence_ids: [evidenceId],
        valid_from: new Date().toISOString(),
      });
    }
  }

  return { entities, relationships };
}
