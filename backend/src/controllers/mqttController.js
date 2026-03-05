import mqtt from "mqtt";
import createDebug from "debug";
import {
  Alert,
  F_Sensor,
  P_Sensor,
  S_Sensor,
  T_Sensor,
} from "../models/Sensor.js";
import Pump from "../models/Pump.js";
import River from "../models/River.js";
import { env } from "../config/env.js";
import { getSocketIo } from "../services/socketService.js";
import { resolveGeoFromRequest } from "../services/geolocationService.js";
import { monitoringRoomsForOwner } from "../utils/realtimeRooms.js";

const debug = createDebug("app:mqtt");

const SENSOR_TOPICS = [
  "pump/pressure/#",
  "/pump/pressure/#",
  "pump/flow/#",
  "/pump/flow/#",
  "pump/speed/#",
  "/pump/speed/#",
  "pump/temp/#",
  "/pump/temp/#",
  "pump/temperature/#",
  "/pump/temperature/#",
];
const REMOTE_CONTROL_TOPIC = "esp_hardware";
const EARTH_RADIUS_KM = 6371;
const MAX_NEAREST_RIVERS = 5;

let sensorClient = null;
let remoteClient = null;

const getBrokerUrl = () => {
  if (env.mqttBrokerUrl) return env.mqttBrokerUrl;

  const rawHost = String(env.mqttBrokerHost || "").trim();
  if (!rawHost || !Number.isFinite(env.mqttBrokerPort)) return "";

  if (/^(mqtt|mqtts|ws|wss):\/\//i.test(rawHost)) {
    return rawHost;
  }

  return `mqtts://${rawHost}:${env.mqttBrokerPort}`;
};

const clientIdFor = (label) =>
  `flowbot-${label}-${Math.random().toString(16).slice(2, 10)}`;

const logMqttError = (label, error) => {
  const message = error?.message || String(error);
  debug(`MQTT ${label} error`, error);
  // Keep a plain stderr log even when DEBUG is not set.
  console.error(`[mqtt] ${label} error: ${message}`);
};

const normalizeTopic = (topic) =>
  String(topic || "")
    .trim()
    .replace(/^\/+/, "")
    .toLowerCase();

const normalizeMetric = (metric) => {
  const normalized = String(metric || "").trim().toLowerCase();
  if (["pressure", "press", "psi"].includes(normalized)) return "pressure";
  if (["flow", "flowrate", "flow_rate"].includes(normalized)) return "flow";
  if (["temp", "temperature"].includes(normalized)) return "temperature";
  if (["speed", "rpm"].includes(normalized)) return "speed";
  return "";
};

const createMqttClient = ({ label, username, password, onConnect }) => {
  const brokerUrl = getBrokerUrl();
  if (!brokerUrl || !username || !password) {
    debug(`MQTT ${label} client not configured`);
    return null;
  }

  const client = mqtt.connect(brokerUrl, {
    username,
    password,
    rejectUnauthorized: false,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
    manualConnect: true,
    clientId: clientIdFor(label),
  });

  client.on("connect", () => {
    debug(`MQTT ${label} connected`);
    onConnect?.(client);
  });
  client.on("error", (error) => {
    logMqttError(label, error);
  });
  client.on("offline", () => {
    debug(`MQTT ${label} offline`);
  });
  client.on("reconnect", () => {
    debug(`MQTT ${label} reconnecting`);
  });
  client.on("close", () => {
    debug(`MQTT ${label} connection closed`);
  });

  client.connect();
  return client;
};

const getMetricFromTopic = (topic) => {
  const normalizedTopic = normalizeTopic(topic);
  if (normalizedTopic.startsWith("pump/pressure")) return "pressure";
  if (normalizedTopic.startsWith("pump/flow")) return "flow";
  if (
    normalizedTopic.startsWith("pump/temp") ||
    normalizedTopic.startsWith("pump/temperature")
  ) {
    return "temperature";
  }
  if (normalizedTopic.startsWith("pump/speed")) return "speed";
  return "unknown";
};

