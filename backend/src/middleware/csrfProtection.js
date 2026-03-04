import crypto from "crypto";
import { emailTokenCookieOptions } from "../utils/cookies.js";

const CSRF_COOKIE_NAME = "csrfToken";
const CSRF_HEADER_NAME = "x-csrf-token";

const csrfCookieOptions = {
  ...emailTokenCookieOptions,
  httpOnly: false,
  maxAge: 24 * 60 * 60 * 1000,
};

export const createCsrfToken = () => crypto.randomBytes(32).toString("hex");

export const issueCsrfToken = (req, res) => {
  const existingToken = req.cookies?.[CSRF_COOKIE_NAME];
  const token = existingToken || createCsrfToken();

  // Always set the cookie to keep TTL in sync with active sessions.
  res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions);

  return res.status(200).json({ csrfToken: token });
};

const isStateChangingMethod = (method) =>
  ["POST", "PUT", "PATCH", "DELETE"].includes(String(method).toUpperCase());

export const csrfProtection = (req, res, next) => {
  if (!isStateChangingMethod(req.method)) {
    return next();
  }

  if (req.path === "/auth/csrf") {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];

  const cookieTokenBuffer =
    typeof cookieToken === "string" ? Buffer.from(cookieToken) : null;
  const headerTokenBuffer =
    typeof headerToken === "string" ? Buffer.from(headerToken) : null;
  const tokensMatch =
    cookieTokenBuffer &&
    headerTokenBuffer &&
    cookieTokenBuffer.length === headerTokenBuffer.length &&
    crypto.timingSafeEqual(cookieTokenBuffer, headerTokenBuffer);

  if (!tokensMatch) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }

  return next();
};

export const clearCsrfCookie = (res) => {
  res.clearCookie(CSRF_COOKIE_NAME, { ...csrfCookieOptions, maxAge: undefined });
};
