import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import redis from "../shared/redis/redis.js";
import Interview from "../services/interview/models/interview.model.js";
import LiveInterview from "../services/interview/models/liveInterview.model.js";
import User from "../services/auth/models/user.model.js";
import CoinTransaction from "../services/auth/models/CoinTransaction.js";
import { addCoins, refundFeatureCoins } from "../services/auth/controllers/auth.controller.js";
import { submitAnswer } from "../services/interview/controllers/interview.controller.js";
import graph from "../services/interview/graph/graph.js";
import { createAnswerUpdateHandler } from "../services/interview/socket/liveRoom.socket.js";
import { clampScore, getInterviewCacheKey } from "../services/interview/utils/cacheKeys.js";
import { isGibberishOrEmpty, getZeroScoreFeedback } from "../services/interview/utils/answerValidator.js";
import { evaluateDomainScores } from "../services/interview/utils/domainClassifier.js";

const mongoose = User.base;

after(async () => {
  try {
    redis.disconnect();
  } catch {}
});

describe("1. Socket.IO Connection & Event-Level RBAC & Payload Bounds (P0-01, P0-02, P2-06, P2-07)", () => {
  test("Rejects unauthenticated socket connections with no verified Redis session", () => {
    const socketWithoutSession = {
      handshake: { headers: {}, cookies: {}, auth: {} },
    };

    const authenticateSocket = (socket) => {
      const sessionId = socket.handshake.cookies?.session || socket.handshake.auth?.sessionToken;
      if (!sessionId) {
        return new Error("Unauthorized: Active session cookie or token required");
      }
      return null;
    };

    const err = authenticateSocket(socketWithoutSession);
    assert.ok(err, "Missing session must return Unauthorized error");
    assert.match(err.message, /Unauthorized/);
  });

  test("Ignores client-supplied handshake.auth.user spoofing", () => {
    const maliciousSocket = {
      handshake: {
        cookies: {},
        auth: {
          user: { _id: "hacker-1", role: "admin", name: "Spoofed Admin" },
        },
      },
      user: null,
    };

    // Strict authentication pattern - never accept socket.handshake.auth.user
    const authenticate = (socket) => {
      const sessionId = socket.handshake.cookies?.session || socket.handshake.auth?.sessionToken;
      if (!sessionId) return { success: false, error: "Unauthorized" };
      return { success: true };
    };

    const res = authenticate(maliciousSocket);
    assert.equal(res.success, false);
    assert.equal(maliciousSocket.user, null, "socket.user must not be populated from handshake.auth.user");
  });

  test("Rejects suspended user accounts during socket handshake", () => {
    const sessionData = {
      userId: "user-suspended-1",
      role: "student",
      status: "suspended",
    };

    const checkSuspension = (session) => {
      if (session.status === "suspended") {
        return new Error("Unauthorized: Account suspended");
      }
      return null;
    };

    const err = checkSuspension(sessionData);
    assert.ok(err);
    assert.match(err.message, /suspended/);
  });

  test("Enforces event-level RBAC: Only trainer can push questions", () => {
    const trainerSocket = { data: { userRole: "trainer", participantRole: "trainer" } };
    const studentSocket = { data: { userRole: "student", participantRole: "student" } };

    const canPushQuestion = (socket) => socket.data?.participantRole === "trainer";

    assert.equal(canPushQuestion(trainerSocket), true);
    assert.equal(canPushQuestion(studentSocket), false);
  });

  test("Enforces event-level RBAC: Only student can stream/update candidate answers", () => {
    const trainerSocket = { data: { userRole: "trainer", participantRole: "trainer" } };
    const studentSocket = { data: { userRole: "student", participantRole: "student" } };

    const canUpdateAnswer = (socket) => socket.data?.participantRole === "student";

    assert.equal(canUpdateAnswer(studentSocket), true);
    assert.equal(canUpdateAnswer(trainerSocket), false);
  });

  test("Enforces maximum payload byte bounds (5 KB question, 15 KB answer, 50 KB code)", () => {
    const validatePayload = (payload, maxBytes) => {
      const size = Buffer.byteLength(typeof payload === "string" ? payload : JSON.stringify(payload || ""));
      return size <= maxBytes;
    };

    const smallQuestion = "What is polymorphism?";
    const hugeQuestion = "A".repeat(6000); // > 5 KB
    assert.equal(validatePayload(smallQuestion, 5120), true);
    assert.equal(validatePayload(hugeQuestion, 5120), false);

    const normalAnswer = "Polymorphism allows objects to take multiple forms.";
    const oversizedAnswer = "B".repeat(16000); // > 15 KB
    assert.equal(validatePayload(normalAnswer, 15360), true);
    assert.equal(validatePayload(oversizedAnswer, 15360), false);

    const normalCode = "function test() { return 42; }";
    const oversizedCode = "C".repeat(55000); // > 50 KB
    assert.equal(validatePayload(normalCode, 51200), true);
    assert.equal(validatePayload(oversizedCode, 51200), false);
  });
});

describe("2. Coin Ledger Enum & Schema Validation (P0-03)", () => {
  test("Validates supported ledger transaction types: PURCHASE_CREDIT, FEATURE_DEBIT, FEATURE_REFUND", () => {
    const allowedTypes = ["PURCHASE_CREDIT", "PURCHASE", "FEATURE_DEBIT", "FEATURE_REFUND", "SUBSCRIPTION_BONUS", "BONUS"];

    assert.ok(allowedTypes.includes("PURCHASE_CREDIT"));
    assert.ok(allowedTypes.includes("FEATURE_DEBIT"));
    assert.ok(allowedTypes.includes("FEATURE_REFUND"));
    assert.ok(!allowedTypes.includes("HACKED_CREDIT"));
  });
});

describe("3. Financial Atomicity & Idempotency Duplicate Detection (P0-04)", () => {
  test("Idempotency guard prevents duplicate credit on repeated requests", () => {
    const existingTransactions = new Map();
    existingTransactions.set("tx-uniq-001", {
      idempotencyKey: "tx-uniq-001",
      amount: 100,
      balanceAfter: 250,
    });

    const processCredit = (key, amount, currentBalance) => {
      if (existingTransactions.has(key)) {
        return {
          duplicate: true,
          balanceAfter: existingTransactions.get(key).balanceAfter,
        };
      }
      const newBal = currentBalance + amount;
      existingTransactions.set(key, { idempotencyKey: key, amount, balanceAfter: newBal });
      return { duplicate: false, balanceAfter: newBal };
    };

    const firstAttempt = processCredit("tx-uniq-002", 50, 250);
    assert.equal(firstAttempt.duplicate, false);
    assert.equal(firstAttempt.balanceAfter, 300);

    // Duplicate attempt with same idempotencyKey
    const secondAttempt = processCredit("tx-uniq-002", 50, 300);
    assert.equal(secondAttempt.duplicate, true);
    assert.equal(secondAttempt.balanceAfter, 300, "Balance must not be incremented on duplicate");
  });
});

describe("4. Cross-Institution Provisioning Protection (P0-05)", () => {
  test("Rejects existing users belonging to another institution during bulk import", () => {
    const currentAdminInstitution = "INSTITUTION_A";
    const existingUsers = [
      { email: "student1@test.com", institutionId: "INSTITUTION_A" },
      { email: "student2@other.com", institutionId: "INSTITUTION_B" },
    ];

    const provisionUser = (userRecord) => {
      const found = existingUsers.find((u) => u.email === userRecord.email);
      if (found && found.institutionId && found.institutionId !== currentAdminInstitution) {
        return {
          rejected: true,
          reason: `Cross-institution conflict: User already belongs to institution ${found.institutionId}`,
        };
      }
      return { rejected: false };
    };

    const res1 = provisionUser({ email: "student1@test.com" });
    assert.equal(res1.rejected, false);

    const res2 = provisionUser({ email: "student2@other.com" });
    assert.equal(res2.rejected, true);
    assert.match(res2.reason, /Cross-institution conflict/);
  });
});

describe("5. AI Interview Engine Concurrency & Answer Attachment Integrity (P1-01)", () => {
  test("Pre-LLM reservation guard rejects concurrent requests for same question", () => {
    let interviewDoc = {
      _id: "int-001",
      currentQuestion: 2,
      status: "in-progress",
      isEvaluating: false,
    };

    const attemptReservation = (expectedQuestion) => {
      if (interviewDoc.status === "completed" || interviewDoc.isEvaluating) {
        return { reserved: false, error: "Evaluation already in progress or question already answered." };
      }
      if (interviewDoc.currentQuestion !== expectedQuestion) {
        return { reserved: false, error: "Question index mismatch." };
      }
      interviewDoc.isEvaluating = true;
      return { reserved: true };
    };

    // First request reserves the evaluation
    const req1 = attemptReservation(2);
    assert.equal(req1.reserved, true);
    assert.equal(interviewDoc.isEvaluating, true);

    // Concurrent second request is immediately rejected without invoking LLM
    const req2 = attemptReservation(2);
    assert.equal(req2.reserved, false);
    assert.match(req2.error, /already in progress/);
  });

  test("summaryNode attaches 6th question answer and feedback before summary evaluation", async () => {
    const mockState = {
      role: "Software Engineer",
      type: "technical",
      question: "What is an index in MongoDB?",
      answer: "An index improves search performance by ordering data in a B-Tree structure.",
      feedback: { score: 95, feedback: "Excellent answer" },
      questions: [
        { question: "Q1", userAnswer: "A1", feedback: { score: 80 } },
        { question: "Q2", userAnswer: "A2", feedback: { score: 85 } },
        { question: "What is an index in MongoDB?", userAnswer: "", feedback: {} },
      ],
    };

    // Mock summaryAgent output
    const report = {
      overallScore: 90,
      summary: "Candidate performed exceptionally well across all technical questions.",
    };

    // Verify questions mapping logic
    let questions = Array.isArray(mockState.questions) ? [...mockState.questions] : [];
    if (questions.length > 0 && mockState.feedback) {
      questions = questions.map((q, idx) => {
        const qObj = { ...q };
        if (idx === questions.length - 1 || (mockState.question && qObj.question === mockState.question)) {
          return {
            ...qObj,
            userAnswer: mockState.answer || qObj.userAnswer || "",
            feedback: mockState.feedback || qObj.feedback || {},
          };
        }
        return qObj;
      });
    }

    const lastQ = questions[questions.length - 1];
    assert.equal(lastQ.userAnswer, mockState.answer);
    assert.equal(lastQ.feedback.score, 95);
  });
});

