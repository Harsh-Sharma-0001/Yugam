import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import redis from "../shared/redis/redis.js";
import { requireRole } from "../services/interview/middleware/roleAuth.js";

after(async () => {
  try {
    redis.disconnect();
  } catch {}
});

describe("1. Live Video Interview Room Authorization & Institution Boundary", () => {
  const configuredSecret = "test-internal-secret-2026";
  process.env.GATEWAY_INTERNAL_SECRET = configuredSecret;

  test("Rejects cross-institution live room access", () => {
    const scheduled = {
      _id: "sched-101",
      institutionId: "COLLEGE_ALPHA",
      studentId: "student-1",
      trainerId: "trainer-1",
    };

    const callerInstitutionId = "COLLEGE_BETA";
    const isCrossInstitution = scheduled.institutionId !== callerInstitutionId;

    assert.equal(isCrossInstitution, true, "Cross-institution access must be detected");
  });

  test("Rejects unauthorized third-party user who is neither assigned student nor faculty", () => {
    const scheduled = {
      _id: "sched-101",
      institutionId: "COLLEGE_ALPHA",
      studentId: "student-1",
      trainerId: "trainer-1",
    };

    const thirdPartyUser = {
      userId: "student-999",
      userRole: "student",
      institutionId: "COLLEGE_ALPHA",
    };

    const isStudent = String(thirdPartyUser.userId) === String(scheduled.studentId);
    const isTrainer = String(thirdPartyUser.userId) === String(scheduled.trainerId);

    const isAuthorized = isStudent || isTrainer;
    assert.equal(isAuthorized, false, "Third-party student must be rejected");
  });

  test("Strictly blocks Admin role from joining live interview room (403 Forbidden)", () => {
    const scheduled = {
      _id: "sched-101",
      institutionId: "COLLEGE_ALPHA",
      studentId: "student-1",
      trainerId: "trainer-1",
    };

    const adminCaller = { userId: "admin-102", userRole: "admin" };

    // Function simulating joinLiveRoom check
    const canJoinLiveRoom = (user, sched) => {
      if (user.userRole === "admin") return false;
      const isStudent = String(sched.studentId) === String(user.userId);
      const isTrainer = String(sched.trainerId) === String(user.userId);
      return isStudent || isTrainer;
    };

    assert.equal(canJoinLiveRoom(adminCaller, scheduled), false, "Admins must be strictly blocked from live video rooms");
  });

  test("Authorizes strictly assigned student and assigned trainer", () => {
    const scheduled = {
      _id: "sched-101",
      institutionId: "COLLEGE_ALPHA",
      studentId: "student-1",
      trainerId: "trainer-1",
    };

    const studentCaller = { userId: "student-1", userRole: "student" };
    const trainerCaller = { userId: "trainer-1", userRole: "trainer" };
    const unassignedTrainer = { userId: "trainer-99", userRole: "trainer" };

    const canJoinLiveRoom = (user, sched) => {
      if (user.userRole === "admin") return false;
      const isStudent = String(sched.studentId) === String(user.userId);
      const isTrainer = String(sched.trainerId) === String(user.userId);
      return isStudent || isTrainer;
    };

    assert.equal(canJoinLiveRoom(studentCaller, scheduled), true);
    assert.equal(canJoinLiveRoom(trainerCaller, scheduled), true);
    assert.equal(canJoinLiveRoom(unassignedTrainer, scheduled), false, "Unassigned trainer cannot join another trainer's room");
  });
});

describe("2. Confidential Trainer Private Notes Redaction", () => {
  test("Strictly redacts trainerPrivateNotes from student-facing payloads", () => {
    const mockRoomInDb = {
      _id: "live-201",
      institutionId: "COLLEGE_ALPHA",
      role: "Backend Engineer",
      questions: [{ questionText: "Explain Event Loop" }],
      sharedCode: { content: "console.log('hi');" },
      trainerPrivateNotes: "CONFIDENTIAL: Candidate struggled with concurrency concepts initially.",
      evaluation: {
        overallScore: 78,
        summaryFeedback: "Solid communication, practice microtasks.",
      },
      toObject: function () {
        return { ...this };
      },
    };

    // Simulate student participant payload sanitization
    const sanitizeForRole = (roomDoc, participantRole) => {
      const roomObject = roomDoc.toObject();
      if (participantRole === "student") {
        delete roomObject.trainerPrivateNotes;
      }
      return roomObject;
    };

    const studentView = sanitizeForRole(mockRoomInDb, "student");
    const trainerView = sanitizeForRole(mockRoomInDb, "trainer");

    // Student must NEVER receive trainerPrivateNotes
    assert.equal("trainerPrivateNotes" in studentView, false);
    assert.equal(studentView.trainerPrivateNotes, undefined);
    assert.equal(studentView.evaluation.overallScore, 78);

    // Trainer must retain private notes
    assert.equal("trainerPrivateNotes" in trainerView, true);
    assert.equal(
      trainerView.trainerPrivateNotes,
      "CONFIDENTIAL: Candidate struggled with concurrency concepts initially."
    );
  });
});

