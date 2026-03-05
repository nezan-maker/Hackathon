import mongoose from "mongoose";

const riverSchema = new mongoose.Schema(
  {
    river_id: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    river_name: {
      type: String,
      required: true,
      trim: true,
    },
    lat: {
      type: Number,
      required: true,
    },
    lon: {
      type: Number,
      required: true,
    },
    discharge_id: {
      type: Number,
      required: true,
    },
    discharge_value: {
      type: String,
      required: true,
      trim: true,
    },
    distance_km: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    versionKey: false,
  },
);

const River = mongoose.model("River", riverSchema);

export default River;
