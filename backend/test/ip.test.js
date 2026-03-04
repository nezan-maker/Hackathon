import test from 'node:test';
import assert from 'node:assert/strict';

import { getClientIp, isPublicRoutableIp } from '../src/utils/ip.js';

test('getClientIp prefers x-forwarded-for', () => {
  const req = {
    headers: {
      'x-forwarded-for': '203.0.113.10, 10.0.0.1',
    },
    ip: '10.0.0.2',
    socket: { remoteAddress: '10.0.0.3' },
  };

  assert.equal(getClientIp(req), '203.0.113.10');
});

test('isPublicRoutableIp rejects private ranges', () => {
  assert.equal(isPublicRoutableIp('127.0.0.1'), false);
  assert.equal(isPublicRoutableIp('10.10.10.10'), false);
  assert.equal(isPublicRoutableIp('192.168.1.25'), false);
});

test('isPublicRoutableIp accepts valid public IPv4', () => {
  assert.equal(isPublicRoutableIp('8.8.8.8'), true);
});
