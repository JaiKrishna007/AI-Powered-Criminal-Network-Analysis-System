import { NextResponse } from 'next/server';
import { mockDB } from '@/lib/client-contracts/mockData';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  const resolutions = mockDB.entityResolutions.filter((r) => r.case_id === caseId);
  return NextResponse.json(resolutions);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  try {
    const { resolutionId, decision } = await request.json();
    
    if (!['ACCEPTED', 'REJECTED', 'DEFERRED'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision type' }, { status: 400 });
    }
    
    const resolution = mockDB.entityResolutions.find((r) => r.id === resolutionId && r.case_id === caseId);
    
    if (!resolution) {
      return NextResponse.json({ error: 'Resolution candidate not found' }, { status: 404 });
    }
    
    resolution.status = decision;
    
    // If accepted, merge candidate attributes to original canonical entity (Entity Resolution - FE-T03)
    if (decision === 'ACCEPTED') {
      const originalEntity = mockDB.entities.find((e) => e.id === resolution.original.id);
      if (originalEntity) {
        // Add candidate canonical name to aliases
        if (!originalEntity.aliases.includes(resolution.candidate.canonical_name)) {
          originalEntity.aliases.push(resolution.candidate.canonical_name);
        }
        // Incorporate any aliases from the candidate
        resolution.candidate.aliases.forEach((alias) => {
          if (!originalEntity.aliases.includes(alias)) {
            originalEntity.aliases.push(alias);
          }
        });
      }
    }
    
    // Simulate logging audit event
    const auditEvent = {
      event_id: `AUD-${Date.now()}`,
      actor_id: 'USR-201',
      action: `ENTITY_RESOLUTION_${decision}`,
      resource_type: 'ADMIN' as const,
      resource_id: resolutionId,
      timestamp: new Date().toISOString(),
      outcome: 'SUCCESS' as const,
      correlation_id: `JOB-${Math.floor(100000 + Math.random() * 900000)}`,
      details: `Entity Resolution Decision: ${decision} for ${resolution.original.canonical_name} vs ${resolution.candidate.canonical_name}`
    };
    
    // Push the event metadata into entities for simple UI review
    mockDB.entities.push({
      id: auditEvent.event_id,
      type: 'EVENT',
      canonical_name: auditEvent.details,
      aliases: [auditEvent.action],
      confidence: 1.0
    });
    
    return NextResponse.json({ success: true, resolution, audit: auditEvent });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
