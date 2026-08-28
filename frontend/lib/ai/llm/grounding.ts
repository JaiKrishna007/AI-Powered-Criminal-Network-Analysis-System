import { GroundedContext } from '../rag/hybrid_retrieval.js';

export interface GroundingValidationResult {
  isGrounded: boolean;
  sanitizedAnswer: string;
  validatedEvidenceIds: string[];
  limitations: string[];
}

export class GroundingValidator {
  /**
   * Validates that material claims (evidence IDs, entities, amounts, dates, relationships) in the raw LLM output
   * strictly correspond to actually retrieved context.
   */
  public validate(llmOutput: string, context: GroundedContext): GroundingValidationResult {
    const rawTrimmed = llmOutput.trim();

    // 1. Check if context is empty or LLM explicitly returned INSUFFICIENT_EVIDENCE
    if (
      !context.formatted_context_text ||
      (context.evidence.length === 0 && context.relationships.length === 0 && context.entities.length === 0)
    ) {
      return {
        isGrounded: false,
        sanitizedAnswer: 'INSUFFICIENT_EVIDENCE',
        validatedEvidenceIds: [],
        limitations: ['No supporting evidence or relationships retrieved within authorized scope.'],
      };
    }

    if (rawTrimmed.toUpperCase().includes('INSUFFICIENT_EVIDENCE')) {
      return {
        isGrounded: true,
        sanitizedAnswer: 'INSUFFICIENT_EVIDENCE',
        validatedEvidenceIds: [],
        limitations: ['Retrieved context is insufficient to answer the investigator question.'],
      };
    }

    const limitations: string[] = [];

    // 2. Validate Evidence ID References in output
    const referencedEvMatches = rawTrimmed.match(/(?:ev_\w+|evidence_\w+)/gi) || [];
    const validatedEvidenceIds: string[] = [];

    for (const match of referencedEvMatches) {
      const normalizedId = match.toLowerCase();
      const matchFound = context.evidence.find(
        (e) => e.id.toLowerCase() === normalizedId || normalizedId.includes(e.id.toLowerCase())
      );
      if (matchFound) {
        if (!validatedEvidenceIds.includes(matchFound.id)) {
          validatedEvidenceIds.push(matchFound.id);
        }
      } else {
        limitations.push(`Unverified evidence reference in answer: ${match}`);
      }
    }

    // If answer contains no explicit ev_ refs, populate with retrieved evidence IDs if valid
    if (validatedEvidenceIds.length === 0 && context.evidence.length > 0) {
      context.evidence.forEach((e) => validatedEvidenceIds.push(e.id));
    }

    // 3. Validate Entity References in output
    const referencedEntities = rawTrimmed.match(/ent_\w+/gi) || [];
    const validEntityIds = new Set<string>(context.entities.map((e) => e.id.toLowerCase()));
    context.evidence.forEach((e) => {
      if (e.entity_ids) e.entity_ids.forEach((id) => validEntityIds.add(id.toLowerCase()));
    });
    context.relationships.forEach((r) => {
      validEntityIds.add(r.source_entity_id.toLowerCase());
      validEntityIds.add(r.target_entity_id.toLowerCase());
    });

    for (const entRef of referencedEntities) {
      if (!validEntityIds.has(entRef.toLowerCase())) {
        limitations.push(`Unverified entity claim in answer: ${entRef}`);
      }
    }

    // 4. Validate Numerical / Financial Amounts in output
    const outputAmounts = (rawTrimmed.match(/\$?(\d{1,3}(?:,\d{3})+|\d{4,})/g) || []).map((a: string) =>
      parseFloat(a.replace(/[\$,]/g, ''))
    );

    const validAmounts = new Set<number>();
    for (const rel of context.relationships) {
      if (rel.attributes?.amount !== undefined) validAmounts.add(rel.attributes.amount);
    }
    for (const ev of context.evidence) {
      const evAmounts = (ev.content.match(/\$?(\d{1,3}(?:,\d{3})+|\d{4,})/g) || []).map((a: string) =>
        parseFloat(a.replace(/[\$,]/g, ''))
      );
      evAmounts.forEach((amt: number) => validAmounts.add(amt));
    }

    for (const amt of outputAmounts) {
      if (validAmounts.size > 0 && !validAmounts.has(amt)) {
        limitations.push(`Unverified numerical amount $${amt} in answer not present in retrieved context.`);
      }
    }

    // 5. Validate Dates in output against retrieved context dates
    const outputDates = rawTrimmed.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
    const validDates = new Set<string>();
    for (const ev of context.evidence) {
      if (ev.date) validDates.add(ev.date);
    }
    for (const rel of context.relationships) {
      const d = rel.created_at?.slice(0, 10) || rel.attributes?.date;
      if (d) validDates.add(d);
    }

    for (const d of outputDates) {
      if (validDates.size > 0 && !validDates.has(d)) {
        limitations.push(`Unverified date claim ${d} in answer not present in retrieved context.`);
      }
    }

    // 6. Strict Grounding Judgment
    // Answer is grounded only if all material claims (evidence IDs, entities, amounts, dates) are verified.
    const isGrounded = limitations.length === 0;

    return {
      isGrounded,
      sanitizedAnswer: isGrounded ? rawTrimmed : 'INSUFFICIENT_EVIDENCE',
      validatedEvidenceIds: isGrounded ? validatedEvidenceIds : [],
      limitations: limitations.length > 0 ? limitations : ['Answer strictly grounded in retrieved evidence.'],
    };
  }
}
