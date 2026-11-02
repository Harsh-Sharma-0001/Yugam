import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import llm from "../config/llm.js";

const resumeSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    summary: { type: "string" },

    skills: {
      type: "array",
      items: { type: "string" },
    },

    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          technologies: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["name", "description", "technologies"],
        additionalProperties: false,
      },
    },

    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          degree: { type: "string" },
          institution: { type: "string" },
          dates: { type: "string" },
          cgpa: { type: "string" },
          percentage: { type: "string" },
          coursework: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "degree",
          "institution",
          "dates",
          "cgpa",
          "percentage",
          "coursework",
        ],
        additionalProperties: false,
      },
    },

    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "string" },
          company: { type: "string" },
          dates: { type: "string" },
          responsibilities: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["role", "company", "dates", "responsibilities"],
        additionalProperties: false,
      },
    },

    strengths: {
      type: "array",
      items: { type: "string" },
    },

    weaknesses: {
      type: "array",
      items: { type: "string" },
    },

    missingSkills: {
      type: "array",
      items: { type: "string" },
    },

    suggestedRole: { type: "string" },

    score: {
      type: "integer",
      minimum: 0,
      maximum: 100,
    },

    recommendations: {
      type: "array",
      items: { type: "string" },
    },
  },

  required: [
    "name",
    "email",
    "phone",
    "summary",
    "skills",
    "projects",
    "education",
    "experience",
    "strengths",
    "weaknesses",
    "missingSkills",
    "suggestedRole",
    "score",
    "recommendations",
  ],

  additionalProperties: false,
};

const structuredLLM = llm.withStructuredOutput(resumeSchema, {
  method: "jsonSchema",
  strict: true,
});


export const resumeAgent = async (resumeText) => {
  const response = await structuredLLM.invoke([
    new SystemMessage(`
You are an expert ATS Resume Parser and Resume Evaluator.

Analyze the provided resume and extract accurate, concise information.

STRICT EXTRACTION RULES:

1. Extract facts only from the supplied resume.
2. Never invent skills, qualifications, projects, experience,
   achievements, dates, certifications or metrics.
3. Preserve the candidate's original factual information.
4. Use "" for unavailable string fields.
5. Use [] for unavailable array fields.
6. Keep the summary within 60 words.
7. Keep project descriptions concise, preferably 30-50 words.
8. Extract all relevant technical skills explicitly mentioned.
9. Extract every identifiable education and experience entry.
10. Do not convert academic projects into professional employment.
11. Do not assume a candidate lacks a skill just because it
    is not mentioned in the resume.
12. Keep strengths and weaknesses concise and evidence-based.
13. Recommendations must be actionable and must not suggest
    fabricated achievements.
14. Score the resume based on its overall completeness,
    clarity, relevance and presentation. Use an integer
    between 0 and 100.
15. Return every field required by the supplied schema.

IMPORTANT:
- Do not omit fields.
- Do not write explanations outside the structured response.
- Prefer concise factual descriptions over lengthy narratives.
`),

    new HumanMessage(`
Analyze the following resume.

<RESUME>
${resumeText}
</RESUME>
`),
  ]);

  return response;
};
