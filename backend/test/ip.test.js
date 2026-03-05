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

test('getClientIp picks first public forwarded IP when private proxy hops are present', () => {
  const req = {
    headers: {
      'x-forwarded-for': '10.10.1.2, 172.20.0.10, 8.8.8.8',
    },
    ip: '172.16.0.1',
  };

  assert.equal(getClientIp(req), '8.8.8.8');
});

test('getClientIp falls back to x-real-ip when x-forwarded-for is absent', () => {
  const req = {
    headers: {
      'x-real-ip': '198.51.100.24',
    },
    socket: { remoteAddress: '10.0.0.7' },
  };

  assert.equal(getClientIp(req), '198.51.100.24');
});

test('isPublicRoutableIp rejects private ranges', () => {
  assert.equal(isPublicRoutableIp('127.0.0.1'), false);
  assert.equal(isPublicRoutableIp('10.10.10.10'), false);
  assert.equal(isPublicRoutableIp('192.168.1.25'), false);
});

test('isPublicRoutableIp accepts valid public IPv4', () => {
  assert.equal(isPublicRoutableIp('8.8.8.8'), true);
});