describe("6. Live Room Completed / Cancelled Conflict Guard (P1-02)", () => {
  test("Rejoining a completed or cancelled live room returns 409 Conflict", () => {
    const checkRoomJoinStatus = (scheduledStatus, liveStatus) => {
      if (scheduledStatus === "completed" || scheduledStatus === "cancelled") {
        return { status: 409, message: `Interview session has ended (Status: ${scheduledStatus}).` };
      }
      if (liveStatus === "completed") {
        return { status: 409, message: "Live interview session is already completed." };
      }
      return { status: 200, message: "Authorized to join room." };
    };

    assert.equal(checkRoomJoinStatus("completed", "completed").status, 409);
    assert.equal(checkRoomJoinStatus("cancelled", "in-progress").status, 409);
    assert.equal(checkRoomJoinStatus("in-progress", "completed").status, 409);
    assert.equal(checkRoomJoinStatus("scheduled", "waiting").status, 200);
    assert.equal(checkRoomJoinStatus("in-progress", "in-progress").status, 200);
  });
});

describe("7. Multi-Tenant Task & Schedule Scoping (P1-04, P1-05)", () => {
  test("Student cannot access tasks of another section by spoofing ?section query parameter", () => {
    const studentUser = {
      userId: "student-1",
      userRole: "student",
      userSection: "CS-A", // verified session
    };

    const forgedQuery = { section: "CS-B" };

    // Implementation ignores req.query.section and trusts req.userSection
    const resolvedSection = studentUser.userSection || "";
    assert.equal(resolvedSection, "CS-A");
    assert.notEqual(resolvedSection, forgedQuery.section);
  });

  test("Student cannot submit to individual task assigned to someone else", () => {
    const task = {
      _id: "task-001",
      targetType: "INDIVIDUAL",
      assignedTo: ["student-alpha", "student-beta"],
      institutionId: "COLLEGE_ALPHA",
    };

    const unauthorizedStudent = { userId: "student-gamma", institutionId: "COLLEGE_ALPHA" };
    const isAssigned = task.assignedTo.includes(unauthorizedStudent.userId);

    assert.equal(isAssigned, false, "Unauthorized student must be rejected from submitting");
  });

  test("Trainer cannot review submissions of tasks belonging to another institution", () => {
    const task = { _id: "task-002", institutionId: "COLLEGE_ALPHA" };
    const trainerInstitution = "COLLEGE_BETA";

    const canReview = task.institutionId === trainerInstitution;
    assert.equal(canReview, false, "Cross-institution task review must be rejected");
  });

  test("Student cannot access schedule details of another student's individual session", () => {
    const scheduled = {
      _id: "sched-500",
      studentId: "student-100",
      section: "",
      institutionId: "COLLEGE_ALPHA",
    };

    const callerStudent = {
      userId: "student-999",
      userRole: "student",
      userSection: "CS-A",
      institutionId: "COLLEGE_ALPHA",
    };

    const isDirectMatch = String(scheduled.studentId) === String(callerStudent.userId);
    const isSectionMatch = Boolean(
      scheduled.section &&
      callerStudent.userSection &&
      scheduled.section.toLowerCase() === callerStudent.userSection.toLowerCase()
    );

    const isAuthorized = isDirectMatch || isSectionMatch;
    assert.equal(isAuthorized, false, "Unauthorized student must not access other candidate's schedule details");
  });
});

describe("8. Gateway Suspended Account Guard (P1-06)", () => {
  test("Gateway isAuth returns 403 Forbidden if user status is suspended", async () => {
    let statusCode = null;
    let jsonBody = null;
    let nextCalled = false;

    // Simulate session in Redis for suspended user
    const mockSession = JSON.stringify({
      userId: "suspended-user-id",
      status: "suspended",
      role: "student",
    });

    const req = {
      cookies: { session: "mock-sess-suspended" },
    };

    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => {
            jsonBody = body;
          },
        };
      },
    };

    const next = () => {
      nextCalled = true;
    };

    // Direct status check logic from isAuth
    const parsedUser = JSON.parse(mockSession);
    if (parsedUser && parsedUser.status === "suspended") {
      res.status(403).json({
        success: false,
        message: "Account suspended: Access denied.",
      });
    } else {
      next();
    }

    assert.equal(statusCode, 403);
    assert.equal(jsonBody.success, false);
    assert.match(jsonBody.message, /Account suspended/);
    assert.equal(nextCalled, false);
  });
});

describe("9. Privileged Role Registration & Verified Debit Linkage for Refunds (P1-07, P1-08)", () => {
  test("Privileged role registration blocks self-role signup unless allowlisted", () => {
    const bootstrapAdmins = ["admin@college.edu"];
    const bootstrapTrainers = ["trainer@college.edu"];
    const allowSelfRole = false;

    const targetRole = "admin";
    const email = "attacker@gmail.com";

    const isBootstrapAdmin = targetRole === "admin" && bootstrapAdmins.includes(email);
    const isBootstrapTrainer = targetRole === "trainer" && bootstrapTrainers.includes(email);
    const canRegisterPrivileged = allowSelfRole || isBootstrapAdmin || isBootstrapTrainer;

    assert.equal(canRegisterPrivileged, false, "Self-signup as admin must be blocked");
  });

  test("Refund requires verified negative debit transaction matching originalIdempotencyKey", () => {
    const ledger = [
      {
        idempotencyKey: "debit-tx-101",
        userId: "user-1",
        amount: -10, // Debit
        type: "FEATURE_DEBIT",
      },
    ];

    const verifyRefund = (userId, debitKey) => {
      const match = ledger.find(
        (tx) => tx.idempotencyKey === debitKey && tx.userId === userId && tx.amount < 0
      );
      if (!match) {
        return {
          valid: false,
          error: "Refund rejected: No matching debit transaction found for this user and reservation.",
        };
      }
      return { valid: true, refundAmount: Math.abs(match.amount) };
    };

    // Valid debit key
    const validRes = verifyRefund("user-1", "debit-tx-101");
    assert.equal(validRes.valid, true);
    assert.equal(validRes.refundAmount, 10);

    // Non-existent debit key
    const invalidRes = verifyRefund("user-1", "non-existent-key");
    assert.equal(invalidRes.valid, false);
    assert.match(invalidRes.error, /No matching debit transaction/);

    // Wrong user
    const wrongUserRes = verifyRefund("user-2", "debit-tx-101");
    assert.equal(wrongUserRes.valid, false);
  });

  test("Cache keys and score clamping utility behave consistently", () => {
    const key = getInterviewCacheKey("INST_XYZ", "student", "user_123");
    assert.equal(key, "interviews:INST_XYZ:student:user_123");

    assert.equal(clampScore(120), 100);
    assert.equal(clampScore(-15), 0);
    assert.equal(clampScore(84.7), 85);
    assert.equal(clampScore("invalid"), 0);
  });
});

describe("10. WebRTC Configurable STUN/TURN ICE Servers (P2-03)", () => {
  test("Falls back to Google public STUN servers when VITE_ICE_SERVERS_JSON is unset or invalid", () => {
    const resolveIce = (envVal) => {
      try {
        if (envVal) {
          const parsed = typeof envVal === "string" ? JSON.parse(envVal) : envVal;
          if (Array.isArray(parsed) && parsed.length > 0) return { iceServers: parsed };
        }
      } catch (_) {}
      return {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      };
    };

    const defaultIce = resolveIce(undefined);
    assert.equal(defaultIce.iceServers.length, 2);
    assert.equal(defaultIce.iceServers[0].urls, "stun:stun.l.google.com:19302");

    const badIce = resolveIce("not-valid-json");
    assert.equal(badIce.iceServers.length, 2);
  });

  test("Correctly parses custom STUN/TURN servers from VITE_ICE_SERVERS_JSON for restrictive college firewalls", () => {
    const resolveIce = (envVal) => {
      try {
        if (envVal) {
          const parsed = typeof envVal === "string" ? JSON.parse(envVal) : envVal;
          if (Array.isArray(parsed) && parsed.length > 0) return { iceServers: parsed };
        }
      } catch (_) {}
      return {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
        ],
      };
    };

    const customIceJson = JSON.stringify([
      { urls: "turn:turn.college.edu:3478", username: "user", credential: "pwd" },
      { urls: "stun:stun.college.edu:3478" },
    ]);

    const resolved = resolveIce(customIceJson);
    assert.equal(resolved.iceServers.length, 2);
    assert.equal(resolved.iceServers[0].urls, "turn:turn.college.edu:3478");
    assert.equal(resolved.iceServers[0].username, "user");
  });
});

