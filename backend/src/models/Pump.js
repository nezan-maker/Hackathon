import mongoose from "mongoose";

const pumpSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: String,
      default: null,
      index: true,
    },
    serial_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    createdByAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
    imageProvider: {
      type: String,
      default: "external",
      trim: true,
    },
    purchasedAt: {
      type: Date,
      default: null,
    },
    registeredAt: {
      type: Date,
      default: null,
    },
    purchaseReceipt: {
      transactionId: {
        type: String,
        default: null,
      },
      cardLast4: {
        type: String,
        default: null,
      },
      cardBrand: {
        type: String,
        default: null,
      },
      amountUsd: {
        type: Number,
        default: null,
      },
      purchasedByEmail: {
        type: String,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  },
);

const Pump = mongoose.model("Pump", pumpSchema);
export default Pump;
