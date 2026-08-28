export const ALLOWLISTED_TOOLS = [
  'search_evidence',
  'get_entity',
  'get_path',
  'get_timeline',
  'get_transactions',
  'get_graph',
] as const;

export type AllowlistedTool = typeof ALLOWLISTED_TOOLS[number];

export type QueryIntentType = 
  | 'SIMILAR_REPORT'
  | 'EXACT_FINANCIAL'
  | 'CONNECTION_PATH'
  | 'WHY_HIGHLIGHTED'
  | 'CASE_SUMMARY'
  | 'GENERAL_INVESTIGATION';

export interface PlannedOperation {
  tool: AllowlistedTool;
  params: Record<string, any>;
}

export interface IntentQueryPlan {
  intent: QueryIntentType;
  case_id: string;
  operations: PlannedOperation[];
  extracted_constraints: {
    start_date?: string;
    end_date?: string;
    target_entity_name?: string;
    min_amount?: number;
    max_amount?: number;
    keywords?: string[];
  };
}

/**
 * Validates whether an operation tool is in the strict allowlist.
 */
export function isAllowlistedTool(tool: string): tool is AllowlistedTool {
  return (ALLOWLISTED_TOOLS as readonly string[]).includes(tool);
}

export class IntentPlanner {
  /**
   * Parses natural language question and generates a validated internal query plan
   * using strictly allowlisted tool operations.
   */
  public planQuery(question: string, caseId: string): IntentQueryPlan {
    const qLower = question.toLowerCase();

    // 1. Extract Date Constraints (e.g. "after 2026-01-01" or "between 2026-01-01 and 2026-06-30")
    const dateMatch = qLower.match(/(\d{4}-\d{2}-\d{2})/g);
    const startDate = dateMatch && dateMatch[0] ? dateMatch[0] : undefined;
    const endDate = dateMatch && dateMatch[1] ? dateMatch[1] : undefined;

    // 2. Extract Amount Constraints (e.g. "$50,000" or "50000 dollars")
    const amountMatch = qLower.match(/\$?(\d{1,3}(?:,\d{3})*|\d+)(?:\s*(?:dollars|usd))?/i);
    const amountVal = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : undefined;

    // 3. Extract Entity ID references (e.g. ent_alpha, ent_gamma)
    const entMatches = question.match(/ent_\w+/g) || [];
    const sourceEnt = entMatches[0];
    const targetEnt = entMatches[1];

    let intent: QueryIntentType = 'GENERAL_INVESTIGATION';
    const operations: PlannedOperation[] = [];

    // 4. Classify intent based on semantic patterns
    if (qLower.includes('connection') || qLower.includes('path') || qLower.includes('link') || qLower.includes('connected to')) {
      intent = 'CONNECTION_PATH';
      operations.push({
        tool: 'get_path',
        params: { source_entity_id: sourceEnt, target_entity_id: targetEnt, question },
      });
      operations.push({
        tool: 'get_graph',
        params: { focus_entity_id: sourceEnt, depth: 2 },
      });
    } else if (qLower.includes('transaction') || qLower.includes('amount') || qLower.includes('dollar') || qLower.includes('transfer') || amountVal !== undefined) {
      intent = 'EXACT_FINANCIAL';
      operations.push({
        tool: 'get_transactions',
        params: { min_amount: amountVal, start_date: startDate, end_date: endDate },
      });
      operations.push({
        tool: 'get_timeline',
        params: { start_date: startDate, end_date: endDate },
      });
    } else if (qLower.includes('why highlighted') || qLower.includes('insight') || qLower.includes('signal') || qLower.includes('flagged')) {
      intent = 'WHY_HIGHLIGHTED';
      operations.push({
        tool: 'search_evidence',
        params: { query: question },
      });
      operations.push({
        tool: 'get_entity',
        params: { question },
      });
    } else if (qLower.includes('summary') || qLower.includes('overview') || qLower.includes('report')) {
      intent = 'CASE_SUMMARY';
      operations.push({
        tool: 'search_evidence',
        params: { query: question },
      });
      operations.push({
        tool: 'get_timeline',
        params: { start_date: startDate, end_date: endDate },
      });
      operations.push({
        tool: 'get_graph',
        params: { depth: 1 },
      });
    } else {
      intent = 'SIMILAR_REPORT';
      operations.push({
        tool: 'search_evidence',
        params: { query: question },
      });
    }

    // 4. Strict Allowlist Validation Guard
    const validatedOperations = operations.filter((op) => {
      if (!isAllowlistedTool(op.tool)) {
        console.warn(`[IntentPlanner] Rejected non-allowlisted tool: ${op.tool}`);
        return false;
      }
      return true;
    });

    return {
      intent,
      case_id: caseId,
      operations: validatedOperations,
      extracted_constraints: {
        start_date: startDate,
        end_date: endDate,
        min_amount: amountVal,
        keywords: question.split(/\s+/).filter((w) => w.length > 3),
      },
    };
  }
}
