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

    const body = await request.json();

    // Proxy the request to D2's copilot endpoint to respect canonical boundaries
    const response = await fetch(`${getD2Url()}/api/cases/${id}/copilot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(session as any).accessToken || ''}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText || 'D2 Copilot Error' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });

  } catch (error: any) {
    console.error(`Copilot Proxy Error in case ${caseId}:`, error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
