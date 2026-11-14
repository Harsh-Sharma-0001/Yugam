import crypto from "crypto";
import redis from "../../../shared/redis/redis.js";
import graph from "../graph/roadmap.graph.js";
import Roadmap from "../models/roadmap.model.js";
import { deductCoins, refundCoins } from "../utils/coinClient.js";

export const generateRoadmap = async (req, res) => {
    let reservationId;
    let deductedCoins = false;
    const userId = req.headers["x-user-id"];
    const sessionId = req.headers["x-session-id"];

    try {
        const {
            role,
            targetPackage,
            useResume = false,
            resume,
        } = req.body;

        if (!role || !targetPackage) {
            return res.status(400).json({
                success: false,
                message: "Role and Target Package are required.",
            });
        }

        let activeResume = resume;
        if (useResume && (!activeResume || !activeResume.skills || activeResume.skills.length === 0)) {
            try {
                const cached = await redis.get(`resume:${userId}`);
                if (cached) {
                    activeResume = JSON.parse(cached);
                }
            } catch (cacheErr) {
                console.error("Roadmap redis resume fetch error:", cacheErr);
            }
        }

        if (useResume && (!activeResume || !activeResume.skills)) {
            return res.status(400).json({
                success: false,
                message: "No analyzed resume found for your account. Please upload your resume first or disable the resume option.",
            });
        }

        // Deduct ROADMAP_GENERATE coins BEFORE invoking LLM graph
        reservationId = crypto.randomUUID();
        let coinRes;
        try {
            coinRes = await deductCoins({
                userId,
                action: "ROADMAP_GENERATE",
                reservationId,
                sessionId,
            });
            deductedCoins = true;
        } catch (coinErr) {
            if (coinErr.status === 402) {
                return res.status(402).json({
                    success: false,
                    message: "Insufficient interview coins.",
                    interviewCoin: coinErr.data?.interviewCoin,
                    required: coinErr.data?.required || 20,
                });
            }
            throw coinErr;
        }

        const result = await graph.invoke({
            role,
            targetPackage,
            useResume: Boolean(useResume && activeResume),
            resume: activeResume || null,
        });

        const roadmap = await Roadmap.create({
            userId,
            ...result.roadmap,
        });

        await redis.set(`roadmap:${userId}:${roadmap._id}`, JSON.stringify(roadmap), "EX", 60 * 60);

        await redis.del(`userRoadmaps:${userId}`);

        return res.status(201).json({
            success: true,
            message: "Roadmap generated successfully.",
            data: roadmap,
            interviewCoin: coinRes?.interviewCoin,
        });

    } catch (error) {
        console.error("generateRoadmap error:", error);

        // Automatic refund if coins were deducted
        let refundedBalance;
        if (deductedCoins && reservationId) {
            const refundRes = await refundCoins({
                userId,
                action: "ROADMAP_GENERATE",
                reservationId,
                sessionId,
            });
            refundedBalance = refundRes?.interviewCoin;
        }

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to generate roadmap",
            interviewCoin: refundedBalance,
        });
    }
};


export const getAllRoadmap = async (req,res) => {
    try {
        const userId = req.headers["x-user-id"]
        const cache = await redis.get(`userRoadmaps:${userId}`)

        if(cache){
            return res.status(200).json({
        success: true,
        data: JSON.parse(cache),
      })
        }

        const roadmaps = await Roadmap.find({userId}).sort({createdAt: -1})

        await redis.set(`userRoadmaps:${userId}`,JSON.stringify(roadmaps),"EX",60*60)

    return res.json({
      success: true,
      data: roadmaps,
    });
    } catch (error) {
       console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
    }
}

export const getRoadmapbyId = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.headers["x-user-id"];

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Missing user ID",
            });
        }

        // Check user-scoped Redis cache
        const cache = await redis.get(`roadmap:${userId}:${id}`);
        if (cache) {
            const cachedRoadmap = JSON.parse(cache);
            // Explicitly verify ownership
            if (String(cachedRoadmap.userId) !== String(userId)) {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden: You do not have permission to access this roadmap.",
                });
            }
            return res.json({
                success: true,
                fromCache: true,
                data: cachedRoadmap,
            });
        }

        const roadmap = await Roadmap.findById(id);

        if (!roadmap) {
            return res.status(404).json({
                success: false,
                message: "Roadmap not found",
            });
        }

        // Verify ownership against database record
        if (String(roadmap.userId) !== String(userId)) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: You do not have permission to access this roadmap.",
            });
        }

        await redis.set(`roadmap:${userId}:${id}`, JSON.stringify(roadmap), "EX", 60 * 60);

        return res.json({
            success: true,
            fromCache: false,
            data: roadmap,
        });
    } catch (error) {
        console.error("getRoadmapbyId error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};