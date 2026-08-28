import { Router } from 'express';
import { db } from '../db';
import { AuditEventRef } from '../models/types';
import { AuditMiddleware } from '../middleware/audit';

const router = Router();

// Mock credentials for prototype testing
const DEMO_USERS: Record<string, string> = {
  'investigator1': 'password123',
  'supervisor1': 'password123',
  'admin1': 'password123'
};

const USER_MAPPING: Record<string, string> = {
  'investigator1': 'USR-INV-001', // Should match seeded DB user
  'supervisor1': 'USR-SUP-001',
  'admin1': 'USR-ADM-001'
};

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Username and password are required.' });
  }

  // 1. Verify demo credentials
  if (DEMO_USERS[username] !== password) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials.' });
  }

  // 2. Map to internal User ID
  const userId = USER_MAPPING[username] || username;

  // 3. Load user from MongoDB
  const user = await db.getUser(userId);
  if (!user) {
    // If not found in DB but valid demo user, create them (mock behavior for prototype)
    await db.createUser({ id: userId, display_name: username, status: 'ACTIVE' });
    if (username.includes('admin')) await db.assignUserRole(userId, 'SYSTEM ADMIN');
    else if (username.includes('super')) await db.assignUserRole(userId, 'SUPERVISOR');
    else await db.assignUserRole(userId, 'INVESTIGATOR');
  }

  // 4. Create signed session
  (req.session as any).userId = userId;

  // 5. Audit Login
  await AuditMiddleware.logAction(userId, 'LOGIN');

  return res.json({ message: 'Login successful', userId });
});

router.post('/logout', async (req, res) => {
  const userId = (req.session as any)?.userId;
  if (userId) {
    await AuditMiddleware.logAction(userId, 'LOGOUT');
  }

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Could not log out.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ message: 'Logout successful' });
  });
});

router.get('/me', async (req, res) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not logged in.' });
  }

  const user = await db.getUser(userId);
  if (!user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User not found.' });
  }

  const roles = await db.getUserRoles(userId);

  return res.json({
    id: user.id,
    display_name: user.display_name,
    roles
  });
});

export default router;