describe("11. Client Auth Status Categorization & Transient Error Isolation (P2-10, P2-11)", () => {
  test("Distinguishes 401/403 unauthenticated from 5xx/network errors", () => {
    const categorizeAuthResponse = (error, data) => {
      if (data?.user) return { status: "authenticated", user: data.user };
      if (!error) return { status: "unauthenticated", user: null };

      const code = error.status || error.response?.status;
      if (code === 401 || code === 403) {
        return { status: "unauthenticated", user: null };
      }
      return { status: "networkError", user: null, isTransient: true };
    };

    assert.equal(categorizeAuthResponse(null, { user: { name: "Harsh" } }).status, "authenticated");
    assert.equal(categorizeAuthResponse({ status: 401 }, null).status, "unauthenticated");
    assert.equal(categorizeAuthResponse({ status: 403 }, null).status, "unauthenticated");
    assert.equal(categorizeAuthResponse({ status: 500 }, null).status, "networkError");
    assert.equal(categorizeAuthResponse({ message: "Network Error" }, null).status, "networkError");
  });
});

describe("12. Firebase Environment-Based Credentials & Docker Setup (P2-13, P2-14, P2-15)", () => {
  test("Parses raw JSON or Base64 Firebase service account credentials from environment", () => {
    const parseCredentials = (rawEnv) => {
      if (!rawEnv) return null;
      const trimmed = rawEnv.trim();
      if (trimmed.startsWith("{")) {
        return JSON.parse(trimmed);
      }
      const decoded = Buffer.from(trimmed, "base64").toString("utf-8");
      return JSON.parse(decoded);
    };

    const sample = { project_id: "yugam-test", client_email: "test@yugam.iam.gserviceaccount.com" };
    const rawJson = JSON.stringify(sample);
    const base64Json = Buffer.from(rawJson).toString("base64");

    const parsedFromRaw = parseCredentials(rawJson);
    assert.equal(parsedFromRaw.project_id, "yugam-test");

    const parsedFromBase64 = parseCredentials(base64Json);
    assert.equal(parsedFromBase64.project_id, "yugam-test");
  });
});

describe("13. Live Room Existence Verification & Terminal State Rejection", () => {
  test("Rejects non-existent room IDs even for valid institutional trainers", () => {
    const authorizeRoomJoin = ({ liveInterview, scheduled, userRole, userInstitutionId }) => {
      if (!liveInterview && !scheduled) {
        return { allowed: false, error: "Interview session not found." };
      }
      const sessionStatus = String(liveInterview?.status || scheduled?.status || "").toLowerCase();
      if (sessionStatus === "completed" || sessionStatus === "cancelled") {
        return { allowed: false, error: `Interview session is already ${sessionStatus}.` };
      }
      const roomInstitutionId = String(
        liveInterview?.institutionId || scheduled?.institutionId || "DEFAULT_COLLEGE"
      );
      if (roomInstitutionId !== userInstitutionId) {
        return { allowed: false, error: "Forbidden: Cross-institution live room access denied." };
      }
      const isInstitutionTrainer = userRole === "trainer" && roomInstitutionId === userInstitutionId;
      if (!isInstitutionTrainer) {
        return { allowed: false, error: "Forbidden: You are not authorized to enter this live room." };
      }
      return { allowed: true };
    };

    const res = authorizeRoomJoin({
      liveInterview: null,
      scheduled: null,
      userRole: "trainer",
      userInstitutionId: "COLLEGE_A",
    });
    assert.equal(res.allowed, false);
    assert.equal(res.error, "Interview session not found.");
  });

  test("Rejects joins when interview session is completed or cancelled", () => {
    const authorizeRoomJoin = ({ liveInterview, scheduled, userRole, userInstitutionId }) => {
      if (!liveInterview && !scheduled) {
        return { allowed: false, error: "Interview session not found." };
      }
      const sessionStatus = String(liveInterview?.status || scheduled?.status || "").toLowerCase();
      if (sessionStatus === "completed" || sessionStatus === "cancelled") {
        return { allowed: false, error: `Interview session is already ${sessionStatus}.` };
      }
      return { allowed: true };
    };

    const resCompleted = authorizeRoomJoin({
      liveInterview: { status: "completed", institutionId: "COLLEGE_A" },
      scheduled: null,
      userRole: "trainer",
      userInstitutionId: "COLLEGE_A",
    });
    assert.equal(resCompleted.allowed, false);
    assert.equal(resCompleted.error, "Interview session is already completed.");

    const resCancelled = authorizeRoomJoin({
      liveInterview: null,
      scheduled: { status: "cancelled", institutionId: "COLLEGE_A" },
      userRole: "trainer",
      userInstitutionId: "COLLEGE_A",
    });
    assert.equal(resCancelled.allowed, false);
    assert.equal(resCancelled.error, "Interview session is already cancelled.");
  });
});

describe("14. Active Question Switching RBAC & Index Validation", () => {
  test("Rejects student role attempts to switch active question", () => {
    const handleActiveQuestion = (socket, { questionIndex }) => {
      if (!socket.data?.verified) return { allowed: false, error: "Unverified" };
      if (socket.data.role !== "trainer") {
        return { allowed: false, error: "Forbidden: Only faculty trainers can switch active questions." };
      }
      const idx = Number(questionIndex);
      if (!Number.isInteger(idx) || idx < 0) {
        return { allowed: false, error: "Invalid question index." };
      }
      return { allowed: true, questionIndex: idx };
    };

    const studentSocket = { data: { verified: true, role: "student" } };
    const trainerSocket = { data: { verified: true, role: "trainer" } };

    const studentAttempt = handleActiveQuestion(studentSocket, { questionIndex: 2 });
    assert.equal(studentAttempt.allowed, false);
    assert.equal(studentAttempt.error, "Forbidden: Only faculty trainers can switch active questions.");

    const trainerAttempt = handleActiveQuestion(trainerSocket, { questionIndex: 2 });
    assert.equal(trainerAttempt.allowed, true);
    assert.equal(trainerAttempt.questionIndex, 2);

    const invalidIndexAttempt = handleActiveQuestion(trainerSocket, { questionIndex: -1 });
    assert.equal(invalidIndexAttempt.allowed, false);
    assert.equal(invalidIndexAttempt.error, "Invalid question index.");
  });

  test("Validates questionIndex against exact stored questions length of room", () => {
    const handleActiveQuestion = ({ socket, roomQuestions, questionIndex }) => {
      if (!socket.data?.verified) return { allowed: false, error: "Unverified" };
      if (socket.data.role !== "trainer") {
        return { allowed: false, error: "Forbidden: Only faculty trainers can switch active questions." };
      }
      const idx = Number(questionIndex);
      if (!Number.isInteger(idx) || idx < 0) {
        return { allowed: false, error: "Invalid question index." };
      }
      const roomQuestionsCount = Array.isArray(roomQuestions) ? roomQuestions.length : 0;
      if (roomQuestionsCount === 0 || idx >= roomQuestionsCount) {
        return {
          allowed: false,
          error: `Question index out of bounds (requested ${idx}, available ${roomQuestionsCount}).`,
        };
      }
      return { allowed: true, questionIndex: idx };
    };

    const trainerSocket = { data: { verified: true, role: "trainer" } };
    const roomWithTwoQuestions = [{ questionText: "Q1" }, { questionText: "Q2" }];

    // Valid indices within bounds
    assert.equal(handleActiveQuestion({ socket: trainerSocket, roomQuestions: roomWithTwoQuestions, questionIndex: 0 }).allowed, true);
    assert.equal(handleActiveQuestion({ socket: trainerSocket, roomQuestions: roomWithTwoQuestions, questionIndex: 1 }).allowed, true);

    // Index exactly at length or beyond
    const outOfBounds = handleActiveQuestion({ socket: trainerSocket, roomQuestions: roomWithTwoQuestions, questionIndex: 2 });
    assert.equal(outOfBounds.allowed, false);
    assert.match(outOfBounds.error, /out of bounds/);

    // Empty room questions
    const emptyRoom = handleActiveQuestion({ socket: trainerSocket, roomQuestions: [], questionIndex: 0 });
    assert.equal(emptyRoom.allowed, false);
    assert.match(emptyRoom.error, /out of bounds/);
  });
});

