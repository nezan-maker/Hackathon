import express from "express";
import { remoteController } from "../controllers/mqttController.js";
import { authMiddleware } from "../controllers/userController.js";

const createRemoteRoute = () => {
  const router = express.Router();
  router.post("/control", authMiddleware, remoteController);
  return router;
};

export default createRemoteRoute;
