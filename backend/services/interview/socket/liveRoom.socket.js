import { Server } from "socket.io";
import redis from "../../../shared/redis/redis.js";
import LiveInterview from "../models/liveInterview.model.js";
import ScheduledInterview from "../models/scheduledInterview.model.js";

// Debounce helper for MongoDB persistence
const debouncedUpdates = new Map();
const queueDbUpdate = (key, updateFn, delayMs = 500) => {
  if (debouncedUpdates.has(key)) {
    clearTimeout(debouncedUpdates.get(key));
  }
  const timer = setTimeout(async () => {
    debouncedUpdates.delete(key);
    try {
      await updateFn();
    } catch (err) {
      console.error(`Debounced DB update failed for ${key}:`, err);
    }
  }, delayMs);
  debouncedUpdates.set(key, timer);
};

/**
 * Initializes and configures the Socket.IO server for real-time live interview rooms.
 * Enforces strict session verification, room-level authorization, and event-level RBAC.
 */
export const initLiveRoomSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // Strict session verification middleware (P0-01, P1-06)
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers?.cookie || "";
      const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
      const sessionId = match
        ? decodeURIComponent(match[1])
        : socket.handshake.auth?.session ||
          socket.handshake.auth?.sessionId ||
          socket.handshake.headers?.["x-session-id"];

      if (!sessionId) {
        return next(new Error("Unauthorized"));
      }

      let sessionStr = null;
      try {
        sessionStr = await redis.get(`session:${sessionId}`);
      } catch (redisErr) {
        console.error("Socket Redis session lookup failure:", redisErr.message);
        return next(new Error("Unauthorized"));
      }

      if (!sessionStr) {
        return next(new Error("Unauthorized"));
      }

      const sessionData = JSON.parse(sessionStr);
      if (!sessionData || (!sessionData.userId && !sessionData._id)) {
        return next(new Error("Unauthorized"));
      }

      // Reject suspended accounts immediately
      if (sessionData.status === "suspended") {
        return next(new Error("Unauthorized: Account suspended."));
      }

      // Secure authenticated user object from server-side Redis session ONLY
      socket.user = sessionData;
      next();
    } catch (err) {
      console.error("Socket authentication error:", err);
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    // Verified Room Join Handler (P0-02)
    const handleRoomJoin = async (payload = {}) => {
      const { liveId, scheduleId, userName } = payload;
      const targetId = liveId || scheduleId;

      if (!targetId || !socket.user) {
        socket.emit("room:error", { message: "Invalid room identifier or missing authentication." });
        return;
      }

      const userId = String(socket.user.userId || socket.user._id);
      const userRole = socket.user.role || "student";
      const userInstitutionId = String(socket.user.institutionId || "DEFAULT_COLLEGE");

      // Strictly block admins from joining live rooms
      if (userRole === "admin") {
        socket.emit("room:error", { message: "Forbidden: Admins are not permitted in live interview rooms." });
        return;
      }

      try {
        let scheduled = null;
        let liveInterview = null;

        // Query ScheduledInterview and/or LiveInterview
        if (String(targetId).match(/^[0-9a-fA-F]{24}$/)) {
          liveInterview = await LiveInterview.findById(targetId);
          if (!liveInterview) {
            liveInterview = await LiveInterview.findOne({ scheduledInterviewId: targetId });
          }
        }

        if (liveInterview?.scheduledInterviewId) {
          scheduled = await ScheduledInterview.findById(liveInterview.scheduledInterviewId);
        } else if (String(targetId).match(/^[0-9a-fA-F]{24}$/)) {
          scheduled = await ScheduledInterview.findById(targetId);
        }

        const roomInstitutionId = String(
          liveInterview?.institutionId || scheduled?.institutionId || ""
        );

        // Verify same institution
        if (roomInstitutionId && roomInstitutionId !== userInstitutionId) {
          socket.emit("room:error", { message: "Forbidden: Cross-institution live room access denied." });
          return;
        }

        // Determine authorization
        const studentId = String(liveInterview?.studentId || scheduled?.studentId || "");
        const assignedTrainerId = String(liveInterview?.trainerId || scheduled?.trainerId || "");

        const isStudent = studentId === userId;
        const isAssignedTrainer = assignedTrainerId === userId;
        const isInstitutionTrainer =
          userRole === "trainer" && (!roomInstitutionId || roomInstitutionId === userInstitutionId);

        if (!isStudent && !isAssignedTrainer && !isInstitutionTrainer) {
          socket.emit("room:error", { message: "Forbidden: You are not authorized to enter this live room." });
          return;
        }

        const actualLiveId = String(liveInterview?._id || targetId);
        const participantRole = isAssignedTrainer || isInstitutionTrainer ? "trainer" : "student";
        const displayName =
          socket.user.name ||
          userName ||
          (participantRole === "trainer" ? "Faculty Trainer" : "Candidate Student");

        // Store verified metadata in socket.data (never trust client on subsequent events)
        socket.data = {
          verified: true,
          liveId: actualLiveId,
          scheduleId: String(scheduled?._id || liveInterview?.scheduledInterviewId || ""),
          role: participantRole,
          userId,
          institutionId: userInstitutionId,
          userName: displayName,
        };

        const roomKey = `live:${actualLiveId}`;
        socket.join(roomKey);

        // Notify other participants in the room
        socket.to(roomKey).emit("user:joined", {
          socketId: socket.id,
          role: participantRole,
          userName: displayName,
        });

        // Send acknowledgment and list of existing peers in the room
        const roomSockets = await io.in(roomKey).fetchSockets();
        const existingPeers = roomSockets
          .filter((s) => s.id !== socket.id)
          .map((s) => ({
            socketId: s.id,
            role: s.data?.role || "peer",
            userName: s.data?.userName || "Participant",
          }));

        socket.emit("room:joined", {
          liveId: actualLiveId,
          yourSocketId: socket.id,
          peers: existingPeers,
        });
      } catch (joinErr) {
        console.error("Room join authorization error:", joinErr);
        socket.emit("room:error", { message: "Failed to authorize room access." });
      }
    };

    socket.on("room:join", handleRoomJoin);
    socket.on("live-room:join", handleRoomJoin);

    // Helper to verify target socket belongs to the exact same room
    const verifySignalingTarget = async (targetSocketId) => {
      if (!targetSocketId || !socket.data?.verified) return false;
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (!targetSocket || !targetSocket.data?.verified) return false;
      return String(targetSocket.data.liveId) === String(socket.data.liveId);
    };

    // WebRTC Signaling: Offer
    socket.on("webrtc:offer", async ({ targetSocketId, sdp }) => {
      if (!socket.data?.verified) return;
      if (targetSocketId) {
        const isAllowed = await verifySignalingTarget(targetSocketId);
        if (isAllowed) {
          io.to(targetSocketId).emit("webrtc:offer", {
            senderSocketId: socket.id,
            sdp,
          });
        }
      } else {
        socket.to(`live:${socket.data.liveId}`).emit("webrtc:offer", {
          senderSocketId: socket.id,
          sdp,
        });
      }
    });

    // WebRTC Signaling: Answer
    socket.on("webrtc:answer", async ({ targetSocketId, sdp }) => {
      if (!socket.data?.verified) return;
      if (targetSocketId) {
        const isAllowed = await verifySignalingTarget(targetSocketId);
        if (isAllowed) {
          io.to(targetSocketId).emit("webrtc:answer", {
            senderSocketId: socket.id,
            sdp,
          });
        }
      } else {
        socket.to(`live:${socket.data.liveId}`).emit("webrtc:answer", {
          senderSocketId: socket.id,
          sdp,
        });
      }
    });

    // WebRTC Signaling: ICE Candidate
    socket.on("webrtc:ice-candidate", async ({ targetSocketId, candidate }) => {
      if (!socket.data?.verified) return;
      if (targetSocketId) {
        const isAllowed = await verifySignalingTarget(targetSocketId);
        if (isAllowed) {
          io.to(targetSocketId).emit("webrtc:ice-candidate", {
            senderSocketId: socket.id,
            candidate,
          });
        }
      } else {
        socket.to(`live:${socket.data.liveId}`).emit("webrtc:ice-candidate", {
          senderSocketId: socket.id,
          candidate,
        });
      }
    });

    // Generic WebRTC signal route
    socket.on("live-room:signal", async (payload = {}) => {
      if (!socket.data?.verified) return;
      const { targetSocketId, data, sdp, candidate, type } = payload;
      const signalData = data || sdp || candidate || payload;
      if (targetSocketId) {
        const isAllowed = await verifySignalingTarget(targetSocketId);
        if (isAllowed) {
          io.to(targetSocketId).emit("live-room:signal", {
            senderSocketId: socket.id,
            data: signalData,
            type,
          });
        }
      } else {
        socket.to(`live:${socket.data.liveId}`).emit("live-room:signal", {
          senderSocketId: socket.id,
          data: signalData,
          type,
        });
      }
    });

    // Workspace: Trainer pushes a question to the room (P0-02 RBAC strictly trainer)
    socket.on("workspace:question-push", async (payload = {}) => {
      try {
        if (!socket.data?.verified || socket.data.role !== "trainer") {
          socket.emit("workspace:error", { message: "Forbidden: Only faculty trainers can push questions." });
          return;
        }

        const liveId = socket.data.liveId;
        const rawText = String(payload.questionText || payload.text || "").trim();

        // Enforce max bounds (5 KB)
        if (rawText.length > 5120) {
          socket.emit("workspace:error", { message: "Question text exceeds maximum allowed size (5 KB)." });
          return;
        }

        const text = rawText || "Live Interview Question";
        const difficulty = ["easy", "medium", "hard"].includes(payload.difficulty)
          ? payload.difficulty
          : "medium";

        const liveInterview = await LiveInterview.findById(liveId);
        if (!liveInterview) return;

        // Ensure all existing questions have valid questionText
        if (Array.isArray(liveInterview.questions)) {
          liveInterview.questions.forEach((q) => {
            if (!q.questionText || !String(q.questionText).trim()) {
              q.questionText = (q.question || "Live Interview Discussion").trim();
            }
          });
        }

        const newQuestion = {
          questionText: text,
          difficulty,
          studentAnswer: "",
          submittedCode: "",
          codeLanguage: "javascript",
        };

        liveInterview.questions.push(newQuestion);
        await liveInterview.save();

        const activeIndex = liveInterview.questions.length - 1;
        io.to(`live:${liveId}`).emit("workspace:question-pushed", {
          questions: liveInterview.questions,
          activeQuestionIndex: activeIndex,
          latestQuestion: liveInterview.questions[activeIndex],
        });
      } catch (err) {
        console.error("workspace:question-push error:", err);
      }
    });

    // Workspace: Switch active question
    socket.on("workspace:active-question", ({ questionIndex } = {}) => {
      if (!socket.data?.verified || questionIndex === undefined) return;
      io.to(`live:${socket.data.liveId}`).emit("workspace:active-question-switched", {
        questionIndex: Number(questionIndex),
      });
    });

    // Workspace: Real-time student answer update (P0-02 RBAC strictly student)
    const handleAnswerUpdate = async (payload = {}) => {
      try {
        if (!socket.data?.verified || socket.data.role !== "student") {
          socket.emit("workspace:error", { message: "Forbidden: Only candidate students can update answers." });
          return;
        }

        const liveId = socket.data.liveId;
        const questionIndex = payload.questionIndex !== undefined ? Number(payload.questionIndex) : 0;
        const answerText = String(payload.answerText || payload.answer || "");

        // Enforce max bounds (15 KB)
        if (answerText.length > 15360) {
          return;
        }

        const roomKey = `live:${liveId}`;

        // Broadcast immediately to trainer so they see live typing/speech
        socket.to(roomKey).emit("workspace:answer-updated", {
          questionIndex,
          answerText,
        });

        // Debounced persistence to MongoDB (P2-07)
        queueDbUpdate(`answer:${liveId}:${questionIndex}`, async () => {
          if (questionIndex >= 0) {
            await LiveInterview.updateOne(
              { _id: liveId },
              { $set: { [`questions.${questionIndex}.studentAnswer`]: answerText } }
            );
          }
        }, 500);
      } catch (err) {
        console.error("workspace:answer-update error:", err);
      }
    };

    socket.on("workspace:answer-update", handleAnswerUpdate);
    socket.on("workspace:answer-change", handleAnswerUpdate);

    // Workspace: Synced Monaco Code Editor
    const handleCodeUpdate = async (payload = {}) => {
      try {
        if (!socket.data?.verified) return;

        const liveId = socket.data.liveId;
        const code = String(payload.code || "");

        // Enforce max bounds (50 KB)
        if (code.length > 51200) {
          socket.emit("workspace:error", { message: "Code buffer exceeds maximum allowed size (50 KB)." });
          return;
        }

        const language = String(payload.language || "javascript");
        const roomKey = `live:${liveId}`;

        // Broadcast to other participant(s)
        socket.to(roomKey).emit("workspace:code-updated", {
          code,
          language,
        });

        // Debounced persistence to MongoDB (P2-07)
        queueDbUpdate(`code:${liveId}`, async () => {
          await LiveInterview.updateOne(
            { _id: liveId },
            {
              $set: {
                "sharedCode.content": code,
                "sharedCode.language": language,
              },
            }
          );
        }, 600);
      } catch (err) {
        console.error("workspace:code-update error:", err);
      }
    };

    socket.on("workspace:code-update", handleCodeUpdate);
    socket.on("workspace:code-change", handleCodeUpdate);

    // Workspace: Code execution output sharing
    socket.on("workspace:code-output", async ({ output, status } = {}) => {
      if (!socket.data?.verified) return;
      const liveId = socket.data.liveId;

      io.to(`live:${liveId}`).emit("workspace:code-output", {
        output,
        status,
      });

      queueDbUpdate(`output:${liveId}`, async () => {
        await LiveInterview.updateOne(
          { _id: liveId },
          { $set: { "sharedCode.lastOutput": typeof output === "string" ? output : JSON.stringify(output) } }
        );
      }, 500);
    });

    // Workspace: Session ended by trainer
    socket.on("workspace:session-ended", ({ report } = {}) => {
      if (!socket.data?.verified || socket.data.role !== "trainer") return;
      io.to(`live:${socket.data.liveId}`).emit("workspace:session-ended", {
        liveId: socket.data.liveId,
        report,
      });
    });

    // Workspace: Participant left the room / concluded session
    socket.on("workspace:peer-left", ({ reason } = {}) => {
      if (!socket.data?.verified) return;
      io.to(`live:${socket.data.liveId}`).emit("workspace:peer-left", {
        liveId: socket.data.liveId,
        leftByRole: socket.data.role,
        leftByName: socket.data.userName,
        reason: reason || "ended",
      });
    });

    // Disconnect handling
    socket.on("disconnect", () => {
      if (socket.data?.liveId) {
        socket.to(`live:${socket.data.liveId}`).emit("user:left", {
          socketId: socket.id,
          role: socket.data.role,
          userName: socket.data.userName,
        });
      }
    });
  });

  return io;
};

export default initLiveRoomSocket;