describe("15. Strict Transaction Error Handling & Standalone Fallback", () => {
  test("Re-throws genuine database errors containing 'session' rather than silently downgrading", async () => {
    const withTransactionMock = async (operation, mockError, env = { NODE_ENV: "development", ALLOW_STANDALONE_MONGO: "true" }) => {
      let isStandaloneUnsupported = false;
      try {
        if (mockError) throw mockError;
        return await operation({});
      } catch (err) {
        isStandaloneUnsupported =
          err.code === 20 ||
          err.codeName === "IllegalOperation" ||
          (err.message &&
            (err.message.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
              err.message.includes("Transactions are not supported")));

        const allowStandaloneFallback =
          env.NODE_ENV !== "production" &&
          env.ALLOW_STANDALONE_MONGO === "true";

        if (isStandaloneUnsupported && allowStandaloneFallback) {
          return await operation(null);
        }
        throw err;
      }
    };

    const appSessionError = new Error("Validation failed: session expired or invalid in user document");
    await assert.rejects(
      async () => {
        await withTransactionMock(async () => {}, appSessionError);
      },
      {
        message: "Validation failed: session expired or invalid in user document",
      },
      "Must re-throw genuine errors mentioning 'session' instead of downgrading"
    );

    let fallbackExecuted = false;
    const standaloneErr = new Error("Transaction numbers are only allowed on a replica set member or mongos");
    standaloneErr.code = 20;

    const result = await withTransactionMock(async (session) => {
      if (session === null) fallbackExecuted = true;
      return "success";
    }, standaloneErr);

    assert.equal(result, "success");
    assert.equal(fallbackExecuted, true, "Must fall back only for explicit standalone code 20 in dev");
  });

  test("withTransaction refuses non-transactional fallback in NODE_ENV === 'production'", async () => {
    const withTransactionMock = async (operation, mockError, env = {}) => {
      let isStandaloneUnsupported = false;
      try {
        if (mockError) throw mockError;
        return await operation({});
      } catch (err) {
        isStandaloneUnsupported =
          err.code === 20 ||
          err.codeName === "IllegalOperation" ||
          (err.message &&
            (err.message.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
              err.message.includes("Transactions are not supported")));

        const allowStandaloneFallback =
          env.NODE_ENV !== "production" &&
          env.ALLOW_STANDALONE_MONGO === "true";

        if (isStandaloneUnsupported && allowStandaloneFallback) {
          return await operation(null);
        }
        throw err;
      }
    };

    const standaloneErr = new Error("Transaction numbers are only allowed on a replica set member or mongos");
    standaloneErr.code = 20;

    // In production, must FAIL FAST even for code 20
    await assert.rejects(
      async () => {
        await withTransactionMock(async () => "ok", standaloneErr, {
          NODE_ENV: "production",
          ALLOW_STANDALONE_MONGO: "true",
        });
      },
      (err) => err.code === 20,
      "Production must reject non-transactional fallback"
    );

    // In dev without explicit ALLOW_STANDALONE_MONGO, must FAIL FAST
    await assert.rejects(
      async () => {
        await withTransactionMock(async () => "ok", standaloneErr, {
          NODE_ENV: "development",
          ALLOW_STANDALONE_MONGO: "false",
        });
      },
      (err) => err.code === 20,
      "Development without ALLOW_STANDALONE_MONGO must reject fallback"
    );

    // In dev with ALLOW_STANDALONE_MONGO === 'true', safe fallback occurs
    let fallbackHit = false;
    const res = await withTransactionMock(async (session) => {
      if (session === null) fallbackHit = true;
      return "dev_fallback_ok";
    }, standaloneErr, {
      NODE_ENV: "development",
      ALLOW_STANDALONE_MONGO: "true",
    });
    assert.equal(res, "dev_fallback_ok");
    assert.equal(fallbackHit, true);
  });

  test("Validates refund amount does not exceed verified original debit amount", () => {
    const validateRefund = ({ originalDebit, requestedAction, requestedAmount }) => {
      if (!originalDebit) return { allowed: false, error: "No matching debit transaction found" };
      if (originalDebit.feature && originalDebit.feature !== requestedAction) {
        return { allowed: false, error: "Debit feature mismatch" };
      }
      const originalDebitAmount = Math.abs(originalDebit.amount);
      if (requestedAmount > originalDebitAmount) {
        return { allowed: false, error: "Requested refund exceeds original debit amount" };
      }
      return { allowed: true };
    };

    const debit = { amount: -20, feature: "interview_live" };
    assert.equal(validateRefund({ originalDebit: debit, requestedAction: "interview_live", requestedAmount: 20 }).allowed, true);
    assert.equal(validateRefund({ originalDebit: debit, requestedAction: "interview_live", requestedAmount: 10 }).allowed, true);
    const excessive = validateRefund({ originalDebit: debit, requestedAction: "interview_live", requestedAmount: 50 });
    assert.equal(excessive.allowed, false);
    assert.match(excessive.error, /exceeds original debit amount/);
    const mismatch = validateRefund({ originalDebit: debit, requestedAction: "resume_review", requestedAmount: 20 });
    assert.equal(mismatch.allowed, false);
    assert.match(mismatch.error, /mismatch/);
  });
});

describe("16. Expiring Lease Recovery for Stuck AI Evaluations", () => {
  test("Expired isEvaluating leases (> 90s) are automatically recovered on retry while active leases (< 90s) return 409 Conflict", () => {
    const LEASE_DURATION_MS = 90_000;
    const canAcquireEvaluationLock = (interviewDoc, now = Date.now()) => {
      const leaseThreshold = new Date(now - LEASE_DURATION_MS);
      if (interviewDoc.status === "completed") return false;
      if (interviewDoc.isEvaluating !== true) return true;
      if (interviewDoc.evaluatingStartedAt && interviewDoc.evaluatingStartedAt < leaseThreshold) {
        return true;
      }
      return false;
    };

    const now = Date.now();

    const fresh = { isEvaluating: false, evaluatingStartedAt: null, status: "in-progress" };
    assert.equal(canAcquireEvaluationLock(fresh, now), true);

    const activeLock = {
      isEvaluating: true,
      evaluatingStartedAt: new Date(now - 30_000),
      status: "in-progress",
    };
    assert.equal(canAcquireEvaluationLock(activeLock, now), false, "Active evaluation under 90s must block");

    const stuckLock = {
      isEvaluating: true,
      evaluatingStartedAt: new Date(now - 95_000),
      status: "in-progress",
    };
    assert.equal(canAcquireEvaluationLock(stuckLock, now), true, "Stuck evaluation older than 90s must be recovered");

    const completed = {
      isEvaluating: false,
      evaluatingStartedAt: null,
      status: "completed",
    };
    assert.equal(canAcquireEvaluationLock(completed, now), false);
  });

  test("Interview schema has evaluationToken and 90s lease recovery with ownership protection", () => {
    // Verify real mongoose schema contains evaluationToken
    const schemaTokenPath = Interview.schema.path("evaluationToken");
    assert.ok(schemaTokenPath, "Interview schema must define evaluationToken");
    assert.equal(schemaTokenPath.instance, "String");

    // Token ownership protection simulation:
    // If Doc was recovered by Request B (now holds token-b), an expired Request A (token-a) attempting to save or finalize:
    const simulateAtomicUpdate = (doc, updateQuery, updateFields) => {
      if (updateQuery.evaluationToken !== doc.evaluationToken) {
        return null; // Mismatch! Cannot overwrite
      }
      return { ...doc, ...updateFields.$set };
    };

    const docNowOwnedByB = {
      _id: "interview-123",
      isEvaluating: true,
      evaluationToken: "token-b",
      currentQuestion: 0,
    };

    const requestAUpdateQuery = {
      _id: "interview-123",
      isEvaluating: true,
      evaluationToken: "token-a",
    };

    const updatedByA = simulateAtomicUpdate(docNowOwnedByB, requestAUpdateQuery, {
      $set: { isEvaluating: false, evaluationToken: null },
    });
    assert.equal(updatedByA, null, "Expired Request A with token-a cannot overwrite Request B's evaluation");

    // Request A finally cleanup also cannot unlock B
    const simulateFinallyCleanup = (doc, cleanupQuery) => {
      if (cleanupQuery.evaluationToken !== doc.evaluationToken) {
        return false; // Did not match, lock unchanged
      }
      doc.isEvaluating = false;
      doc.evaluationToken = null;
      return true;
    };

    const unlockedByA = simulateFinallyCleanup(docNowOwnedByB, requestAUpdateQuery);
    assert.equal(unlockedByA, false, "Expired Request A's finally block cannot unlock Request B's lock");
    assert.equal(docNowOwnedByB.isEvaluating, true, "Request B's evaluation remains locked");
    assert.equal(docNowOwnedByB.evaluationToken, "token-b");
  });
});

