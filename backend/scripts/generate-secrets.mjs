import crypto from 'node:crypto';

const generateSecret = () => crypto.randomBytes(48).toString('base64url');

console.log('AUTH_SECRET=' + generateSecret());
console.log('REFRESH_SECRET=' + generateSecret());
console.log('AUTH_SECRETS=' + generateSecret());
console.log('REFRESH_SECRETS=' + generateSecret());
