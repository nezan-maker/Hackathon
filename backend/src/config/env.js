import dotenv from "dotenv";

dotenv.config({ quiet: true });

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback = false) => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const toTrimmedString = (value) => String(value || "").trim();

const parseOrigins = (value) =>
  (value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const unique = (values) => [...new Set(values.filter(Boolean))];

const parseSecretList = (value) =>
  (value || "")
    .split(",")
    .map((secret) => secret.trim())
    .filter(Boolean);

const parseEmailList = (value) =>
  (value || "")
    .split(",")
    .map((email) => email.toLowerCase().trim())
    .filter(Boolean);

const isProduction = (process.env.NODE_ENV || "development") === "production";

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction,
  port: toNumber(process.env.PORT, 5500),
  mongoUri: process.env.MONGO_URI || "",
  authSecret: process.env.AUTH_SECRET || "",
  refreshSecret: process.env.REFRESH_SECRET || "",
  authSecrets: parseSecretList(process.env.AUTH_SECRETS || process.env.AUTH_SECRET || ""),
  refreshSecrets: parseSecretList(
    process.env.REFRESH_SECRETS || process.env.REFRESH_SECRET || "",
  ),
  smtpUser: process.env.USER_NAME || "",
  smtpPass: process.env.USER_PASS || "",
  resendApiName: toTrimmedString(process.env.RESEND_API_NAME),
  resendApiKey: toTrimmedString(process.env.RESEND_API_KEY),
  frontendAppUrl: toTrimmedString(process.env.FRONTEND_APP_URL),
  backendAppUrl: toTrimmedString(process.env.BACKEND_APP_URL),
  trustProxy: process.env.TRUST_PROXY || (isProduction ? "1" : "loopback"),
  corsOrigins: unique([
    ...parseOrigins(
      process.env.CORS_ORIGINS ||
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5500,http://127.0.0.1:5500",
    ),
    toTrimmedString(process.env.FRONTEND_APP_URL),
  ]),
  geoIpBaseUrl: process.env.GEO_IP_BASE_URL || "https://ipwho.is",
  geoIpTimeoutMs: toNumber(process.env.GEO_IP_TIMEOUT_MS, 2500),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
  allowCardlessPurchases: toBoolean(process.env.ALLOW_CARDLESS_PURCHASES),
  adminEmails: parseEmailList(process.env.ADMIN_EMAILS || ""),
  enableMqtt: toBoolean(process.env.ENABLE_MQTT),
  mqttBrokerUrl: toTrimmedString(process.env.MQTT_BROKER_URL),
  mqttBrokerHost: toTrimmedString(process.env.MQTT_BROKER_HOST),
  mqttBrokerPort: toNumber(process.env.MQTT_BROKER_PORT, 8883),
  mqttNodeUsername: toTrimmedString(process.env.MQTT_NODE_USERNAME),
  mqttNodePassword: toTrimmedString(process.env.MQTT_NODE_PASSWORD),
  mqttDeviceUsername: toTrimmedString(process.env.MQTT_DEVICE_USERNAME),
  mqttDevicePassword: toTrimmedString(process.env.MQTT_DEVICE_PASSWORD),
};

export const ensureRequiredEnv = (...keys) => {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
};

const hasWeakSecret = (secret) => {
  if (!secret || secret.length < 32) return true;
  const weakValues = [
    "changeme",
    "secret",
    "password",
    "replace-with-strong-random-secret",
    "replace-with-another-strong-random-secret",
  ];
  return weakValues.includes(secret.toLowerCase());
};

export const validateProductionConfig = () => {
  if (!env.isProduction) return;

  if (env.authSecrets.length === 0 || env.refreshSecrets.length === 0) {
    throw new Error("AUTH_SECRETS/REFRESH_SECRETS must be configured in production");
  }

  if (hasWeakSecret(env.authSecrets[0]) || hasWeakSecret(env.refreshSecrets[0])) {
    throw new Error("Production JWT secrets are weak. Use strong random values (32+ chars).");
  }

  const hasLocalOrigins = env.corsOrigins.some((origin) =>
    /localhost|127\.0\.0\.1/.test(origin),
  );

  if (hasLocalOrigins) {
    throw new Error("CORS_ORIGINS must not include localhost in production");
  }
};

export const validateMqttConfig = () => {
  if (!env.enableMqtt) return;

  const missing = [];
  if (!env.mqttBrokerUrl && !env.mqttBrokerHost) {
    missing.push("MQTT_BROKER_URL or MQTT_BROKER_HOST");
  }
  if (!env.mqttNodeUsername) missing.push("MQTT_NODE_USERNAME");
  if (!env.mqttNodePassword) missing.push("MQTT_NODE_PASSWORD");
  if (!env.mqttDeviceUsername) missing.push("MQTT_DEVICE_USERNAME");
  if (!env.mqttDevicePassword) missing.push("MQTT_DEVICE_PASSWORD");

  if (missing.length > 0) {
    throw new Error(`Missing required MQTT environment variables: ${missing.join(", ")}`);
  }
};
