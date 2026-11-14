import llm from "../config/llm.js";
import feedbackPrompt from "../prompts/feedbackPrompt.js";





export const feedbackAgent = async (data) => {
    let response;
    try {
        const prompt = feedbackPrompt(data);

        response = await llm.invoke(prompt);

        const cleaned = response?.content
            ?.replace(/```json/g, "")
            ?.replace(/```/g, "")
            ?.trim() || "";

        return JSON.parse(cleaned);
    } catch (error) {
        console.error("Feedback Agent Error:", error?.message);
        if (response?.content) {
            console.error("Feedback Agent raw response content:", response.content);
        }

        throw new Error("Failed to generate feedback");
    }
};