const maybeCreateAlert = async ({ pumpId, pumpName, ownerUserId, value, metric }) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return;

  if (metric === "pressure" && numericValue > 110) {
    const alert = await Alert.create({
      pump_id: pumpId,
      sensorValue: `Pressure exceeded threshold: ${numericValue}`,
      message: `Pressure exceeded safe threshold (${numericValue} PSI)`,
      type: "overpressure",
      severity: "critical",
      status: "active",
    });
    const io = getSocketIo();
    if (io) {
      io.to(monitoringRoomsForOwner(ownerUserId)).emit("alert:new", {
        id: String(alert._id),
        pumpId: String(alert.pump_id),
        pumpName: pumpName || `Pump ${String(alert.pump_id)}`,
        type: alert.type,
        severity: alert.severity,
        status: alert.status,
        message: alert.message || alert.sensorValue,
        timestamp: alert.createdAt || new Date(),
      });
    }
  }

  if (metric === "temperature" && numericValue > 95) {
    const alert = await Alert.create({
      pump_id: pumpId,
      sensorValue: `Temperature high: ${numericValue}`,
      message: `Pump temperature exceeded threshold (${numericValue}°C)`,
      type: "sensor-failure",
      severity: "warning",
      status: "active",
    });
    const io = getSocketIo();
    if (io) {
      io.to(monitoringRoomsForOwner(ownerUserId)).emit("alert:new", {
        id: String(alert._id),
        pumpId: String(alert.pump_id),
        pumpName: pumpName || `Pump ${String(alert.pump_id)}`,
        type: alert.type,
        severity: alert.severity,
        status: alert.status,
        message: alert.message || alert.sensorValue,
        timestamp: alert.createdAt || new Date(),
      });
    }
  }
};

const parseSensorMessage = (payload, topic) => {
  const raw = typeof payload === "string" ? payload.trim() : "";
  let parsedObject = null;

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    parsedObject = payload;
  } else if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        parsedObject = parsed;
      }
    } catch {
      // Ignore JSON parsing errors and continue with text parsing.
    }
  }

  const effectiveTopic =
    String(parsedObject?.topic || parsedObject?.mqttTopic || topic || "").trim();
  const metricFromPayload = normalizeMetric(
    parsedObject?.metric ||
      parsedObject?.sensor ||
      parsedObject?.sensorType ||
      parsedObject?.measurement,
  );
  const metric = metricFromPayload || getMetricFromTopic(effectiveTopic);
  let pumpId = "";
  let value = "";

  if (parsedObject) {
    pumpId = String(
      parsedObject.pumpId ||
        parsedObject.pumpID ||
        parsedObject.pump_id ||
        parsedObject.serial_id ||
        parsedObject.serialId ||
        parsedObject.id ||
        "",
    ).trim();
    const metricValue =
      metric === "pressure"
        ? (parsedObject.pressure ?? parsedObject.psi)
        : metric === "flow"
          ? (parsedObject.flow ?? parsedObject.flowRate)
          : metric === "temperature"
            ? (parsedObject.temperature ?? parsedObject.temp)
            : metric === "speed"
              ? (parsedObject.speed ?? parsedObject.rpm)
              : undefined;
    value =
      parsedObject.value ??
      parsedObject.sensorValue ??
      parsedObject.reading ??
      parsedObject.metricValue ??
      metricValue ??
      "";
  }

  if (!pumpId || value === "") {
    const textPayload =
      raw ||
      String(
        parsedObject?.payload ||
          parsedObject?.message ||
          parsedObject?.data ||
          "",
      ).trim();
    const lines = textPayload
      .split(/\r?\n|,/)
      .map((line) => line.trim())
      .filter(Boolean);
    const idLine = lines.find((line) =>
      /(pump[\s_]*id|serial[\s_]*id|pumpid)/i.test(line),
    );
    const valueLine =
      lines.find((line) => {
        if (!line.includes(":")) return false;
        if (/(pump[\s_]*id|serial[\s_]*id|pumpid)/i.test(line)) return false;
        if (metric === "pressure") return /(pressure|psi|value)/i.test(line);
        if (metric === "flow") return /(flow|flowrate|value)/i.test(line);
        if (metric === "temperature")
          return /(temp|temperature|value)/i.test(line);
        if (metric === "speed") return /(speed|rpm|value)/i.test(line);
        return true;
      }) || "";

    if (!pumpId) {
      pumpId = idLine?.split(":")?.[1]?.trim() || "";
    }
    if (value === "") {
      value = valueLine ? valueLine.split(":")?.[1]?.trim() || "" : textPayload;
    }
  }

  // Fallback for topics shaped like /pump/<metric>/<pump-id>.
  if (!pumpId) {
    const topicParts = normalizeTopic(effectiveTopic).split("/").filter(Boolean);
    if (topicParts.length >= 3 && topicParts[0] === "pump") {
      pumpId = topicParts.slice(2).join("/").trim();
    }
  }

  const numericValue = Number(value);
  return {
    metric,
    topic: effectiveTopic,
    pumpId,
    value: Number.isFinite(numericValue) ? numericValue : String(value).trim(),
  };
};

