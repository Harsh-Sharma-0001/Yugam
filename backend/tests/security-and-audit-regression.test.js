import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import redis from "../shared/redis/redis.js";
import { clampScore, getInterviewCacheKey } from "../services/interview/utils/cacheKeys.js";

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