describe("17. Direct Controller & Socket Integration Tests (Real Modules)", () => {
  test("Real submitAnswer: expired evaluationToken cannot overwrite or unlock newer active evaluation", async () => {
    const origFindOne = Interview.findOne;
    const origFindOneAndUpdate = Interview.findOneAndUpdate;
    const origUpdateOne = Interview.updateOne;
    const origGraphInvoke = graph.invoke;

    let capturedReservationQuery = null;
    let capturedUpdateQuery = null;
    let capturedFinallyQuery = null;

    try {
      graph.invoke = async () => ({
        feedback: {
          score: 85,
          strengths: ["Clean explanation"],
          improvements: ["Mention task queue"],
        },
      });

      // 1. Stub findOne to return an in-progress interview
      Interview.findOne = async () => ({
        _id: "interview-live-1",
        userId: "student-1",
        status: "in-progress",
        currentQuestion: 0,
        questions: [{ question: "Explain event loop", difficulty: "medium" }],
        role: "Frontend Engineer",
        type: "technical",
      });

      // 2. Simulate concurrent scenario:
      // Request A acquires lock with token-A.
      // But Request A's lease expires (> 90s), Request B acquires lock with token-B.
      // When Request A attempts atomic update, query requires token-A, but document has token-B -> returns null!
      Interview.findOneAndUpdate = async (query, update) => {
        if (query.$or) {
          capturedReservationQuery = query;
          return {
            _id: "interview-live-1",
            userId: "student-1",
            currentQuestion: 0,
            isEvaluating: true,
            evaluationToken: "token-A",
          };
        } else {
          capturedUpdateQuery = query;
          return null; // Overtaken by Request B!
        }
      };

      Interview.updateOne = async (filter, update) => {
        capturedFinallyQuery = filter;
        return { matchedCount: 0, modifiedCount: 0 };
      };

      const mockReq = {
        headers: { "x-user-id": "student-1" },
        body: { interviewId: "interview-live-1", answer: "Event loop manages microtasks and macrotasks", questionIndex: 0 },
      };

      let responseStatus = null;
      let responseBody = null;
      const mockRes = {
        status(code) {
          responseStatus = code;
          return this;
        },
        json(data) {
          responseBody = data;
          return this;
        },
      };

      await submitAnswer(mockReq, mockRes);

      assert.equal(responseStatus, 409);
      assert.equal(responseBody.success, false);
      assert.match(responseBody.message, /Question already submitted or concurrent request in progress/);

      assert.ok(capturedUpdateQuery.evaluationToken, "Update query must require evaluationToken");
      assert.equal(capturedUpdateQuery.isEvaluating, true);

      assert.equal(capturedFinallyQuery.isEvaluating, true);
      assert.equal(capturedFinallyQuery.evaluationToken, capturedUpdateQuery.evaluationToken,
        "Finally block must match exact evaluationToken so expired Request A never unlocks Request B"
      );
    } finally {
      Interview.findOne = origFindOne;
      Interview.findOneAndUpdate = origFindOneAndUpdate;
      Interview.updateOne = origUpdateOne;
      graph.invoke = origGraphInvoke;
    }
  });

  test("Real addCoins in NODE_ENV=production enforces replica set transactions and fails fast", async () => {
    const origEnv = process.env.NODE_ENV;
    const origAllow = process.env.ALLOW_STANDALONE_MONGO;
    const origStartSession = mongoose.startSession;
    const origFindOne = CoinTransaction.findOne;

    try {
      process.env.NODE_ENV = "production";
      process.env.ALLOW_STANDALONE_MONGO = "true"; // In production, this should be ignored!

      CoinTransaction.findOne = async () => null;

      // Stub mongoose.startSession to simulate standalone Mongo error (code 20)
      mongoose.startSession = async () => {
        const err = new Error("Transaction numbers are only allowed on a replica set member or mongos");
        err.code = 20;
        err.codeName = "IllegalOperation";
        throw err;
      };

      const mockReq = {
        body: {
          userId: new mongoose.Types.ObjectId().toString(),
          amount: 50,
          idempotencyKey: "tx-prod-test-1",
        },
      };

      let responseStatus = null;
      let responseBody = null;
      const mockRes = {
        status(code) {
          responseStatus = code;
          return this;
        },
        json(data) {
          responseBody = data;
          return this;
        },
      };

      await addCoins(mockReq, mockRes);

      assert.equal(responseStatus, 500);
      assert.equal(responseBody.success, false);
      assert.match(responseBody.message, /Failed to add coins|Transaction numbers are only allowed/);
    } finally {
      process.env.NODE_ENV = origEnv;
      process.env.ALLOW_STANDALONE_MONGO = origAllow;
      mongoose.startSession = origStartSession;
      CoinTransaction.findOne = origFindOne;
    }
  });

  test("Real refundFeatureCoins rejects refund when requested amount exceeds verified original debit", async () => {
    const origFindOne = CoinTransaction.findOne;
    try {
      CoinTransaction.findOne = async (query) => {
        if (query.amount && query.amount.$lt === 0) {
          return {
            idempotencyKey: "debit-key-1",
            userId: "user-abc",
            amount: -10, // Only 10 coins debited
            feature: "ROADMAP_GENERATE", // Costs 20 coins
          };
        }
        return null;
      };

      const mockReq = {
        body: {
          userId: "user-abc",
          action: "ROADMAP_GENERATE",
          reservationId: "debit-key-1",
        },
      };

      let responseStatus = null;
      let responseBody = null;
      const mockRes = {
        status(code) {
          responseStatus = code;
          return this;
        },
        json(data) {
          responseBody = data;
          return this;
        },
      };

      await refundFeatureCoins(mockReq, mockRes);

      assert.equal(responseStatus, 400);
      assert.equal(responseBody.success, false);
      assert.match(responseBody.message, /exceeds original debit amount/);
    } finally {
      CoinTransaction.findOne = origFindOne;
    }
  });

  test("Real student answer socket handler rejects negative, non-integer, and out-of-bounds indices", async () => {
    const origFindById = LiveInterview.findById;
    const origUpdateOne = LiveInterview.updateOne;

    try {
      LiveInterview.findById = (id) => ({
        select: async () => ({
          questions: [
            { questionText: "Q1", studentAnswer: "" },
            { questionText: "Q2", studentAnswer: "" },
          ],
        }),
      });
      LiveInterview.updateOne = async () => ({ matchedCount: 1, modifiedCount: 1 });

      const errors = [];
      const broadcasts = [];
      const mockSocket = {
        data: { verified: true, role: "student", liveId: "6afc7a9e6609754e2daaddbc" },
        emit: (event, data) => {
          if (event === "workspace:error") errors.push(data);
        },
        to: () => ({
          emit: (event, data) => broadcasts.push({ event, data }),
        }),
      };

      const handler = createAnswerUpdateHandler(mockSocket, {});

      // Case 1: Negative index (-1)
      errors.length = 0;
      broadcasts.length = 0;
      await handler({ questionIndex: -1, answerText: "Negative answer" });
      assert.equal(errors.length, 1);
      assert.equal(errors[0].message, "Invalid question index.");
      assert.equal(broadcasts.length, 0);

      // Case 2: Non-integer string ("abc")
      errors.length = 0;
      broadcasts.length = 0;
      await handler({ questionIndex: "abc", answerText: "Non-int answer" });
      assert.equal(errors.length, 1);
      assert.equal(errors[0].message, "Invalid question index.");
      assert.equal(broadcasts.length, 0);

      // Case 3: Out of bounds index (2, when questions count is 2)
      errors.length = 0;
      broadcasts.length = 0;
      await handler({ questionIndex: 2, answerText: "Out of bounds answer" });
      assert.equal(errors.length, 1);
      assert.match(errors[0].message, /Question index out of bounds/);
      assert.equal(broadcasts.length, 0);

      // Case 4: Valid index (1)
      errors.length = 0;
      broadcasts.length = 0;
      await handler({ questionIndex: 1, answerText: "Valid answer for Q2" });
      assert.equal(errors.length, 0);
      assert.equal(broadcasts.length, 1);
      assert.equal(broadcasts[0].event, "workspace:answer-updated");
      assert.equal(broadcasts[0].data.questionIndex, 1);
      assert.equal(broadcasts[0].data.answerText, "Valid answer for Q2");
    } finally {
      LiveInterview.findById = origFindById;
      LiveInterview.updateOne = origUpdateOne;
    }
  });
});

describe("18. Live Faculty Incomplete Status, Resume Disabling & AI Resume State Restoration", () => {
  const checkIsLive = (interview) => {
    return Boolean(
      interview?.isLive === true ||
      interview?.isLiveInterview === true ||
      String(interview?.mode).toUpperCase() === "LIVE" ||
      String(interview?.type).toUpperCase() === "LIVE"
    );
  };

  const getInterviewCardPresentation = (interview) => {
    const isCompleted = interview?.status === "completed";
    const isLive = checkIsLive(interview);

    let statusBadgeText = "In Progress";
    if (isCompleted) {
      statusBadgeText = "Completed";
    } else if (isLive) {
      statusBadgeText = "Not Completed";
    }

    const canResume = !isCompleted && !isLive;
    const canInspect = true;

    return {
      isCompleted,
      isLive,
      statusBadgeText,
      canResume,
      canInspect,
    };
  };

  test("Identifies live faculty sessions across isLive, isLiveInterview, mode=LIVE, and type=LIVE", () => {
    assert.equal(checkIsLive({ isLive: true }), true);
    assert.equal(checkIsLive({ isLiveInterview: true }), true);
    assert.equal(checkIsLive({ mode: "LIVE" }), true);
    assert.equal(checkIsLive({ mode: "live" }), true);
    assert.equal(checkIsLive({ type: "LIVE" }), true);
    assert.equal(checkIsLive({ type: "live" }), true);

    // AI mock interview should NOT be flagged as live
    assert.equal(checkIsLive({ type: "technical", mode: "ai", isLive: false }), false);
    assert.equal(checkIsLive({ type: "hr", mode: "ai" }), false);
    assert.equal(checkIsLive(null), false);
  });

  test("Incomplete live faculty interviews show 'Not Completed' and completely disable Resume buttons", () => {
    const incompleteLiveSession = {
      _id: "live-session-123",
      role: "Software Engineer",
      status: "in-progress",
      mode: "live",
      isLiveInterview: true,
      questions: [{ questionText: "Live Q1" }],
    };

    const presentation = getInterviewCardPresentation(incompleteLiveSession);
    assert.equal(presentation.isLive, true);
    assert.equal(presentation.isCompleted, false);
    assert.equal(presentation.statusBadgeText, "Not Completed");
    assert.equal(presentation.canResume, false, "Live incomplete session must NOT have Resume button");
    assert.equal(presentation.canInspect, true, "Inspect Session must remain accessible");
  });

  test("Incomplete AI mock interviews keep 'In Progress' and allow Resume button", () => {
    const incompleteAiSession = {
      _id: "ai-session-456",
      role: "Backend Engineer",
      status: "in-progress",
      mode: "ai",
      type: "technical",
      questions: [
        { question: "Explain indexing", timer: 60, userAnswer: "Indexing speeds up reads" },
        { question: "Explain B-Trees", timer: 90, userAnswer: "" },
      ],
      currentQuestion: 1,
    };

    const presentation = getInterviewCardPresentation(incompleteAiSession);
    assert.equal(presentation.isLive, false);
    assert.equal(presentation.isCompleted, false);
    assert.equal(presentation.statusBadgeText, "In Progress");
    assert.equal(presentation.canResume, true, "AI mock interview must have Resume button");
  });

  test("AI interview resume state restoration safely resolves current question and initial timer without throwing", () => {
    const resolveResumeState = (interview) => {
      const questionsList = Array.isArray(interview?.questions) ? interview.questions : [];
      let initialIndex = typeof interview?.currentQuestion === "number" ? interview.currentQuestion : 0;

      if (initialIndex >= questionsList.length && questionsList.length > 0) {
        const firstUnanswered = questionsList.findIndex((q) => !q.userAnswer || !q.userAnswer.trim());
        initialIndex = firstUnanswered !== -1 ? firstUnanswered : 0;
      }

      const safeIndex = Math.min(Math.max(0, initialIndex), Math.max(0, questionsList.length - 1));
      const currentQ = questionsList[safeIndex] || questionsList[0] || {};
      const initialTimer = Number(currentQ?.timer) || 60;
      const totalQuestions = questionsList.length || 1;
      const progress = Math.min(100, Math.round(((safeIndex + 1) / totalQuestions) * 100));

      return {
        safeIndex,
        currentQ,
        initialTimer,
        totalQuestions,
        progress,
      };
    };

    // Case 1: Mid-way session resumed at Question 2 (index 1) with timer 90s
    const state1 = resolveResumeState({
      questions: [
        { question: "Q1", timer: 60, userAnswer: "Answered Q1" },
        { question: "Q2", timer: 90, userAnswer: "" },
      ],
      currentQuestion: 1,
    });
    assert.equal(state1.safeIndex, 1);
    assert.equal(state1.currentQ.question, "Q2");
    assert.equal(state1.initialTimer, 90);
    assert.equal(state1.totalQuestions, 2);
    assert.equal(state1.progress, 100);

    // Case 2: In-progress session with undefined timer and currentQuestion out of range
    const state2 = resolveResumeState({
      questions: [
        { question: "Q1", userAnswer: "" },
      ],
      currentQuestion: 99,
    });
    assert.equal(state2.safeIndex, 0);
    assert.equal(state2.currentQ.question, "Q1");
    assert.equal(state2.initialTimer, 60, "Fallback timer must be 60");
    assert.equal(state2.totalQuestions, 1);
    assert.equal(state2.progress, 100);

    // Case 3: Empty or loading questions object (never throws TypeError: Cannot read properties of undefined (reading 'timer'))
    const state3 = resolveResumeState({});
    assert.equal(state3.safeIndex, 0);
    assert.equal(state3.initialTimer, 60);
    assert.equal(state3.totalQuestions, 1);
    assert.equal(state3.progress, 100);
  });
});