const parseSensorMessages = (payload, topic) => {
  const raw = String(payload || "").trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed.map((item) => parseSensorMessage(item, topic));
    }

    if (parsed && typeof parsed === "object" && Array.isArray(parsed.messages)) {
      const base = {
        pumpId:
          parsed.pumpId || parsed.pumpID || parsed.pump_id || parsed.serial_id || parsed.serialId,
        topic: parsed.topic || parsed.mqttTopic || topic,
        metric: parsed.metric || parsed.sensor || parsed.sensorType,
      };
      return parsed.messages.map((item) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          return parseSensorMessage({ ...base, ...item }, topic);
        }
        return parseSensorMessage(item, topic);
      });
    }
  } catch {
    // Not JSON; fallback to legacy single payload parsing.
  }

  return [parseSensorMessage(raw, topic)];
};

const parseRemoteCommand = (message) => {
  const normalized = String(message || "").trim().toUpperCase();
  if (!normalized) return null;

  if (normalized === "ON" || normalized === "OFF") {
    return { command: normalized, speed: null };
  }

  const speedMatch = normalized.match(/^SPEED\s*:\s*(\d{1,3})$/);
  if (!speedMatch) return null;

  const speed = Number(speedMatch[1]);
  if (!Number.isInteger(speed) || speed < 0 || speed > 100) {
    return null;
  }

  return { command: "SPEED", speed };
};

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const latitude1 = Number(lat1);
  const longitude1 = Number(lon1);
  const latitude2 = Number(lat2);
  const longitude2 = Number(lon2);

  if (
    !Number.isFinite(latitude1) ||
    !Number.isFinite(longitude1) ||
    !Number.isFinite(latitude2) ||
    !Number.isFinite(longitude2)
  ) {
    return Number.NaN;
  }

  const dLat = toRadians(latitude2 - latitude1);
  const dLon = toRadians(longitude2 - longitude1);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const a =
    sinLat * sinLat +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      sinLon *
      sinLon;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

const toNearestRiverPayload = ({ river, distanceKm }) => ({
  _id: String(river._id),
  river_id: river.river_id,
  river_name: river.river_name,
  lat: Number(river.lat),
  lon: Number(river.lon),
  discharge_id: river.discharge_id,
  discharge_value: String(river.discharge_value ?? ""),
  distance_km: Number(distanceKm.toFixed(6)),
});

const toFiniteCoordinate = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseBooleanQueryValue = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
};

