import { db } from '../db';
import { EntityReview, ReviewState, SyncState } from '../models/types';
import { EntityResolutionEventV1, EntityResolutionEventSchema } from '../contracts';
import { GraphClient } from './graph_client';
import { AuthMiddleware } from '../middleware/auth';

export class EntityReviewService {
  /**
   * Records a human review decision for an entity candidate.
   * Review states must strictly be one of: CANDIDATE, ACCEPTED, REJECTED, DEFERRED.
   * Enforces case authorization for the reviewer and uses ENTITY_RESOLUTION.v1 contract.
   */
  public static async recordReviewDecision(
    candidateId: string,
    decision: ReviewState,
    reviewerId: string
  ): Promise<EntityReview> {
    if (!['ACCEPTED', 'REJECTED', 'DEFERRED'].includes(decision)) {
      throw new Error(`Invalid entity review state: ${decision}`);
    }

    const candidate = await db.getCandidate(candidateId);
    if (!candidate) {
      throw new Error(`Candidate ${candidateId} not found`);
    }

    // 1. Enforce strict state machine transitions (Issue 6)
    if ((candidate.status === 'ACCEPTED' || candidate.status === 'REJECTED') && candidate.status !== decision) {
      throw new Error(`Cannot transition from terminal state: ${candidate.status}`);
    }
    if (candidate.status === 'DEFERRED' && decision === 'DEFERRED') {
      throw new Error('Cannot transition from DEFERRED to DEFERRED');
    }

    // 1. Enforce explicit case authorization before recording review (Issue 6)
    await AuthMiddleware.authorizeCaseAccess({
      userId: reviewerId,
      caseId: candidate.case_id
    });

    const userRoles = await db.getUserRoles(reviewerId);
    const hasReviewRole = userRoles.some(r => ['INVESTIGATOR', 'SUPERVISOR'].includes(r));
    if (!hasReviewRole) {
      throw new Error('User lacks reviewer privileges: Requires INVESTIGATOR or SUPERVISOR role');
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
   * Dynamically resolves reviewer role and access level from database.
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

    const canonicalEntityId = candidate.canonical_entity_id || candidate.id.replace('CAND-', 'ENT-');
    
    const canonicalEntity = {
      id: canonicalEntityId,
      name: candidate.name,
      type: candidate.candidate_data?.type || 'UNKNOWN',
      identifiers: candidate.identifiers,
      properties: candidate.candidate_data?.properties || {},
      created_at: candidate.created_at,
      updated_at: new Date().toISOString()
    };

    const resolutionPayload: EntityResolutionEventV1 = {
      candidate_id: candidate.id,
      case_id: candidate.case_id,
      decision: 'ACCEPTED',
      canonical_entity: canonicalEntity,
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

    // Dynamic reviewer role and case access level resolution (Issue 5 & Issue 14)
    const { getEffectiveRole } = await import('../utils/security.js');
    const userRoles = await db.getUserRoles(reviewerId);
    const effectiveRole = getEffectiveRole(userRoles);

    const caseMember = await db.getCaseMember(candidate.case_id, reviewerId);
    const accessLevel = caseMember?.access_level || (userRoles.includes('SYSTEM ADMIN') ? 'ADMIN' : 'INVESTIGATOR');

    const context = {
      user_id: reviewerId,
      actor_id: reviewerId,
      role: effectiveRole,
      case_id: candidate.case_id,
      allowed_case_ids: [candidate.case_id],
      access_level: accessLevel
    };

    try {
      if (validated.data.decision === 'ACCEPTED' && validated.data.canonical_entity) {
        const { GraphSyncAdapter } = await import('../workers/graph_sync.adapter.js');
        await GraphSyncAdapter.syncEntityToD4(context, validated.data.canonical_entity);
        const canonicalId = validated.data.canonical_entity.id;
        
        await db.updateEntityReview(candidateId, {
          sync_state: 'SYNCED',
          sync_error: null
        });

        await db.updateCandidate(candidateId, { canonical_entity_id: canonicalId });
      } else {
        await db.updateEntityReview(candidateId, {
          sync_state: 'SYNCED',
          sync_error: null
        });
      }
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
   * Enforces case authorization before performing retry (Issue 7).
   */
  public static async retrySync(candidateId: string, reviewerId: string): Promise<EntityReview> {
    const candidate = await db.getCandidate(candidateId);
    if (!candidate) {
      throw new Error(`Candidate ${candidateId} not found`);
    }

    await AuthMiddleware.authorizeCaseAccess({
      userId: reviewerId,
      caseId: candidate.case_id
    });

    return await this.syncResolutionDownstream(candidateId, reviewerId);
  }

  public static async getReview(candidateId: string): Promise<EntityReview | null> {
    return await db.getEntityReview(candidateId);
  }
}

