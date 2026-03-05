import createDebug from "debug";
import Pump from "../models/Pump.js";
import { env } from "../config/env.js";
import { calculatePumpPrice } from "../utils/pricing.js";
import {
  createPumpPaymentIntent,
  isStripeEnabled,
} from "../services/stripeService.js";

const debug = createDebug("app:payment");

export const createPaymentIntent = async (req, res) => {
  try {
    const { serial_id } = req.body || {};
    const user = req.user;

    if (!serial_id) {
      return res.status(400).json({ message: "serial_id is required" });
    }

    if (!user?._id || !user?.email) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const pump = await Pump.findOne({ serial_id: String(serial_id).trim() });
    if (!pump) {
      return res.status(404).json({ message: "Pump not found" });
    }

    if (pump.userId && String(pump.userId) !== String(user._id)) {
      return res
        .status(409)
        .json({ message: "Pump has already been purchased by another account" });
    }

    if (pump.userId && String(pump.userId) === String(user._id)) {
      return res.status(200).json({
        message: "You already purchased this pump",
        alreadyPurchased: true,
        serial_id: pump.serial_id,
      });
    }

    const amountUsd = calculatePumpPrice(pump.capacity);

    if (!isStripeEnabled()) {
      if (env.allowCardlessPurchases) {
        return res.status(200).json({
          message: "Cardless fallback mode is enabled",
          payment_provider: "simulated",
          card_required: false,
          amount_usd: amountUsd,
          currency: "usd",
          serial_id: pump.serial_id,
        });
      }

      return res.status(503).json({
        message: "Stripe payment provider is not configured",
      });
    }

    const intent = await createPumpPaymentIntent({
      amountUsd,
      serialId: pump.serial_id,
      pumpMongoId: pump._id,
      userId: user._id,
      userEmail: user.email,
    });

    return res.status(200).json({
      payment_provider: "stripe",
      payment_intent_id: intent.id,
      client_secret: intent.client_secret,
      publishable_key: env.stripePublishableKey,
      card_required: true,
      amount_usd: amountUsd,
      currency: "usd",
      serial_id: pump.serial_id,
    });
  } catch (error) {
    debug("createPaymentIntent failed", error);
    return res.status(500).json({ message: "Unable to create payment intent" });
  }
};
