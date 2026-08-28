import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import connectToDatabase from '@/lib/db/mongodb';
import { Case } from '@/lib/db/models/Case';
import { Evidence } from '@/lib/db/models/Evidence';
import { addIngestionJob } from '@/lib/queue/ingestionQueue';
import mongoose from 'mongoose';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function POST(request: Request, { params }: { params: { id: string } }) {
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

    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Check authorization: Must be case owner for Investigator, or have higher roles.
    const userRole = (session.user as any).role;
    const userId = (session.user as any).id;
    if (userRole === 'INVESTIGATOR' && caseData.owner_id.toString() !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate type
    const filename = file.name;
    const extension = filename.split('.').pop()?.toUpperCase() || '';
    if (!['PDF', 'CSV', 'JSON', 'TXT'].includes(extension)) {
      return NextResponse.json({ error: `Unsupported file type: ${extension}` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate SHA-256
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Store Original Artifact
    const uploadsDir = path.join(process.cwd(), 'uploads', caseId);
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const storageUri = path.join(uploadsDir, `${hash}_${filename}`);
    await fs.writeFile(storageUri, buffer);

    // Check for duplicates
    const existing = await Evidence.findOne({ sha256: hash, case_id: caseId });
    if (existing) {
      return NextResponse.json({ error: 'File already exists in this case' }, { status: 409 });
    }

    // Create Metadata Record
    const evidence = await Evidence.create({
      case_id: caseId,
      source_type: extension,
      source_ref: filename,
      storage_uri: storageUri,
      sha256: hash,
      classification: caseData.classification,
      status: 'PENDING'
    });

    // Queue for processing
    await addIngestionJob(evidence._id.toString(), storageUri, extension);

    return NextResponse.json({ 
      message: 'File uploaded and queued for processing',
      evidence 
    }, { status: 201 });

  } catch (error: any) {
    console.error(`Error uploading to case ${params.id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
