import { env } from "../config/env.js";

export const securityHeaders = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Permissions-Policy", "geolocation=(self), microphone=(), camera=()");
  if (env.isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' https://js.stripe.com https://cdn.socket.io",
    "connect-src 'self' https://api.stripe.com https://js.stripe.com ws: wss:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ];
  res.setHeader(
    "Content-Security-Policy",
    cspDirectives.join("; "),
  );
  next();
};
