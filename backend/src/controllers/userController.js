import bcrypt from "bcrypt";
import crypto from "crypto";
import nodemailer from "nodemailer";
import createDebug from "debug";
import User from "../models/User.js";
import { env } from "../config/env.js";
import {
  accessCookieOptions,
  emailTokenCookieOptions,
  refreshCookieOptions,
} from "../utils/cookies.js";
import { resolveGeoFromRequest } from "../services/geolocationService.js";
import {
  signAccessToken,
  signEmailToken,
  signRefreshToken,
  verifyAccessToken,
  verifyEmailToken,
  verifyRefreshToken,
} from "../services/tokenService.js";
import {
  clearCsrfCookie,
  issueCsrfToken,
} from "../middleware/csrfProtection.js";

const debug = createDebug("app:auth");

const EMAIL_REGEX = /^[a-zA-Z0-9.+_%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^[0-9]{10}$/;

const getResolvedRole = (email, currentRole = "user") => {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();
  if (env.adminEmails.includes(normalizedEmail)) {
    return "admin";
  }

  return currentRole === "admin" ? "admin" : "user";
};

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

const sendVerificationEmail = async (email, otp) => {
  const transporter = createMailerTransport();
  if (!transporter) {
    return false;
  }

  await transporter.sendMail({
    from: env.smtpUser,
    to: email,
    subject: "FlowBot email verification code",
    text: `Your verification code is ${otp}. It expires in 8 minutes.`,
    html: `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f0f2f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
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
              Verification Required
            </h1>
          </td>
        </tr>

        <tr>
          <td style="padding: 40px 30px; text-align: center; background-color: #ffffff;">
            <p style="
                font-size: 16px;
                line-height: 1.6;
                color: #4b5563;
                margin: 0 0 24px;
              ">
              Welcome to <strong>FlowBOT</strong>. To complete your setup and secure your account, please use the verification code below.
            </p>

            <div style="
                display: inline-block;
                padding: 20px 40px;
                margin: 10px 0 25px;
                background-color: #f8fafc;
                border-radius: 8px;
                border: 2px solid #e2e8f0;
              ">
              <span style="
                  font-size: 32px;
                  font-weight: 800;
                  letter-spacing: 8px;
                  color: #001f3f;
                ">
                ${otp}
              </span>
            </div>

            <p style="font-size: 14px; color: #9ca3af; margin-top: 10px;">
              This unique code is valid for <strong>8 minutes</strong>.
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
              If you did not request this code, please ignore this email or contact support if you have concerns.
            </p>
            <p style="margin: 0; font-weight: 600; color: #001f3f;">© 2026 FlowBot Inc. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  });

  return true;
};

const issueTokens = (user) => {
  const tokenPayload = { userId: user._id, tokenVersion: user.tokenVersion };
  const accessToken = signAccessToken(tokenPayload, "1h");
  const refreshToken = signRefreshToken({ userId: user._id }, "14d");

  return { accessToken, refreshToken };
};

const setSessionCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, accessCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
};

export const signUp = async (req, res) => {
  try {
    const { name, email, password, phone_number } = req.body || {};

    if (!name || !email || !password || !phone_number) {
      return res.status(400).json({
        error:
          "first_name, last_name, email, password and phone_number are required",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedPhone = String(phone_number).replace(/\D/g, "");

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (!PHONE_REGEX.test(normalizedPhone)) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        error: "Password must have at least 8 characters",
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { phone_number: Number(normalizedPhone) },
      ],
    });

    if (existingUser) {
      return res
        .status(409)
        .json({ error: "User already exists. Please log in." });
    }

    const geo = await resolveGeoFromRequest(req);
    const otp = crypto.randomInt(0, 100000000).toString().padStart(8, "0");
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      otp_token: hashedOtp,
      otpExpiresAt: new Date(Date.now() + 8 * 60 * 1000),
      phone_number: Number(normalizedPhone),
      lat: geo.lat,
      lon: geo.lon,
      lastLoginIp: geo.ip || null,
      role: getResolvedRole(normalizedEmail),
    });

    const emailToken = signEmailToken(
      { userId: user._id, email: user.email },
      "8m",
    );

    res.cookie("emailToken", emailToken, {
      ...emailTokenCookieOptions,
      maxAge: 8 * 60 * 1000,
    });

    const sent = await sendVerificationEmail(normalizedEmail, otp).catch(
      (error) => {
        debug("Failed to send verification email", error);
        return false;
      },
    );

    if (!sent) {
      if (env.isProduction) {
        await User.findByIdAndDelete(user._id);
        res.clearCookie("emailToken", {
          ...emailTokenCookieOptions,
          maxAge: undefined,
        });
        return res
          .status(500)
          .json({ error: "Unable to send verification email" });
      }

      return res.status(201).json({
        message:
          "Account created. Email service is not configured, use devOtp to continue in local development.",
        devOtp: otp,
      });
    }

    return res.status(201).json({
      message: "Verification code sent to your email",
    });
  } catch (error) {
    debug("signUp failed", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const confirm = async (req, res) => {
  try {
    const { otpToken } = req.body || {};
    if (!otpToken) {
      return res.status(400).json({ error: "OTP is required" });
    }

    const emailToken = req.cookies?.emailToken;
    if (!emailToken) {
      return res.status(401).json({ error: "Verification session not found" });
    }

    const decoded = verifyEmailToken(emailToken);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (
      !user.otp_token ||
      !user.otpExpiresAt ||
      user.otpExpiresAt < new Date()
    ) {
      return res.status(401).json({ error: "Verification code expired" });
    }

    const hashedInputOtp = crypto
      .createHash("sha256")
      .update(String(otpToken).trim())
      .digest("hex");

    if (hashedInputOtp !== user.otp_token) {
      return res.status(403).json({ error: "Invalid verification code" });
    }

    const geo = await resolveGeoFromRequest(req);

    user.isVerified = true;
    user.otp_token = null;
    user.otpExpiresAt = null;
    user.isLoggedIn = true;
    if (geo.lat !== null && geo.lon !== null) {
      user.lat = geo.lat;
      user.lon = geo.lon;
    }
    user.lastLoginIp = geo.ip || user.lastLoginIp;

    const { accessToken, refreshToken } = issueTokens(user);
    user.refreshToken = refreshToken;
    await user.save();

    setSessionCookies(res, accessToken, refreshToken);
    return res.status(200).json({
      message: "Email confirmed successfully",
      token: accessToken,
    });
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Verification token expired" });
    }

    debug("confirm failed", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const logIn = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const passwordMatches = await bcrypt.compare(
      String(password),
      user.password,
    );
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid password" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Email not verified" });
    }

    const geo = await resolveGeoFromRequest(req);
    const resolvedRole = getResolvedRole(user.email, user.role);

    const { accessToken, refreshToken } = issueTokens(user);
    user.refreshToken = refreshToken;
    user.isLoggedIn = true;
    if (geo.lat !== null && geo.lon !== null) {
      user.lat = geo.lat;
      user.lon = geo.lon;
    }
    user.lastLoginIp = geo.ip || user.lastLoginIp;
    user.role = resolvedRole;
    await user.save();

    setSessionCookies(res, accessToken, refreshToken);

    return res.status(200).json({ token: accessToken });
  } catch (error) {
    debug("logIn failed", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const refreshTokenCookie = req.cookies?.refreshToken;
    if (!refreshTokenCookie) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    const payload = verifyRefreshToken(refreshTokenCookie);
    const user = await User.findById(payload.userId);

    if (!user || user.refreshToken !== refreshTokenCookie) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    const accessToken = signAccessToken(
      { userId: user._id, tokenVersion: user.tokenVersion },
      "1h",
    );

    res.cookie("accessToken", accessToken, accessCookieOptions);
    return res.status(200).json({ newAccessToken: accessToken });
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Refresh token expired" });
    }

    debug("refreshToken failed", error);
    return res.status(403).json({ message: "Invalid refresh token" });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshTokenCookie = req.cookies?.refreshToken;
    if (refreshTokenCookie) {
      await User.findOneAndUpdate(
        { refreshToken: refreshTokenCookie },
        { $set: { refreshToken: null, isLoggedIn: false } },
      );
    }

    res.clearCookie("accessToken", {
      ...accessCookieOptions,
      maxAge: undefined,
    });
    res.clearCookie("refreshToken", {
      ...refreshCookieOptions,
      maxAge: undefined,
    });
    res.clearCookie("emailToken", {
      ...emailTokenCookieOptions,
      maxAge: undefined,
    });
    clearCsrfCookie(res);

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    debug("logout failed", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const authMiddleware = async (req, res, next) => {
  try {
    const bearer = req.headers.authorization;
    const bearerToken =
      typeof bearer === "string" && bearer.startsWith("Bearer ")
        ? bearer.slice("Bearer ".length).trim()
        : null;

    const token = req.cookies?.accessToken || bearerToken;
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Access token expired" });
    }

    debug("authMiddleware failed", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export const adminMiddleware = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const resolvedRole = getResolvedRole(user.email, user.role);
    if (resolvedRole !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    if (user.role !== resolvedRole) {
      user.role = resolvedRole;
      await user.save();
    }

    return next();
  } catch (error) {
    debug("adminMiddleware failed", error);
    return res.status(403).json({ message: "Admin access required" });
  }
};

export const mainPage = async (_req, res) => {
  return res.status(200).json({ message: "FlowBot API is running" });
};

export const csrfToken = (req, res) => {
  return issueCsrfToken(req, res);
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    return res.status(200).json({
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone_number: user.phone_number,
      lat: user.lat,
      lon: user.lon,
      lastLoginIp: user.lastLoginIp,
      role: getResolvedRole(user.email, user.role),
      createdAt: user.createdAt,
    });
  } catch (error) {
    debug("getCurrentUser failed", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
