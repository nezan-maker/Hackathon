import express from "express";
import {
  dashAlerts,
  overView,
  pumpDetails,
  purchasedPumps,
  registerPage,
  userPumpRegister,
} from "../controllers/dashController.js";

const createDashboardRoutes = () => {
  const router = express.Router();
  router.get("/dashboard", overView);
  router.get("/pumps", purchasedPumps);
  router.post("/register-pump", userPumpRegister);
  router.get("/register-pump", registerPage);
  router.get("/pumps/:id", pumpDetails);
  router.get("/alerts", dashAlerts);
  return router;
};

export default createDashboardRoutes;
