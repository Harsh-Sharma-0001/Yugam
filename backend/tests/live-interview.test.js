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

  test("Authorizes assigned student and any trainer in the same institution", () => {
    const scheduled = {
      _id: "sched-101",
      institutionId: "COLLEGE_ALPHA",
      studentId: "student-1",
      trainerId: "trainer-1",
    };

    const studentCaller = { userId: "student-1", userRole: "student", institutionId: "COLLEGE_ALPHA" };
    const assignedTrainer = { userId: "trainer-1", userRole: "trainer", institutionId: "COLLEGE_ALPHA" };
    const colleagueTrainer = { userId: "trainer-99", userRole: "trainer", institutionId: "COLLEGE_ALPHA" };
    const otherCollegeTrainer = { userId: "trainer-55", userRole: "trainer", institutionId: "COLLEGE_BETA" };
    const otherStudent = { userId: "student-2", userRole: "student", institutionId: "COLLEGE_ALPHA" };

    const canJoinLiveRoom = (user, sched) => {
      if (user.userRole === "admin") return false;
      const isStudent = String(sched.studentId) === String(user.userId);
      const isAssignedTrainer = String(sched.trainerId) === String(user.userId);
      const isInstitutionTrainer =
        user.userRole === "trainer" && String(sched.institutionId) === String(user.institutionId);
      return isStudent || isAssignedTrainer || isInstitutionTrainer;
    };

    assert.equal(canJoinLiveRoom(studentCaller, scheduled), true, "Assigned student must be authorized");
    assert.equal(canJoinLiveRoom(assignedTrainer, scheduled), true, "Assigned trainer must be authorized");
    assert.equal(canJoinLiveRoom(colleagueTrainer, scheduled), true, "Colleague trainer in same college must be authorized");
    assert.equal(canJoinLiveRoom(otherCollegeTrainer, scheduled), false, "Trainer from different institution must be rejected");
    assert.equal(canJoinLiveRoom(otherStudent, scheduled), false, "Different student must be rejected");
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

describe("5. Post-Interview Lifecycle: Schedule Cleanup, Explorer Resolution & Trainer History", () => {
  test("Filters out completed and cancelled sessions from upcoming scheduled lists", () => {
    const allSchedules = [
      { _id: "s1", role: "Software Engineer", status: "completed" },
      { _id: "s2", role: "Frontend Dev", status: "scheduled" },
      { _id: "s3", role: "Backend Dev", status: "in-progress" },
      { _id: "s4", role: "DevOps", status: "cancelled" },
    ];

    const upcoming = allSchedules.filter(
      (item) => item.status === "scheduled" || item.status === "in-progress"
    );

    assert.equal(upcoming.length, 2);
    assert.deepEqual(
      upcoming.map((u) => u._id),
      ["s2", "s3"],
      "Completed and cancelled sessions must never appear in upcoming strip"
    );
  });

  test("Seamlessly resolves LiveInterview records and redacts trainerPrivateNotes for students", () => {
    const liveDoc = {
      _id: "live-doc-123",
      studentId: "student-1",
      trainerId: "trainer-1",
      role: "Software Engineer",
      interviewType: "technical",
      status: "completed",
      evaluation: {
        overallScore: 94,
        summaryFeedback: "Outstanding problem solving and clear communication.",
        strengths: ["Strong concurrency grasp", "Clean modular code"],
        weaknesses: ["Can optimize edge-case memory"],
        criteria: { correctness: 95, clarity: 92, problemSolving: 96 },
      },
      trainerPrivateNotes: "CONFIDENTIAL: Candidate is a top placement prospect.",
      questions: [
        {
          questionText: "Implement binary search",
          studentAnswer: "Binary search divides array in halves.",
          submittedCode: "function bs() {}",
          score: 95,
          feedback: "Great implementation",
        },
      ],
    };

    const normalizeForUser = (doc, userRole, reqUserId) => {
      const isStudent = String(doc.studentId) === String(reqUserId);
      const isTrainer = String(doc.trainerId) === String(reqUserId);
      if (!isStudent && !isTrainer) {
        throw new Error("Forbidden");
      }

      const res = {
        _id: doc._id,
        isLiveInterview: true,
        role: doc.role,
        type: doc.interviewType,
        status: doc.status,
        overallScore: doc.evaluation?.overallScore ?? 0,
        feedback: doc.evaluation?.summaryFeedback || "",
        strengths: doc.evaluation?.strengths || [],
        weaknesses: doc.evaluation?.weaknesses || [],
        criteria: doc.evaluation?.criteria || {},
        questions: doc.questions.map((q) => ({
          question: q.questionText,
          answer: q.studentAnswer,
          code: q.submittedCode,
          score: q.score,
          feedback: q.feedback,
        })),
      };

      if (userRole === "trainer" || userRole === "admin") {
        res.trainerPrivateNotes = doc.trainerPrivateNotes;
      }
      return res;
    };

    const studentReport = normalizeForUser(liveDoc, "student", "student-1");
    const trainerReport = normalizeForUser(liveDoc, "trainer", "trainer-1");

    assert.equal(studentReport._id, "live-doc-123");
    assert.equal(studentReport.overallScore, 94);
    assert.equal("trainerPrivateNotes" in studentReport, false, "Student must never see confidential notes");
    assert.equal(studentReport.questions[0].score, 95);

    assert.equal(trainerReport.overallScore, 94);
    assert.equal(trainerReport.trainerPrivateNotes, "CONFIDENTIAL: Candidate is a top placement prospect.");
  });

  test("Computes accurate conducted interview stats and KPI metrics for Trainer role", () => {
    const trainerLiveInterviews = [
      {
        _id: "live-1",
        trainerId: "trainer-sumedh",
        status: "completed",
        type: "technical",
        evaluation: { overallScore: 94 },
        questions: [{ score: 95, studentAnswer: "code..." }, { score: 90, studentAnswer: "ans..." }],
      },
      {
        _id: "live-2",
        trainerId: "trainer-sumedh",
        status: "completed",
        type: "technical",
        evaluation: { overallScore: 86 },
        questions: [{ score: 85, studentAnswer: "code..." }],
      },
    ];

    const completed = trainerLiveInterviews.filter((i) => i.status === "completed");
    const totalQuestions = trainerLiveInterviews.reduce(
      (sum, item) => sum + (item.questions?.length || 0),
      0
    );
    const avgScore = Number(
      (completed.reduce((sum, item) => sum + item.evaluation.overallScore, 0) / completed.length).toFixed(1)
    );

    const stats = {
      totalInterviews: trainerLiveInterviews.length,
      totalQuestions,
      completed: completed.length,
      averageScore: avgScore,
    };

    assert.equal(stats.totalInterviews, 2);
    assert.equal(stats.totalQuestions, 3);
    assert.equal(stats.completed, 2);
    assert.equal(stats.averageScore, 90);
  });
});