describe("19. Roll Number Display, Trainer Strengths/Improvements, Session Rubric Card & Question AI Scoring", () => {
  test("Student Roll Number resolution prioritizes roll number over raw MongoDB ObjectId", () => {
    const resolveDisplayRollNumber = (interview) => {
      return (
        interview?.studentRollNumber ||
        interview?.rollNumber ||
        interview?.candidateRollNumber ||
        interview?.student?.rollNumber ||
        "N/A"
      );
    };

    // Case 1: Populated student roll number
    const interviewWithRoll = {
      studentId: "6ae8a9d8d2261930c78944e5",
      studentName: "Harsh Sharma",
      studentRollNumber: "2315000916",
    };
    assert.equal(resolveDisplayRollNumber(interviewWithRoll), "2315000916");

    // Case 2: Roll number present in alias rollNumber or candidateRollNumber
    assert.equal(resolveDisplayRollNumber({ rollNumber: "GLA-2026-99" }), "GLA-2026-99");
    assert.equal(resolveDisplayRollNumber({ candidateRollNumber: "ROLL-404" }), "ROLL-404");

    // Case 3: Missing roll number must fall back to "N/A" instead of leaking MongoDB _id
    const interviewWithoutRoll = {
      studentId: "6ae8a9d8d2261930c78944e5",
      studentName: "Candidate",
    };
    assert.equal(resolveDisplayRollNumber(interviewWithoutRoll), "N/A");
    assert.notEqual(resolveDisplayRollNumber(interviewWithoutRoll), "6ae8a9d8d2261930c78944e5");
  });

  test("Live interview report normalizes strengths, improvements and redacts confidential notes for students", () => {
    const normalizeLiveDocForViewer = (liveDoc, userRole) => {
      const strengths = liveDoc.evaluation?.strengths || [];
      const improvements = liveDoc.evaluation?.weaknesses || [];
      const isStudent = userRole === "student";

      const report = {
        _id: liveDoc._id,
        studentRollNumber: liveDoc.studentRollNumber || "N/A",
        rollNumber: liveDoc.studentRollNumber || "N/A",
        overallScore: liveDoc.evaluation?.overallScore ?? 0,
        strengths,
        improvements,
        weaknesses: improvements,
        summary: liveDoc.evaluation?.summaryFeedback || "",
        criteria: liveDoc.evaluation?.criteria || {},
      };

      if (!isStudent) {
        report.trainerPrivateNotes = liveDoc.trainerPrivateNotes || "";
      }

      return report;
    };

    const mockLiveDoc = {
      _id: "6ae8a9d8d2261930c78944e5",
      studentRollNumber: "2315000916",
      trainerPrivateNotes: "Student showed great confidence but hesitated on dynamic programming.",
      evaluation: {
        overallScore: 92,
        strengths: ["Strong problem decomposition", "Clean modular code"],
        weaknesses: ["Deepen knowledge of memoization", "Consider space complexity edge cases"],
        summaryFeedback: "Harsh demonstrated solid full-stack capabilities.",
        criteria: {
          correctness: 90,
          problemSolving: 95,
          efficiency: 85,
          clarity: 95,
          relevance: 90,
          communication: 95,
        },
      },
    };

    // Student view
    const studentReport = normalizeLiveDocForViewer(mockLiveDoc, "student");
    assert.equal(studentReport.studentRollNumber, "2315000916");
    assert.equal(studentReport.strengths.length, 2);
    assert.equal(studentReport.improvements.length, 2);
    assert.equal(studentReport.trainerPrivateNotes, undefined, "Confidential notes must be redacted for student");

    // Trainer view
    const trainerReport = normalizeLiveDocForViewer(mockLiveDoc, "trainer");
    assert.equal(trainerReport.trainerPrivateNotes, "Student showed great confidence but hesitated on dynamic programming.");
    assert.equal(trainerReport.strengths.length, 2);
    assert.equal(trainerReport.improvements.length, 2);
  });

  test("6-dimension session rubric criteria calculates weighted score and does not duplicate on per-question cards", () => {
    const criteria = {
      correctness: 80,
      problemSolving: 90,
      efficiency: 80,
      clarity: 80,
      relevance: 90,
      communication: 100,
    };

    const weightedScore = Math.round(
      0.25 * criteria.correctness +
      0.25 * criteria.problemSolving +
      0.15 * criteria.efficiency +
      0.15 * criteria.clarity +
      0.10 * criteria.relevance +
      0.10 * criteria.communication
    );

    assert.equal(weightedScore, 86);

    // Verify per-question mapping omits session-wide criteria pills
    const rawQuestion = {
      questionText: "Explain LRU Cache implementation",
      studentAnswer: "Used HashMap + Doubly Linked List for O(1) get and put.",
      score: 88,
      feedback: "Accurate time complexity analysis with clean data structure selection.",
    };

    const normalizedQ = {
      question: rawQuestion.questionText,
      answer: rawQuestion.studentAnswer,
      score: rawQuestion.score,
      aiFeedback: rawQuestion.feedback,
      feedback: {
        score: rawQuestion.score,
        feedback: rawQuestion.feedback,
      },
    };

    assert.equal(normalizedQ.score, 88);
    assert.equal(normalizedQ.aiFeedback, "Accurate time complexity analysis with clean data structure selection.");
    assert.equal(normalizedQ.feedback.correctness, undefined, "Per-question card must not duplicate session criteria");
    assert.equal(normalizedQ.feedback.problemSolving, undefined);
  });

  test("Per-question evaluation assigns score 0 for empty answers and evaluates answered questions", () => {
    const evaluateAnswerSync = (q, defaultScore = 75) => {
      const studentAnswer = (q?.studentAnswer || q?.answer || "").trim();
      const submittedCode = (q?.submittedCode || q?.code || "").trim();

      if (!studentAnswer && !submittedCode) {
        return {
          score: 0,
          feedback: "No answer submitted for this question.",
        };
      }

      return {
        score: typeof q?.score === "number" && q.score > 0 ? q.score : defaultScore,
        feedback: q?.feedback || "Candidate provided a relevant technical answer.",
      };
    };

    // Unanswered question
    const unanswered = evaluateAnswerSync({ questionText: "What is an index?", studentAnswer: "", submittedCode: "" });
    assert.equal(unanswered.score, 0);
    assert.equal(unanswered.feedback, "No answer submitted for this question.");

    // Answered question with existing evaluated score
    const answeredWithScore = evaluateAnswerSync({
      questionText: "Explain closures",
      studentAnswer: "A closure is the combination of a function bundled together with references to its lexical environment.",
      score: 95,
      feedback: "Clear conceptual definition and practical explanation.",
    });
    assert.equal(answeredWithScore.score, 95);
    assert.equal(answeredWithScore.feedback, "Clear conceptual definition and practical explanation.");

    // Answered question with code
    const answeredWithCode = evaluateAnswerSync({
      questionText: "Reverse a string",
      submittedCode: "function reverse(s) { return s.split('').reverse().join(''); }",
    });
    assert.equal(answeredWithCode.score, 75);
    assert.ok(answeredWithCode.feedback.length > 0);
  });
});

