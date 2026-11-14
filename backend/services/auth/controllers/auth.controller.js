import crypto from "crypto";
import { getAuth } from "firebase-admin/auth";
import { app } from "../configs/firebase.js";
import User from "../model/user.model.js";
import CoinTransaction from "../models/CoinTransaction.js";
import AuditLog from "../models/auditLog.model.js";
import redis from "../../../shared/redis/redis.js";
import { FEATURE_COIN_COSTS } from "../constants/coinPricing.js";

export const login = async (req, res) => {
  try {
    const { token } = req.body;

    const decoded = await getAuth(app).verifyIdToken(token);

    let user = await User.findOne({
      firebaseUid: decoded.uid,
    });

    if (!user) {
      // Check if user was pre-provisioned by email
      const existingByEmail = await User.findOne({ email: decoded.email?.toLowerCase() });
      if (existingByEmail) {
        existingByEmail.firebaseUid = decoded.uid;
        if (!existingByEmail.name && decoded.name) {
          existingByEmail.name = decoded.name;
        }
        user = await existingByEmail.save();
      } else {
        user = await User.create({
          firebaseUid: decoded.uid,
          email: decoded.email?.toLowerCase(),
          name: decoded.name || decoded.email?.split("@")[0],
          role: "student",
          institutionId: "DEFAULT_COLLEGE",
          status: "active",
        });
      }
    }

    const sessionId = crypto.randomUUID();

    await redis.set(
      `session:${sessionId}`,
      JSON.stringify({
        userId: user._id,
        name: user.name,
        email: user.email,
        interviewCoin: user.interviewCoin,
        role: user.role || "student",
        institutionId: user.institutionId || "DEFAULT_COLLEGE",
        status: user.status || "active",
        permissions: user.permissions || [],
        profile: user.profile || {},
      }),
      "EX",
      60 * 60 * 24 * 7
    );

    // Track active session in the user's session set
    await redis.sadd(`userSessions:${user._id}`, sessionId);
    await redis.expire(`userSessions:${user._id}`, 60 * 60 * 24 * 7);

    res.cookie("session", sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.json({ success: true, user });
  } catch (error) {
    console.log(error);
    return res.status(401).json({ message: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    const sessionId = req.cookies?.session;

    if (sessionId) {
      const session = await redis.get(`session:${sessionId}`);
      if (session) {
        try {
          const sessionData = JSON.parse(session);
          if (sessionData?.userId) {
            await redis.srem(`userSessions:${sessionData.userId}`, sessionId);
          }
        } catch (e) {
          console.error("Error cleaning up user session set on logout:", e);
        }
      }
      await redis.del(`session:${sessionId}`);
    }

    res.clearCookie("session", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const syncFullUserDataInRedis = async (userId, updatedUser, specificSessionId) => {
  try {
    const patchData = (sessionData) => {
      if (updatedUser.name !== undefined) sessionData.name = updatedUser.name;
      if (updatedUser.email !== undefined) sessionData.email = updatedUser.email;
      if (updatedUser.interviewCoin !== undefined) sessionData.interviewCoin = updatedUser.interviewCoin;
      if (updatedUser.role !== undefined) sessionData.role = updatedUser.role;
      if (updatedUser.institutionId !== undefined) sessionData.institutionId = updatedUser.institutionId;
      if (updatedUser.status !== undefined) sessionData.status = updatedUser.status;
      if (updatedUser.permissions !== undefined) sessionData.permissions = updatedUser.permissions;
      if (updatedUser.profile !== undefined) sessionData.profile = updatedUser.profile;
      return sessionData;
    };

    if (specificSessionId) {
      const cached = await redis.get(`session:${specificSessionId}`);
      if (cached) {
        const sessionData = patchData(JSON.parse(cached));
        const ttl = await redis.ttl(`session:${specificSessionId}`);
        await redis.set(
          `session:${specificSessionId}`,
          JSON.stringify(sessionData),
          "EX",
          ttl > 0 ? ttl : 60 * 60 * 24 * 7
        );
      }
    }

    const userSessionsKey = `userSessions:${userId}`;
    const sessionIds = await redis.smembers(userSessionsKey);

    if (sessionIds && sessionIds.length > 0) {
      for (const sid of sessionIds) {
        if (sid === specificSessionId) continue;
        const cached = await redis.get(`session:${sid}`);
        if (cached) {
          const sessionData = patchData(JSON.parse(cached));
          const ttl = await redis.ttl(`session:${sid}`);
          await redis.set(
            `session:${sid}`,
            JSON.stringify(sessionData),
            "EX",
            ttl > 0 ? ttl : 60 * 60 * 24 * 7
          );
        } else {
          await redis.srem(userSessionsKey, sid);
        }
      }
    }
  } catch (err) {
    console.error("syncFullUserDataInRedis error:", err);
  }
};

export const syncUserSessionsInRedis = async (userId, updatedCoins, specificSessionId) => {
  return syncFullUserDataInRedis(userId, { interviewCoin: updatedCoins }, specificSessionId);
};

export const useInterviewCoins = async (req, res) => {
  try {
    const sessionId = req.cookies?.session || req.headers["x-session-id"];
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No active session.",
      });
    }

    const rawSession = await redis.get(`session:${sessionId}`);
    if (!rawSession) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid or expired session.",
      });
    }

    const sessionData = JSON.parse(rawSession);
    const userId = sessionData?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid session payload.",
      });
    }

    const { coins, action } = req.body;
    const cost = action && FEATURE_COIN_COSTS[action] !== undefined
      ? FEATURE_COIN_COSTS[action]
      : Number(coins);

    if (isNaN(cost) || cost <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid coin amount is required",
      });
    }

    // Atomic conditional balance deduction to prevent race conditions and negative balances
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, interviewCoin: { $gte: cost } },
      { $inc: { interviewCoin: -cost } },
      { new: true }
    );

    if (!updatedUser) {
      const existingUser = await User.findById(userId);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      return res.status(402).json({
        success: false,
        message: "Insufficient interview coins.",
        interviewCoin: existingUser.interviewCoin,
      });
    }

    // Synchronize all active Redis sessions for this user
    await syncUserSessionsInRedis(updatedUser._id, updatedUser.interviewCoin, sessionId);

    return res.status(200).json({
      success: true,
      message: "Interview coins updated successfully",
      action,
      interviewCoin: updatedUser.interviewCoin,
    });
  } catch (error) {
    console.error("useInterviewCoins error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const addCoins = async (req, res) => {
  try {
    const { userId, amount, coins, idempotencyKey, sessionId } = req.body;
    const addAmount = Number(amount ?? coins);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (isNaN(addAmount) || addAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid coin amount is required",
      });
    }

    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: "idempotencyKey is required",
      });
    }

    // Check if transaction has already been recorded in the ledger
    const existingTx = await CoinTransaction.findOne({ idempotencyKey });
    if (existingTx) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        interviewCoin: existingTx.balanceAfter,
      });
    }

    // Atomically increment user balance
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { interviewCoin: addAmount } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Record transaction in ledger
    try {
      await CoinTransaction.create({
        idempotencyKey,
        userId: updatedUser._id,
        amount: addAmount,
        type: "PURCHASE",
        balanceAfter: updatedUser.interviewCoin,
      });
    } catch (err) {
      if (err.code === 11000) {
        // Race condition: concurrent execution already recorded ledger
        const record = await CoinTransaction.findOne({ idempotencyKey });
        return res.status(200).json({
          success: true,
          duplicate: true,
          interviewCoin: record ? record.balanceAfter : updatedUser.interviewCoin,
        });
      }
      throw err;
    }

    // Synchronize all active Redis sessions for this user
    await syncUserSessionsInRedis(updatedUser._id, updatedUser.interviewCoin, sessionId);

    return res.status(200).json({
      success: true,
      message: "Coins added successfully",
      interviewCoin: updatedUser.interviewCoin,
    });
  } catch (error) {
    console.error("addCoins error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deductFeatureCoins = async (req, res) => {
  try {
    const { userId, action, reservationId, sessionId } = req.body;

    if (!userId || !action || !reservationId) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters (userId, action, reservationId).",
      });
    }

    const cost = FEATURE_COIN_COSTS[action];
    if (cost === undefined) {
      return res.status(400).json({
        success: false,
        message: `Invalid or unallowlisted action: ${action}`,
      });
    }

    // Idempotency check: if this reservation has already executed, return current state
    const existingTx = await CoinTransaction.findOne({ idempotencyKey: reservationId });
    if (existingTx) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        interviewCoin: existingTx.balanceAfter,
        deducted: cost,
      });
    }

    // Atomic conditional deduction
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, interviewCoin: { $gte: cost } },
      { $inc: { interviewCoin: -cost } },
      { new: true }
    );

    if (!updatedUser) {
      const existingUser = await User.findById(userId);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      return res.status(402).json({
        success: false,
        message: `Insufficient coins for ${action}. Required: ${cost}, Available: ${existingUser.interviewCoin}`,
        interviewCoin: existingUser.interviewCoin,
        requiredCoins: cost,
      });
    }

    // Record immutable ledger entry
    try {
      await CoinTransaction.create({
        idempotencyKey: reservationId,
        userId: updatedUser._id,
        amount: -cost,
        type: "FEATURE_DEDUCTION",
        balanceAfter: updatedUser.interviewCoin,
      });
    } catch (err) {
      if (err.code === 11000) {
        // Concurrent race condition: duplicate reservation processed
        await User.findByIdAndUpdate(userId, { $inc: { interviewCoin: cost } });
        const record = await CoinTransaction.findOne({ idempotencyKey: reservationId });
        return res.status(200).json({
          success: true,
          duplicate: true,
          interviewCoin: record ? record.balanceAfter : updatedUser.interviewCoin + cost,
          deducted: cost,
        });
      }
      throw err;
    }

    // Sync Redis sessions for active tabs
    const activeSessionId = sessionId || req.cookies?.session;
    await syncUserSessionsInRedis(updatedUser._id, updatedUser.interviewCoin, activeSessionId);

    return res.status(200).json({
      success: true,
      interviewCoin: updatedUser.interviewCoin,
      deducted: cost,
    });
  } catch (error) {
    console.error("deductFeatureCoins error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const refundFeatureCoins = async (req, res) => {
  try {
    const { userId, action, reservationId, sessionId } = req.body;

    if (!userId || !action || !reservationId) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters (userId, action, reservationId).",
      });
    }

    const cost = FEATURE_COIN_COSTS[action];
    if (cost === undefined) {
      return res.status(400).json({
        success: false,
        message: `Invalid or unallowlisted action: ${action}`,
      });
    }

    const refundKey = `refund:${reservationId}`;

    // Idempotency check: if this refund has already executed, return current state
    const existingRefund = await CoinTransaction.findOne({ idempotencyKey: refundKey });
    if (existingRefund) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        interviewCoin: existingRefund.balanceAfter,
        refunded: cost,
      });
    }

    // Atomically refund coins back to the user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { interviewCoin: cost } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Record refund in the ledger
    try {
      await CoinTransaction.create({
        idempotencyKey: refundKey,
        userId: updatedUser._id,
        amount: cost,
        type: "FEATURE_REFUND",
        balanceAfter: updatedUser.interviewCoin,
      });
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate refund caught by unique idempotencyKey index
        await User.findByIdAndUpdate(userId, { $inc: { interviewCoin: -cost } });
        const record = await CoinTransaction.findOne({ idempotencyKey: refundKey });
        return res.status(200).json({
          success: true,
          duplicate: true,
          interviewCoin: record ? record.balanceAfter : updatedUser.interviewCoin - cost,
          refunded: cost,
        });
      }
      throw err;
    }

    // Sync Redis sessions for active tabs
    const activeSessionId = sessionId || req.cookies?.session;
    await syncUserSessionsInRedis(updatedUser._id, updatedUser.interviewCoin, activeSessionId);

    return res.status(200).json({
      success: true,
      interviewCoin: updatedUser.interviewCoin,
      refunded: cost,
    });
  } catch (error) {
    console.error("refundFeatureCoins error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-__v -firebaseUid");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        interviewCoin: user.interviewCoin,
        role: user.role || "student",
        institutionId: user.institutionId || "DEFAULT_COLLEGE",
        status: user.status || "active",
        permissions: user.permissions || [],
        profile: user.profile || {},
      },
    });
  } catch (error) {
    console.error("getUserById error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * PUT /api/auth/profile
 * Authenticated user updates their name and role-tailored profile.
 * Academic Integrity Guard: Changes to student marks/CGPA enter pending verification.
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.userId || req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Missing user identity." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const { name, profile: newProfile = {} } = req.body;

    if (name && typeof name === "string") {
      user.name = name.trim();
    }

    const currentProfile = user.profile ? (typeof user.profile.toObject === "function" ? user.profile.toObject() : { ...user.profile }) : {};

    if (user.role === "student") {
      // Immediate updates permitted
      if (newProfile.contactNumber !== undefined) currentProfile.contactNumber = String(newProfile.contactNumber).trim();
      if (newProfile.resumeUrl !== undefined) currentProfile.resumeUrl = String(newProfile.resumeUrl).trim();
      if (newProfile.collegeName !== undefined) currentProfile.collegeName = String(newProfile.collegeName).trim();
      if (newProfile.course !== undefined) currentProfile.course = String(newProfile.course).trim();
      if (newProfile.section !== undefined) currentProfile.section = String(newProfile.section).trim();
      if (newProfile.rollNumber !== undefined) currentProfile.rollNumber = String(newProfile.rollNumber).trim();

      // Academic fields check: currentCGPA, semester, year, tenthPercentage, twelfthPercentage
      const hasAcademicChange =
        newProfile.currentCGPA !== undefined ||
        newProfile.semester !== undefined ||
        newProfile.year !== undefined ||
        newProfile.tenthPercentage !== undefined ||
        newProfile.twelfthPercentage !== undefined ||
        newProfile.academics?.tenthPercentage !== undefined ||
        newProfile.academics?.twelfthPercentage !== undefined;

      if (hasAcademicChange) {
        const tenth =
          newProfile.academics?.tenthPercentage !== undefined
            ? Number(newProfile.academics.tenthPercentage)
            : newProfile.tenthPercentage !== undefined
            ? Number(newProfile.tenthPercentage)
            : currentProfile.academics?.tenthPercentage;

        const twelfth =
          newProfile.academics?.twelfthPercentage !== undefined
            ? Number(newProfile.academics.twelfthPercentage)
            : newProfile.twelfthPercentage !== undefined
            ? Number(newProfile.twelfthPercentage)
            : currentProfile.academics?.twelfthPercentage;

        const cgpa =
          newProfile.currentCGPA !== undefined
            ? Number(newProfile.currentCGPA)
            : currentProfile.currentCGPA;

        const sem =
          newProfile.semester !== undefined
            ? Number(newProfile.semester)
            : currentProfile.semester;

        const yr =
          newProfile.year !== undefined
            ? Number(newProfile.year)
            : currentProfile.year;

        currentProfile.pendingAcademicUpdate = {
          currentCGPA: cgpa,
          semester: sem,
          year: yr,
          tenthPercentage: tenth,
          twelfthPercentage: twelfth,
          submittedAt: new Date(),
        };
        currentProfile.academicVerificationStatus = "pending";

        // Log to AuditLog for transparency
        await AuditLog.create({
          institutionId: user.institutionId || "DEFAULT_COLLEGE",
          actorId: user._id,
          actorRole: user.role,
          action: "ACADEMICS_UPDATE_SUBMITTED",
          targetId: user._id,
          details: { pendingAcademicUpdate: currentProfile.pendingAcademicUpdate },
        });
      }
    } else if (user.role === "trainer") {
      if (newProfile.employeeId !== undefined) currentProfile.employeeId = String(newProfile.employeeId).trim();
      if (newProfile.collegeName !== undefined) currentProfile.collegeName = String(newProfile.collegeName).trim();
      if (newProfile.department !== undefined) currentProfile.department = String(newProfile.department).trim();
      if (newProfile.designation !== undefined) currentProfile.designation = String(newProfile.designation).trim();
      if (newProfile.specializations !== undefined) {
        currentProfile.specializations = Array.isArray(newProfile.specializations)
          ? newProfile.specializations
          : String(newProfile.specializations)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
      }
      if (newProfile.yearsOfExperience !== undefined) currentProfile.yearsOfExperience = Number(newProfile.yearsOfExperience);
      if (newProfile.contactNumber !== undefined) currentProfile.contactNumber = String(newProfile.contactNumber).trim();
      if (newProfile.bio !== undefined) currentProfile.bio = String(newProfile.bio).trim();
    } else if (user.role === "admin") {
      if (newProfile.employeeId !== undefined) currentProfile.employeeId = String(newProfile.employeeId).trim();
      if (newProfile.collegeName !== undefined) currentProfile.collegeName = String(newProfile.collegeName).trim();
      if (newProfile.department !== undefined) currentProfile.department = String(newProfile.department).trim();
      if (newProfile.designation !== undefined) currentProfile.designation = String(newProfile.designation).trim();
      if (newProfile.contactNumber !== undefined) currentProfile.contactNumber = String(newProfile.contactNumber).trim();
    }

    user.profile = currentProfile;
    await user.save();

    const sessionId = req.cookies?.session || req.headers["x-session-id"];
    await syncFullUserDataInRedis(user._id, user, sessionId);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user,
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/auth/students/:studentId/verify-academics
 * Allowed: admin, trainer
 */
export const verifyStudentAcademics = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status = "verified", remarks } = req.body;

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    if (req.institutionId && student.institutionId !== req.institutionId) {
      return res.status(403).json({ success: false, message: "Forbidden: Cross-institution action not permitted." });
    }

    if (student.role !== "student") {
      return res.status(400).json({ success: false, message: "Target user is not a student." });
    }

    const studentProfile = student.profile ? (typeof student.profile.toObject === "function" ? student.profile.toObject() : { ...student.profile }) : {};

    if (status === "verified") {
      if (studentProfile.pendingAcademicUpdate) {
        const update = studentProfile.pendingAcademicUpdate;
        if (update.currentCGPA !== undefined) studentProfile.currentCGPA = update.currentCGPA;
        if (update.semester !== undefined) studentProfile.semester = update.semester;
        if (update.year !== undefined) studentProfile.year = update.year;

        studentProfile.academics = studentProfile.academics || {};
        if (update.tenthPercentage !== undefined) studentProfile.academics.tenthPercentage = update.tenthPercentage;
        if (update.twelfthPercentage !== undefined) studentProfile.academics.twelfthPercentage = update.twelfthPercentage;
      }
      studentProfile.academicVerificationStatus = "verified";
      studentProfile.pendingAcademicUpdate = null;
    } else {
      studentProfile.academicVerificationStatus = "unsubmitted";
      studentProfile.pendingAcademicUpdate = null;
    }

    student.profile = studentProfile;
    await student.save();

    await AuditLog.create({
      institutionId: student.institutionId || req.institutionId || "DEFAULT_COLLEGE",
      actorId: req.userId,
      actorRole: req.userRole || "admin",
      action: "ACADEMICS_VERIFIED",
      targetId: student._id,
      details: { status, remarks, verifiedAt: new Date() },
    });

    await syncFullUserDataInRedis(student._id, student);

    return res.status(200).json({
      success: true,
      message: `Student academic status marked as ${status}.`,
      user: student,
    });
  } catch (error) {
    console.error("verifyStudentAcademics error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/auth/users/:targetUserId/role
 * Allowed: admin only
 */
export const updateUserRole = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const { role, permissions, status } = req.body;

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (req.institutionId && targetUser.institutionId !== req.institutionId) {
      return res.status(403).json({ success: false, message: "Forbidden: Cross-institution action not permitted." });
    }

    // Last active admin demotion/suspension guard
    if (
      targetUser.role === "admin" &&
      ((role && role !== "admin") || (status && status !== "active"))
    ) {
      const activeAdminCount = await User.countDocuments({
        institutionId: targetUser.institutionId,
        role: "admin",
        status: "active",
      });

      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: "Action rejected: Cannot demote or suspend the last active administrator of this institution.",
        });
      }
    }

    if (role) {
      if (!["student", "trainer", "admin"].includes(role)) {
        return res.status(400).json({ success: false, message: `Invalid role: ${role}` });
      }
      targetUser.role = role;
    }

    if (permissions && Array.isArray(permissions)) {
      targetUser.permissions = permissions;
    }

    if (status) {
      if (!["active", "suspended", "pending"].includes(status)) {
        return res.status(400).json({ success: false, message: `Invalid status: ${status}` });
      }
      targetUser.status = status;
    }

    await targetUser.save();

    await AuditLog.create({
      institutionId: targetUser.institutionId || req.institutionId || "DEFAULT_COLLEGE",
      actorId: req.userId,
      actorRole: req.userRole || "admin",
      action: "ROLE_UPDATED",
      targetId: targetUser._id,
      details: { newRole: targetUser.role, permissions: targetUser.permissions, status: targetUser.status },
    });

    await syncFullUserDataInRedis(targetUser._id, targetUser);

    return res.status(200).json({
      success: true,
      message: "User role and permissions updated successfully.",
      user: targetUser,
    });
  } catch (error) {
    console.error("updateUserRole error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/auth/admin/provision-users
 * Allowed: admin only
 */
export const provisionUsers = async (req, res) => {
  try {
    const { users } = req.body;
    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, message: "Valid users array is required." });
    }

    const institutionId = req.institutionId || "DEFAULT_COLLEGE";
    const provisioned = [];

    for (const record of users) {
      if (!record.email) continue;
      const email = String(record.email).toLowerCase().trim();
      let user = await User.findOne({ email });

      if (user) {
        user.name = record.name || user.name;
        user.role = record.role || user.role || "student";
        user.institutionId = institutionId;
        user.profile = user.profile || {};
        if (record.rollNumber) user.profile.rollNumber = record.rollNumber;
        if (record.course) user.profile.course = record.course;
        if (record.section) user.profile.section = record.section;
        if (record.year) user.profile.year = Number(record.year);
        if (record.semester) user.profile.semester = Number(record.semester);
        if (record.currentCGPA !== undefined) user.profile.currentCGPA = Number(record.currentCGPA);
        if (record.tenthPercentage !== undefined || record.twelfthPercentage !== undefined) {
          user.profile.academics = user.profile.academics || {};
          if (record.tenthPercentage !== undefined) user.profile.academics.tenthPercentage = Number(record.tenthPercentage);
          if (record.twelfthPercentage !== undefined) user.profile.academics.twelfthPercentage = Number(record.twelfthPercentage);
        }
        if (record.employeeId) user.profile.employeeId = record.employeeId;
        if (record.department) user.profile.department = record.department;
        if (record.designation) user.profile.designation = record.designation;
        user.profile.academicVerificationStatus = "verified";
        await user.save();
        await syncFullUserDataInRedis(user._id, user);
        provisioned.push(user);
      } else {
        const placeholderUid = `provisioned_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        user = await User.create({
          firebaseUid: placeholderUid,
          email,
          name: record.name || email.split("@")[0],
          role: record.role || "student",
          institutionId,
          status: "active",
          profile: {
            rollNumber: record.rollNumber,
            course: record.course,
            section: record.section,
            year: record.year ? Number(record.year) : undefined,
            semester: record.semester ? Number(record.semester) : undefined,
            currentCGPA: record.currentCGPA !== undefined ? Number(record.currentCGPA) : undefined,
            academics: {
              tenthPercentage: record.tenthPercentage ? Number(record.tenthPercentage) : undefined,
              twelfthPercentage: record.twelfthPercentage ? Number(record.twelfthPercentage) : undefined,
            },
            employeeId: record.employeeId,
            department: record.department,
            designation: record.designation,
            academicVerificationStatus: "verified",
          },
        });
        provisioned.push(user);
      }
    }

    await AuditLog.create({
      institutionId,
      actorId: req.userId,
      actorRole: req.userRole || "admin",
      action: "BULK_IMPORT",
      details: { count: provisioned.length, importedAt: new Date() },
    });

    return res.status(200).json({
      success: true,
      message: `Successfully provisioned ${provisioned.length} users.`,
      count: provisioned.length,
      users: provisioned,
    });
  } catch (error) {
    console.error("provisionUsers error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/auth/users
 * Allowed: admin, trainer
 */
export const getInstitutionUsers = async (req, res) => {
  try {
    const institutionId = req.institutionId || "DEFAULT_COLLEGE";
    const { role, status, search } = req.query;

    const filter = { institutionId };
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { "profile.rollNumber": searchRegex },
        { "profile.employeeId": searchRegex },
        { "profile.section": searchRegex },
      ];
    }

    const users = await User.find(filter).select("-__v -firebaseUid").sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("getInstitutionUsers error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/auth/students/pending-verifications
 * Allowed: admin, trainer
 */
export const getPendingVerifications = async (req, res) => {
  try {
    const institutionId = req.institutionId || "DEFAULT_COLLEGE";
    const students = await User.find({
      institutionId,
      role: "student",
      "profile.academicVerificationStatus": "pending",
    })
      .select("-__v -firebaseUid")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    console.error("getPendingVerifications error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/auth/audit-logs
 * Allowed: admin only
 */
export const getAuditLogs = async (req, res) => {
  try {
    const institutionId = req.institutionId || "DEFAULT_COLLEGE";
    const logs = await AuditLog.find({ institutionId })
      .populate("actorId", "name email role")
      .populate("targetId", "name email role")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error("getAuditLogs error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /internal/institution/students
 * Protected by isInternalService
 */
export const getInternalStudents = async (req, res) => {
  try {
    const { institutionId } = req.query;
    const filter = { role: "student" };
    if (institutionId) {
      filter.institutionId = institutionId;
    }

    const students = await User.find(filter)
      .select("_id name email status role institutionId profile createdAt")
      .lean();

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    console.error("getInternalStudents error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /internal/audit-logs
 * Protected by isInternalService
 */
export const createInternalAuditLog = async (req, res) => {
  try {
    const { institutionId, actorId, actorRole, action, targetId, details } = req.body;
    if (!institutionId || !actorId || !actorRole || !action) {
      return res.status(400).json({ success: false, message: "Missing required audit fields." });
    }

    const log = await AuditLog.create({
      institutionId,
      actorId,
      actorRole,
      action,
      targetId: targetId || null,
      details: details || {},
    });

    return res.status(201).json({
      success: true,
      log,
    });
  } catch (error) {
    console.error("createInternalAuditLog error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

