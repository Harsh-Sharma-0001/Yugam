import llm from "../config/llm.js";
import summaryPrompt from "../prompts/summaryPrompt.js";

const DEFAULT_FAILED_SUMMARY = {
    overallScore: 0,
    summary:
        "The candidate was unable to provide coherent or valid technical responses during this interview session. Responses were either empty, random characters, or entirely non-responsive. Significant preparation and structured practice are required before entering technical interviews.",
    strengths: [
        "No demonstrable strengths observed due to unanswered or invalid responses."
    ],
    weaknesses: [
        "Submitted invalid, random, or non-responsive answers to interview questions.",
        "Lacked technical depth and basic conceptual problem-solving.",
        "Did not attempt core domain or behavioral prompts."
    ],
    recommendations: [
        "Review core foundational concepts in the target technology stack.",
        "Practice explaining technical solutions step-by-step with working code.",
        "Use the STAR method (Situation, Task, Action, Result) for behavioral questions.",
        "Build hands-on projects to develop practical implementation experience.",
        "Conduct practice mock interviews to build technical communication confidence."
    ]
};

export const summaryAgent = async (data) => {
    const computedAverageScore = typeof data.computedAverageScore === "number"
        ? Math.max(0, Math.min(100, Math.round(data.computedAverageScore)))
        : 0;

    const validAnsweredCount = typeof data.validAnsweredCount === "number"
        ? data.validAnsweredCount
        : 0;

    // Fast-path: If all answers were gibberish / empty, return honest zero report immediately
    if (computedAverageScore === 0 || validAnsweredCount === 0) {
        return {
            ...DEFAULT_FAILED_SUMMARY,
            overallScore: 0,
        };
    }

    let response;
    try {
        const prompt = summaryPrompt({
            ...data,
            computedAverageScore,
            validAnsweredCount,
        });

        response = await llm.invoke(prompt);

        const cleaned = response?.content
            ?.replace(/```json/g, "")
            ?.replace(/```/g, "")
            ?.trim() || "";

        const parsed = JSON.parse(cleaned);

        // Deterministic Score Clamping (within ±3 points of computed average)
        let finalOverallScore = computedAverageScore;
        const parsedScore = Number(parsed.overallScore);
        if (Number.isFinite(parsedScore)) {
            const minAllowed = Math.max(0, computedAverageScore - 3);
            const maxAllowed = Math.min(100, computedAverageScore + 3);
            finalOverallScore = Math.min(maxAllowed, Math.max(minAllowed, Math.round(parsedScore)));
        }

        // Integrity check: If score is very low, eliminate hallucinated strengths
        if (computedAverageScore < 20) {
            return {
                overallScore: finalOverallScore,
                summary: parsed.summary || DEFAULT_FAILED_SUMMARY.summary,
                strengths: [
                    "No demonstrable strengths observed due to unanswered or invalid responses."
                ],
                weaknesses: Array.isArray(parsed.weaknesses) && parsed.weaknesses.length > 0
                    ? parsed.weaknesses
                    : DEFAULT_FAILED_SUMMARY.weaknesses,
                recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0
                    ? parsed.recommendations
                    : DEFAULT_FAILED_SUMMARY.recommendations,
            };
        }

        return {
            overallScore: finalOverallScore,
            summary: parsed.summary || "Candidate completed the interview evaluation.",
            strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0
                ? parsed.strengths
                : ["Demonstrated foundational domain awareness."],
            weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        };
    } catch (error) {
        console.error("Summary Agent Error:", error?.message);
        if (response?.content) {
            console.error("Summary Agent raw response content:", response.content);
        }

        // Resilient deterministic fallback
        return {
            overallScore: computedAverageScore,
            summary: computedAverageScore >= 50
                ? "Candidate demonstrated competent performance across technical interview questions."
                : DEFAULT_FAILED_SUMMARY.summary,
            strengths: computedAverageScore >= 50
                ? ["Demonstrated technical understanding of core interview topics."]
                : DEFAULT_FAILED_SUMMARY.strengths,
            weaknesses: DEFAULT_FAILED_SUMMARY.weaknesses,
            recommendations: DEFAULT_FAILED_SUMMARY.recommendations,
        };
    }
};
