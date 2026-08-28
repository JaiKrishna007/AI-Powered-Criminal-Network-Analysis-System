import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import connectToDatabase from '@/lib/db/mongodb';
import { Case } from '@/lib/db/models/Case';
import mongoose from 'mongoose';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const caseId = params.id;
    if (!mongoose.Types.ObjectId.isValid(caseId)) {
      return NextResponse.json({ error: 'Invalid Case ID' }, { status: 400 });
    }

    await connectToDatabase();

    const caseData = await Case.findById(caseId).lean();

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Check case-level authorization
    const userRole = (session.user as any).role;
    const userId = (session.user as any).id;

    if (userRole === 'INVESTIGATOR' && caseData.owner_id.toString() !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ case: caseData }, { status: 200 });

  } catch (error: any) {
    console.error(`Error fetching case ${params.id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
