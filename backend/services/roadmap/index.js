import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import { connectDB } from "./configs/db.js";
import roadmapRouter from "./routes/roadmap.route.js";
import { verifyGatewayOrigin } from "./middleware/gatewayAuth.js";
import redis from "../../shared/redis/redis.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 6004;

app.get("/", (req, res) => {
    res.send("Hello from Roadmap-service");
});

app.get("/health", (req, res) => {
    const isDbReady = mongoose.connection.readyState === 1;
    const status = isDbReady ? 200 : 503;
    return res.status(status).json({
        status: isDbReady ? "ok" : "degraded",
        service: "roadmap-service",
        timestamp: new Date().toISOString(),
        dbState: mongoose.connection.readyState,
    });
});

app.use(verifyGatewayOrigin);
app.use("/", roadmapRouter);

const startServer = async () => {
    try {
        await connectDB();
        try {
            await redis.ping();
            console.log("Roadmap Redis Ping OK");
        } catch (redisErr) {
            console.warn("Roadmap Redis ping warning on startup:", redisErr.message);
            if (process.env.NODE_ENV === "production") {
                throw redisErr;
            }
        }

        app.listen(PORT, () => {
            console.log(`Roadmap-service Started on ${PORT}`);
        });
    } catch (error) {
        console.error("Roadmap service startup failed:", error);
        process.exit(1);
    }
};

startServer();