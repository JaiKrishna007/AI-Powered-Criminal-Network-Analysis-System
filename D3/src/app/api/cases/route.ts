import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';

const getD2Url = () => process.env.D2_SERVICE_URL || 'http://localhost:8001';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call D2 backend for case list instead of connecting to MongoDB directly
    // This removes the duplicate database dependency and respects D2's canonical ownership.
    const response = await fetch(`${getD2Url()}/api/cases`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // In a real microservice setup, we'd pass an M2M signed AuthContext or propagate the user session
        'Authorization': `Bearer ${(session as any).accessToken || ''}`
      }
    });

    if (!response.ok) {
      throw new Error(`D2 responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({ cases: data.cases || [] }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching cases from D2:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Call D2 backend to create case
    const response = await fetch(`${getD2Url()}/api/cases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(session as any).accessToken || ''}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`D2 responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });

  } catch (error: any) {
    console.error('Error creating case via D2:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