const persistResolvedUserGeo = async ({ user, lat, lon, ip }) => {
  if (!user || typeof user !== "object") return;

  let shouldSave = false;
  if (lat !== null && lon !== null) {
    if (toFiniteCoordinate(user.lat) !== lat) {
      user.lat = lat;
      shouldSave = true;
    }
    if (toFiniteCoordinate(user.lon) !== lon) {
      user.lon = lon;
      shouldSave = true;
    }
  }

  if (ip && String(user.lastLoginIp || "") !== ip) {
    user.lastLoginIp = ip;
    shouldSave = true;
  }

  if (shouldSave && typeof user.save === "function") {
    try {
      await user.save();
    } catch (error) {
      debug("Failed to persist resolved user geolocation", error);
    }
  }
};

const resolveCoordinatesForNearestRivers = async (req) => {
  const browserLat = toFiniteCoordinate(req?.query?.lat);
  const browserLon = toFiniteCoordinate(req?.query?.lon);
  if (browserLat !== null && browserLon !== null) {
    await persistResolvedUserGeo({ user: req?.user, lat: browserLat, lon: browserLon, ip: "" });
    return { lat: browserLat, lon: browserLon, source: "browser" };
  }

  const currentLat = toFiniteCoordinate(req?.user?.lat);
  const currentLon = toFiniteCoordinate(req?.user?.lon);
  if (currentLat !== null && currentLon !== null) {
    return { lat: currentLat, lon: currentLon, source: "session" };
  }

  const allowServerFallback = parseBooleanQueryValue(
    req?.query?.browser_location_denied,
  );
  if (!allowServerFallback) {
    return null;
  }

  const geo = await resolveGeoFromRequest(req);
  const lat = toFiniteCoordinate(geo?.lat);
  const lon = toFiniteCoordinate(geo?.lon);
  const ip = String(geo?.ip || "").trim();

  await persistResolvedUserGeo({ user: req?.user, lat, lon, ip });

  if (lat === null || lon === null) {
    return null;
  }

  return { lat, lon, source: "ip" };
};

const findControllablePump = async ({ pumpSerialId, user }) => {
  const normalizedSerialId = String(pumpSerialId || "").trim();
  if (!normalizedSerialId) {
    return { status: 400, message: "pump_id is required" };
  }

  const pump = await Pump.findOne({ serial_id: normalizedSerialId });
  if (!pump) {
    return { status: 404, message: "Pump not found" };
  }

  if (!user?._id || !pump.userId || String(pump.userId) !== String(user._id)) {
    return {
      status: 403,
      message: "You can only control pumps that you own",
    };
  }

  if (!pump.purchasedAt) {
    return {
      status: 403,
      message: "Pump must be purchased before remote control is enabled",
    };
  }

  if (!pump.registeredAt) {
    return {
      status: 403,
      message: "Pump must be registered before remote control is enabled",
    };
  }

  return { pump };
};

