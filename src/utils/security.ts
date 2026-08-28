import crypto from 'crypto';

function getInternalSecret(): string {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.INTERNAL_SERVICE_SECRET) {
      throw new Error('FATAL: INTERNAL_SERVICE_SECRET must be configured in production environment.');
    }
    return process.env.INTERNAL_SERVICE_SECRET;
  }
  return process.env.INTERNAL_SERVICE_SECRET || 'demo-internal-service-hmac-secret';
}

const INTERNAL_SECRET = getInternalSecret();

/**
 * Computes an HMAC-SHA256 signature for internal microservice authorization contexts.
 */
export function signAuthContext(context: Record<string, any>): {
  contextHeader: string;
  signatureHeader: string;
} {
  const payload = {
    ...context,
    issued_at: Date.now(),
    expires_at: Date.now() + 60000 // 60 seconds expiration
  };
  
  // Sort keys for canonical serialization
  const sortedPayload = Object.keys(payload).sort().reduce((acc, key) => {
    (acc as any)[key] = (payload as any)[key];
    return acc;
  }, {});

  const contextHeader = JSON.stringify(sortedPayload);
  const signatureHeader = crypto
    .createHmac('sha256', INTERNAL_SECRET)
    .update(contextHeader)
    .digest('hex');

  return { contextHeader, signatureHeader };
}

/**
 * Validates HMAC-SHA256 signature for incoming internal service requests.
 */
export function verifyAuthContext(contextStr: string, signatureStr: string): boolean {
  if (!contextStr || !signatureStr) return false;
  try {
    const expected = crypto
      .createHmac('sha256', INTERNAL_SECRET)
      .update(contextStr)
      .digest('hex');

    if (signatureStr.length !== expected.length) return false;
    const isValid = crypto.timingSafeEqual(Buffer.from(signatureStr), Buffer.from(expected));
    
    if (!isValid) return false;
    
    const parsed = JSON.parse(contextStr);
    if (!parsed.expires_at || Date.now() > parsed.expires_at) {
      return false;
    }
    
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Deterministically resolves the highest-priority effective role from a user's roles array.
 * Priority: SYSTEM ADMIN > SUPERVISOR > INVESTIGATOR > ANALYST > OFFICER
 */
export function getEffectiveRole(roles: string[] = []): string {
  if (!roles || roles.length === 0) return 'INVESTIGATOR';
  if (roles.includes('SYSTEM ADMIN')) return 'SYSTEM ADMIN';
  if (roles.includes('SUPERVISOR')) return 'SUPERVISOR';
  if (roles.includes('INVESTIGATOR')) return 'INVESTIGATOR';
  if (roles.includes('ANALYST')) return 'ANALYST';
  return roles[0] || 'INVESTIGATOR';
}

