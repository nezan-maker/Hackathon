import mongoose from "mongoose";
import createDebug from "debug";
import User from "../models/User.js";
import { env, ensureRequiredEnv } from "./env.js";

const debug = createDebug("app:db");

const ensureUserIndexes = async () => {
  try {
    const indexes = await User.collection.indexes();
    const serialIndex = indexes.find(
      (index) => index?.key?.serialCode === 1,
    );

    const needsRecreate =
      serialIndex && (!serialIndex.unique || !serialIndex.sparse);

    if (needsRecreate) {
      await User.collection.dropIndex(serialIndex.name);
      debug("Dropped legacy serialCode index", serialIndex.name);
    }

    if (!serialIndex || needsRecreate) {
      await User.collection.createIndex(
        { serialCode: 1 },
        { name: "serialCode_1", unique: true, sparse: true },
      );
      debug("Ensured serialCode sparse unique index");
    }
  } catch (error) {
    debug("Failed to ensure user indexes", error);
  }
};

export const connectDB = async () => {
  ensureRequiredEnv("MONGO_URI");
  const connection = await mongoose.connect(env.mongoUri, {
    autoIndex: env.nodeEnv !== "production",
  });
  await ensureUserIndexes();
  debug("MongoDB connected", connection.connection.name);
  return connection;
};

export const cleanUpUnverifiedUsers = () => {
  return setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await User.deleteMany({
        isVerified: false,
        createdAt: { $lt: cutoff },
      });
    } catch (error) {
      debug("Cleanup job failed", error);
    }
  }, 10 * 60 * 1000);
};
