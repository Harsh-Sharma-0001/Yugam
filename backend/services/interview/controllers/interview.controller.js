import { json } from "express";
import crypto from "crypto";
import redis from "../../../shared/redis/redis.js";
import graph from "../graph/graph.js";
import Interview from "../models/interview.model.js";
import { deductCoins, refundCoins } from "../utils/coinClient.js";

export const startInterview = async (req, res) => {
    let reservationId;
    let deductedCoins = false;
    const userId = req.headers["x-user-id"];
    const sessionId = req.headers["x-session-id"];

    try {
        let {
            type,
            role,
            useResume = false,
            resume = {}, } = req.body;

        if (!type || !role) {
            return res.status(400).json({
                success: false,
                message: "Interview type and role are required",
            });
        }

        // Deduct INTERVIEW_START coins BEFORE calling LLM
        reservationId = crypto.randomUUID();
        let coinRes;
        try {
            coinRes = await deductCoins({
                userId,
                action: "INTERVIEW_START",
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
                    required: coinErr.data?.required || 50,
                });
            }
            throw coinErr;
        }

        let activeResume = resume;
        if (useResume && (!activeResume || !activeResume.skills || activeResume.skills.length === 0)) {
            try {
                const cached = await redis.get(`resume:${userId}`);
                if (cached) {
                    activeResume = JSON.parse(cached);
                }
            } catch (cacheErr) {
                console.error("Interview redis resume cache error:", cacheErr);
            }
        }

        const result = await graph.invoke({
            action: "start",
            role,
            type,
            useResume: Boolean(useResume && activeResume),
            resume: activeResume || {}
        });

        const questions = result.questions;

        if (!questions || questions.length === 0) {
            throw new Error("Failed to generate interview questions");
        }

        const interview = await Interview.create({
            userId,
            type,
            role,
            useResume,
            questions,
            currentQuestion: 0,
            status: "in-progress",
        });

        await redis.del(`interviews:${userId}`);

        return res.status(200).json({
            success: true,
            interviewId: interview._id,
            currentQuestion: 0,
            totalQuestions: interview.questions.length,
            question: interview.questions[0],
            interviewCoin: coinRes?.interviewCoin,
        });
    } catch (error) {
        console.error("startInterview error:", error);

        // Automatic refund if coins were deducted
        let refundedBalance;
        if (deductedCoins && reservationId) {
            const refundRes = await refundCoins({
                userId,
                action: "INTERVIEW_START",
                reservationId,
                sessionId,
            });
            refundedBalance = refundRes?.interviewCoin;
        }

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to start interview",
            interviewCoin: refundedBalance,
        });
    }
};


export const submitAnswer = async (req, res) => {
    try {
        const userId = req.headers["x-user-id"];
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Missing user credentials.",
            });
        }

        const { interviewId, answer, questionIndex } = req.body;

        // 1. Strict Input Validation
        if (!interviewId || typeof answer !== "string" || !answer.trim()) {
            return res.status(400).json({
                success: false,
                message: "interviewId and non-empty string answer are required.",
            });
        }

        if (answer.length > 15000) {
            return res.status(400).json({
                success: false,
                message: "Answer exceeds maximum allowed length (15,000 characters).",
            });
        }

        // 2. Fetch Interview & Validate Ownership
        const interview = await Interview.findOne({
            _id: interviewId,
            userId,
        });

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: "Interview not found",
            });
        }

        // 3. Status and Index Verification
        if (interview.status === "completed" || interview.currentQuestion >= interview.questions.length) {
            return res.status(409).json({
                success: false,
                message: "Interview is already completed.",
            });
        }

        const expectedIndex = interview.currentQuestion;

        if (questionIndex !== undefined && questionIndex !== null && Number(questionIndex) !== expectedIndex) {
            return res.status(409).json({
                success: false,
                message: `Question index mismatch. Expected index ${expectedIndex}, received ${questionIndex}.`,
            });
        }

        const currentQuestion = interview.questions[expectedIndex];
        if (!currentQuestion) {
            return res.status(400).json({
                success: false,
                message: "Invalid question index",
            });
        }

        const trimmedAnswer = answer.trim();
        const completed = expectedIndex + 1 >= interview.questions.length;

        // 4. LLM Feedback & Scoring
        const result = await graph.invoke({
            action: "feedback",
            question: currentQuestion.question,
            answer: trimmedAnswer,
            difficulty: currentQuestion.difficulty,
            completed,
            role: interview.role,
            type: interview.type,
            questions: interview.questions,
        });

        // 5. Atomic Update with Concurrency Guard
        const updateQuery = {
            _id: interviewId,
            userId,
            currentQuestion: expectedIndex,
            status: { $ne: "completed" },
        };

        const updateFields = {
            $set: {
                [`questions.${expectedIndex}.userAnswer`]: trimmedAnswer,
                [`questions.${expectedIndex}.feedback`]: result.feedback || {},
            },
            $inc: {
                currentQuestion: 1,
            },
        };

        if (completed) {
            updateFields.$set.status = "completed";
            updateFields.$set.overallScore = result.report?.overallScore || 0;
            updateFields.$set.summary = result.report?.summary || "";
            updateFields.$set.strengths = result.report?.strengths || [];
            updateFields.$set.weaknesses = result.report?.weaknesses || [];
            updateFields.$set.recommendations = result.report?.recommendations || [];
        }

        const updatedInterview = await Interview.findOneAndUpdate(
            updateQuery,
            updateFields,
            { new: true }
        );

        if (!updatedInterview) {
            return res.status(409).json({
                success: false,
                message: "Question already submitted or concurrent request in progress.",
            });
        }

        await redis.del(`interviews:${userId}`);

        if (completed) {
            return res.status(200).json({
                success: true,
                completed: true,
                interview: updatedInterview,
                feedback: result.feedback,
            });
        }

        return res.status(200).json({
            success: true,
            completed: false,
            currentQuestion: updatedInterview.currentQuestion,
            question: updatedInterview.questions[updatedInterview.currentQuestion],
            feedback: result.feedback,
        });

    } catch (error) {
        console.error("submitAnswer error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to submit answer.",
        });
    }
};


