import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const ensureSecrets = (secrets, name) => {
  if (!Array.isArray(secrets) || secrets.length === 0) {
    throw new Error(`${name} is not configured`);
  }
};

const signWithPrimary = (payload, secrets, expiresIn) => {
  ensureSecrets(secrets, "JWT secrets");
  return jwt.sign(payload, secrets[0], { expiresIn });
};

const verifyWithRotation = (token, secrets) => {
  ensureSecrets(secrets, "JWT secrets");
  let lastError = null;

  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

export const signAccessToken = (payload, expiresIn = "1h") =>
  signWithPrimary(payload, env.authSecrets, expiresIn);

export const signRefreshToken = (payload, expiresIn = "14d") =>
  signWithPrimary(payload, env.refreshSecrets, expiresIn);

export const signEmailToken = (payload, expiresIn = "10m") =>
  signWithPrimary(payload, env.authSecrets, expiresIn);

export const verifyAccessToken = (token) => verifyWithRotation(token, env.authSecrets);

export const verifyRefreshToken = (token) =>
  verifyWithRotation(token, env.refreshSecrets);

export const verifyEmailToken = (token) => verifyWithRotation(token, env.authSecrets);
