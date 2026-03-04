import express from "express";
import {
    signUp,
    logIn,
    logout,
    confirm,
    refreshToken,
    mainPage,
    csrfToken,
    getCurrentUser,
    authMiddleware,
} from "../controllers/userController.js";
import {
    changePassword,
    changePasswordAuthenticated,
    resetCodeVer,
    resetPassword,
} from "../controllers/changePwd.js";
import { authRateLimiter } from "../middleware/rateLimit.js";
const createUserRoutes = () => {
    const router = express.Router();
    router.get("/main", mainPage);
    router.get("/csrf", csrfToken);
    router.get("/me", authMiddleware, getCurrentUser);
    router.post("/signup", authRateLimiter, signUp);
    router.post("/login", authRateLimiter, logIn);
    router.post("/confirm", authRateLimiter, confirm);
    router.post("/logout", logout);
    router.post("/pass", authRateLimiter, changePassword);
    router.post("/change-password", authMiddleware, changePasswordAuthenticated);
    router.post("/verify-code", authRateLimiter, resetCodeVer);
    router.post("/reset", authRateLimiter, resetPassword);
    router.post("/refresh", refreshToken);
    return router;
};

// const router = createUserRoutes()
export default createUserRoutes;
