import express from "express"
import { getAllInterviews, getInterview, startInterview, submitAnswer } from "../controllers/interview.controller.js"
import { getExecutionStatus, runCode } from "../controllers/code.controller.js"

const interviewRouter = express.Router()

// Code Execution Engine Routes
interviewRouter.post("/code/run", runCode)
interviewRouter.get("/code/status/:token", getExecutionStatus)

interviewRouter.post("/start", startInterview)
interviewRouter.post("/answer", submitAnswer)
interviewRouter.get("/all", getAllInterviews)
interviewRouter.get("/:id", getInterview)

export default interviewRouter