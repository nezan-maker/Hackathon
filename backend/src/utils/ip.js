import net from "node:net";

const normalizeIp = (ip) => {
  if (!ip) return "";
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  if (ip === "::1") return "127.0.0.1";
  return ip;
};

export const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.length > 0) {
    const firstIp = forwarded.split(",")[0]?.trim();
    return normalizeIp(firstIp);
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return normalizeIp(forwarded[0]);
  }

  return normalizeIp(req.ip || req.socket?.remoteAddress || "");
};

const isPrivateV4 = (ip) =>
  ip.startsWith("10.") ||
  ip.startsWith("127.") ||
  ip.startsWith("192.168.") ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
  ip === "0.0.0.0";

const isPrivateV6 = (ip) =>
  ip === "::1" ||
  ip.startsWith("fe80:") ||
  ip.startsWith("fc") ||
  ip.startsWith("fd") ||
  ip === "::";

export const isPublicRoutableIp = (ip) => {
  const normalized = normalizeIp(ip);
  const type = net.isIP(normalized);
  if (type === 0) return false;
  if (type === 4) return !isPrivateV4(normalized);
  return !isPrivateV6(normalized.toLowerCase());
};
