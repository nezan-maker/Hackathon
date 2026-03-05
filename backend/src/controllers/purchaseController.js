import crypto from "crypto";
import nodemailer from "nodemailer";
import createDebug from "debug";
import Pump from "../models/Pump.js";
import { Alert } from "../models/Sensor.js";
import { env } from "../config/env.js";
import { filterPumpsOwnedByUser, isAdminUser } from "../utils/accessControl.js";
import { monitoringRoomsForOwner } from "../utils/realtimeRooms.js";
import { calculatePumpPrice } from "../utils/pricing.js";
import { normalizeCloudinaryUrl } from "../utils/cloudinary.js";
import { getSocketIo } from "../services/socketService.js";
import {
  getPaymentIntent,
  isStripeEnabled,
} from "../services/stripeService.js";

const debug = createDebug("app:purchase");
const INSTALL_CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const createMailerTransport = () => {
  if (!env.smtpUser || !env.smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
};

const generateSerialId = () =>
  crypto.randomInt(0, 1000000).toString().padStart(6, "0");

const buildUniqueSerialId = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const serial = generateSerialId();
    const existing = await Pump.findOne({ serial_id: serial });
    if (!existing) return serial;
  }

  throw new Error("Unable to generate unique pump serial ID");
};

const getFrontendBaseUrl = () => {
  const explicit = String(env.frontendAppUrl || "").trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const fallbackFromCors = env.corsOrigins.find((origin) =>
    /^https?:\/\//i.test(String(origin || "").trim()),
  );

  if (fallbackFromCors) {
    return String(fallbackFromCors).replace(/\/+$/, "");
  }

  return "http://localhost:5173";
};

const buildRegisterPumpLink = (serialId) =>
  `${getFrontendBaseUrl()}/register-pump?serial_id=${encodeURIComponent(
    String(serialId || "").trim(),
  )}`;

const getBackendBaseUrl = (req) => {
  const explicit = String(env.backendAppUrl || "").trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    ?.trim();
  const protocol = forwardedProto || req?.protocol || "http";
  const host =
    (typeof req?.get === "function" ? String(req.get("host") || "") : "")
      .trim();

  if (host) {
    return `${protocol}://${host}`.replace(/\/+$/, "");
  }

  return "http://localhost:5500";
};

const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token || "")).digest("hex");

const buildInstallationConfirmationLink = ({ req, serialId, token }) =>
  `${getBackendBaseUrl(req)}/installations/confirm?serial_id=${encodeURIComponent(
    String(serialId || "").trim(),
  )}&token=${encodeURIComponent(String(token || "").trim())}`;

const buildRegisterRedirectLink = ({ serialId, installationStatus }) => {
  const redirectUrl = new URL(`${getFrontendBaseUrl()}/register-pump`);
  const normalizedSerialId = String(serialId || "").trim();
  const normalizedStatus = String(installationStatus || "").trim();

  if (normalizedSerialId) {
    redirectUrl.searchParams.set("serial_id", normalizedSerialId);
  }
  if (normalizedStatus) {
    redirectUrl.searchParams.set("installation", normalizedStatus);
  }

  return redirectUrl.toString();
};

const redirectToRegisterWithInstallationState = (res, payload) =>
  res.redirect(buildRegisterRedirectLink(payload));

