import llm from "../config/llm.js";
import feedbackPrompt from "../prompts/feedbackPrompt.js";
import { isGibberishOrEmpty, getZeroScoreFeedback } from "../utils/answerValidator.js";

const clampScore = (val) => {
    const num = Number(val);
    if (!Number.isFinite(num)) return 0;
    return Math.min(100, Math.max(0, Math.round(num)));
};

export const feedbackAgent = async (data) => {
    // 1. Deterministic Proctor Anti-Gibberish Check
    const candidateAnswer = data.answer || "";
    if (isGibberishOrEmpty(candidateAnswer)) {
        return getZeroScoreFeedback();
    }

    let response;
    try {
        const prompt = feedbackPrompt(data);

        response = await llm.invoke(prompt);

        const cleaned = response?.content
            ?.replace(/```json/g, "")
            ?.replace(/```/g, "")
            ?.trim() || "";

        const parsed = JSON.parse(cleaned);

        // 2. Strict Score Normalization & Zero-Score Enforcement
        const score = clampScore(parsed.score);
        const relevance = clampScore(parsed.relevance);

        // If score or relevance is 0, strictly force all dimensional sub-scores to 0 (no pity points)
        if (score === 0 || relevance === 0) {
            return {
                score: 0,
                correctness: 0,
                clarity: 0,
                relevance: 0,
                detail: 0,
                efficiency: 0,
                communication: 0,
                problemSolving: 0,
                creativity: 0,
                feedback: parsed.feedback || "The submitted response does not address the question asked.",
                improvements: Array.isArray(parsed.improvements) && parsed.improvements.length > 0
                    ? parsed.improvements
                    : [
                        "Directly address the core concepts of the prompt.",
                        "Provide concrete technical details or implementation steps."
                    ],
            };
        }

        return {
            score,
            correctness: clampScore(parsed.correctness ?? score),
            clarity: clampScore(parsed.clarity ?? score),
            relevance,
            detail: clampScore(parsed.detail ?? score),
            efficiency: clampScore(parsed.efficiency ?? score),
            communication: clampScore(parsed.communication ?? score),
            problemSolving: clampScore(parsed.problemSolving ?? score),
            creativity: clampScore(parsed.creativity ?? score),
            feedback: parsed.feedback || "Answer evaluated against technical criteria.",
            improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
        };
    } catch (error) {
        console.error("Feedback Agent Error:", error?.message);
        if (response?.content) {
            console.error("Feedback Agent raw response content:", response.content);
        }

        throw new Error("Failed to generate feedback");
    }
};
