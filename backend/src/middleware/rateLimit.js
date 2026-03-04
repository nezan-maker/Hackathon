import { getClientIp } from "../utils/ip.js";

const stores = new Map();

const pruneExpiredBuckets = (windowMs) => {
  const now = Date.now();
  for (const [key, value] of stores.entries()) {
    if (now - value.windowStart > windowMs * 2) {
      stores.delete(key);
    }
  }
};

const getBucket = (key, windowMs) => {
  const now = Date.now();
  const value = stores.get(key);

  if (!value || now - value.windowStart > windowMs) {
    const fresh = { count: 0, windowStart: now };
    stores.set(key, fresh);
    return fresh;
  }

  return value;
};

export const createRateLimiter = ({
  keyPrefix,
  windowMs,
  max,
  message = "Too many requests",
}) => {
  return (req, res, next) => {
    if (stores.size > 10000) {
      pruneExpiredBuckets(windowMs);
    }

    const ip = getClientIp(req) || "unknown";
    const key = `${keyPrefix}:${ip}`;
    const bucket = getBucket(key, windowMs);
    bucket.count += 1;

    const resetInSeconds = Math.max(
      0,
      Math.ceil((windowMs - (Date.now() - bucket.windowStart)) / 1000),
    );

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(resetInSeconds));

    if (bucket.count > max) {
      return res.status(429).json({ message });
    }

    return next();
  };
};

export const globalRateLimiter = createRateLimiter({
  keyPrefix: "global",
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: "Too many requests from this IP, please try again later",
});

export const authRateLimiter = createRateLimiter({
  keyPrefix: "auth",
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Too many authentication attempts, please try again later",
});
