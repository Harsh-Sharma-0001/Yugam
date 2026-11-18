import crypto from "crypto";
import mongoose from "mongoose";
import { getAuth } from "firebase-admin/auth";
import { app } from "../configs/firebase.js";
import User from "../model/user.model.js";
import CoinTransaction from "../models/CoinTransaction.js";
import AuditLog from "../models/auditLog.model.js";
import redis from "../../../shared/redis/redis.js";
import { FEATURE_COIN_COSTS } from "../constants/coinPricing.js";

/**
 * Executes a MongoDB operation inside a session transaction when supported,
 * with graceful fallback for standalone local instances.
 */
const withTransaction = async (operation) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (_) {}
    }
    // Fallback ONLY when MongoDB explicitly indicates standalone-server transactions unsupported (code 20 / IllegalOperation)
    // AND explicitly allowed in non-production environments
    const isStandaloneUnsupported =
      err.code === 20 ||
      err.codeName === "IllegalOperation" ||
      (err.message &&
        (err.message.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
          err.message.includes("Transactions are not supported")));

    const allowStandaloneFallback =
      process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_STANDALONE_MONGO === "true";

    if (isStandaloneUnsupported && allowStandaloneFallback) {
      return await operation(null);
    }
    throw err;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

export const login = async (req, res) => {
  try {
    const { token, idToken, intendedRole, authMode, collegeName, rollNumber, employeeId } = req.body;
    const authToken = token || idToken;

    if (!authToken) {
      return res.status(400).json({ success: false, message: "Authentication token is required." });
    }

    const decoded = await getAuth(app).verifyIdToken(authToken);
    const email = decoded.email?.toLowerCase();

    let user = await User.findOne({
      $or: [{ firebaseUid: decoded.uid }, { email }],
    });

    // 1. If user already exists in MongoDB
    if (user) {
      // Connect firebaseUid if not yet associated
      if (!user.firebaseUid) {
        user.firebaseUid = decoded.uid;
        await user.save();
      }

      // Role check: if caller passed an intendedRole that mismatches registered role
      if (intendedRole && user.role !== intendedRole) {
        const roleTitles = {
          student: "Student",
          trainer: "Technical Trainer",
          admin: "College Admin",
        };
        const actualTitle = roleTitles[user.role] || user.role;
        return res.status(403).json({
          success: false,
          roleMismatch: true,
          currentRole: user.role,
          message: `This account is registered as a ${actualTitle}. Please select the ${actualTitle} tab or contact your College Administrator.`,
        });
      }
    } else {
      // 2. New user registration
      const targetRole = intendedRole || "student";

      if (targetRole === "student") {
        user = await User.create({
          firebaseUid: decoded.uid,
          email,
          name: decoded.name || email?.split("@")[0] || "Student",
          role: "student",
          institutionId: collegeName ? collegeName.toUpperCase().replace(/\s+/g, "_") : "DEFAULT_COLLEGE",
          status: "active",
          profile: {
            rollNumber: rollNumber || "",
            department: "Computer Science & Engineering",
          },
        });
      } else {
        // Trainer or Admin signup:
        const bootstrapAdmins = (process.env.BOOTSTRAP_ADMIN_EMAILS || "")
          .toLowerCase()
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
        const bootstrapTrainers = (process.env.BOOTSTRAP_TRAINER_EMAILS || "")
          .toLowerCase()
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
        const allowSelfRole =
          process.env.ALLOW_SELF_ROLE_SIGNUP === "true" ||
          process.env.ALLOW_ROLE_SELECTION === "true";

        const isBootstrapAdmin = targetRole === "admin" && bootstrapAdmins.includes(email);
        const isBootstrapTrainer = targetRole === "trainer" && bootstrapTrainers.includes(email);

        if (isBootstrapAdmin || isBootstrapTrainer || allowSelfRole) {
          user = await User.create({
            firebaseUid: decoded.uid,
            email,
            name: decoded.name || email?.split("@")[0] || (targetRole === "admin" ? "Admin" : "Trainer"),
            role: targetRole,
            institutionId: collegeName ? collegeName.toUpperCase().replace(/\s+/g, "_") : "DEFAULT_COLLEGE",
            status: "active",
            profile: {
              employeeId: employeeId || "",
              designation: targetRole === "admin" ? "Institutional Administrator" : "Technical Faculty Trainer",
              department: "Academic Operations",
            },
          });
        } else {
          return res.status(403).json({
            success: false,
            message: `${targetRole === "admin" ? "College Admin" : "Technical Trainer"} accounts must be pre-provisioned by your institution. Please sign in with your college-invited email or contact your College Administrator.`,
          });
        }
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

    const { coins, action, idempotencyKey } = req.body;
    const cost = action && FEATURE_COIN_COSTS[action] !== undefined
      ? FEATURE_COIN_COSTS[action]
      : Number(coins);

    if (isNaN(cost) || cost <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid coin amount is required",
      });
    }

    if (idempotencyKey) {
      const existingTx = await CoinTransaction.findOne({ idempotencyKey });
      if (existingTx) {
        return res.status(200).json({
          success: true,
          duplicate: true,
          message: "Interview coins already deducted",
          action,
          interviewCoin: existingTx.balanceAfter,
        });
      }
    }

    // Atomic conditional balance deduction to prevent race conditions and negative balances (P0-04)
    const txResult = await withTransaction(async (dbSession) => {
      if (idempotencyKey) {
        const checkTx = await CoinTransaction.findOne(
          { idempotencyKey },
          null,
          dbSession ? { session: dbSession } : undefined
        );
        if (checkTx) {
          return { duplicate: true, balanceAfter: checkTx.balanceAfter };
        }
      }

      const updatedUser = await User.findOneAndUpdate(
        { _id: userId, interviewCoin: { $gte: cost } },
        { $inc: { interviewCoin: -cost } },
        { new: true, ...(dbSession ? { session: dbSession } : {}) }
      );

      if (!updatedUser) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      if (idempotencyKey) {
        await CoinTransaction.create(
          [
            {
              idempotencyKey,
              userId: updatedUser._id,
              amount: -cost,
              type: "FEATURE_DEBIT",
              feature: action || "use-coins",
              balanceAfter: updatedUser.interviewCoin,
            },
          ],
          dbSession ? { session: dbSession } : {}
        );
      }

      return { duplicate: false, balanceAfter: updatedUser.interviewCoin, userId: updatedUser._id };
    });

    if (txResult.duplicate) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: "Interview coins already deducted",
        action,
        interviewCoin: txResult.balanceAfter,
      });
    }

    // Synchronize all active Redis sessions for this user
    await syncUserSessionsInRedis(txResult.userId, txResult.balanceAfter, sessionId);

    return res.status(200).json({
      success: true,
      message: "Interview coins updated successfully",
      action,
      interviewCoin: txResult.balanceAfter,
    });
  } catch (error) {
    if (error.message === "INSUFFICIENT_FUNDS") {
      const existingUser = await User.findById(userId);
      return res.status(402).json({
        success: false,
        message: "Insufficient interview coins.",
        interviewCoin: existingUser ? existingUser.interviewCoin : 0,
      });
    }
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

    // Atomic transaction execution with standalone fallback (P0-04)
    const txResult = await withTransaction(async (dbSession) => {
      const checkTx = await CoinTransaction.findOne(
        { idempotencyKey },
        null,
        dbSession ? { session: dbSession } : undefined
      );
      if (checkTx) {
        return { duplicate: true, balanceAfter: checkTx.balanceAfter };
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { interviewCoin: addAmount } },
        { new: true, ...(dbSession ? { session: dbSession } : {}) }
      );

      if (!updatedUser) {
        throw new Error("USER_NOT_FOUND");
      }

      // Record transaction in ledger with correct enum type (P0-03)
      await CoinTransaction.create(
        [
          {
            idempotencyKey,
            userId: updatedUser._id,
            amount: addAmount,
            type: "PURCHASE_CREDIT",
            balanceAfter: updatedUser.interviewCoin,
          },
        ],
        dbSession ? { session: dbSession } : {}
      );

      return { duplicate: false, balanceAfter: updatedUser.interviewCoin, userId: updatedUser._id };
    });

    if (txResult.duplicate) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        interviewCoin: txResult.balanceAfter,
      });
    }

    // Synchronize all active Redis sessions for this user
    await syncUserSessionsInRedis(txResult.userId, txResult.balanceAfter, sessionId);

    return res.status(200).json({
      success: true,
      message: "Coins added successfully",
      interviewCoin: txResult.balanceAfter,
    });
  } catch (error) {
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (error.code === 11000) {
      const record = await CoinTransaction.findOne({ idempotencyKey: req.body?.idempotencyKey });
      return res.status(200).json({
        success: true,
        duplicate: true,
        interviewCoin: record ? record.balanceAfter : undefined,
      });
    }
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

    // Atomic conditional deduction within transaction (P0-04)
    const txResult = await withTransaction(async (dbSession) => {
      const checkTx = await CoinTransaction.findOne(
        { idempotencyKey: reservationId },
        null,
        dbSession ? { session: dbSession } : undefined
      );
      if (checkTx) {
        return { duplicate: true, balanceAfter: checkTx.balanceAfter };
      }

      const updatedUser = await User.findOneAndUpdate(
        { _id: userId, interviewCoin: { $gte: cost } },
        { $inc: { interviewCoin: -cost } },
        { new: true, ...(dbSession ? { session: dbSession } : {}) }
      );

      if (!updatedUser) {
        const existingUser = await User.findById(userId);
        if (!existingUser) {
          throw new Error("USER_NOT_FOUND");
        }
        throw new Error(`INSUFFICIENT_COINS:${existingUser.interviewCoin}`);
      }

      await CoinTransaction.create(
        [
          {
            idempotencyKey: reservationId,
            userId: updatedUser._id,
            amount: -cost,
            type: "FEATURE_DEDUCTION",
            feature: action,
            balanceAfter: updatedUser.interviewCoin,
          },
        ],
        dbSession ? { session: dbSession } : {}
      );

      return { duplicate: false, balanceAfter: updatedUser.interviewCoin, userId: updatedUser._id };
    });

    if (txResult.duplicate) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        interviewCoin: txResult.balanceAfter,
        deducted: cost,
      });
    }

    // Sync Redis sessions for active tabs
    const activeSessionId = sessionId || req.cookies?.session;
    await syncUserSessionsInRedis(txResult.userId, txResult.balanceAfter, activeSessionId);

    return res.status(200).json({
      success: true,
      interviewCoin: txResult.balanceAfter,
      deducted: cost,
    });
  } catch (error) {
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (error.message?.startsWith("INSUFFICIENT_COINS:")) {
      const available = Number(error.message.split(":")[1]) || 0;
      const cost = FEATURE_COIN_COSTS[req.body?.action] || 0;
      return res.status(402).json({
        success: false,
        message: `Insufficient coins for ${req.body?.action}. Required: ${cost}, Available: ${available}`,
        interviewCoin: available,
        requiredCoins: cost,
      });
    }
    if (error.code === 11000) {
      const record = await CoinTransaction.findOne({ idempotencyKey: req.body?.reservationId });
      return res.status(200).json({
        success: true,
        duplicate: true,
        interviewCoin: record ? record.balanceAfter : undefined,
        deducted: FEATURE_COIN_COSTS[req.body?.action] || 0,
      });
    }
    console.error("deductFeatureCoins error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const refundFeatureCoins = async (req, res) => {
  try {
    const { userId, action, reservationId, originalIdempotencyKey, sessionId } = req.body;
    const debitKey = originalIdempotencyKey || reservationId;

    if (!userId || !action || !debitKey) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters (userId, action, reservationId/originalIdempotencyKey).",
      });
    }

    const cost = FEATURE_COIN_COSTS[action];
    if (cost === undefined) {
      return res.status(400).json({
        success: false,
        message: `Invalid or unallowlisted action: ${action}`,
      });
    }

    // Verified Debit Linkage for Refunds (P1-08)
    const debitTx = await CoinTransaction.findOne({
      idempotencyKey: debitKey,
      userId,
      amount: { $lt: 0 },
    });

    if (!debitTx) {
      return res.status(400).json({
        success: false,
        message: "Refund rejected: No matching debit transaction found for this user and reservation.",
      });
    }

    // Verify feature matches original debit
    if (debitTx.feature && debitTx.feature !== action) {
      return res.status(400).json({
        success: false,
        message: `Refund rejected: Debit feature mismatch (${debitTx.feature} vs ${action}).`,
      });
    }

    // Validate requested refund amount does not exceed verified original debit's amount
    const originalDebitAmount = Math.abs(debitTx.amount);
    if (cost > originalDebitAmount) {
      return res.status(400).json({
        success: false,
        message: `Refund rejected: Requested refund (${cost}) exceeds original debit amount (${originalDebitAmount}).`,
      });
    }

    const refundKey = `refund:${debitKey}`;

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

    // Atomic refund operation within transaction (P0-04, P1-08)
    const txResult = await withTransaction(async (dbSession) => {
      const checkRefund = await CoinTransaction.findOne(
        { idempotencyKey: refundKey },
        null,
        dbSession ? { session: dbSession } : undefined
      );
      if (checkRefund) {
        return { duplicate: true, balanceAfter: checkRefund.balanceAfter };
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { interviewCoin: cost } },
        { new: true, ...(dbSession ? { session: dbSession } : {}) }
      );

      if (!updatedUser) {
        throw new Error("USER_NOT_FOUND");
      }

      await CoinTransaction.create(
        [
          {
            idempotencyKey: refundKey,
            originalIdempotencyKey: debitKey,
            userId: updatedUser._id,
            amount: cost,
            type: "FEATURE_REFUND",
            feature: action,
            balanceAfter: updatedUser.interviewCoin,
          },
        ],
        dbSession ? { session: dbSession } : {}
      );

      return { duplicate: false, balanceAfter: updatedUser.interviewCoin, userId: updatedUser._id };
    });

    if (txResult.duplicate) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        interviewCoin: txResult.balanceAfter,
        refunded: cost,
      });
    }

    // Sync Redis sessions for active tabs
    const activeSessionId = sessionId || req.cookies?.session;
    await syncUserSessionsInRedis(txResult.userId, txResult.balanceAfter, activeSessionId);

    return res.status(200).json({
      success: true,
      interviewCoin: txResult.balanceAfter,
      refunded: cost,
    });
  } catch (error) {
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (error.code === 11000) {
      const debitKey = req.body?.originalIdempotencyKey || req.body?.reservationId;
      const record = await CoinTransaction.findOne({ idempotencyKey: `refund:${debitKey}` });
      return res.status(200).json({
        success: true,
        duplicate: true,
        interviewCoin: record ? record.balanceAfter : undefined,
        refunded: FEATURE_COIN_COSTS[req.body?.action] || 0,
      });
    }
    console.error("refundFeatureCoins error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Session-authenticated refund for client features (e.g., failed PDF generation)
 */
export const refundUserCoins = async (req, res) => {
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

    req.body = req.body || {};
    req.body.userId = userId;
    req.body.sessionId = sessionId;
    return refundFeatureCoins(req, res);
  } catch (error) {
    console.error("refundUserCoins error:", error);
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
    const rejected = [];

    for (const record of users) {
      if (!record.email) continue;
      const email = String(record.email).toLowerCase().trim();
      let user = await User.findOne({ email });

      if (user) {
        // Cross-institution conflict protection (P0-05)
        if (user.institutionId && user.institutionId !== institutionId) {
          rejected.push({
            email,
            reason: `Cross-institution conflict: User already belongs to institution ${user.institutionId}`,
          });
          continue;
        }

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
      message: `Successfully provisioned ${provisioned.length} users.${rejected.length > 0 ? ` ${rejected.length} records rejected due to cross-institution conflicts.` : ""}`,
      count: provisioned.length,
      users: provisioned,
      rejected,
      rejectedCount: rejected.length,
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