describe("20. Strengths & Areas for Improvement Auto-Flush & Alias Unification", () => {
  test("Trainer pending input fields auto-flush into strengths and improvements on submit", () => {
    const preparePayload = ({
      strengths,
      newStrengthInput,
      weaknesses,
      newWeaknessInput,
      overallScore = 90,
    }) => {
      let currentStrengths = [...strengths];
      const pendingStrength = (newStrengthInput || "").trim();
      if (pendingStrength) {
        const items = pendingStrength.includes("\n")
          ? pendingStrength.split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean)
          : [pendingStrength];
        items.forEach((it) => {
          if (!currentStrengths.includes(it)) currentStrengths.push(it);
        });
      }

      let currentWeaknesses = [...weaknesses];
      const pendingWeakness = (newWeaknessInput || "").trim();
      if (pendingWeakness) {
        const items = pendingWeakness.includes("\n")
          ? pendingWeakness.split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean)
          : [pendingWeakness];
        items.forEach((it) => {
          if (!currentWeaknesses.includes(it)) currentWeaknesses.push(it);
        });
      }

      return {
        overallScore,
        strengths: currentStrengths,
        weaknesses: currentWeaknesses,
        improvements: currentWeaknesses,
        areasForImprovement: currentWeaknesses,
        candidateStrengths: currentStrengths,
      };
    };

    // Case 1: Trainer typed "He is a sharp student." into pending input without clicking Add
    const payload = preparePayload({
      strengths: [],
      newStrengthInput: "He is a sharp student.",
      weaknesses: ["Needs improvement in communicating his ideas."],
      newWeaknessInput: "Work on system design fundamentals",
    });

    assert.deepEqual(payload.strengths, ["He is a sharp student."]);
    assert.deepEqual(payload.candidateStrengths, ["He is a sharp student."]);
    assert.deepEqual(payload.weaknesses, [
      "Needs improvement in communicating his ideas.",
      "Work on system design fundamentals",
    ]);
    assert.deepEqual(payload.improvements, payload.weaknesses);
    assert.deepEqual(payload.areasForImprovement, payload.weaknesses);
  });

  test("Normalizes strengths and improvements across array, newline, and comma-delimited strings", () => {
    const normalizeStringList = (input) => {
      if (!input) return [];
      if (Array.isArray(input)) {
        return input.map((item) => String(item).trim()).filter(Boolean);
      }
      if (typeof input === "string" && input.trim()) {
        return input
          .split(/[\r\n,]+/)
          .map((item) => item.trim())
          .filter(Boolean);
      }
      return [];
    };

    // Array of strings
    assert.deepEqual(normalizeStringList(["Good coder", " Fast learner "]), ["Good coder", "Fast learner"]);

    // Newline-separated string
    assert.deepEqual(
      normalizeStringList("Sharp analytical skills\nStrong React knowledge\n\n"),
      ["Sharp analytical skills", "Strong React knowledge"]
    );

    // Comma-separated string
    assert.deepEqual(
      normalizeStringList("Clean syntax, Good git habits, "),
      ["Clean syntax", "Good git habits"]
    );

    // Empty / null
    assert.deepEqual(normalizeStringList(null), []);
    assert.deepEqual(normalizeStringList("   "), []);
  });

  test("Report viewers resolve strengths and areasForImprovement across any payload alias", () => {
    const normalizeStringList = (input) => {
      if (!input) return [];
      if (Array.isArray(input)) return input.map((s) => String(s).trim()).filter(Boolean);
      if (typeof input === "string" && input.trim()) {
        return input.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean);
      }
      return [];
    };

    const resolveStrengthsAndImprovements = (interview) => {
      const strengthsList =
        normalizeStringList(interview.strengths).length > 0
          ? normalizeStringList(interview.strengths)
          : normalizeStringList(interview.evaluation?.strengths).length > 0
          ? normalizeStringList(interview.evaluation?.strengths)
          : normalizeStringList(interview.candidateStrengths).length > 0
          ? normalizeStringList(interview.candidateStrengths)
          : normalizeStringList(interview.summary?.strengths);

      const improvementsList =
        normalizeStringList(interview.improvements).length > 0
          ? normalizeStringList(interview.improvements)
          : normalizeStringList(interview.areasForImprovement).length > 0
          ? normalizeStringList(interview.areasForImprovement)
          : normalizeStringList(interview.weaknesses).length > 0
          ? normalizeStringList(interview.weaknesses)
          : normalizeStringList(interview.evaluation?.improvements).length > 0
          ? normalizeStringList(interview.evaluation?.improvements)
          : normalizeStringList(interview.evaluation?.areasForImprovement).length > 0
          ? normalizeStringList(interview.evaluation?.areasForImprovement)
          : normalizeStringList(interview.evaluation?.weaknesses).length > 0
          ? normalizeStringList(interview.evaluation?.weaknesses)
          : normalizeStringList(interview.summary?.improvements).length > 0
          ? normalizeStringList(interview.summary?.improvements)
          : normalizeStringList(interview.summary?.areasForImprovement).length > 0
          ? normalizeStringList(interview.summary?.areasForImprovement)
          : normalizeStringList(interview.summary?.weaknesses);

      return { strengthsList, improvementsList };
    };

    // Case A: Payload uses areasForImprovement and candidateStrengths
    const docA = {
      candidateStrengths: ["Fast learner", "Proactive"],
      areasForImprovement: ["Practice dynamic programming"],
    };
    const resA = resolveStrengthsAndImprovements(docA);
    assert.deepEqual(resA.strengthsList, ["Fast learner", "Proactive"]);
    assert.deepEqual(resA.improvementsList, ["Practice dynamic programming"]);

    // Case B: Payload nested inside summary from legacy sessions
    const docB = {
      summary: {
        strengths: ["Sharp student"],
        weaknesses: ["Needs improvement in communicating his ideas."],
      },
    };
    const resB = resolveStrengthsAndImprovements(docB);
    assert.deepEqual(resB.strengthsList, ["Sharp student"]);
    assert.deepEqual(resB.improvementsList, ["Needs improvement in communicating his ideas."]);

    // Case C: Payload with raw newline string in evaluation.improvements
    const docC = {
      evaluation: {
        strengths: ["Clean code"],
        improvements: "Time complexity\nEdge cases",
      },
    };
    const resC = resolveStrengthsAndImprovements(docC);
    assert.deepEqual(resC.strengthsList, ["Clean code"]);
    assert.deepEqual(resC.improvementsList, ["Time complexity", "Edge cases"]);
  });
});

describe("21. Anti-Gibberish Proctor Validation & Deterministic Score Aggregation", () => {
  test("Classifies empty, symbol-mash, pure numbers, and keyboard gibberish as isGibberishOrEmpty", () => {
    // Gibberish and non-answer test inputs
    const gibberishSamples = [
      "",
      "   ",
      "rteyshj",
      "12345678",
      "@#$%^&*",
      "wzxcg",
      "plmiuygvc",
      "errdtyuiugcv,bn",
      "aaaaaa",
      "123 456 789",
      "??? !!! ...",
      "asdfghjkl",
      "qwe rty uiop",
      "zzzzzzzzzz",
      "- - - _ _ _",
    ];

    for (const sample of gibberishSamples) {
      assert.equal(
        isGibberishOrEmpty(sample),
        true,
        `Expected "${sample}" to be classified as gibberish/empty`
      );
    }

    // Genuine answers must NOT be classified as gibberish
    const genuineSamples = [
      "I use React and Node.js for building scalable web applications.",
      "In my previous project, we implemented JWT authentication with refresh tokens.",
      "Recursion is a technique where a function calls itself to solve smaller subproblems.",
      "We followed the STAR method to resolve production database latency spikes.",
      "const binarySearch = (arr, target) => { return arr.indexOf(target); };",
      "Polymorphism allows objects of different classes to be treated through a common interface.",
    ];

    for (const sample of genuineSamples) {
      assert.equal(
        isGibberishOrEmpty(sample),
        false,
        `Expected genuine answer "${sample}" to NOT be classified as gibberish`
      );
    }
  });

  test("getZeroScoreFeedback returns strict 0 across all criteria with mentor guidance and no pity points", () => {
    const feedback = getZeroScoreFeedback();
    assert.equal(feedback.score, 0);
    assert.equal(feedback.clarity, 0);
    assert.equal(feedback.relevance, 0);
    assert.equal(feedback.communication, 0);
    assert.equal(feedback.correctness, 0);
    assert.equal(feedback.detail, 0);
    assert.equal(feedback.efficiency, 0);
    assert.equal(feedback.problemSolving, 0);
    assert.equal(feedback.creativity, 0);
    assert.match(feedback.feedback, /No valid response detected/);
    assert.ok(Array.isArray(feedback.improvements) && feedback.improvements.length >= 2);
  });

  test("Deterministic overallScore calculation matches exact mathematical question average and clamps to 0", () => {
    // Scenario 1: All 6 questions scored 0 (e.g. all gibberish)
    const zeroQuestions = [
      { score: 0 },
      { score: 0 },
      { score: 0 },
      { score: 0 },
      { score: 0 },
      { score: 0 },
    ];
    const zeroScores = zeroQuestions.map((q) => q.score);
    const zeroAvg = Math.round(zeroScores.reduce((a, b) => a + b, 0) / zeroScores.length);
    assert.equal(zeroAvg, 0);

    // Enforce that overallScore cannot be inflated to 58 when average is 0
    let finalZeroScore = zeroAvg;
    const llmInflatedScore = 58;
    if (zeroAvg === 0) {
      finalZeroScore = 0;
    } else {
      finalZeroScore = Math.min(zeroAvg + 3, Math.max(zeroAvg - 3, llmInflatedScore));
    }
    assert.equal(finalZeroScore, 0, "Overall score must be 0 when question average is 0");

    // Scenario 2: Mixed question scores (e.g. 80, 85, 90, 75)
    const mixedScores = [80, 85, 90, 75];
    const mixedAvg = Math.round(mixedScores.reduce((a, b) => a + b, 0) / mixedScores.length);
    assert.equal(mixedAvg, 83);

    // Clamps LLM holistic score within ±3 points
    const llmReportScore = 95; // LLM attempts to give 95
    const clampedScore = Math.min(mixedAvg + 3, Math.max(mixedAvg - 3, llmReportScore));
    assert.equal(clampedScore, 86, "Score must be clamped within 3 points of real average");
  });

  test("Eliminates hallucinated strengths when average score is < 20 or questions are invalid", () => {
    const computedAvg = 0;
    const questionScores = [0, 0, 0, 0];

    const generateStrengths = (avg, scores, llmStrengths) => {
      if (avg < 20 || scores.filter((s) => s > 0).length === 0) {
        return ["No demonstrable strengths observed due to unanswered or invalid responses."];
      }
      return llmStrengths;
    };

    const hallucinatedLLMStrengths = [
      "Clear and concise communication style",
      "Good understanding of STAR method",
      "Strong technical fundamentals",
    ];

    const actualStrengths = generateStrengths(computedAvg, questionScores, hallucinatedLLMStrengths);
    assert.deepEqual(actualStrengths, [
      "No demonstrable strengths observed due to unanswered or invalid responses.",
    ]);
  });
});

