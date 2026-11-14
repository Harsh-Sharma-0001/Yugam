import fs from "fs";
import crypto from "crypto";
import mongoose from "mongoose";

import redis from "../../../shared/redis/redis.js";

import { resumeAgent } from "../agents/resume.agent.js";
import extractText from "../config/pdf.js";
import Resume from "../models/resume.model.js";
import { deductCoins, refundCoins } from "../utils/coinClient.js";

import { ROLE_SKILLS } from "../config/roleSkills.js";

import {
  analyzeRoleSkills,
  getAvailableRoles,
  resolveTargetRoleKey,
} from "../utils/skillMatcher.js";
import { validatePdfBuffer } from "../utils/pdfValidator.js";
export { validatePdfBuffer };

// --------------------------------------------------
// UPLOAD AND ANALYZE RESUME
// --------------------------------------------------

export const uploadResume = async (req, res) => {
  const file = req.file;
  let reservationId;
  let deductedCoins = false;
  const userId = req.headers["x-user-id"];
  const sessionId = req.headers["x-session-id"];

  try {
    // 1. Validate uploaded file
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Resume PDF is required",
      });
    }

    // Validate PDF magic bytes (%PDF-) to reject spoofed MIME types
    const fileHeader = Buffer.alloc(5);
    const fd = fs.openSync(file.path, "r");
    try {
      fs.readSync(fd, fileHeader, 0, 5, 0);
    } finally {
      fs.closeSync(fd);
    }

    if (!validatePdfBuffer(fileHeader)) {
      return res.status(400).json({
        success: false,
        message: "Invalid PDF file signature.",
      });
    }

    // 2. Validate user
    if (
      !userId ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid UserId is required",
      });
    }

    // Deduct RESUME_SCORE coins BEFORE expensive PDF extraction and AI processing
    reservationId = crypto.randomUUID();
    let coinRes;
    try {
      coinRes = await deductCoins({
        userId,
        action: "RESUME_SCORE",
        reservationId,
        sessionId,
      });
      deductedCoins = true;
    } catch (coinErr) {
      if (coinErr.status === 402) {
        return res.status(402).json({
          success: false,
          message: "Insufficient interview coins.",
          interviewCoin: coinErr.data?.interviewCoin,
          required: coinErr.data?.required || 10,
        });
      }
      throw coinErr;
    }

    // 3. Extract text from PDF
    const resumeText = await extractText(file.path);

    if (!resumeText || !resumeText.trim()) {
      throw new Error("Could not extract text from the uploaded PDF");
    }

    // 4. Extract structured resume information using AI
    const resumeData = await resumeAgent(resumeText);

    if (
      !resumeData ||
      typeof resumeData !== "object" ||
      Array.isArray(resumeData)
    ) {
      throw new Error("Invalid structured response from Resume AI");
    }

    // 5. Resolve target role & domain
    // If the client explicitly provided a targetRole, respect it.
    // Otherwise, dynamically derive the role from the resume's own AI extraction (suggestedRole).
    const rawRole = (req.body?.targetRole || "").trim();
    const effectiveRoleName = rawRole || resumeData?.suggestedRole || "Full-Stack Software Engineer";
    const targetRoleKey = resolveTargetRoleKey(effectiveRoleName) || "custom-track";

    // 6. Perform deterministic role-based skill matching
    const roleSkillAnalysis = analyzeRoleSkills({
      targetRole: targetRoleKey,
      customRoleLabel: effectiveRoleName,
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
          targetRole: effectiveRoleName,
          suggestedRole: resumeData.suggestedRole || effectiveRoleName,
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
      interviewCoin: coinRes?.interviewCoin,
    });

  } catch (error) {
    console.error("Resume Upload Error:", error);

    // Automatic refund if coins were deducted
    let refundedBalance;
    if (deductedCoins && reservationId) {
      const refundRes = await refundCoins({
        userId,
        action: "RESUME_SCORE",
        reservationId,
        sessionId,
      });
      refundedBalance = refundRes?.interviewCoin;
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Resume processing failed",
      interviewCoin: refundedBalance,
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
              resume: cachedResume,
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
      return res.status(200).json({
        success: true,
        data: null,
        resume: null,
        message: "No resume found for this user.",
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
      resume: resume,
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
