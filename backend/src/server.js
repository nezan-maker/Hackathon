import express from "express";
import cookieParser from "cookie-parser";
import http from "http";
import net from "node:net";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import createDebug from "debug";
import { fileURLToPath } from "url";
import createUserRoutes from "./routes/userRoute.js";
import createPurchaseRoutes from "./routes/purchaseRoute.js";
import createRemoteRoute from "./routes/remoteRoute.js";
import createAdminRoutes from "./routes/adminRoute.js";
import User from "./models/User.js";
import { connectDB } from "./config/db.js";
import {
  env,
  ensureRequiredEnv,
  validateMqttConfig,
  validateProductionConfig,
} from "./config/env.js";
import { mqttFn } from "./controllers/mqttController.js";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { csrfProtection } from "./middleware/csrfProtection.js";
import { globalRateLimiter } from "./middleware/rateLimit.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { verifyAccessToken } from "./services/tokenService.js";
import { getMetricsSnapshot, metricsMiddleware } from "./services/metricsService.js";
import { reportError } from "./services/errorReporter.js";
import { setSocketIo } from "./services/socketService.js";
import { isAdminUser } from "./utils/accessControl.js";
import { ADMIN_MONITOR_ROOM, userMonitorRoom } from "./utils/realtimeRooms.js";
import dns from "dns"
dns.setDefaultResultOrder('ipv4first');

const debug = createDebug("app:server");

const app = express();
const server = http.createServer(app);

const isPrivateIpv4Host = (hostname) =>
  hostname.startsWith("10.") ||
  hostname.startsWith("192.168.") ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

const isLocalDevOrigin = (origin) => {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:") return false;

    const host = url.hostname.toLowerCase();
    if (["localhost", "127.0.0.1"].includes(host)) {
      return true;
    }

    const ipType = net.isIP(host);
    return ipType === 4 && isPrivateIpv4Host(host);
  } catch {
    return false;
  }
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (env.corsOrigins.includes(origin)) return true;
  if (!env.isProduction && isLocalDevOrigin(origin)) return true;
  return false;
};

export const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
});

setSocketIo(io);

const parseCookieHeader = (cookieHeader) => {
  const entries = String(cookieHeader || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const cookies = {};
  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    if (!key) continue;

    cookies[key] = decodeURIComponent(value);
  }

  return cookies;
};

io.use(async (socket, next) => {
  try {
    const cookies = parseCookieHeader(
      socket.handshake.headers.cookie || socket.request.headers.cookie,
    );
    const accessToken = cookies.accessToken;
    if (!accessToken) {
      return next(new Error("Unauthorized"));
    }

    const payload = verifyAccessToken(accessToken);
    const user = await User.findById(payload.userId, {
      _id: 1,
      email: 1,
      role: 1,
    }).lean();
    if (!user) {
      return next(new Error("Unauthorized"));
    }

    socket.data.userId = String(user._id);
    socket.data.isAdmin = isAdminUser(user);
    return next();
  } catch (error) {
    return next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const userId = String(socket.data?.userId || "").trim();
  if (userId) {
    socket.join(userMonitorRoom(userId));
  }

  if (socket.data?.isAdmin) {
    socket.join(ADMIN_MONITOR_ROOM);
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("trust proxy", env.trustProxy);

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(securityHeaders);
app.use(globalRateLimiter);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);
app.use(metricsMiddleware);
app.use(csrfProtection);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/metrics", (_req, res) => {
  res.status(200).json(getMetricsSnapshot());
});

app.use("/auth", createUserRoutes());
app.use("/admin", createAdminRoutes());
app.use("/", createPurchaseRoutes());
app.use("/remote", createRemoteRoute());
app.use(express.static(path.join(__dirname, "public")));

app.use((err, _req, res, _next) => {
  debug("Unhandled request error", err);
  void reportError({ error: err, context: { location: "express-error-handler" } });
  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "CORS blocked request origin" });
  }

  return res.status(500).json({ message: "Internal server error" });
});

const startServer = async () => {
  try {
    ensureRequiredEnv("MONGO_URI", "AUTH_SECRET", "REFRESH_SECRET");
    validateProductionConfig();
    validateMqttConfig();
    await connectDB();
    mqttFn();

    server.listen(env.port, () => {
      debug(`Server started on port ${env.port}`);
    });
  } catch (error) {
    debug("Failed to start server", error);
    process.exit(1);
  }
};

process.on("unhandledRejection", (error) => {
  debug("Unhandled promise rejection", error);
  void reportError({ error, context: { location: "unhandledRejection" } });
});

process.on("uncaughtException", (error) => {
  debug("Uncaught exception", error);
  void reportError({ error, context: { location: "uncaughtException" } });
});

startServer();
