import fs from "fs";
import mongoose from "mongoose";

import redis from "../../../shared/redis/redis.js";

import { resumeAgent } from "../agents/resume.agent.js";
import extractText from "../config/pdf.js";
import Resume from "../models/resume.model.js";

import { ROLE_SKILLS } from "../config/roleSkills.js";

import {
  analyzeRoleSkills,
  getAvailableRoles,
} from "../utils/skillMatcher.js";

// --------------------------------------------------
// UPLOAD AND ANALYZE RESUME
// --------------------------------------------------

export const uploadResume = async (req, res) => {
  const file = req.file;

  try {
    // 1. Validate uploaded file
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Resume PDF is required",
      });
    }

    // 2. Validate user
    const userId = req.headers["x-user-id"];

    if (
      !userId ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid UserId is required",
      });
    }

    // 3. Validate target role
    const targetRole = req.body?.targetRole;

    if (
      typeof targetRole !== "string" ||
      !Object.hasOwn(ROLE_SKILLS, targetRole)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid target role",
      });
    }

    // 4. Extract text from PDF
    const resumeText = await extractText(file.path);

    if (!resumeText || !resumeText.trim()) {
      return res.status(422).json({
        success: false,
        message: "Could not extract text from the uploaded PDF",
      });
    }

    // 5. Extract structured resume information using AI
    const resumeData = await resumeAgent(resumeText);

    if (
      !resumeData ||
      typeof resumeData !== "object" ||
      Array.isArray(resumeData)
    ) {
      throw new Error("Invalid structured response from Resume AI");
    }

    // 6. Perform deterministic role-based skill matching
    const roleSkillAnalysis = analyzeRoleSkills({
      targetRole,
      resumeData,
      extractedText: resumeText,
    });

    // 7. Save or update MongoDB
    const resume = await Resume.findOneAndUpdate(
      { userId },
      {
        $set: {
          ...resumeData,
          userId,
          extractedText: resumeText,
          targetRole,
          missingSkills: roleSkillAnalysis.missingSkills,
          roleSkillAnalysis,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    // 8. Update Redis cache
    try {
      await redis.set(
        `resume:${userId}`,
        JSON.stringify(resume)
      );
    } catch (cacheError) {
      console.error(
        "Resume Redis Cache Update Error:",
        cacheError.message
      );
    }

    // 9. Return response
    return res.status(200).json({
      success: true,
      message: "Resume analyzed successfully",
      data: resume,
    });

  } catch (error) {
    console.error("Resume Upload Error:", error);

    return res.status(500).json({
      success: false,
      message: "Resume processing failed",
    });

  } finally {
    // 10. Always delete temporary uploaded PDF
    if (file?.path) {
      try {
        await fs.promises.unlink(file.path);
      } catch (cleanupError) {
        if (cleanupError.code !== "ENOENT") {
          console.error(
            "PDF Cleanup Error:",
            cleanupError
          );
        }
      }
    }
  }
};


// --------------------------------------------------
// GET USER RESUME
// --------------------------------------------------

export const getResume = async (req, res) => {
  try {
    // 1. Validate user
    const userId = req.headers["x-user-id"];

    if (
      !userId ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid UserId is required",
      });
    }

    const cacheKey = `resume:${userId}`;

    // 2. Try Redis first
    try {
      const cache = await redis.get(cacheKey);

      if (cache) {
        try {
          const cachedResume = JSON.parse(cache);

          if (cachedResume && typeof cachedResume === "object") {
            return res.status(200).json({
              success: true,
              source: "redis",
              data: cachedResume,
            });
          }
        } catch (parseError) {
          console.error(
            "Invalid Resume Redis Cache:",
            parseError.message
          );
        }
      }
    } catch (cacheError) {
      console.error(
        "Resume Redis Cache Read Error:",
        cacheError.message
      );
    }

    // 3. Fallback to MongoDB
    const resume = await Resume.findOne({ userId });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    // 4. Repopulate Redis
    try {
      await redis.set(
        cacheKey,
        JSON.stringify(resume)
      );
    } catch (cacheError) {
      console.error(
        "Resume Redis Cache Populate Error:",
        cacheError.message
      );
    }

    // 5. Return MongoDB result
    return res.status(200).json({
      success: true,
      source: "mongoDb",
      data: resume,
    });

  } catch (error) {
    console.error("Get Resume Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve resume",
    });
  }
};


// --------------------------------------------------
// GET AVAILABLE RESUME ROLES
// --------------------------------------------------

export const getResumeRoles = (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: getAvailableRoles(),
    });
  } catch (error) {
    console.error("Get Resume Roles Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve available roles",
    });
  }
};
