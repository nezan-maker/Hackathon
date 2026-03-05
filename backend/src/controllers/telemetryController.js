import createDebug from "debug";
import Pump from "../models/Pump.js";
import { Alert, F_Sensor, P_Sensor, S_Sensor, T_Sensor } from "../models/Sensor.js";
import {
  filterPumpsOwnedByUser,
  isAdminUser,
  isPumpOwnedByUser,
} from "../utils/accessControl.js";

const debug = createDebug("app:telemetry");

const clampLimit = (value, fallback = 60) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(10, Math.min(500, Math.floor(parsed)));
};

const toNumberOrNull = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeMetricDocs = (docs, metric) =>
  docs
    .map((doc) => ({
      metric,
      pump_id: String(doc.pump_id),
      value: toNumberOrNull(doc.sensorValue),
      timestamp: doc.createdAt,
    }))
    .filter((item) => item.value !== null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

const buildAlertSummary = (alerts) => {
  const summary = {
    total: alerts.length,
    active: 0,
    acknowledged: 0,
    resolved: 0,
    criticalActive: 0,
  };

  for (const alert of alerts) {
    const status = alert.status || "active";
    if (status === "active") summary.active += 1;
    if (status === "acknowledged") summary.acknowledged += 1;
    if (status === "resolved") summary.resolved += 1;

    if (status === "active" && alert.severity === "critical") {
      summary.criticalActive += 1;
    }
  }

  return summary;
};

export const telemetryOverview = async (req, res) => {
  try {
    const user = req.user;
    if (!user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const limit = clampLimit(req.query.limit, 80);
    const isAdmin = isAdminUser(user);
    const pumpCandidates = await Pump.find(
      isAdmin ? {} : { userId: { $exists: true, $ne: null } },
      {
        _id: 1,
        name: 1,
        serial_id: 1,
        userId: 1,
        purchasedAt: 1,
        registeredAt: 1,
      },
    )
      .sort({ createdAt: -1 })
      .lean();
    const pumps = isAdmin
      ? pumpCandidates
      : filterPumpsOwnedByUser(pumpCandidates, user);

    const allowedPumpIds = pumps.map((pump) => String(pump.serial_id));
    const sensorFilter =
      isAdmin || allowedPumpIds.length > 0
        ? (isAdmin ? {} : { pump_id: { $in: allowedPumpIds } })
        : { pump_id: { $in: [] } };
    const alertFilter =
      isAdmin || allowedPumpIds.length > 0
        ? (isAdmin ? {} : { pump_id: { $in: allowedPumpIds } })
        : { pump_id: { $in: [] } };

    const [pressureDocs, flowDocs, tempDocs, speedDocs, alerts] = await Promise.all([
      P_Sensor.find(sensorFilter).sort({ createdAt: -1 }).limit(limit).lean(),
      F_Sensor.find(sensorFilter).sort({ createdAt: -1 }).limit(limit).lean(),
      T_Sensor.find(sensorFilter).sort({ createdAt: -1 }).limit(limit).lean(),
      S_Sensor.find(sensorFilter).sort({ createdAt: -1 }).limit(limit).lean(),
      Alert.find(alertFilter).sort({ createdAt: -1 }).limit(200).lean(),
    ]);

    const pumpNameBySerial = new Map(
      pumps.map((pump) => [String(pump.serial_id), pump.name]),
    );

    const pressure = normalizeMetricDocs(pressureDocs, "pressure").map((item) => ({
      ...item,
      pump_name: pumpNameBySerial.get(item.pump_id) || `Pump ${item.pump_id}`,
    }));
    const flow = normalizeMetricDocs(flowDocs, "flow").map((item) => ({
      ...item,
      pump_name: pumpNameBySerial.get(item.pump_id) || `Pump ${item.pump_id}`,
    }));
    const temperature = normalizeMetricDocs(tempDocs, "temperature").map((item) => ({
      ...item,
      pump_name: pumpNameBySerial.get(item.pump_id) || `Pump ${item.pump_id}`,
    }));
    const speed = normalizeMetricDocs(speedDocs, "speed").map((item) => ({
      ...item,
      pump_name: pumpNameBySerial.get(item.pump_id) || `Pump ${item.pump_id}`,
    }));

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      pumps,
      alerts: buildAlertSummary(alerts),
      series: {
        pressure,
        flow,
        temperature,
        speed,
      },
    });
  } catch (error) {
    debug("telemetryOverview failed", error);
    return res.status(500).json({ message: "Unable to fetch telemetry overview" });
  }
};

export const pumpTelemetry = async (req, res) => {
  try {
    const serialId = String(req.params.serial_id || "").trim();
    const user = req.user;
    const limit = clampLimit(req.query.limit, 80);

    if (!serialId) {
      return res.status(400).json({ message: "serial_id is required" });
    }

    if (!user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const pump = await Pump.findOne({ serial_id: serialId }).lean();
    if (!pump) {
      return res.status(404).json({ message: "Pump not found" });
    }

    if (!isPumpOwnedByUser(pump, user)) {
      return res
        .status(403)
        .json({ message: "You can only view telemetry for pumps that you own" });
    }

    const [pressureDocs, flowDocs, tempDocs, speedDocs] = await Promise.all([
      P_Sensor.find({ pump_id: serialId }).sort({ createdAt: -1 }).limit(limit).lean(),
      F_Sensor.find({ pump_id: serialId }).sort({ createdAt: -1 }).limit(limit).lean(),
      T_Sensor.find({ pump_id: serialId }).sort({ createdAt: -1 }).limit(limit).lean(),
      S_Sensor.find({ pump_id: serialId }).sort({ createdAt: -1 }).limit(limit).lean(),
    ]);

    const pressure = normalizeMetricDocs(pressureDocs, "pressure");
    const flow = normalizeMetricDocs(flowDocs, "flow");
    const temperature = normalizeMetricDocs(tempDocs, "temperature");
    const speed = normalizeMetricDocs(speedDocs, "speed");

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      pump: {
        _id: String(pump._id),
        name: pump.name,
        serial_id: pump.serial_id,
        capacity: pump.capacity,
        userId: pump.userId || null,
        purchasedAt: pump.purchasedAt || null,
        registeredAt: pump.registeredAt || null,
      },
      latest: {
        pressure: pressure[pressure.length - 1]?.value ?? null,
        flow: flow[flow.length - 1]?.value ?? null,
        temperature: temperature[temperature.length - 1]?.value ?? null,
        speed: speed[speed.length - 1]?.value ?? null,
      },
      series: {
        pressure,
        flow,
        temperature,
        speed,
      },
    });
  } catch (error) {
    debug("pumpTelemetry failed", error);
    return res.status(500).json({ message: "Unable to fetch pump telemetry" });
  }
};
