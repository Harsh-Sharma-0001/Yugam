import express from "express";
import {
  getAllInterviews,
  getInterview,
  startInterview,
  submitAnswer,
} from "../controllers/interview.controller.js";
import { getExecutionStatus, runCode } from "../controllers/code.controller.js";
import {
  createTask,
  getTasks,
  getTaskSubmissions,
  reviewSubmission,
  submitTask,
} from "../controllers/task.controller.js";
import { requireRole } from "../middleware/roleAuth.js";

const interviewRouter = express.Router();

// Code Execution Engine Routes
interviewRouter.post("/code/run", runCode);
interviewRouter.post("/code/execute", runCode);
interviewRouter.get("/code/status/:token", getExecutionStatus);

// Task & Assignment Routes (Mounted before /:id)
interviewRouter.post("/tasks", requireRole("admin", "trainer"), createTask);
interviewRouter.get("/tasks", requireRole("student", "trainer", "admin"), getTasks);
interviewRouter.post("/tasks/:taskId/submit", requireRole("student"), submitTask);
interviewRouter.get("/tasks/:taskId/submissions", requireRole("admin", "trainer"), getTaskSubmissions);
interviewRouter.patch("/tasks/:taskId/submissions/:submissionId", requireRole("admin", "trainer"), reviewSubmission);

// AI Mock Interview Routes
interviewRouter.post("/start", startInterview);
interviewRouter.post("/answer", submitAnswer);
interviewRouter.post("/submit", submitAnswer);
interviewRouter.get("/all", getAllInterviews);
interviewRouter.get("/:id", getInterview);

export default interviewRouter;
