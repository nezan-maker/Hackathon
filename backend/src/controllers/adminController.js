import crypto from "crypto";
import createDebug from "debug";
import Pump from "../models/Pump.js";
import User from "../models/User.js";
import { Alert, F_Sensor, P_Sensor, S_Sensor, T_Sensor } from "../models/Sensor.js";
import { calculatePumpPrice } from "../utils/pricing.js";
import { normalizeCloudinaryUrl } from "../utils/cloudinary.js";

const debug = createDebug("app:admin");

const generateSerialId = () =>
  crypto.randomInt(0, 1000000).toString().padStart(6, "0");

const buildUniqueSerialId = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const serial = generateSerialId();
    const exists = await Pump.findOne({ serial_id: serial }).select({ _id: 1 });
    if (!exists) {
      return serial;
    }
  }

  throw new Error("Unable to generate unique pump serial");
};

const toNumeric = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const mapAlertStatusSummary = (alerts) => {
  const summary = {
    active: 0,
    acknowledged: 0,
    resolved: 0,
  };

  for (const alert of alerts) {
    if (alert.status === "resolved") summary.resolved += 1;
    else if (alert.status === "acknowledged") summary.acknowledged += 1;
    else summary.active += 1;
  }

  return summary;
};

const mapLatestTelemetry = (docs, metric) =>
  docs.map((doc) => ({
    metric,
    pump_id: String(doc.pump_id),
    value: toNumeric(doc.sensorValue),
    timestamp: doc.createdAt,
  }));

