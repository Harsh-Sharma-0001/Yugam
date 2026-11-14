import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import interviewRouter from "./routes/interview.route.js";
import { verifyGatewayOrigin } from "./middleware/gatewayAuth.js";
import redis from "../../shared/redis/redis.js";

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 6003;

app.get("/", (req, res) => {
    res.send("Hello from Interview-service");
});

app.get("/health", (req, res) => {
    const isDbReady = mongoose.connection.readyState === 1;
    const status = isDbReady ? 200 : 503;
    return res.status(status).json({
        status: isDbReady ? "ok" : "degraded",
        service: "interview-service",
        timestamp: new Date().toISOString(),
        dbState: mongoose.connection.readyState,
    });
});

app.use(verifyGatewayOrigin);
app.use("/", interviewRouter);

const startServer = async () => {
    try {
        await connectDB();
        try {
            await redis.ping();
            console.log("Interview Redis Ping OK");
        } catch (redisErr) {
            console.warn("Interview Redis ping warning on startup:", redisErr.message);
            if (process.env.NODE_ENV === "production") {
                throw redisErr;
            }
        }

        app.listen(PORT, () => {
            console.log(`Interview-service Started on ${PORT}`);
        });
    } catch (error) {
        console.error("Interview service startup failed:", error);
        process.exit(1);
    }
};

startServer();