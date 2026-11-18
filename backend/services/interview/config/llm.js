
import { ChatGroq } from "@langchain/groq"
import dotenv from "dotenv"
dotenv.config()

const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY || "mock-groq-key-test",
    model: "openai/gpt-oss-120b",
    temperature: 0.2,
    maxRetries: 2,
})

export default llm