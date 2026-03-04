import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCsrfToken,
  csrfProtection,
  issueCsrfToken,
} from '../src/middleware/csrfProtection.js';

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    cookies: {},
    cookieOptions: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    cookie(name, value, options) {
      this.cookies[name] = value;
      this.cookieOptions[name] = options;
      return this;
    },
  };

  return res;
};

test('createCsrfToken returns random token', () => {
  const tokenA = createCsrfToken();
  const tokenB = createCsrfToken();

  assert.equal(typeof tokenA, 'string');
  assert.notEqual(tokenA, tokenB);
  assert.ok(tokenA.length >= 32);
});

test('csrfProtection allows valid token pair', async () => {
  const token = createCsrfToken();
  const req = {
    method: 'POST',
    path: '/auth/login',
    cookies: { csrfToken: token },
    headers: { 'x-csrf-token': token },
  };
  const res = createMockRes();

  let nextCalled = false;
  csrfProtection(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('csrfProtection blocks invalid token', async () => {
  const req = {
    method: 'POST',
    path: '/auth/login',
    cookies: { csrfToken: 'a' },
    headers: { 'x-csrf-token': 'b' },
  };
  const res = createMockRes();

  let nextCalled = false;
  csrfProtection(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { message: 'Invalid CSRF token' });
});

test('issueCsrfToken reuses existing token and refreshes cookie ttl', async () => {
  const token = createCsrfToken();
  const req = {
    cookies: { csrfToken: token },
  };
  const res = createMockRes();

  issueCsrfToken(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { csrfToken: token });
  assert.equal(res.cookies.csrfToken, token);
  assert.equal(typeof res.cookieOptions.csrfToken.maxAge, 'number');
});
