import Pump from "../models/Pump.js";
import { Alert, F_Sensor, P_Sensor, S_Sensor, T_Sensor } from "../models/Sensor.js";

export const overView = async (_req, res) => {
  try {
    const [totalPumps, activeAlerts] = await Promise.all([
      Pump.countDocuments(),
      Alert.countDocuments(),
    ]);

    return res.status(200).json({
      totalPumps,
      activeAlerts,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const purchasedPumps = async (_req, res) => {
  try {
    const pumps = await Pump.find().sort({ createdAt: -1 });
    return res.status(200).json({ pumps });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const userPumpRegister = async (req, res) => {
  try {
    const { serial_id } = req.body || {};
    if (!serial_id) {
      return res.status(400).json({ message: "serial_id is required" });
    }

    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const pump = await Pump.findOne({ serial_id: String(serial_id).trim() });
    if (!pump) {
      return res.status(404).json({ message: "Pump not found" });
    }

    pump.userId = String(req.user._id);
    await pump.save();

    return res.status(200).json({ message: "Pump registered to user successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const registerPage = async (_req, res) => {
  return res.status(200).json({ message: "Use API endpoint POST /register-pump" });
};

export const pumpDetails = async (req, res) => {
  try {
    const pumpId = req.params.id;
    const pump = await Pump.findById(pumpId);

    if (!pump) {
      return res.status(404).json({ message: "Pump not found" });
    }

    const [pressure, flow, speed, temperature] = await Promise.all([
      P_Sensor.find({ pump_id: pump.serial_id }).sort({ createdAt: -1 }).limit(20),
      F_Sensor.find({ pump_id: pump.serial_id }).sort({ createdAt: -1 }).limit(20),
      S_Sensor.find({ pump_id: pump.serial_id }).sort({ createdAt: -1 }).limit(20),
      T_Sensor.find({ pump_id: pump.serial_id }).sort({ createdAt: -1 }).limit(20),
    ]);

    return res.status(200).json({
      pump,
      sensors: {
        pressure,
        flow,
        speed,
        temperature,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const dashAlerts = async (_req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 }).limit(200);
    return res.status(200).json({ alerts });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};