const publishRemotePayload = (topic, payload) =>
  new Promise((resolve, reject) => {
    remoteClient.publish(topic, payload, {}, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

export const nearestRiversController = async (req, res) => {
  try {
    const coordinates = await resolveCoordinatesForNearestRivers(req);
    if (!coordinates) {
      return res.status(409).json({
        message:
          "Browser geolocation is required. Allow location access in your browser. Server fallback runs only when location permission is denied.",
      });
    }
    const userLat = coordinates.lat;
    const userLon = coordinates.lon;

    const rivers = await River.find(
      {},
      {
        _id: 1,
        river_id: 1,
        river_name: 1,
        lat: 1,
        lon: 1,
        discharge_id: 1,
        discharge_value: 1,
      },
    ).lean();

    const nearest = (Array.isArray(rivers) ? rivers : [])
      .map((river) => {
        const distanceKm = haversineDistanceKm(userLat, userLon, river.lat, river.lon);
        if (!Number.isFinite(distanceKm)) {
          return null;
        }

        return { river, distanceKm };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, MAX_NEAREST_RIVERS)
      .map(toNearestRiverPayload);

    return res.status(200).json({
      user_location: {
        lat: userLat,
        lon: userLon,
      },
      location_source: coordinates.source,
      rivers: nearest,
    });
  } catch (error) {
    debug("nearestRiversController failed", error);
    return res.status(500).json({ message: "Unable to fetch nearest rivers" });
  }
};

export const mqttFn = () => {
  if (!env.enableMqtt) {
    debug("MQTT disabled by ENABLE_MQTT flag");
    return;
  }

  if (sensorClient || remoteClient) {
    debug("MQTT clients already initialized");
    return;
  }

  sensorClient = createMqttClient({
    label: "sensor",
    username: env.mqttNodeUsername,
    password: env.mqttNodePassword,
    onConnect: (client) => {
      client.subscribe(SENSOR_TOPICS, (error, granted) => {
        if (error) {
          logMqttError("sensor subscribe failed", error);
          return;
        }
        debug("MQTT sensor subscribed", granted);
      });
    },
  });

  remoteClient = createMqttClient({
    label: "remote",
    username: env.mqttDeviceUsername,
    password: env.mqttDevicePassword,
  });

  if (!sensorClient) {
    debug("MQTT sensor client not configured");
    return;
  }

  sensorClient.on("message", async (topic, data) => {
    try {
      const payload = data.toString();
      const parsedMessages = parseSensorMessages(payload, topic);
      if (parsedMessages.length === 0) {
        debug("MQTT message ignored (empty payload)", { topic });
        return;
      }

      if (parsedMessages.length > 1) {
        debug("MQTT batch payload detected", {
          topic,
          count: parsedMessages.length,
        });
      }

      const pumpCache = new Map();
      for (const parsedMessage of parsedMessages) {
        const metric = parsedMessage.metric || getMetricFromTopic(parsedMessage.topic);
        const messageTopic = parsedMessage.topic || topic;
        const { pumpId, value } = parsedMessage;

        if (metric === "unknown") {
          debug("MQTT message ignored (unsupported topic)", { topic: messageTopic });
          continue;
        }

        if (!pumpId) {
          debug("MQTT message ignored (missing pumpId)", {
            topic: messageTopic,
            payload,
          });
          continue;
        }

        if (value === "") {
          debug("MQTT message ignored (missing value)", {
            topic: messageTopic,
            pumpId,
            payload,
          });
          continue;
        }

        const cacheKey = String(pumpId).trim();
        if (!pumpCache.has(cacheKey)) {
          const pump = await Pump.findOne({ serial_id: cacheKey });
          pumpCache.set(cacheKey, pump || null);
        }
        const pump = pumpCache.get(cacheKey);
        if (!pump) {
          debug("MQTT message ignored (pump not found)", {
            topic: messageTopic,
            pumpId: cacheKey,
          });
          continue;
        }

        if (metric === "pressure") {
          await P_Sensor.create({ pump_id: cacheKey, sensorValue: value });
        } else if (metric === "flow") {
          await F_Sensor.create({ pump_id: cacheKey, sensorValue: String(value) });
        } else if (metric === "temperature") {
          await T_Sensor.create({ pump_id: cacheKey, sensorValue: String(value) });
        } else if (metric === "speed") {
          await S_Sensor.create({ pump_id: cacheKey, sensorValue: String(value) });
        }

        await maybeCreateAlert({
          pumpId: cacheKey,
          pumpName: pump.name,
          ownerUserId: pump.userId || null,
          value,
          metric,
        });
        const io = getSocketIo();
        if (io) {
          io.to(monitoringRoomsForOwner(pump.userId || null)).emit("sensor:update", {
            pumpId: cacheKey,
            pumpName: pump.name,
            metric,
            topic: messageTopic,
            value,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      debug("MQTT message handling failed", error);
    }
  });
};

export const selectRiverController = async (req, res) => {
  try {
    if (!env.enableMqtt) {
      return res.status(503).json({ message: "MQTT is disabled" });
    }

    if (!remoteClient) {
      return res
        .status(500)
        .json({ message: "MQTT remote client not configured" });
    }

    if (!remoteClient.connected) {
      return res
        .status(503)
        .json({ message: "MQTT remote client is not connected" });
    }

    const user = req.user;
    const { pump_id, river_id } = req.body || {};
    if (!pump_id || river_id === undefined || river_id === null) {
      return res
        .status(400)
        .json({ message: "pump_id and river_id are required" });
    }

    const validatedPump = await findControllablePump({
      pumpSerialId: pump_id,
      user,
    });
    if (!validatedPump.pump) {
      return res.status(validatedPump.status).json({
        message: validatedPump.message || "Unable to validate pump",
      });
    }
    const pump = validatedPump.pump;

    const normalizedRiverId = String(river_id).trim();
    const numericRiverId = Number(normalizedRiverId);
    if (!normalizedRiverId || !Number.isFinite(numericRiverId)) {
      return res.status(400).json({
        message: "river_id must be a numeric value",
      });
    }

    const river = await River.findOne({ river_id: numericRiverId }).lean();
    if (!river) {
      return res.status(404).json({ message: "River not found" });
    }

    const payload = JSON.stringify({
      pump_id: String(pump.serial_id),
      command: "RIVER_SELECT",
      river_id: river.river_id,
      river_name: String(river.river_name ?? "").trim(),
      lat: Number(river.lat),
      lon: Number(river.lon),
      discharge: String(river.discharge_value ?? "").trim(),
      discharge_id: river.discharge_id,
      requested_by: String(user._id),
      requested_at: new Date().toISOString(),
    });

    await publishRemotePayload(REMOTE_CONTROL_TOPIC, payload).catch((error) => {
      debug("MQTT river selection publish failed", error);
      throw error;
    });

    return res.status(200).json({
      message: `River selection sent to ${REMOTE_CONTROL_TOPIC}`,
    });
  } catch (error) {
    debug("selectRiverController failed", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const remoteController = async (req, res) => {
  try {
    if (!env.enableMqtt) {
      return res.status(503).json({ message: "MQTT is disabled" });
    }

    if (!remoteClient) {
      return res
        .status(500)
        .json({ message: "MQTT remote client not configured" });
    }

    if (!remoteClient.connected) {
      return res
        .status(503)
        .json({ message: "MQTT remote client is not connected" });
    }

    const user = req.user;
    const { pump_id, message } = req.body || {};
    if (!pump_id || !message) {
      return res
        .status(400)
        .json({ message: "pump_id and message are required" });
    }

    const pump = await Pump.findOne({ serial_id: String(pump_id) });
    if (!pump) {
      return res.status(404).json({ message: "Pump not found" });
    }

    if (
      !user?._id ||
      !pump.userId ||
      String(pump.userId) !== String(user._id)
    ) {
      return res
        .status(403)
        .json({ message: "You can only control pumps that you own" });
    }

    if (!pump.purchasedAt) {
      return res.status(403).json({
        message: "Pump must be purchased before remote control is enabled",
      });
    }

    if (!pump.registeredAt) {
      return res.status(403).json({
        message: "Pump must be registered before remote control is enabled",
      });
    }

    const parsedCommand = parseRemoteCommand(message);
    if (!parsedCommand) {
      return res.status(400).json({
        message:
          "Invalid command. Use ON, OFF, or SPEED:<0-100> (for example SPEED:65).",
      });
    }

    const payload = JSON.stringify({
      pump_id: String(pump.serial_id),
      command: parsedCommand.command,
      speed: parsedCommand.speed,
      requested_by: String(user._id),
      requested_at: new Date().toISOString(),
    });

    await publishRemotePayload(REMOTE_CONTROL_TOPIC, payload).catch((error) => {
      debug("MQTT remote publish failed", error);
      throw error;
    });

    return res.status(200).json({
      message: `Command sent to ${REMOTE_CONTROL_TOPIC}`,
    });
  } catch (error) {
    debug("remoteController failed", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
