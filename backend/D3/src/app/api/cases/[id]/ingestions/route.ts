import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';

const getD2Url = () => process.env.D2_SERVICE_URL || 'http://localhost:8001';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Forward the multipart form data directly to D2 for canonical ingestion
    const response = await fetch(`${getD2Url()}/api/cases/${caseId}/ingestions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${(session as any).accessToken || ''}`
      },
      body: formData // Forward raw formData
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `D2 ingestion failed: ${errText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });

  } catch (error: any) {
    console.error(`Error uploading to case ${caseId} via D2:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
