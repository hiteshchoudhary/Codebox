import crypto from 'crypto';
import config from '../../utils/config.js';

/**
 * Timing-safe string comparison using HMAC to prevent timing attacks.
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const key = Buffer.alloc(32);
  const hmacA = crypto.createHmac('sha256', key).update(a).digest();
  const hmacB = crypto.createHmac('sha256', key).update(b).digest();

  return crypto.timingSafeEqual(hmacA, hmacB);
}

/**
 * Authentication middleware
 * Validates auth token from any of the configured headers (X-Auth-Token, x-rapidapi-key, etc.)
 */
export function authMiddleware(req, res, next) {
  // Skip auth if no tokens configured
  if (config.auth.tokens.length === 0) {
    return next();
  }

  let token = null;
  for (const header of config.auth.headers) {
    token = req.get(header);
    if (token) break;
  }

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Missing authentication header',
    });
  }

  // Use timing-safe comparison for each configured token
  const isValid = config.auth.tokens.some((validToken) => safeCompare(token, validToken));

  if (!isValid) {
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid authentication token',
    });
  }

  next();
}

export default authMiddleware;
