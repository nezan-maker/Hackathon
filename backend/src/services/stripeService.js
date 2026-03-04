import { env } from "../config/env.js";
import { toUsdCents } from "../utils/pricing.js";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

const createFormParams = (payload) => {
  const params = new URLSearchParams();

  const appendValue = (key, value) => {
    if (value === undefined || value === null || value === "") return;

    if (Array.isArray(value)) {
      value.forEach((entry) => appendValue(`${key}[]`, entry));
      return;
    }

    if (typeof value === "object") {
      Object.entries(value).forEach(([childKey, childValue]) => {
        appendValue(`${key}[${childKey}]`, childValue);
      });
      return;
    }

    params.append(key, String(value));
  };

  Object.entries(payload).forEach(([key, value]) => appendValue(key, value));
  return params;
};

const stripeRequest = async (path, { method = "GET", body = null } = {}) => {
  if (!env.stripeSecretKey) {
    throw new Error("Stripe is not configured");
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.stripeSecretKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    const message = payload?.error?.message || "Stripe API request failed";
    throw new Error(message);
  }

  return payload;
};

export const isStripeEnabled = () =>
  Boolean(env.stripeSecretKey && env.stripePublishableKey);

export const createPumpPaymentIntent = async ({
  amountUsd,
  serialId,
  pumpMongoId,
  userId,
  userEmail,
}) => {
  const amount = toUsdCents(amountUsd);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid payment amount");
  }

  const body = createFormParams({
    amount,
    currency: "usd",
    automatic_payment_methods: {
      enabled: true,
    },
    receipt_email: userEmail || undefined,
    metadata: {
      serial_id: String(serialId),
      pump_id: String(pumpMongoId),
      user_id: String(userId),
    },
    description: `Pump purchase: ${serialId}`,
  });

  return stripeRequest("/payment_intents", {
    method: "POST",
    body,
  });
};

export const getPaymentIntent = async (paymentIntentId) => {
  const encoded = encodeURIComponent(String(paymentIntentId));
  return stripeRequest(`/payment_intents/${encoded}?expand[]=latest_charge`);
};
