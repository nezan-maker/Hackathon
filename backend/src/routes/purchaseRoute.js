import express from "express"
import {
    purchasePump,
    registerPump,
    confirmPumpInstallation,
    advertPump,
    myPurchasedPumps,
    publicCatalogPumps,
    getAlerts,
    acknowledgeAlert,
    resolveAlert,
} from "../controllers/purchaseController.js"
import { createPaymentIntent } from "../controllers/paymentController.js";
import {
    pumpTelemetry,
    telemetryOverview,
} from "../controllers/telemetryController.js";
import { authMiddleware } from "../controllers/userController.js"
const createPurchaseRoutes = () => {
    const router = express.Router()
    router.get("/home", advertPump)
    router.get("/installations/confirm", confirmPumpInstallation)
    router.get("/my-pumps", authMiddleware, myPurchasedPumps)
    router.get("/catalog", publicCatalogPumps)
    router.get("/alerts", authMiddleware, getAlerts)
    router.get("/telemetry/overview", authMiddleware, telemetryOverview)
    router.get("/telemetry/pump/:serial_id", authMiddleware, pumpTelemetry)
    router.post("/payments/create-intent", authMiddleware, createPaymentIntent)
    router.post("/alerts/:id/acknowledge", authMiddleware, acknowledgeAlert)
    router.post("/alerts/:id/resolve", authMiddleware, resolveAlert)
    router.post("/purchase", authMiddleware, purchasePump)
    router.post("/register", authMiddleware, registerPump)
    return router
}
export default createPurchaseRoutes;
