import mongoose, { Schema, Document, Model } from 'mongoose';

export enum CaseStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

export enum Classification {
  PUBLIC_DEMO = 'PUBLIC/DEMO',
  CASE_RESTRICTED = 'CASE_RESTRICTED',
  SENSITIVE = 'SENSITIVE',
  SECRET = 'SECRET',
}

export interface ICase extends Document {
  title: string;
  description?: string;
  status: CaseStatus;
  owner_id: mongoose.Types.ObjectId;
  classification: Classification;
  createdAt: Date;
  updatedAt: Date;
}

const CaseSchema: Schema<ICase> = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: Object.values(CaseStatus),
      default: CaseStatus.OPEN,
      required: true,
    },
    owner_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    classification: {
      type: String,
      enum: Object.values(Classification),
      default: Classification.CASE_RESTRICTED,
      required: true,
    },
  },
  { timestamps: true }
);

CaseSchema.index({ owner_id: 1 });
CaseSchema.index({ status: 1 });

export const Case: Model<ICase> = mongoose.models.Case || mongoose.model<ICase>('Case', CaseSchema);
