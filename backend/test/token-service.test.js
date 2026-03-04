import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.AUTH_SECRETS = 'current_access_secret_that_is_long_enough,old_access_secret_that_is_long_enough';
process.env.REFRESH_SECRETS = 'current_refresh_secret_that_is_long_enough,old_refresh_secret_that_is_long_enough';
process.env.AUTH_SECRET = 'current_access_secret_that_is_long_enough';
process.env.REFRESH_SECRET = 'current_refresh_secret_that_is_long_enough';

const tokenService = await import('../src/services/tokenService.js');

const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = tokenService;

test('signAccessToken signs with current secret', () => {
  const token = signAccessToken({ userId: 'u1', tokenVersion: 1 }, '1h');
  const decoded = verifyAccessToken(token);
  assert.equal(decoded.userId, 'u1');
});

test('verifyAccessToken accepts rotated previous secret', () => {
  const legacyToken = jwt.sign(
    { userId: 'legacy-user', tokenVersion: 1 },
    'old_access_secret_that_is_long_enough',
    { expiresIn: '1h' },
  );

  const decoded = verifyAccessToken(legacyToken);
  assert.equal(decoded.userId, 'legacy-user');
});

test('verifyRefreshToken accepts rotated previous secret', () => {
  const legacyRefresh = jwt.sign(
    { userId: 'legacy-refresh-user' },
    'old_refresh_secret_that_is_long_enough',
    { expiresIn: '1h' },
  );

  const decoded = verifyRefreshToken(legacyRefresh);
  assert.equal(decoded.userId, 'legacy-refresh-user');
});

test('signRefreshToken creates valid refresh token', () => {
  const token = signRefreshToken({ userId: 'u2' }, '1h');
  const decoded = verifyRefreshToken(token);
  assert.equal(decoded.userId, 'u2');
});
