import { Server } from "socket.io";
import redis from "../../../shared/redis/redis.js";
import LiveInterview from "../models/liveInterview.model.js";

/**
 * Initializes and configures the Socket.IO server for real-time live interview rooms.
 * Handles WebRTC signaling (offer, answer, ICE candidates) and shared workspace synchronization
 * (questions, student answers, Monaco code updates, execution output).
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

  // Session verification middleware
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers?.cookie || "";
      const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
      const sessionId = match
        ? decodeURIComponent(match[1])
        : socket.handshake.auth?.session || socket.handshake.auth?.sessionId;

      if (sessionId) {
        try {
          const sessionStr = await redis.get(`session:${sessionId}`);
          if (sessionStr) {
            socket.user = JSON.parse(sessionStr);
          }
        } catch (redisErr) {
          console.warn("Socket Redis session lookup warning:", redisErr.message);
        }
      }

      // Allow testing/fallback auth payload
      if (!socket.user && socket.handshake.auth?.user) {
        socket.user = socket.handshake.auth.user;
      }

      next();
    } catch (err) {
      console.error("Socket authentication error:", err);
      next();
    }
  });

  io.on("connection", (socket) => {
    let currentLiveId = null;

    // Join room event
    socket.on("room:join", async ({ liveId, role, userName }) => {
      if (!liveId) return;

      currentLiveId = liveId;
      const roomKey = `live:${liveId}`;
      socket.join(roomKey);

      const participantRole = role || socket.user?.role || "student";
      const displayName = userName || socket.user?.name || (participantRole === "trainer" ? "Trainer" : "Student");

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

      socket.data.role = participantRole;
      socket.data.userName = displayName;
      socket.data.liveId = liveId;

      socket.emit("room:joined", {
        liveId,
        yourSocketId: socket.id,
        peers: existingPeers,
      });
    });

    // WebRTC Signaling: Offer
    socket.on("webrtc:offer", ({ targetSocketId, sdp, liveId }) => {
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc:offer", {
          senderSocketId: socket.id,
          sdp,
        });
      } else if (liveId) {
        socket.to(`live:${liveId}`).emit("webrtc:offer", {
          senderSocketId: socket.id,
          sdp,
        });
      }
    });

    // WebRTC Signaling: Answer
    socket.on("webrtc:answer", ({ targetSocketId, sdp, liveId }) => {
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc:answer", {
          senderSocketId: socket.id,
          sdp,
        });
      } else if (liveId) {
        socket.to(`live:${liveId}`).emit("webrtc:answer", {
          senderSocketId: socket.id,
          sdp,
        });
      }
    });

    // WebRTC Signaling: ICE Candidate
    socket.on("webrtc:ice-candidate", ({ targetSocketId, candidate, liveId }) => {
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc:ice-candidate", {
          senderSocketId: socket.id,
          candidate,
        });
      } else if (liveId) {
        socket.to(`live:${liveId}`).emit("webrtc:ice-candidate", {
          senderSocketId: socket.id,
          candidate,
        });
      }
    });

    // Workspace: Trainer pushes a question to the room
    socket.on("workspace:question-push", async ({ liveId, questionText, difficulty }) => {
      try {
        if (!liveId || !questionText) return;
        const liveInterview = await LiveInterview.findById(liveId);
        if (!liveInterview) return;

        const newQuestion = {
          questionText: questionText.trim(),
          difficulty: difficulty || "medium",
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
    socket.on("workspace:active-question", ({ liveId, questionIndex }) => {
      if (!liveId || questionIndex === undefined) return;
      io.to(`live:${liveId}`).emit("workspace:active-question-switched", {
        questionIndex: Number(questionIndex),
      });
    });

    // Workspace: Real-time student answer update (typing or speech-to-text)
    socket.on("workspace:answer-update", async ({ liveId, questionIndex, answerText }) => {
      try {
        if (!liveId) return;
        const roomKey = `live:${liveId}`;

        // Broadcast immediately to trainer so they see live typing/speech
        socket.to(roomKey).emit("workspace:answer-updated", {
          questionIndex,
          answerText,
        });

        // Async persist in database
        if (questionIndex !== undefined && questionIndex >= 0) {
          await LiveInterview.updateOne(
            { _id: liveId },
            { $set: { [`questions.${questionIndex}.studentAnswer`]: answerText } }
          );
        }
      } catch (err) {
        console.error("workspace:answer-update error:", err);
      }
    });

    // Workspace: Synced Monaco Code Editor
    socket.on("workspace:code-update", async ({ liveId, code, language }) => {
      try {
        if (!liveId) return;
        const roomKey = `live:${liveId}`;

        // Broadcast to other participant(s)
        socket.to(roomKey).emit("workspace:code-updated", {
          code,
          language: language || "javascript",
        });

        // Persist shared code state
        await LiveInterview.updateOne(
          { _id: liveId },
          {
            $set: {
              "sharedCode.content": code,
              "sharedCode.language": language || "javascript",
            },
          }
        );
      } catch (err) {
        console.error("workspace:code-update error:", err);
      }
    });

    // Workspace: Code execution output sharing
    socket.on("workspace:code-output", async ({ liveId, output, status }) => {
      try {
        if (!liveId) return;
        io.to(`live:${liveId}`).emit("workspace:code-output", {
          output,
          status,
        });

        await LiveInterview.updateOne(
          { _id: liveId },
          { $set: { "sharedCode.lastOutput": typeof output === "string" ? output : JSON.stringify(output) } }
        );
      } catch (err) {
        console.error("workspace:code-output error:", err);
      }
    });

    // Workspace: Session ended by trainer
    socket.on("workspace:session-ended", ({ liveId, report }) => {
      if (!liveId) return;
      io.to(`live:${liveId}`).emit("workspace:session-ended", {
        liveId,
        report,
      });
    });

    // Disconnect handling
    socket.on("disconnect", () => {
      if (currentLiveId) {
        socket.to(`live:${currentLiveId}`).emit("user:left", {
          socketId: socket.id,
          role: socket.data?.role,
          userName: socket.data?.userName,
        });
      }
    });
  });

  return io;
};
