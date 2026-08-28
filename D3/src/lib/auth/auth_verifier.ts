import crypto from 'crypto';
import { AuthContext } from '../../../../../shared-contracts';

function getInternalSecret(): string {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.INTERNAL_SERVICE_SECRET) {
      throw new Error('FATAL: INTERNAL_SERVICE_SECRET must be configured in production environment.');
    }
    return process.env.INTERNAL_SERVICE_SECRET;
  }
  return process.env.INTERNAL_SERVICE_SECRET || 'demo-internal-service-hmac-secret';
}

export function verifyAuthContext(contextStr: string, signatureStr: string): boolean {
  if (!contextStr || !signatureStr) return false;
  try {
    const internalSecret = getInternalSecret();
    const contextJson = Buffer.from(contextStr, 'base64').toString('utf8');
    const expected = crypto
      .createHmac('sha256', internalSecret)
      .update(contextJson)
      .digest('hex');

    if (signatureStr.length !== expected.length) return false;
    const isValid = crypto.timingSafeEqual(Buffer.from(signatureStr), Buffer.from(expected));
    
    if (!isValid) return false;
    
    const parsed = JSON.parse(contextJson);
    if (!parsed.expires_at) return false;
    if (Date.now() > parsed.expires_at) return false;
    
    return true;
  } catch (err) {
    return false;
  }
}

export function extractAndVerifyAuthContext(headers: Record<string, string | string[] | undefined | null>): AuthContext {
  const contextHeader = headers['x-authorization-context'];
  const signatureHeader = headers['x-authorization-signature'];

  const contextStr = Array.isArray(contextHeader) ? contextHeader[0] : contextHeader;
  const signatureStr = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

  if (!contextStr || !signatureStr) {
    throw new Error('UNAUTHORIZED: Missing X-Authorization-Context or X-Authorization-Signature headers');
  }

  const isValid = verifyAuthContext(contextStr, signatureStr);
  if (!isValid) {
    throw new Error('FORBIDDEN: Invalid or expired authorization signature');
  }

  const contextJson = Buffer.from(contextStr, 'base64').toString('utf8');
  const parsed = JSON.parse(contextJson);

  if (!parsed.user_id && !parsed.actor_id) {
    throw new Error('FORBIDDEN: Missing user_id or actor_id in AuthContext');
  }
  if (!parsed.case_id) {
    throw new Error('FORBIDDEN: Missing case_id in AuthContext');
  }
  if (!parsed.role) {
    throw new Error('FORBIDDEN: Missing role in AuthContext');
  }

  const authContext: AuthContext = {
    user_id: parsed.user_id || parsed.actor_id,
    actor_id: parsed.actor_id || parsed.user_id,
    role: parsed.role,
    case_id: parsed.case_id,
    allowed_case_ids: Array.isArray(parsed.allowed_case_ids) 
      ? parsed.allowed_case_ids 
      : [parsed.case_id],
    access_level: parsed.access_level || 'READ',
    correlation_id: parsed.correlation_id || ''
  };

  return authContext;
}
