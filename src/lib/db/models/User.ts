import mongoose, { Schema, Document, Model } from 'mongoose';

export enum Role {
  INVESTIGATOR = 'INVESTIGATOR',
  SUPERVISOR = 'SUPERVISOR',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { 
      type: String, 
      enum: Object.values(Role), 
      default: Role.INVESTIGATOR,
      required: true 
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'DISABLED'],
      default: 'ACTIVE',
    }
  },
  { timestamps: true }
);

// Prevent Next.js HMR from compiling the model multiple times
export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
