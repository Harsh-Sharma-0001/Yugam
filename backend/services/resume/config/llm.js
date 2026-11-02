import { ChatGroq } from "@langchain/groq";
import dotenv from "dotenv";

dotenv.config();

const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,

  model: "openai/gpt-oss-20b",

  temperature: 0.1,

  // Increased from 2500 to 6000
  maxTokens: 6000,

  maxRetries: 2,
});

export default llm;
