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
  _id: string;
  title: string;
  description?: string;
  status: CaseStatus;
  owner_id: string;
  classification: Classification;
  createdAt: Date;
  updatedAt: Date;
}

const CaseSchema: Schema<ICase> = new Schema(
  {
    _id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: Object.values(CaseStatus),
      default: CaseStatus.OPEN,
      required: true,
    },
    owner_id: { type: String, required: true },
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
