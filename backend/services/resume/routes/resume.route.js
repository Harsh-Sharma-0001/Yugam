import express from "express";

import {
  getResume,
  getResumeRoles,
  uploadResume,
} from "../controllers/resume.controller.js";

import { upload } from "../middleware/multer.js";

const resumeRouter = express.Router();

resumeRouter.get("/roles", getResumeRoles);

resumeRouter.post(
  "/upload",
  upload.single("resume"),
  uploadResume
);

resumeRouter.get("/get-resume", getResume);

export default resumeRouter;