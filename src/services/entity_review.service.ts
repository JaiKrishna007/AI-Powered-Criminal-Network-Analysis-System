import { db } from '../db';
import { EntityReview, ReviewState } from '../models/types';
import { GraphClient } from './graph_client';

export class EntityReviewService {
  /**
   * Records a human review decision for an entity candidate.
   * Review states must strictly be one of: CANDIDATE, ACCEPTED, REJECTED, DEFERRED.
   */
  public static async recordReviewDecision(
    candidateId: string,
    decision: ReviewState,
    reviewerId: string
  ): Promise<EntityReview> {
    if (!['ACCEPTED', 'REJECTED', 'DEFERRED'].includes(decision)) {
      throw new Error(`Invalid entity review state: ${decision}`);
    }

    const reviewRecord: EntityReview = {
      candidate_id: candidateId,
      decision: decision as 'ACCEPTED' | 'REJECTED' | 'DEFERRED',
      reviewer_id: reviewerId,
      decided_at: new Date().toISOString()
    };

    const review = await db.createEntityReview(reviewRecord);

    // 38. Approved entity merge needs explicit downstream synchronization
    if (decision === 'ACCEPTED') {
      const candidate = await db.getCandidate(candidateId);
      if (candidate) {
        try {
          // Assuming D4 accepts POST /entities/sync or similar
          // Contract says: "emit ENTITY resolution event/contract -> Neo4j canonical entity update"
          const context = { user_id: reviewerId, role: 'SYSTEM', case_id: candidate.case_id, access_level: 'ADMIN' };
          await GraphClient.fetchD4('/entities/sync', context, { candidate }, 5000);
        } catch (e: any) {
          console.warn(`Downstream sync for candidate ${candidateId} failed: ${e.message}`);
        }
      }
    }

    return review;
  }

  public static async getReview(candidateId: string): Promise<EntityReview | null> {
    return await db.getEntityReview(candidateId);
  }
}
