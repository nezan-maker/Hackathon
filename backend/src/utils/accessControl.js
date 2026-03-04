import { env } from "../config/env.js";

const normalizeId = (value) => String(value || "").trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

export const isAdminUser = (user) => {
  if (!user) return false;

  if (String(user.role || "").toLowerCase() === "admin") {
    return true;
  }

  const email = normalizeEmail(user.email);
  return Boolean(email && env.adminEmails.includes(email));
};

export const isPumpOwnedByUser = (pump, user) => {
  if (!pump || !user) return false;
  if (isAdminUser(user)) return true;

  const userId = normalizeId(user._id);
  const pumpUserId = normalizeId(pump.userId);
  if (!userId || !pumpUserId) return false;

  return userId === pumpUserId;
};

