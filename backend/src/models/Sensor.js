import mongoose from "mongoose";

const pressureSchema = new mongoose.Schema(
    {
        pump_id: {
            type: String,
            required: true,
        },
        sensorValue: {
            type: Number,
            required: true
        }

    },
    {
        timestamps: true,
    },
)
const flowSchema = new mongoose.Schema(
    {
        pump_id: {
            type: String,
            required: true,
        },
        sensorValue: {
            type: String,
            required: true
        }

    },
    {
        timestamps: true,
    },
)
const temperatureSchema = new mongoose.Schema(
    {
        pump_id: {
            type: String,
            required: true,
        },
        sensorValue: {
            type: String,
            required: true
        }

    },
    {
        timestamps: true,
    },
)
const speedSchema = new mongoose.Schema(
    {
        pump_id: {
            type: String,
            required: true
        },
        sensorValue: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true,
    },
)
const alertSchema = new mongoose.Schema({
    pump_id: {
        type: String,
        required: true
    },
    sensorValue: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["overpressure", "dry-run", "sensor-failure", "maintenance"],
        default: "sensor-failure",
    },
    severity: {
        type: String,
        enum: ["critical", "warning", "info"],
        default: "warning",
    },
    status: {
        type: String,
        enum: ["active", "acknowledged", "resolved"],
        default: "active",
    },
    acknowledgedAt: {
        type: Date,
        default: null,
    },
    resolvedAt: {
        type: Date,
        default: null,
    },
    message: {
        type: String,
        default: "",
    },

}, {
    timestamps: true
})
export const P_Sensor = mongoose.model("P_Sensor", pressureSchema)
export const T_Sensor = mongoose.model("T_Sensor", temperatureSchema)
export const F_Sensor = mongoose.model("F_Sensor", flowSchema)
export const S_Sensor = mongoose.model("S_Sensor", speedSchema)
export const Alert = mongoose.model("Alerts", alertSchema)
