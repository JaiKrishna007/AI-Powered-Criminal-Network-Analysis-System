import { db } from '../db';
import { EntityReview, ReviewState, SyncState } from '../models/types';
import { EntityResolutionEventV1, EntityResolutionEventSchema } from '../contracts';
import { GraphClient } from './graph_client';

export class EntityReviewService {
  /**
   * Records a human review decision for an entity candidate.
   * Review states must strictly be one of: CANDIDATE, ACCEPTED, REJECTED, DEFERRED.
   * Uses ENTITY_RESOLUTION.v1 contract and tracks downstream synchronization state.
   */
  public static async recordReviewDecision(
    candidateId: string,
    decision: ReviewState,
    reviewerId: string
  ): Promise<EntityReview> {
    if (!['ACCEPTED', 'REJECTED', 'DEFERRED'].includes(decision)) {
      throw new Error(`Invalid entity review state: ${decision}`);
    }

    let initialSyncState: SyncState | undefined = decision === 'ACCEPTED' ? 'SYNC_PENDING' : undefined;

    const reviewRecord: EntityReview = {
      candidate_id: candidateId,
      decision: decision as 'ACCEPTED' | 'REJECTED' | 'DEFERRED',
      reviewer_id: reviewerId,
      decided_at: new Date().toISOString(),
      sync_state: initialSyncState
    };

    let review = await db.createEntityReview(reviewRecord);

    // Approved entity merge needs explicit downstream synchronization with ENTITY_RESOLUTION.v1
    if (decision === 'ACCEPTED') {
      review = await this.syncResolutionDownstream(candidateId, reviewerId, reviewRecord.decided_at);
    }

    return review;
  }

  /**
   * Dispatches ENTITY_RESOLUTION.v1 contract to D4 (Graph Service)
   * Tracks SYNCED vs SYNC_FAILED state to maintain consistency.
   */
  public static async syncResolutionDownstream(
    candidateId: string,
    reviewerId: string,
    decidedAt?: string
  ): Promise<EntityReview> {
    const candidate = await db.getCandidate(candidateId);
    if (!candidate) {
      throw new Error(`Candidate ${candidateId} not found for synchronization`);
    }

    const resolutionPayload: EntityResolutionEventV1 = {
      candidate_id: candidate.id,
      case_id: candidate.case_id,
      decision: 'ACCEPTED',
      canonical_entity: {
        id: candidate.id.replace('CAND-', 'ENT-'),
        name: candidate.name,
        type: candidate.candidate_data?.type || 'PERSON',
        identifiers: candidate.identifiers || {},
        properties: {
          phone: candidate.normalized_phone || candidate.original_phone,
          score: candidate.score
        },
        created_at: new Date().toISOString()
      },
      reviewer_id: reviewerId,
      decided_at: decidedAt || new Date().toISOString()
    };

    // Validate payload against frozen schema
    const validated = EntityResolutionEventSchema.safeParse(resolutionPayload);
    if (!validated.success) {
      await db.updateEntityReview(candidateId, {
        sync_state: 'SYNC_FAILED',
        sync_error: 'Invalid ENTITY_RESOLUTION.v1 payload schema'
      });
      return (await db.getEntityReview(candidateId))!;
    }

    const context = {
      user_id: reviewerId,
      role: 'INVESTIGATOR',
      case_id: candidate.case_id,
      access_level: 'MEMBER'
    };

    try {
      await GraphClient.fetchD4('/internal/entities/resolve', context, validated.data, 5000);
      await db.updateEntityReview(candidateId, {
        sync_state: 'SYNCED',
        sync_error: null
      });
    } catch (e: any) {
      console.warn(`Downstream sync for candidate ${candidateId} failed: ${e.message}`);
      await db.updateEntityReview(candidateId, {
        sync_state: 'SYNC_FAILED',
        sync_error: e.message || 'Downstream sync failed'
      });
    }

    return (await db.getEntityReview(candidateId))!;
  }

  /**
   * Retries synchronization for failed entity reviews.
   */
  public static async retrySync(candidateId: string, reviewerId: string): Promise<EntityReview> {
    return await this.syncResolutionDownstream(candidateId, reviewerId);
  }

  public static async getReview(candidateId: string): Promise<EntityReview | null> {
    return await db.getEntityReview(candidateId);
  }
}

