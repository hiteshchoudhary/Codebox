import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import config from '../src/utils/config.js';
import { authMiddleware } from '../src/api/middleware/auth.js';

function mockReq(token) {
  return {
    get(header) {
      if (header === 'X-Auth-Token') return token || null;
      return null;
    },
  };
}

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

describe('Auth Middleware', () => {
  const originalTokens = [...config.auth.tokens];

  beforeEach(() => {
    config.auth.tokens = [...originalTokens];
  });

  it('should skip auth when no tokens configured', () => {
    config.auth.tokens = [];
    let called = false;
    authMiddleware(mockReq(null), mockRes(), () => { called = true; });
    assert(called);
  });

  it('should return 401 when no auth header provided', () => {
    config.auth.tokens = ['my-secret'];
    const res = mockRes();
    authMiddleware(mockReq(null), res, () => {});
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'Authentication required');
  });

  it('should return 401 for invalid token', () => {
    config.auth.tokens = ['my-secret'];
    const res = mockRes();
    authMiddleware(mockReq('wrong-token'), res, () => {});
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'Authentication failed');
  });

  it('should accept valid token', () => {
    config.auth.tokens = ['my-secret'];
    let called = false;
    authMiddleware(mockReq('my-secret'), mockRes(), () => { called = true; });
    assert(called);
  });

  it('should accept token from multiple configured tokens', () => {
    config.auth.tokens = ['token-a', 'token-b', 'token-c'];
    let called = false;
    authMiddleware(mockReq('token-b'), mockRes(), () => { called = true; });
    assert(called);
  });

  it('should reject token that is a prefix of a valid token', () => {
    config.auth.tokens = ['my-secret-token'];
    const res = mockRes();
    authMiddleware(mockReq('my-secret'), res, () => {});
    assert.strictEqual(res.statusCode, 401);
  });

  it('should reject token that contains a valid token as substring', () => {
    config.auth.tokens = ['secret'];
    const res = mockRes();
    authMiddleware(mockReq('my-secret-extra'), res, () => {});
    assert.strictEqual(res.statusCode, 401);
  });

  it('should reject empty string token', () => {
    config.auth.tokens = ['my-secret'];
    const res = mockRes();
    authMiddleware(mockReq(''), res, () => {});
    assert.strictEqual(res.statusCode, 401);
  });
});
