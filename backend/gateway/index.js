import "dotenv/config";
import http from "http";
import express from "express";
import proxy from "express-http-proxy";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { createProxyMiddleware } from "http-proxy-middleware";
import redis from "../shared/redis/redis.js";
import { getCurrentUser } from "./controllers/user.controller.js";
import { isAuth } from "./middleware/isAuth.js";
import { proxyWithHeaders } from "./utils/proxyWithHeaders.js";

const app = express();
app.use(express.json());

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
}));

app.use(morgan("dev"));
app.use(cookieParser());

// Sanitize client-supplied role/identity headers to prevent header injection
app.use((req, res, next) => {
    delete req.headers["x-user-id"];
    delete req.headers["x-user-role"];
    delete req.headers["x-institution-id"];
    delete req.headers["x-gateway-secret"];
    next();
});

const PORT = process.env.PORT || 6000;

app.get("/", (req, res) => {
    res.send("Hello from Gateway");
});

app.get("/health", (req, res) => {
    return res.status(200).json({
        status: "ok",
        service: "gateway",
        timestamp: new Date().toISOString(),
    });
});

// Block public access to internal endpoints
app.use("/api/auth/add-coins", (req, res) => {
    return res.status(403).json({
        success: false,
        message: "Forbidden: Direct coin crediting is not permitted.",
    });
});

app.use("/api/auth/internal", (req, res) => {
    return res.status(403).json({
        success: false,
        message: "Forbidden: Direct access to internal endpoints is not permitted.",
    });
});

// Optional auth middleware for auth service proxy
const optionalAuth = async (req, res, next) => {
    try {
        const sessionId = req.cookies?.session;
        if (sessionId) {
            const session = await redis.get(`session:${sessionId}`);
            if (session) {
                req.user = JSON.parse(session);
            }
        }
    } catch (e) {
        // Silently continue for unauthenticated callers (e.g. login)
    }
    next();
};

// Socket.IO WebSocket and polling proxy to Interview Service
const socketProxy = createProxyMiddleware({
    target: process.env.INTERVIEW_SERVICE_URL || "http://localhost:6003",
    ws: true,
    changeOrigin: true,
});

app.use("/socket.io", socketProxy);

app.use("/api/auth", optionalAuth, proxyWithHeaders(process.env.AUTH_SERVICE_URL));
app.use("/api/resume", isAuth, proxyWithHeaders(process.env.RESUME_SERVICE_URL));
app.use("/api/interview", isAuth, proxyWithHeaders(process.env.INTERVIEW_SERVICE_URL));
app.use("/api/roadmap", isAuth, proxyWithHeaders(process.env.ROADMAP_SERVICE_URL));
app.use("/api/billing", isAuth, proxyWithHeaders(process.env.BILLING_SERVICE_URL));

app.get("/api/me", isAuth, getCurrentUser);
app.get("/api/auth/me", isAuth, getCurrentUser);

const server = http.createServer(app);
server.on("upgrade", (req, socket, head) => {
    if (req.url && req.url.startsWith("/socket.io")) {
        socketProxy.upgrade(req, socket, head);
    }
});

server.listen(PORT, () => {
    console.log(`Gateway (HTTP + WebSocket Proxy) Started on ${PORT}`);
});
