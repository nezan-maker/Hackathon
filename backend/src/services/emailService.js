import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const RESEND_API_URL = "https://api.resend.com/emails";

const normalizeRecipients = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((recipient) => String(recipient || "").trim())
      .filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((recipient) => recipient.trim())
    .filter(Boolean);
};

const createSmtpTransport = () =>
  nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });

export const getDefaultSenderAddress = () =>
  env.isProduction ? env.resendApiName : env.smtpUser;

export const isEmailServiceConfigured = () =>
  env.isProduction
    ? Boolean(env.resendApiName && env.resendApiKey)
    : Boolean(env.smtpUser && env.smtpPass);

const sendWithResend = async ({ from, to, subject, text, html }) => {
  const recipients = normalizeRecipients(to);
  if (recipients.length === 0) {
    throw new Error("At least one email recipient is required");
  }

  const payload = {
    from,
    to: recipients,
    subject,
  };

  if (typeof text === "string" && text.length > 0) payload.text = text;
  if (typeof html === "string" && html.length > 0) payload.html = html;

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) return;

  let errorDetail = "";
  try {
    errorDetail = await response.text();
  } catch {
    errorDetail = "";
  }

  const detail = errorDetail ? `: ${errorDetail}` : "";
  throw new Error(`Resend request failed (${response.status})${detail}`);
};

export const sendEmail = async (options) => {
  if (!isEmailServiceConfigured()) {
    return false;
  }

  const fromAddress = String(options?.from || getDefaultSenderAddress()).trim();
  if (!fromAddress) {
    return false;
  }

  if (env.isProduction) {
    await sendWithResend({
      from: fromAddress,
      to: options?.to,
      subject: options?.subject,
      text: options?.text,
      html: options?.html,
    });
    return true;
  }

  const transport = createSmtpTransport();
  await transport.sendMail({
    from: fromAddress,
    to: options?.to,
    subject: options?.subject,
    text: options?.text,
    html: options?.html,
  });
  return true;
};
