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
import {
  getStudentsDirectory,
  exportStudentsDirectory,
} from "../controllers/directory.controller.js";
import {
  getScheduleById,
  getScheduledInterviews,
  scheduleInterview,
  updateScheduleStatus,
} from "../controllers/schedule.controller.js";
import { requireRole } from "../middleware/roleAuth.js";

const interviewRouter = express.Router();

// Code Execution Engine Routes
interviewRouter.post("/code/run", runCode);
interviewRouter.post("/code/execute", runCode);
interviewRouter.get("/code/status/:token", getExecutionStatus);

// Task & Assignment Routes
interviewRouter.post("/tasks", requireRole("admin", "trainer"), createTask);
interviewRouter.get("/tasks", requireRole("student", "trainer", "admin"), getTasks);
interviewRouter.post("/tasks/:taskId/submit", requireRole("student"), submitTask);
interviewRouter.get("/tasks/:taskId/submissions", requireRole("admin", "trainer"), getTaskSubmissions);
interviewRouter.patch("/tasks/:taskId/submissions/:submissionId", requireRole("admin", "trainer"), reviewSubmission);

// Student Performance Directory & Exports (Mounted before /:id)
interviewRouter.get("/students-directory/export", requireRole("admin", "trainer"), exportStudentsDirectory);
interviewRouter.get("/students-directory", requireRole("admin", "trainer"), getStudentsDirectory);

// Interview Scheduling Routes (Mounted before /:id)
interviewRouter.post("/schedule", requireRole("admin", "trainer"), scheduleInterview);
interviewRouter.get("/schedule", requireRole("student", "trainer", "admin"), getScheduledInterviews);
interviewRouter.patch("/schedule/:id/status", requireRole("admin", "trainer"), updateScheduleStatus);
interviewRouter.get("/schedule/:id", requireRole("student", "trainer", "admin"), getScheduleById);

// AI Mock Interview Routes
interviewRouter.post("/start", startInterview);
interviewRouter.post("/answer", submitAnswer);
interviewRouter.post("/submit", submitAnswer);
interviewRouter.get("/all", getAllInterviews);
interviewRouter.get("/:id", getInterview);

export default interviewRouter;
