import express from "express";
import {
  adminCreatePump,
  adminConfirmPumpInstallation,
  adminListPumps,
  adminOverview,
} from "../controllers/adminController.js";
import { adminMiddleware, authMiddleware } from "../controllers/userController.js";

const createAdminRoutes = () => {
  const router = express.Router();

  router.use(authMiddleware, adminMiddleware);
  router.get("/overview", adminOverview);
  router.get("/pumps", adminListPumps);
  router.post("/pumps", adminCreatePump);
  router.post("/pumps/:serial_id/confirm-installation", adminConfirmPumpInstallation);

  return router;
};

export default createAdminRoutes;
