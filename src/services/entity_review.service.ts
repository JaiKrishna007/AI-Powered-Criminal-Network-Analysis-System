import { db } from '../db';
import { EntityReview, ReviewState } from '../models/types';

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

    return await db.createEntityReview(reviewRecord);
  }

  public static async getReview(candidateId: string): Promise<EntityReview | null> {
    return await db.getEntityReview(candidateId);
  }
}
