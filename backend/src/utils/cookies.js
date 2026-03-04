import { env } from "../config/env.js";

const sameSite = env.isProduction ? "none" : "lax";

export const accessCookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite,
  path: "/",
  maxAge: 60 * 60 * 1000,
};

export const refreshCookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite,
  path: "/",
  maxAge: 14 * 24 * 60 * 60 * 1000,
};

export const emailTokenCookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite,
  path: "/",
};
