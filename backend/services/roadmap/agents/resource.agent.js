import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import llm from "../configs/llm.js";
import searchVideo from "../configs/youtube.js";
import { validateResourceUrl, TRUSTED_RESOURCE_DOMAINS } from "../utils/urlValidator.js";

export { validateResourceUrl, TRUSTED_RESOURCE_DOMAINS };

const resourceAgent = async (state) => {
    try {
        const roadmap = state.roadmap;
        const role = state.role || "";
        const moduleTitles = (roadmap.modules || []).map((module) => module.title).join("\n");

        const docsResponse = await llm.invoke([
            new SystemMessage(`
You are an expert technical documentation librarian.
Target Track: ${role || "Software Engineering"}

For every module below, return the most authoritative official documentation URL or high-quality developer guide.

Rules:
1. Prefer primary official documentation (e.g. react.dev, nodejs.org, spring.io, python.org, docs.docker.com, kubernetes.io, playwright.dev, postgresql.org, mongodb.com, etc.).
2. If official docs do not exist, return a trusted developer reference (MDN, AWS Docs, RealPython, etc.).
3. Return ONLY a valid JSON array. No markdown, no commentary.
4. Keep the exact same module title.

Format:
[
  {
    "title": "Module Title",
    "article": "https://..."
  }
]
`),
            new HumanMessage(`Modules:\n${moduleTitles}`)
        ]);

        let docs = [];
        try {
            const cleaned = (docsResponse.content || "")
                .replace(/```json/gi, "")
                .replace(/```/g, "")
                .trim();
            const startIdx = cleaned.indexOf("[");
            const endIdx = cleaned.lastIndexOf("]");
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                docs = JSON.parse(cleaned.substring(startIdx, endIdx + 1));
            } else {
                docs = JSON.parse(cleaned);
            }
        } catch (e) {
            console.warn("Docs parsing error, using fallback links:", e?.message);
            docs = [];
        }

        const docsMap = new Map();
        docs.forEach((item) => {
            if (item?.title && item?.article) {
                docsMap.set(item.title.trim().toLowerCase(), item.article.trim());
            }
        });

        roadmap.modules = await Promise.all(
            (roadmap.modules || []).map(async (module) => {
                let video = null;
                try {
                    video = await searchVideo(module.title, role);
                } catch (err) {
                    console.warn("Video search error:", err?.message);
                }

                const fallbackDoc = `https://www.google.com/search?q=${encodeURIComponent(`${module.title} ${role} official documentation`.trim())}`;
                const rawDoc = docsMap.get((module.title || "").trim().toLowerCase());
                const safeDoc = validateResourceUrl(rawDoc, fallbackDoc);

                const fallbackVideo = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${module.title} ${role} tutorial`.trim())}`;
                const safeVideo = validateResourceUrl(video?.url, fallbackVideo);

                return {
                    ...module,
                    youtube: safeVideo,
                    article: safeDoc,
                };
            })
        );

        return {
            ...state,
            roadmap,
        };
    } catch (error) {
        console.error("Resource Agent Error:", error);
        return state;
    }
};

export default resourceAgent;
