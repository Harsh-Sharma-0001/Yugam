import llm from "../config/llm.js"
import hrInterviewPrompt from "../prompts/hrInterviewPrompt.js"
import technicalInterviewPrompt from "../prompts/technicalInterviewPrompt.js"



export const interviewAgent = async (data) => {
    let rawContent = "";
    try {
        const isHr = String(data.type || "").trim().toLowerCase() === "hr";
        const prompt = isHr ? hrInterviewPrompt(data) : technicalInterviewPrompt(data);

        const response = await llm.invoke(prompt);
        rawContent = response?.content || "";

        const cleaned = rawContent
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        // Attempt direct parse
        try {
            return JSON.parse(cleaned);
        } catch {
            // Fallback: extract substring between first [ and last ]
            const startIdx = cleaned.indexOf("[");
            const endIdx = cleaned.lastIndexOf("]");
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                return JSON.parse(cleaned.substring(startIdx, endIdx + 1));
            }
            throw new Error("Unable to locate JSON array in response");
        }
    } catch (error) {
        console.error("Interview Agent Error:", error?.message);
        if (rawContent) {
            console.error("Raw LLM Response:", rawContent);
        }
        throw new Error("Failed to generate interview questions.");
    }
};