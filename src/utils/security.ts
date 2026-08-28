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
  const contextHeader = JSON.stringify(context);
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
    return crypto.timingSafeEqual(Buffer.from(signatureStr), Buffer.from(expected));
  } catch (err) {
    return false;
  }
}