export const adminOverview = async (_req, res) => {
  try {
    const [
      totalUsers,
      totalAdmins,
      totalPumps,
      purchasedPumps,
      registeredPumps,
      alerts,
      recentPumps,
      recentUsers,
      recentAlerts,
      latestPressure,
      latestFlow,
      latestTemp,
      latestSpeed,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "admin" }),
      Pump.countDocuments(),
      Pump.countDocuments({ purchasedAt: { $ne: null } }),
      Pump.countDocuments({ registeredAt: { $ne: null } }),
      Alert.find().sort({ createdAt: -1 }).limit(400).lean(),
      Pump.find().sort({ createdAt: -1 }).limit(50).lean(),
      User.find({}, { first_name: 1, last_name: 1, email: 1, role: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Alert.find().sort({ createdAt: -1 }).limit(50).lean(),
      P_Sensor.find().sort({ createdAt: -1 }).limit(30).lean(),
      F_Sensor.find().sort({ createdAt: -1 }).limit(30).lean(),
      T_Sensor.find().sort({ createdAt: -1 }).limit(30).lean(),
      S_Sensor.find().sort({ createdAt: -1 }).limit(30).lean(),
    ]);

    const pumpNameBySerial = new Map(
      recentPumps.map((pump) => [String(pump.serial_id), pump.name]),
    );

    const alertStatus = mapAlertStatusSummary(alerts);
    const availablePumps = Math.max(0, totalPumps - purchasedPumps);

    return res.status(200).json({
      stats: {
        users: totalUsers,
        admins: totalAdmins,
        pumps: totalPumps,
        availablePumps,
        purchasedPumps,
        registeredPumps,
        alertsTotal: alerts.length,
        alertsActive: alertStatus.active,
        alertsAcknowledged: alertStatus.acknowledged,
        alertsResolved: alertStatus.resolved,
      },
      recent: {
        users: recentUsers.map((user) => ({
          id: String(user._id),
          name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
          email: user.email,
          role: user.role || "user",
          createdAt: user.createdAt,
        })),
        pumps: recentPumps.map((pump) => ({
          id: String(pump._id),
          name: pump.name,
          serial_id: pump.serial_id,
          url: pump.url,
          capacity: pump.capacity,
          createdByAdmin: Boolean(pump.createdByAdmin),
          imageProvider: pump.imageProvider || "external",
          userId: pump.userId || null,
          purchasedAt: pump.purchasedAt || null,
          registeredAt: pump.registeredAt || null,
          price_usd: calculatePumpPrice(pump.capacity),
          createdAt: pump.createdAt,
        })),
        alerts: recentAlerts.map((alert) => ({
          id: String(alert._id),
          pumpId: String(alert.pump_id),
          pumpName:
            pumpNameBySerial.get(String(alert.pump_id)) || `Pump ${String(alert.pump_id)}`,
          type: alert.type || "sensor-failure",
          severity: alert.severity || "warning",
          status: alert.status || "active",
          message: alert.message || alert.sensorValue,
          timestamp: alert.createdAt,
        })),
      },
      telemetry: {
        pressure: mapLatestTelemetry(latestPressure, "pressure"),
        flow: mapLatestTelemetry(latestFlow, "flow"),
        temperature: mapLatestTelemetry(latestTemp, "temperature"),
        speed: mapLatestTelemetry(latestSpeed, "speed"),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    debug("adminOverview failed", error);
    return res.status(500).json({ message: "Unable to load admin overview" });
  }
};

export const adminListPumps = async (_req, res) => {
  try {
    const pumps = await Pump.find().sort({ createdAt: -1 });
    const ownerIds = [
      ...new Set(
        pumps
          .map((pump) => String(pump.userId || "").trim())
          .filter(Boolean),
      ),
    ];
    const owners = ownerIds.length
      ? await User.find(
          { _id: { $in: ownerIds } },
          { first_name: 1, last_name: 1, email: 1 },
        )
      : [];
    const ownerMap = new Map(owners.map((owner) => [String(owner._id), owner]));

    const mapped = pumps.map((pump) => {
      const owner = pump.userId ? ownerMap.get(String(pump.userId)) : null;
      return {
        _id: String(pump._id),
        name: pump.name,
        serial_id: pump.serial_id,
        url: pump.url,
        createdByAdmin: Boolean(pump.createdByAdmin),
        imageProvider: pump.imageProvider || "external",
        capacity: pump.capacity,
        userId: pump.userId || null,
        owner: owner
          ? {
              name: `${owner.first_name || ""} ${owner.last_name || ""}`.trim(),
              email: owner.email,
            }
          : null,
        purchasedAt: pump.purchasedAt || null,
        registeredAt: pump.registeredAt || null,
        price_usd: calculatePumpPrice(pump.capacity),
        createdAt: pump.createdAt,
      };
    });

    return res.status(200).json({ pumps: mapped });
  } catch (error) {
    debug("adminListPumps failed", error);
    return res.status(500).json({ message: "Unable to list pumps" });
  }
};

export const adminCreatePump = async (req, res) => {
  try {
    const { name, capacity, url, serial_id } = req.body || {};

    if (!name || !capacity || !url) {
      return res.status(400).json({ message: "name, capacity and url are required" });
    }

    const normalizedName = String(name).trim();
    const numericCapacity = toNumeric(capacity);
    if (!normalizedName) {
      return res.status(400).json({ message: "name is required" });
    }
    if (!numericCapacity || numericCapacity <= 0) {
      return res.status(400).json({ message: "capacity must be a positive number" });
    }

    const normalizedImage = normalizeCloudinaryUrl(url);
    if (!normalizedImage.valid) {
      return res.status(400).json({ message: normalizedImage.message });
    }

    const incomingSerial = serial_id ? String(serial_id).trim() : "";
    const serial = incomingSerial || (await buildUniqueSerialId());
    const existing = await Pump.findOne({ serial_id: serial });
    if (existing) {
      return res.status(409).json({ message: "serial_id already exists" });
    }

    const pump = await Pump.create({
      name: normalizedName,
      serial_id: serial,
      url: normalizedImage.url,
      capacity: Number(numericCapacity),
      createdByAdmin: true,
      imageProvider: "cloudinary",
      userId: null,
      purchasedAt: null,
      registeredAt: null,
      purchaseReceipt: {
        transactionId: null,
        cardLast4: null,
        cardBrand: null,
        amountUsd: null,
        purchasedByEmail: null,
      },
    });

    return res.status(201).json({
      message: "Pump added to catalog successfully",
      pump: {
        _id: String(pump._id),
        name: pump.name,
        serial_id: pump.serial_id,
        url: pump.url,
        capacity: pump.capacity,
        createdByAdmin: pump.createdByAdmin,
        imageProvider: pump.imageProvider,
        price_usd: calculatePumpPrice(pump.capacity),
        createdAt: pump.createdAt,
      },
    });
  } catch (error) {
    debug("adminCreatePump failed", error);
    return res.status(500).json({ message: "Unable to create pump" });
  }
};
