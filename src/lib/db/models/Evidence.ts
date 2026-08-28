import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEvidence extends Document {
  case_id: mongoose.Types.ObjectId;
  source_type: 'PDF' | 'CSV' | 'JSON' | 'TXT';
  source_ref: string; // Original filename
  storage_uri: string; // Path on disk or S3
  sha256: string;
  classification: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
}

const EvidenceSchema: Schema<IEvidence> = new Schema(
  {
    case_id: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    source_type: { type: String, enum: ['PDF', 'CSV', 'JSON', 'TXT'], required: true },
    source_ref: { type: String, required: true },
    storage_uri: { type: String, required: true },
    sha256: { type: String, required: true },
    classification: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
    }
  },
  { timestamps: true }
);

EvidenceSchema.index({ case_id: 1, classification: 1 });
EvidenceSchema.index({ sha256: 1 });

export const Evidence: Model<IEvidence> = mongoose.models.Evidence || mongoose.model<IEvidence>('Evidence', EvidenceSchema);
