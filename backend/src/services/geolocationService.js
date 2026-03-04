import createDebug from "debug";
import { env } from "../config/env.js";
import { getClientIp, isPublicRoutableIp } from "../utils/ip.js";

const debug = createDebug("app:geolocation");

const parseCoordinates = (payload) => {
  const lat = Number(payload?.latitude ?? payload?.lat);
  const lon = Number(payload?.longitude ?? payload?.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return { lat, lon };
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

    if (payload.success === false) {
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