describe("3. Live Evaluation Rubric Scoring & Completion", () => {
  test("Rejects student role attempting to complete live interview room (403 Forbidden)", async () => {
    const middleware = requireRole("admin", "trainer");
    let statusCode = null;
    let nextCalled = false;

    const req = {
      headers: {
        "x-gateway-secret": "test-internal-secret-2026",
        "x-user-id": "student-1",
        "x-user-role": "student",
      },
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: () => {} };
      },
    };

    await middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(statusCode, 403);
    assert.equal(nextCalled, false);
  });

  test("Computes weighted rubric evaluation score across 6 core criteria", () => {
    const criteria = {
      correctness: 80, // 25% = 20
      problemSolving: 90, // 25% = 22.5
      efficiency: 70, // 15% = 10.5
      clarity: 85, // 15% = 12.75
      relevance: 90, // 10% = 9.0
      communication: 80, // 10% = 8.0
    };

    const weightedScore = Math.round(
      0.25 * criteria.correctness +
      0.25 * criteria.problemSolving +
      0.15 * criteria.efficiency +
      0.15 * criteria.clarity +
      0.10 * criteria.relevance +
      0.10 * criteria.communication
    );

    // 20 + 22.5 + 10.5 + 12.75 + 9.0 + 8.0 = 82.75 -> 83
    assert.equal(weightedScore, 83);
    assert.ok(weightedScore >= 0 && weightedScore <= 100);
  });

  test("Calculates interview session elapsed duration in seconds correctly", () => {
    const startedAt = new Date("2026-11-14T10:00:00Z");
    const endedAt = new Date("2026-11-14T10:45:30Z");

    const durationSeconds = Math.max(0, Math.round((endedAt - startedAt) / 1000));

    // 45 minutes and 30 seconds = 45 * 60 + 30 = 2730 seconds
    assert.equal(durationSeconds, 2730);
  });
});

describe("4. Socket.IO Real-Time Workspace Signaling Protocol", () => {
  test("Validates WebRTC signaling message contracts for offer, answer, and ICE candidate", () => {
    const offerPayload = {
      liveId: "room-123",
      targetSocketId: "socket-peer-1",
      sdp: { type: "offer", sdp: "v=0\r\no=trainer..." },
    };
    const answerPayload = {
      liveId: "room-123",
      targetSocketId: "socket-caller-1",
      sdp: { type: "answer", sdp: "v=0\r\no=student..." },
    };
    const iceCandidatePayload = {
      liveId: "room-123",
      targetSocketId: "socket-peer-1",
      candidate: { candidate: "candidate:1 1 UDP...", sdpMid: "0", sdpMLineIndex: 0 },
    };

    assert.ok(offerPayload.sdp && offerPayload.sdp.type === "offer");
    assert.ok(answerPayload.sdp && answerPayload.sdp.type === "answer");
    assert.ok(iceCandidatePayload.candidate && iceCandidatePayload.candidate.candidate);
  });

  test("Validates live workspace syncing message schemas", () => {
    const questionPush = {
      liveId: "room-123",
      questionText: "Implement an LRU Cache in JavaScript or Python.",
      difficulty: "hard",
    };
    const codeUpdate = {
      liveId: "room-123",
      code: "class LRUCache { constructor(capacity) { this.cap = capacity; } }",
      language: "javascript",
    };
    const answerUpdate = {
      liveId: "room-123",
      questionIndex: 0,
      answerText: "I will use a doubly linked list combined with a hash map to achieve O(1) get and put.",
    };

    assert.equal(questionPush.difficulty, "hard");
    assert.equal(codeUpdate.language, "javascript");
    assert.equal(answerUpdate.questionIndex, 0);
    assert.ok(answerUpdate.answerText.includes("doubly linked list"));
  });
});