const buildInstallationConfirmationEmailHtml = ({
  serialId,
  installationConfirmationLink,
  registrationLink,
}) => `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f0f2f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <tr>
    <td align="center" style="padding: 40px 16px;">
      <table cellpadding="0" cellspacing="0" role="presentation" style="
          background: #ffffff;
          margin: 0 auto;
          max-width: 600px;
          width: 100%;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        ">
        <tr>
          <td style="
              background: linear-gradient(135deg, #001f3f, #003366);
              padding: 30px;
              text-align: center;
              color: #ffffff;
            ">
            <h1 style="
                margin: 0;
                font-size: 22px;
                font-weight: 600;
                letter-spacing: 1px;
                text-transform: uppercase;
              ">
              Purchase Confirmed
            </h1>
          </td>
        </tr>

        <tr>
          <td style="padding: 40px 30px; text-align: center; background-color: #ffffff;">
            <p style="
                font-size: 16px;
                line-height: 1.6;
                color: #4b5563;
                margin: 0 0 20px;
              ">
              Your <strong>FlowBOT</strong> purchase is complete. Product key:
            </p>

            <div style="
                display: inline-block;
                padding: 14px 28px;
                margin: 0 0 24px;
                background-color: #f8fafc;
                border-radius: 8px;
                border: 2px solid #e2e8f0;
              ">
              <span style="
                  font-size: 28px;
                  font-weight: 800;
                  letter-spacing: 4px;
                  color: #001f3f;
                ">
                ${String(serialId || "").trim()}
              </span>
            </div>

            <p style="
                font-size: 15px;
                line-height: 1.6;
                color: #4b5563;
                margin: 0 0 22px;
              ">
              After installation is complete, click the button below to confirm installation. An admin will review and approve it, then you can register your pump and start remote monitoring.
            </p>

            <a href="${installationConfirmationLink}" style="
                display: inline-block;
                background: #001f3f;
                color: #ffffff;
                font-weight: 600;
                text-decoration: none;
                border-radius: 8px;
                padding: 12px 24px;
                margin: 0 0 20px;
              ">
              Confirm Installation
            </a>

            <p style="font-size: 13px; color: #64748b; margin: 0;">
              If the button does not work, use this link:<br />
              <a href="${installationConfirmationLink}" style="color: #0f4c81; word-break: break-all;">${installationConfirmationLink}</a>
            </p>
          </td>
        </tr>

        <tr>
          <td style="
              background-color: #f1f5f9;
              padding: 24px;
              text-align: center;
              font-size: 13px;
              color: #64748b;
              border-top: 1px solid #e2e8f0;
            ">
            <p style="margin: 0 0 8px; line-height: 1.5;">
              Registration page: <a href="${registrationLink}" style="color: #0f4c81;">${registrationLink}</a>
            </p>
            <p style="margin: 0; font-weight: 600; color: #001f3f;">© 2026 FlowBot Inc. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

const maskCardNumber = (cardNumber) => {
  const digits = String(cardNumber).replace(/\D/g, "");
  return digits.slice(-4);
};

const detectCardBrand = (cardNumber) => {
  const digits = String(cardNumber).replace(/\D/g, "");
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^6(?:011|5)/.test(digits)) return "discover";
  return "card";
};

const luhnCheck = (cardNumber) => {
  const digits = String(cardNumber).replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
};

const isExpiryValid = (month, year) => {
  const expiryMonth = Number(month);
  const expiryYear = Number(year);
  if (!Number.isInteger(expiryMonth) || expiryMonth < 1 || expiryMonth > 12) return false;
  if (!Number.isInteger(expiryYear) || expiryYear < 2000 || expiryYear > 2100) return false;

  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();
  if (expiryYear < currentYear) return false;
  if (expiryYear === currentYear && expiryMonth < currentMonth) return false;
  return true;
};

const validatePurchasePayload = (payload) => {
  const {
    cardNumber,
    cardholderName,
    expiryMonth,
    expiryYear,
    cvv,
    billingZip,
  } = payload || {};

  if (!cardNumber || !cardholderName || !expiryMonth || !expiryYear || !cvv || !billingZip) {
    return "cardNumber, cardholderName, expiryMonth, expiryYear, cvv and billingZip are required";
  }

  if (!luhnCheck(cardNumber)) {
    return "Invalid card number";
  }

  if (!isExpiryValid(expiryMonth, expiryYear)) {
    return "Invalid or expired card expiry date";
  }

  if (!/^\d{3,4}$/.test(String(cvv))) {
    return "Invalid CVV";
  }

  if (!/^[a-zA-Z0-9 -]{4,12}$/.test(String(billingZip).trim())) {
    return "Invalid billing ZIP/postal code";
  }

  if (String(cardholderName).trim().length < 3) {
    return "Cardholder name is too short";
  }

  return null;
};

const hasCardInput = (payload) => {
  const {
    cardNumber,
    expiryMonth,
    expiryYear,
    cvv,
  } = payload || {};

  return Boolean(
    cardNumber || expiryMonth || expiryYear || cvv,
  );
};

const getIntentChargeCardDetails = (intent) => {
  const charge = intent?.latest_charge;
  const card = charge?.payment_method_details?.card;

  return {
    brand: card?.brand || null,
    last4: card?.last4 || null,
  };
};

const getAlertPump = async (pumpId) =>
  Pump.findOne({ serial_id: String(pumpId || "").trim() }, { userId: 1, serial_id: 1 }).lean();

export const registerPump = async (req, res) => {
  try {
    const { serial_id } = req.body || {};
    const user = req.user;

    if (!serial_id) {
      return res.status(400).json({ message: "serial_id is required" });
    }

    const pump = await Pump.findOne({ serial_id: String(serial_id).trim() }).select(
      "+installationConfirmationTokenHash",
    );
    if (!pump) {
      return res.status(404).json({ message: "Pump not found" });
    }

    if (!pump.userId || String(pump.userId) !== String(user._id)) {
      return res.status(403).json({
        message: "You can only register pumps that you have purchased",
      });
    }

    if (!pump.purchasedAt) {
      return res.status(403).json({
        message: "Pump must be purchased before it can be registered",
      });
    }

    const installationWorkflowEnabled =
      Boolean(pump.installationConfirmationTokenHash) ||
      Boolean(pump.installationConfirmedAt) ||
      Boolean(pump.adminInstallationConfirmedAt);

    if (installationWorkflowEnabled && !pump.installationConfirmedAt) {
      return res.status(403).json({
        message:
          "Complete installation from the confirmation email before registering this pump",
      });
    }

    if (installationWorkflowEnabled && !pump.adminInstallationConfirmedAt) {
      return res.status(403).json({
        message:
          "Installation is waiting for admin confirmation before registration is allowed",
      });
    }

    if (pump.registeredAt) {
      return res.status(200).json({ message: "Pump is already registered", pump });
    }

    pump.registeredAt = new Date();
    await pump.save();

    return res.status(200).json({
      message: "Pump successfully registered",
      pump,
    });
  } catch (error) {
    debug("registerPump failed", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const confirmPumpInstallation = async (req, res) => {
  const serialId = String(req.query?.serial_id || "").trim();

  try {
    const token = String(req.query?.token || "").trim();
    if (!serialId || !token) {
      return redirectToRegisterWithInstallationState(res, {
        serialId,
        installationStatus: "invalid-link",
      });
    }

    const tokenHash = hashToken(token);
    const pump = await Pump.findOne({ serial_id: serialId }).select(
      "+installationConfirmationTokenHash",
    );

    if (!pump) {
      return redirectToRegisterWithInstallationState(res, {
        serialId,
        installationStatus: "invalid-link",
      });
    }

    if (pump.installationConfirmedAt) {
      return redirectToRegisterWithInstallationState(res, {
        serialId: pump.serial_id,
        installationStatus: "already-confirmed",
      });
    }

    if (
      !pump.installationConfirmationTokenHash ||
      pump.installationConfirmationTokenHash !== tokenHash
    ) {
      return redirectToRegisterWithInstallationState(res, {
        serialId: pump.serial_id,
        installationStatus: "invalid-link",
      });
    }

    if (
      !pump.installationConfirmationExpiresAt ||
      pump.installationConfirmationExpiresAt < new Date()
    ) {
      return redirectToRegisterWithInstallationState(res, {
        serialId: pump.serial_id,
        installationStatus: "link-expired",
      });
    }

    pump.installationConfirmedAt = new Date();
    pump.installationConfirmationTokenHash = null;
    pump.installationConfirmationExpiresAt = null;
    await pump.save();

    return redirectToRegisterWithInstallationState(res, {
      serialId: pump.serial_id,
      installationStatus: pump.adminInstallationConfirmedAt
        ? "confirmed"
        : "confirmed-awaiting-admin",
    });
  } catch (error) {
    debug("confirmPumpInstallation failed", error);
    return redirectToRegisterWithInstallationState(res, {
      serialId,
      installationStatus: "error",
    });
  }
};

export const advertPump = async (_req, res) => {
  try {
    const pumps = await Pump.find().sort({ createdAt: -1 });
    const mappedPumps = pumps.map((pump) => ({
      ...pump.toObject(),
      price_usd: calculatePumpPrice(pump.capacity),
    }));
    return res.status(200).json({ pumps: mappedPumps });
  } catch (error) {
    debug("advertPump failed", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const myPurchasedPumps = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const pumpCandidates = await Pump.find({
      userId: { $exists: true, $ne: null },
    }).sort({ purchasedAt: -1, createdAt: -1 });
    const normalizedUserId = String(req.user._id);
    const pumps = pumpCandidates.filter(
      (pump) => String(pump.userId || "").trim() === normalizedUserId,
    );

    const mappedPumps = pumps.map((pump) => ({
      ...pump.toObject(),
      price_usd: calculatePumpPrice(pump.capacity),
    }));

    return res.status(200).json({ pumps: mappedPumps });
  } catch (error) {
    debug("myPurchasedPumps failed", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const publicCatalogPumps = async (_req, res) => {
  try {
    const pumps = await Pump.find({
      url: { $exists: true, $ne: "" },
      $or: [
        { createdByAdmin: true },
        { createdByAdmin: { $exists: false } },
      ],
    }).sort({ createdAt: -1 });

    const mappedPumps = pumps
      .map((pump) => {
        const normalized = normalizeCloudinaryUrl(pump.url);
        if (!normalized.valid) {
          return null;
        }

        return {
          _id: String(pump._id),
          name: pump.name,
          serial_id: pump.serial_id,
          url: normalized.url,
          capacity: pump.capacity,
          price_usd: calculatePumpPrice(pump.capacity),
          createdByAdmin:
            typeof pump.createdByAdmin === "boolean"
              ? pump.createdByAdmin
              : true,
          imageProvider: "cloudinary",
          createdAt: pump.createdAt,
        };
      })
      .filter(Boolean);

    return res.status(200).json({ pumps: mappedPumps });
  } catch (error) {
    debug("publicCatalogPumps failed", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const purchasePump = async (req, res) => {
  try {
    const { serial_id, payment_intent_id } = req.body || {};
    const user = req.user;

    if (!serial_id) {
      return res.status(400).json({ message: "serial_id is required" });
    }

    const pump = await Pump.findOne({ serial_id: String(serial_id).trim() }).select(
      "+installationConfirmationTokenHash",
    );
    if (!pump) {
      return res.status(404).json({ message: "Pump not found" });
    }

    if (!user?.email) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (pump.userId && String(pump.userId) !== String(user._id)) {
      return res.status(409).json({ message: "Pump has already been purchased by another account" });
    }

    if (pump.userId && String(pump.userId) === String(user._id)) {
      return res.status(200).json({
        message: "You already purchased this pump",
        serial_id: pump.serial_id,
        transaction_id: pump.purchaseReceipt?.transactionId || null,
        installation_confirmed: Boolean(pump.installationConfirmedAt),
        admin_installation_confirmed: Boolean(pump.adminInstallationConfirmedAt),
        installation_confirmation_required:
          Boolean(pump.installationConfirmationTokenHash) &&
          !pump.installationConfirmedAt,
        registration_allowed:
          Boolean(pump.installationConfirmedAt) &&
          Boolean(pump.adminInstallationConfirmedAt),
        registered_at: pump.registeredAt || null,
      });
    }

    const expectedAmountUsd = calculatePumpPrice(pump.capacity);
    let transactionId = "";
    let cardLast4 = null;
    let cardBrand = null;
    let amountUsd = expectedAmountUsd;
    let paymentProvider = "simulated";

    if (isStripeEnabled()) {
      if (!payment_intent_id) {
        return res.status(400).json({ message: "payment_intent_id is required" });
      }

      const intent = await getPaymentIntent(payment_intent_id).catch(() => null);
      if (!intent) {
        return res.status(400).json({ message: "Invalid payment intent" });
      }

      if (intent.status !== "succeeded") {
        return res.status(400).json({ message: "Payment has not been completed" });
      }

      if (String(intent.currency || "").toLowerCase() !== "usd") {
        return res.status(400).json({ message: "Unsupported payment currency" });
      }

      const metadata = intent.metadata || {};
      if (String(metadata.serial_id || "") !== String(pump.serial_id)) {
        return res.status(400).json({ message: "Payment intent does not match selected pump" });
      }

      if (String(metadata.user_id || "") !== String(user._id)) {
        return res.status(403).json({ message: "Payment intent is not owned by current user" });
      }

      const alreadyUsed = await Pump.findOne({
        _id: { $ne: pump._id },
        "purchaseReceipt.transactionId": intent.id,
      });
      if (alreadyUsed) {
        return res.status(409).json({ message: "Payment intent was already used" });
      }

      const receivedUsd = Number(intent.amount_received || intent.amount || 0) / 100;
      if (!Number.isFinite(receivedUsd) || receivedUsd < expectedAmountUsd) {
        return res.status(400).json({ message: "Paid amount is insufficient for this pump" });
      }

      const card = getIntentChargeCardDetails(intent);
      transactionId = String(intent.id);
      cardLast4 = card.last4;
      cardBrand = card.brand;
      amountUsd = Number(receivedUsd.toFixed(2));
      paymentProvider = "stripe";
    } else {
      const cardProvided = hasCardInput(req.body);

      if (cardProvided) {
        const validationError = validatePurchasePayload(req.body);
        if (validationError) {
          return res.status(400).json({ message: validationError });
        }
      } else if (!env.allowCardlessPurchases) {
        return res.status(503).json({
          message: "Payment provider is not configured yet. Try again later.",
        });
      }

      transactionId = `tx_${crypto.randomUUID()}`;
      cardLast4 = cardProvided ? maskCardNumber(req.body.cardNumber) : null;
      cardBrand = cardProvided ? detectCardBrand(req.body.cardNumber) : null;
      paymentProvider = cardProvided ? "simulated" : "simulated-cardless";
    }

    const installationConfirmationToken = crypto.randomBytes(32).toString("hex");
    const installationConfirmationTokenHash = hashToken(installationConfirmationToken);
    const installationConfirmationExpiresAt = new Date(
      Date.now() + INSTALL_CONFIRM_TTL_MS,
    );

    pump.userId = String(user._id);
    pump.purchasedAt = new Date();
    pump.registeredAt = null;
    pump.installationConfirmedAt = null;
    pump.adminInstallationConfirmedAt = null;
    pump.installationConfirmationTokenHash = installationConfirmationTokenHash;
    pump.installationConfirmationExpiresAt = installationConfirmationExpiresAt;
    pump.purchaseReceipt = {
      transactionId,
      cardLast4,
      cardBrand,
      amountUsd,
      purchasedByEmail: user.email,
    };
    await pump.save();

    const registrationLink = buildRegisterPumpLink(pump.serial_id);
    const installationConfirmationLink = buildInstallationConfirmationLink({
      req,
      serialId: pump.serial_id,
      token: installationConfirmationToken,
    });
    const transporter = createMailerTransport();
    let buyerEmailSent = false;
    let adminEmailSent = false;

    if (transporter) {
      const adminRecipients = [...new Set(env.adminEmails.filter(Boolean))];

      const emailJobs = [
        transporter
          .sendMail({
            from: env.smtpUser,
            to: user.email,
            subject: "FlowBot Pump Installation Confirmation",
            text: [
              "Your pump purchase is complete.",
              `Product key: ${pump.serial_id}.`,
              `Confirm installation: ${installationConfirmationLink}`,
              "After confirmation, admin must approve installation before registration is enabled.",
              `Registration page: ${registrationLink}`,
            ].join("\n"),
            html: buildInstallationConfirmationEmailHtml({
              serialId: pump.serial_id,
              installationConfirmationLink,
              registrationLink,
            }),
          })
          .then(() => {
            buyerEmailSent = true;
          })
          .catch((mailError) => {
            debug("purchasePump buyer email failed", mailError);
          }),
      ];

      if (adminRecipients.length > 0) {
        emailJobs.push(
          transporter
            .sendMail({
              from: env.smtpUser,
              to: adminRecipients.join(","),
              subject: `FlowBot purchase: pump ${pump.serial_id}`,
              text: [
                `User ${user.email} purchased pump ${pump.serial_id}.`,
                `Installation confirmation link: ${installationConfirmationLink}`,
                `Registration link: ${registrationLink}`,
              ].join("\n"),
            })
            .then(() => {
              adminEmailSent = true;
            })
            .catch((mailError) => {
              debug("purchasePump admin email failed", mailError);
            }),
        );
      }

      await Promise.all(emailJobs);
    }

    return res.status(200).json({
      message: buyerEmailSent
        ? "Purchase completed successfully. Confirm installation from email; admin approval is required before registration."
        : "Purchase completed successfully. Email service is unavailable, use installation_confirmation_link from response.",
      serial_id: pump.serial_id,
      registration_link: registrationLink,
      installation_confirmation_link: installationConfirmationLink,
      installation_confirmation_expires_at: installationConfirmationExpiresAt.toISOString(),
      admin_notified: adminEmailSent,
      transaction_id: transactionId,
      amount_usd: amountUsd,
      card_last4: cardLast4,
      payment_provider: paymentProvider,
    });
  } catch (error) {
    debug("purchasePump failed", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAlerts = async (req, res) => {
  try {
    const user = req.user;
    if (!user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const admin = isAdminUser(user);
    const pumpCandidates = await Pump.find(
      admin ? {} : { userId: { $exists: true, $ne: null } },
      { serial_id: 1, name: 1, userId: 1 },
    ).lean();
    const pumps = admin
      ? pumpCandidates
      : filterPumpsOwnedByUser(pumpCandidates, user);
    const pumpSerialIds = pumps.map((pump) => String(pump.serial_id));

    const alertFilter =
      admin || pumpSerialIds.length > 0
        ? (admin ? {} : { pump_id: { $in: pumpSerialIds } })
        : { pump_id: { $in: [] } };

    const alerts = await Alert.find(alertFilter).sort({ createdAt: -1 }).limit(200).lean();

    const pumpNameBySerial = new Map(
      pumps.map((pump) => [String(pump.serial_id), pump.name]),
    );

    const mappedAlerts = alerts.map((alert) => {
      const sensorText = String(alert.sensorValue || "");
      const lowerText = sensorText.toLowerCase();

      let type = alert.type || "sensor-failure";
      let severity = alert.severity || "warning";

      if (!alert.type && lowerText.includes("pressure")) {
        type = "overpressure";
        severity = "critical";
      } else if (!alert.type && lowerText.includes("dry")) {
        type = "dry-run";
      } else if (!alert.type && lowerText.includes("maint")) {
        type = "maintenance";
        severity = "info";
      }

      return {
        id: String(alert._id),
        pumpId: String(alert.pump_id),
        pumpName:
          pumpNameBySerial.get(String(alert.pump_id)) || `Pump ${String(alert.pump_id)}`,
        type,
        severity,
        message: alert.message || sensorText,
        timestamp: alert.createdAt || alert._id.getTimestamp(),
        status: alert.status || "active",
        acknowledgedAt: alert.acknowledgedAt || null,
        resolvedAt: alert.resolvedAt || null,
      };
    });

    return res.status(200).json({ alerts: mappedAlerts });
  } catch (error) {
    debug("getAlerts failed", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const acknowledgeAlert = async (req, res) => {
  try {
    const user = req.user;
    if (!user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const alertId = req.params.id;
    const alert = await Alert.findById(alertId);

    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }

    const pump = await getAlertPump(alert.pump_id);
    const isAdmin = isAdminUser(user);
    const canManage =
      isAdmin ||
      (pump?.userId &&
        String(pump.userId) === String(user._id));
    if (!canManage) {
      return res.status(403).json({
        message: "You can only manage alerts for pumps that you own",
      });
    }

    if (alert.status === "resolved") {
      return res.status(400).json({ message: "Resolved alerts cannot be acknowledged" });
    }

    alert.status = "acknowledged";
    alert.acknowledgedAt = new Date();
    await alert.save();
    const io = getSocketIo();
    if (io) {
      io.to(monitoringRoomsForOwner(pump?.userId || null)).emit("alert:updated", {
        id: String(alert._id),
        status: alert.status,
        acknowledgedAt: alert.acknowledgedAt,
        resolvedAt: alert.resolvedAt,
        timestamp: alert.createdAt,
      });
    }

    return res.status(200).json({ message: "Alert acknowledged successfully" });
  } catch (error) {
    debug("acknowledgeAlert failed", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const resolveAlert = async (req, res) => {
  try {
    const user = req.user;
    if (!user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const alertId = req.params.id;
    const alert = await Alert.findById(alertId);

    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }

    const pump = await getAlertPump(alert.pump_id);
    const isAdmin = isAdminUser(user);
    const canManage =
      isAdmin ||
      (pump?.userId &&
        String(pump.userId) === String(user._id));
    if (!canManage) {
      return res.status(403).json({
        message: "You can only manage alerts for pumps that you own",
      });
    }

    alert.status = "resolved";
    if (!alert.acknowledgedAt) {
      alert.acknowledgedAt = new Date();
    }
    alert.resolvedAt = new Date();
    await alert.save();
    const io = getSocketIo();
    if (io) {
      io.to(monitoringRoomsForOwner(pump?.userId || null)).emit("alert:updated", {
        id: String(alert._id),
        status: alert.status,
        acknowledgedAt: alert.acknowledgedAt,
        resolvedAt: alert.resolvedAt,
        timestamp: alert.createdAt,
      });
    }

    return res.status(200).json({ message: "Alert resolved successfully" });
  } catch (error) {
    debug("resolveAlert failed", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
