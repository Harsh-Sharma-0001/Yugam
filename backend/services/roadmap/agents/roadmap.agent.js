import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import llm from "../configs/llm.js";
import roadmapPrompt from "../configs/roadmap.prompt.js";

const roadmapAgent = async (state) => {
    try {
        const resume = state.useResume && state.resume
            ? {
                skills: state.resume.skills || [],
                missingSkills: state.resume.missingSkills || [],
                projects: state.resume.projects || [],
                experience: state.resume.experience || [],
                score: state.resume.score || 0,
                suggestedRole: state.resume.suggestedRole || "",
                recommendations: state.resume.recommendations || [],
            }
            : null;

        const response = await llm.invoke([
            new SystemMessage(roadmapPrompt),
            new HumanMessage(`
Target Role:
${state.role}

Target Package:
${state.targetPackage}

Resume:
${JSON.stringify(resume, null, 2)}
`)
        ]);

        const cleaned = (response.content || "")
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        let roadmap;
        try {
            roadmap = JSON.parse(cleaned);
        } catch {
            const startIdx = cleaned.indexOf("{");
            const endIdx = cleaned.lastIndexOf("}");
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                roadmap = JSON.parse(cleaned.substring(startIdx, endIdx + 1));
            } else {
                throw new Error("Invalid structured response from Roadmap AI");
            }
        }

        const capitalize = (value = "") =>
            value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : "Medium";

        roadmap.level = capitalize(roadmap.level || "Intermediate");

        roadmap.modules = (roadmap.modules || []).map((module) => ({
            ...module,
            difficulty: capitalize(module.difficulty || "Medium"),
        }));

        return {
            ...state,
            roadmap,
        };
    } catch (error) {
        console.error("Roadmap Agent Error:", error);
        throw error;
    }
};

export default roadmapAgent;
