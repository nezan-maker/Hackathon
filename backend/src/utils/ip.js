import net from "node:net";

const normalizeIp = (ip) => {
  const value = String(ip || "").trim().replace(/^"(.*)"$/, "$1");
  if (!value) return "";
  if (value.startsWith("::ffff:")) return value.slice(7);
  if (value === "::1") return "127.0.0.1";
  return value;
};

const readHeaderValue = (headers, name) => {
  const raw = headers?.[name];
  if (Array.isArray(raw)) {
    return raw.join(",");
  }
  return typeof raw === "string" ? raw : "";
};

const parseForwardedList = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => normalizeIp(entry))
    .filter((entry) => entry && entry.toLowerCase() !== "unknown");

const pickPreferredIp = (candidates) => {
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const firstPublic = candidates.find((candidate) => isPublicRoutableIp(candidate));
  return firstPublic || candidates[0] || "";
};

export const getClientIp = (req) => {
  const forwardedFor = readHeaderValue(req?.headers, "x-forwarded-for");
  const forwardedCandidates = parseForwardedList(forwardedFor);
  if (forwardedCandidates.length > 0) {
    return pickPreferredIp(forwardedCandidates);
  }

  const realIp = normalizeIp(readHeaderValue(req?.headers, "x-real-ip"));
  if (realIp) {
    return realIp;
  }

  const remoteCandidates = [normalizeIp(req?.ip), normalizeIp(req?.socket?.remoteAddress)].filter(
    Boolean,
  );
  return pickPreferredIp(remoteCandidates);
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
