import createDebug from "debug";
import { env } from "../config/env.js";
import { getClientIp, isPublicRoutableIp } from "../utils/ip.js";

const debug = createDebug("app:geolocation");

const toFiniteNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseCoordinatePair = (value) => {
  const raw = String(value || "").trim();
  if (!raw.includes(",")) return null;
  const [rawLat, rawLon] = raw.split(",", 2).map((part) => part.trim());
  const lat = toFiniteNumber(rawLat);
  const lon = toFiniteNumber(rawLon);
  if (lat === null || lon === null) return null;
  return { lat, lon };
};

const parseCoordinates = (payload) => {
  const lat = toFiniteNumber(
    payload?.latitude ??
      payload?.lat ??
      payload?.location?.latitude ??
      payload?.location?.lat ??
      payload?.geo?.latitude ??
      payload?.geo?.lat,
  );
  const lon = toFiniteNumber(
    payload?.longitude ??
      payload?.lon ??
      payload?.lng ??
      payload?.location?.longitude ??
      payload?.location?.lon ??
      payload?.location?.lng ??
      payload?.geo?.longitude ??
      payload?.geo?.lon ??
      payload?.geo?.lng,
  );

  if (lat !== null && lon !== null) {
    return { lat, lon };
  }

  const locPair = parseCoordinatePair(payload?.loc ?? payload?.location);
  if (locPair) {
    return locPair;
  }

  return null;
};

export const resolveGeoFromIp = async (ip) => {
  if (!ip || !isPublicRoutableIp(ip)) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.geoIpTimeoutMs);

  try {
    const response = await fetch(`${env.geoIpBaseUrl}/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    if (!payload) return null;

    if (payload.success === false || payload.status === "fail") {
      return null;
    }

    return parseCoordinates(payload);
  } catch (error) {
    debug("Failed to resolve geolocation", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const resolveGeoFromRequest = async (req) => {
  const ip = getClientIp(req);
  const coordinates = await resolveGeoFromIp(ip);

  if (!coordinates) {
    return { ip, lat: null, lon: null };
  }

  return {
    ip,
    ...coordinates,
  };
};
