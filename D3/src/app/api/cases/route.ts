import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import connectToDatabase from '@/lib/db/mongodb';
import { Case } from '@/lib/db/models/Case';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Enforce case-level authorization: 
    // Investigators see their cases, supervisors/admins might see all or based on permissions.
    // For MVP, we filter by owner_id for INVESTIGATOR role.
    const query: any = {};
    const userRole = (session.user as any).role;
    const userId = (session.user as any).id;

    if (userRole === 'INVESTIGATOR') {
      query.owner_id = userId;
    }

    const cases = await Case.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ cases }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching cases:', error);
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
    const { title, description, classification } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    await connectToDatabase();

    const newCase = await Case.create({
      title,
      description,
      classification: classification || 'CASE_RESTRICTED',
      owner_id: (session.user as any).id,
      status: 'OPEN',
    });

    return NextResponse.json({ case: newCase }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating case:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
