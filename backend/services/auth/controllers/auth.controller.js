import crypto from "crypto";

import { getAuth } from "firebase-admin/auth";


import { app } from "../configs/firebase.js";
import User from "../model/user.model.js";
import CoinTransaction from "../models/CoinTransaction.js";
import redis from "../../../shared/redis/redis.js";


export const login = async (req, res) => {

  try {

    const { token } = req.body;

    const decoded = await getAuth(app).verifyIdToken(token);

    let user = await User.findOne({
      firebaseUid: decoded.uid,
    });

    if (!user) {

      user = await User.create({

        firebaseUid: decoded.uid,

        email: decoded.email,

        name: decoded.name

      });

    }

    const sessionId = crypto.randomUUID();

    await redis.set(`session:${sessionId}`, JSON.stringify({
        userId: user._id,
        name: user.name,
        email: user.email,
        interviewCoin: user.interviewCoin
      }), "EX", 60 * 60 * 24 * 7);

    // Track active session in the user's session set
    await redis.sadd(`userSessions:${user._id}`, sessionId);
    await redis.expire(`userSessions:${user._id}`, 60 * 60 * 24 * 7);

    res.cookie("session", sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 1000 * 60 * 60 * 24 * 7,
      }
    );

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
export const syncUserSessionsInRedis = async (userId, updatedCoins, specificSessionId) => {
  try {
    // 1. If a specific sessionId is known, update it directly
    if (specificSessionId) {
      const cached = await redis.get(`session:${specificSessionId}`);
      if (cached) {
        const sessionData = JSON.parse(cached);
        sessionData.interviewCoin = updatedCoins;
        const ttl = await redis.ttl(`session:${specificSessionId}`);
        await redis.set(
          `session:${specificSessionId}`,
          JSON.stringify(sessionData),
          "EX",
          ttl > 0 ? ttl : 60 * 60 * 24 * 7
        );
      }
    }

    // 2. Query all active session IDs tracked in the user's session set
    const userSessionsKey = `userSessions:${userId}`;
    const sessionIds = await redis.smembers(userSessionsKey);

    if (sessionIds && sessionIds.length > 0) {
      for (const sid of sessionIds) {
        if (sid === specificSessionId) continue;
        const cached = await redis.get(`session:${sid}`);
        if (cached) {
          const sessionData = JSON.parse(cached);
          sessionData.interviewCoin = updatedCoins;
          const ttl = await redis.ttl(`session:${sid}`);
          await redis.set(
            `session:${sid}`,
            JSON.stringify(sessionData),
            "EX",
            ttl > 0 ? ttl : 60 * 60 * 24 * 7
          );
        } else {
          // Clean up expired session ID
          await redis.srem(userSessionsKey, sid);
        }
      }
    }
  } catch (err) {
    console.error("syncUserSessionsInRedis error:", err);
  }
};

export const useInterviewCoins = async (req, res) => {
  try {
    const sessionId = req.cookies?.session;
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
    const cost = Number(coins);

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
        type: "PURCHASE_CREDIT",
        balanceAfter: updatedUser.interviewCoin,
      });
    } catch (err) {
      // In case of concurrent race condition causing duplicate key violation (E11000)
      if (err.code === 11000) {
        // Roll back the duplicate increment
        await User.findByIdAndUpdate(userId, { $inc: { interviewCoin: -addAmount } });
        const record = await CoinTransaction.findOne({ idempotencyKey });
        return res.status(200).json({
          success: true,
          duplicate: true,
          interviewCoin: record ? record.balanceAfter : updatedUser.interviewCoin - addAmount,
        });
      }
      throw err;
    }

    // Synchronize all active Redis sessions for this user
    const activeSessionId = sessionId || req.cookies?.session;
    await syncUserSessionsInRedis(updatedUser._id, updatedUser.interviewCoin, activeSessionId);

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

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-__v");
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