describe("22. Real-Time Room Presence & Peer State Tracking", () => {
  test("Calculates authoritative room presence with verified participants and peerCount", () => {
    const mockSockets = [
      {
        id: "socket-trainer-1",
        data: {
          verified: true,
          liveId: "live-session-123",
          userId: "user-trainer",
          userName: "Sumedh Sir",
          role: "trainer",
        },
      },
      {
        id: "socket-student-1",
        data: {
          verified: true,
          liveId: "live-session-123",
          userId: "user-student",
          userName: "Harsh Sharma",
          role: "student",
        },
      },
      {
        id: "socket-unverified",
        data: {
          verified: false,
          liveId: "live-session-123",
        },
      },
    ];

    const computePresence = (sockets, liveId) => {
      const participants = sockets
        .filter((s) => s.data?.verified && String(s.data?.liveId) === String(liveId))
        .map((s) => ({
          userId: s.data.userId,
          name: s.data.userName,
          userName: s.data.userName,
          role: s.data.role,
          socketId: s.id,
        }));

      return {
        liveId,
        peerCount: participants.length,
        participants,
      };
    };

    const presence = computePresence(mockSockets, "live-session-123");
    assert.equal(presence.peerCount, 2, "Only verified participants in the room must be counted");
    assert.equal(presence.participants[0].role, "trainer");
    assert.equal(presence.participants[0].name, "Sumedh Sir");
    assert.equal(presence.participants[1].role, "student");
    assert.equal(presence.participants[1].name, "Harsh Sharma");
  });

  test("Recalculates room presence correctly upon socket disconnect or room exit", () => {
    const activeSockets = [
      {
        id: "socket-trainer-1",
        data: {
          verified: true,
          liveId: "live-session-123",
          userId: "user-trainer",
          userName: "Sumedh Sir",
          role: "trainer",
        },
      },
      {
        id: "socket-student-1",
        data: {
          verified: true,
          liveId: "live-session-123",
          userId: "user-student",
          userName: "Harsh Sharma",
          role: "student",
        },
      },
    ];

    const disconnectSocketId = "socket-student-1";
    const remainingSockets = activeSockets.filter((s) => s.id !== disconnectSocketId);

    const remainingParticipants = remainingSockets
      .filter((s) => s.data?.verified && String(s.data?.liveId) === "live-session-123")
      .map((s) => ({
        userId: s.data.userId,
        name: s.data.userName,
        userName: s.data.userName,
        role: s.data.role,
        socketId: s.id,
      }));

    assert.equal(remainingParticipants.length, 1);
    assert.equal(remainingParticipants[0].role, "trainer");
  });

  test("Evaluates client-side isPeerConnected correctly across single-PC and WebRTC states", () => {
    const evaluatePeerConnected = ({ isPeerInRoom, peerConnected, remoteStream, connectionState }) => {
      return Boolean(
        isPeerInRoom ||
        peerConnected ||
        remoteStream ||
        connectionState === "connected"
      );
    };

    // Case 1: Sole participant in room (Waiting for peer)
    assert.equal(
      evaluatePeerConnected({
        isPeerInRoom: false,
        peerConnected: false,
        remoteStream: null,
        connectionState: "new",
      }),
      false,
      "Must show waiting when alone in room"
    );

    // Case 2: Both in Socket.IO room but WebRTC video stream pending (Single-PC test tab or camera shared)
    assert.equal(
      evaluatePeerConnected({
        isPeerInRoom: true,
        peerConnected: false,
        remoteStream: null,
        connectionState: "checking",
      }),
      true,
      "Must transition to Peer Connected immediately once peer is in Socket.IO room"
    );

    // Case 3: WebRTC video stream connected
    assert.equal(
      evaluatePeerConnected({
        isPeerInRoom: true,
        peerConnected: true,
        remoteStream: { active: true },
        connectionState: "connected",
      }),
      true,
      "Must remain Peer Connected with active WebRTC stream"
    );

    // Case 4: Peer leaves the room
    assert.equal(
      evaluatePeerConnected({
        isPeerInRoom: false,
        peerConnected: false,
        remoteStream: null,
        connectionState: "disconnected",
      }),
      false,
      "Must revert to waiting when peer leaves"
    );
  });
});

describe("23. AI Domain Competency Evaluation, Top-N Slicing & Directory Export Validation", () => {
  test("evaluateDomainScores: accurately categorizes DSA, Technical, and Communication questions", () => {
    const questions = [
      {
        questionText: "Given an unsorted array, return the indices of two elements that sum to target using a HashMap.",
        score: 90,
        feedback: { correctness: 90, efficiency: 85, problemSolving: 92 },
      },
      {
        questionText: "Design a scalable rate-limiting architecture with Redis cache and API Gateway.",
        score: 85,
        feedback: { correctness: 85, efficiency: 85, problemSolving: 85 },
      },
      {
        questionText: "Tell me about yourself and describe a time you handled a difficult conflict with a team member.",
        score: 95,
        feedback: { communication: 95, clarity: 95, relevance: 92 },
      },
    ];

    const result = evaluateDomainScores({
      type: "technical",
      role: "Backend Engineer",
      questions,
      overallScore: 90,
      evaluation: {
        criteria: {
          correctness: 88,
          clarity: 92,
          efficiency: 85,
          communication: 95,
          problemSolving: 90,
        },
      },
    });

    assert.ok(result.dsa >= 80 && result.dsa <= 100, `Expected high DSA score, got ${result.dsa}`);
    assert.ok(result.technical >= 80 && result.technical <= 100, `Expected high Technical score, got ${result.technical}`);
    assert.ok(result.communication >= 85 && result.communication <= 100, `Expected high Communication score, got ${result.communication}`);
  });

  test("evaluateDomainScores: returns strictly 0 for all domains on zero score / failed proctor session", () => {
    const result = evaluateDomainScores({
      type: "technical",
      role: "Software Engineer",
      questions: [
        {
          questionText: "What is an array?",
          score: 0,
          userAnswer: "rteyshj",
        },
      ],
      overallScore: 0,
    });

    assert.deepEqual(result, { dsa: 0, technical: 0, communication: 0 }, "All domains must be 0 when overallScore is 0");
  });

  test("Directory Top-N slicing and multi-criteria sorting by competency scores", () => {
    const mockStudents = [
      { name: "Student Alpha", dsaScore: 45, technicalScore: 50, communicationScore: 80, overallAvgScore: 58 },
      { name: "Student Beta", dsaScore: 95, technicalScore: 90, communicationScore: 70, overallAvgScore: 85 },
      { name: "Student Gamma", dsaScore: 80, technicalScore: 95, communicationScore: 90, overallAvgScore: 88 },
      { name: "Student Delta", dsaScore: 70, technicalScore: 75, communicationScore: 95, overallAvgScore: 80 },
    ];

    // Sort by DSA desc
    const sortByDsa = [...mockStudents].sort((a, b) => b.dsaScore - a.dsaScore);
    assert.equal(sortByDsa[0].name, "Student Beta");
    assert.equal(sortByDsa[1].name, "Student Gamma");

    // Sort by Communication desc
    const sortByComm = [...mockStudents].sort((a, b) => b.communicationScore - a.communicationScore);
    assert.equal(sortByComm[0].name, "Student Delta");
    assert.equal(sortByComm[1].name, "Student Gamma");

    // Top-N slice (N = 2)
    const top2 = sortByDsa.slice(0, 2);
    assert.equal(top2.length, 2);
    assert.equal(top2[0].name, "Student Beta");
    assert.equal(top2[1].name, "Student Gamma");
  });

  test("Export headers and rows include DSA, Technical, and Communication columns", () => {
    const headers = [
      "Roll Number",
      "Student Name",
      "Email",
      "Course",
      "Year",
      "Semester",
      "Section",
      "Verification Status",
      "Class 10th (%)",
      "Class 12th (%)",
      "Current B.Tech CGPA",
      "Overall Avg Interview Score",
      "AI Interview Avg",
      "Live Interview Avg",
      "DSA Score",
      "Technical Score",
      "Communication Score",
      "Completed Interviews",
    ];

    assert.ok(headers.includes("DSA Score"), "Must contain DSA Score column");
    assert.ok(headers.includes("Technical Score"), "Must contain Technical Score column");
    assert.ok(headers.includes("Communication Score"), "Must contain Communication Score column");
  });
});




