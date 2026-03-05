import express from "express";
import {
  nearestRiversController,
  remoteController,
  selectRiverController,
} from "../controllers/mqttController.js";
import { authMiddleware } from "../controllers/userController.js";

const createRemoteRoute = () => {
  const router = express.Router();
  router.get("/rivers/nearest", authMiddleware, nearestRiversController);
  router.post("/rivers/select", authMiddleware, selectRiverController);
  router.post("/control", authMiddleware, remoteController);
  return router;
};

export default createRemoteRoute;