export const getInterview = async (req, res) => {
    try {
        const userId = req.headers["x-user-id"];
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Missing user credentials.",
            });
        }
        const { id } = req.params;

        const interview = await Interview.findOne({
            _id: id,
            userId,
        });
        if (!interview) {
            return res.status(404).json({
                success: false,
                message: "Interview not found",
            });
        }

        return res.status(200).json({
            success: true,
            interview,
        });
    } catch (error) {
        console.error("getInterview error:", error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


export const getAllInterviews = async (req, res) => {
    try {
        const userId = req.headers["x-user-id"];
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Missing user credentials.",
            });
        }

        const cache = await redis.get(`interviews:${userId}`);

        if (cache) {
            console.log("✅ Data served from Redis");
            return res.status(200).json(JSON.parse(cache));
        }

        const interviews = await Interview.find({ userId }).sort({ createdAt: -1 });

        const completed = interviews.filter((item) => item.status === "completed");

        // Calculate totalQuestions as questions actually solved/answered by the user
        const totalQuestions = interviews.reduce((sum, item) => {
            const answeredCount = item.questions.filter(
                (q) => q.userAnswer && typeof q.userAnswer === "string" && q.userAnswer.trim().length > 0
            ).length;
            return sum + answeredCount;
        }, 0);

        const averageScore = completed.length > 0 ? Number(
            (completed.reduce((sum, item) => sum + item.overallScore, 0)) / completed.length
        ).toFixed(1) : 0;

        const stats = {
            totalInterviews: interviews.length,
            totalQuestions,
            completed: completed.length,
            averageScore: Number(averageScore),
        };

        const getAverageData = (list) => {
            if (!list.length) {
                return [
                    { skill: "Correctness", score: 0 },
                    { skill: "Clarity", score: 0 },
                    { skill: "Relevance", score: 0 },
                    { skill: "Detail", score: 0 },
                    { skill: "Efficiency", score: 0 },
                    { skill: "Communication", score: 0 },
                    { skill: "Problem solving", score: 0 },
                    { skill: "Creativity", score: 0 },
                ];
            }

            const total = {
                correctness: 0,
                clarity: 0,
                relevance: 0,
                detail: 0,
                efficiency: 0,
                communication: 0,
                problemSolving: 0,
                creativity: 0,
            };

            let count = 0;
            list.forEach((interview) => {
                interview.questions.forEach((q) => {
                    if (q.userAnswer && q.userAnswer.trim().length > 0) {
                        count++;
                        total.correctness += q.feedback?.correctness || 0;
                        total.clarity += q.feedback?.clarity || 0;
                        total.relevance += q.feedback?.relevance || 0;
                        total.detail += q.feedback?.detail || 0;
                        total.efficiency += q.feedback?.efficiency || 0;
                        total.communication += q.feedback?.communication || 0;
                        total.problemSolving += q.feedback?.problemSolving || 0;
                        total.creativity += q.feedback?.creativity || 0;
                    }
                });
            });

            if (count === 0) {
                return [
                    { skill: "Correctness", score: 0 },
                    { skill: "Clarity", score: 0 },
                    { skill: "Relevance", score: 0 },
                    { skill: "Detail", score: 0 },
                    { skill: "Efficiency", score: 0 },
                    { skill: "Communication", score: 0 },
                    { skill: "Problem solving", score: 0 },
                    { skill: "Creativity", score: 0 },
                ];
            }

            return [
                { skill: "Correctness", score: Math.round(total.correctness / count) },
                { skill: "Clarity", score: Math.round(total.clarity / count) },
                { skill: "Relevance", score: Math.round(total.relevance / count) },
                { skill: "Detail", score: Math.round(total.detail / count) },
                { skill: "Efficiency", score: Math.round(total.efficiency / count) },
                { skill: "Communication", score: Math.round(total.communication / count) },
                { skill: "Problem solving", score: Math.round(total.problemSolving / count) },
                { skill: "Creativity", score: Math.round(total.creativity / count) },
            ];
        };

        const technicalInterviews = completed.filter((item) => item.type === "technical");
        const HrInterviews = completed.filter((item) => item.type === "hr");

        const technicalData = getAverageData(technicalInterviews);
        const hrData = getAverageData(HrInterviews);

        const technicalCount = technicalInterviews.length;
        const hrCount = HrInterviews.length;

        const payload = {
            success: true,
            interviews,
            stats,
            technicalData,
            hrData,
            technicalCount,
            hrCount,
        };

        await redis.set(`interviews:${userId}`, JSON.stringify(payload), "EX", 600);

        return res.status(200).json(payload);

    } catch (error) {
        console.error("getAllInterviews error:", error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


