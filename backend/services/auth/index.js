import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { connectDb } from "./configs/db.js";
import authRouter from "./routes/auth.route.js";
import redis from "../../shared/redis/redis.js";

const app = express();

app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 6001;

app.get("/health", (req, res) => {
    const isDbReady = mongoose.connection.readyState === 1;
    const status = isDbReady ? 200 : 503;
    return res.status(status).json({
        status: isDbReady ? "ok" : "degraded",
        service: "auth-service",
        timestamp: new Date().toISOString(),
        dbState: mongoose.connection.readyState,
    });
});

app.use("/", authRouter);

const startServer = async () => {
    try {
        await connectDb();
        try {
            await redis.ping();
            console.log("Auth Redis Ping OK");
        } catch (redisErr) {
            console.warn("Auth Redis ping warning on startup:", redisErr.message);
            if (process.env.NODE_ENV === "production") {
                throw redisErr;
            }
        }

        app.listen(PORT, () => {
            console.log(`Auth Service Started on ${PORT}`);
        });
    } catch (error) {
        console.error("Auth service startup failed:", error);
        process.exit(1);
    }
};

startServer();