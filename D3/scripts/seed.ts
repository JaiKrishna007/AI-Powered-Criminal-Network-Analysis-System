import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Role } from '../src/lib/db/models/User';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:adminpassword@localhost:27017/sih?authSource=admin';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create Admin
    const adminPassword = await bcrypt.hash('admin123', 10);
    await User.findOneAndUpdate(
      { email: 'admin@demo.com' },
      {
        name: 'System Admin',
        email: 'admin@demo.com',
        passwordHash: adminPassword,
        role: Role.SYSTEM_ADMIN,
        status: 'ACTIVE',
      },
      { upsert: true, new: true }
    );
    console.log('Admin user seeded');

    // Create Investigator
    const invPassword = await bcrypt.hash('inv123', 10);
    await User.findOneAndUpdate(
      { email: 'investigator@demo.com' },
      {
        name: 'Lead Investigator',
        email: 'investigator@demo.com',
        passwordHash: invPassword,
        role: Role.INVESTIGATOR,
        status: 'ACTIVE',
      },
      { upsert: true, new: true }
    );
    console.log('Investigator user seeded');

    // Create Supervisor
    const supPassword = await bcrypt.hash('sup123', 10);
    await User.findOneAndUpdate(
      { email: 'supervisor@demo.com' },
      {
        name: 'Case Supervisor',
        email: 'supervisor@demo.com',
        passwordHash: supPassword,
        role: Role.SUPERVISOR,
        status: 'ACTIVE',
      },
      { upsert: true, new: true }
    );
    console.log('Supervisor user seeded');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seed();
