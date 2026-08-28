import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';

const getD2Url = () => process.env.D2_SERVICE_URL || 'http://localhost:8001';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let caseId = 'unknown';
  try {
    const { id } = await params;
    caseId = id;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!caseId || caseId === 'unknown') {
      return NextResponse.json({ error: 'Invalid Case ID' }, { status: 400 });
    }

    // Call D2 backend for case details
    const response = await fetch(`${getD2Url()}/api/cases/${caseId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(session as any).accessToken || ''}`
      }
    });

    if (!response.ok) {
      if (response.status === 404) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      if (response.status === 403) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      throw new Error(`D2 responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });

  } catch (error: any) {
    console.error(`Error fetching case ${caseId} via D2:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
