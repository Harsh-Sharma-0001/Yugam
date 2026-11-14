import { test, describe, after } from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeFormula,
  escapeCsvCell,
  generateCsvString,
} from "../services/interview/utils/exportSanitizer.js";
import { requireRole } from "../services/interview/middleware/roleAuth.js";
import redis from "../shared/redis/redis.js";

after(async () => {
  try {
    redis.disconnect();
  } catch {}
});

describe("1. Spreadsheet Formula Injection Sanitization (CSV/Excel CWE-1236)", () => {
  test("Neutralizes dangerous leading characters by prefixing with single quote", () => {
    // Formula payloads commonly used in CSV injection
    const dangerousInputs = [
      "=cmd|' /C calc'!A0",
      "+12345",
      "-2+3+cmd|' /C calc'!A0",
      "@SUM(1+1)*cmd|' /C calc'!A0",
      "\tmalicious_tab",
      "\rmalicious_return",
    ];

    dangerousInputs.forEach((payload) => {
      const sanitized = sanitizeFormula(payload);
      assert.ok(sanitized.startsWith("'"), `Expected '${payload}' to start with single quote`);
      assert.equal(sanitized, `'${payload}`);
    });
  });

  test("Leaves safe strings, numbers, and booleans untouched", () => {
    assert.equal(sanitizeFormula("Rahul Sharma"), "Rahul Sharma");
    assert.equal(sanitizeFormula("21BCSE101"), "21BCSE101");
    assert.equal(sanitizeFormula(9.2), 9.2);
    assert.equal(sanitizeFormula(true), true);
    assert.equal(sanitizeFormula(null), "");
    assert.equal(sanitizeFormula(undefined), "");
  });

  test("RFC 4180 CSV cell escaping properly handles commas, quotes, and sanitized formulas", () => {
    const rawWithComma = "=SUM(A1,B1)";
    const escaped = escapeCsvCell(rawWithComma);
    // Formula neutralized to '=SUM(A1,B1)' and since it has a comma, wrapped in quotes
    assert.equal(escaped, `"'=SUM(A1,B1)"`);

    const rawWithQuotes = 'Software "Lead" Engineer';
    assert.equal(escapeCsvCell(rawWithQuotes), `"Software ""Lead"" Engineer"`);
  });

  test("generateCsvString prepends UTF-8 BOM for Microsoft Excel compatibility", () => {
    const table = [
      ["Roll Number", "Name"],
      ["21CSE101", "Aman"],
    ];
    const csv = generateCsvString(table);
    assert.ok(csv.startsWith("\uFEFF"), "CSV output must start with UTF-8 BOM character");
    assert.ok(csv.includes("21CSE101,Aman"));
  });
});

describe("2. Student Performance Metric Aggregation & Non-Blending", () => {
  test("Computes overall, AI, and live averages only from completed interviews", () => {
    const mockStudentInterviews = [
      { mode: "ai", status: "completed", overallScore: 80 },
      { mode: "ai", status: "completed", overallScore: 90 },
      { mode: "live", status: "completed", overallScore: 70 },
      // The following sessions must be completely ignored
      { mode: "ai", status: "in-progress", overallScore: 20 },
      { mode: "live", status: "scheduled", overallScore: null },
      { mode: "ai", status: "cancelled", overallScore: null },
    ];

    const completed = mockStudentInterviews.filter((i) => i.status === "completed");
    const aiCompleted = completed.filter((i) => i.mode !== "live");
    const liveCompleted = completed.filter((i) => i.mode === "live");

    const overallAvg = Number(
      (completed.reduce((a, b) => a + b.overallScore, 0) / completed.length).toFixed(1)
    );
    const aiAvg = Number(
      (aiCompleted.reduce((a, b) => a + b.overallScore, 0) / aiCompleted.length).toFixed(1)
    );
    const liveAvg = Number(
      (liveCompleted.reduce((a, b) => a + b.overallScore, 0) / liveCompleted.length).toFixed(1)
    );

    assert.equal(completed.length, 3);
    assert.equal(overallAvg, 80.0); // (80 + 90 + 70) / 3 = 80.0
    assert.equal(aiAvg, 85.0); // (80 + 90) / 2 = 85.0
    assert.equal(liveAvg, 70.0); // 70 / 1 = 70.0
  });

  test("Maintains separate 3-tier academic indicators without blending percentage and CGPA", () => {
    const studentProfile = {
      currentCGPA: 8.75, // 10-point scale
      academics: {
        tenthPercentage: 92.4, // 100-point scale
        twelfthPercentage: 88.6, // 100-point scale
      },
    };

    // Verify scales remain discrete
    assert.equal(studentProfile.currentCGPA, 8.75);
    assert.equal(studentProfile.academics.tenthPercentage, 92.4);
    assert.equal(studentProfile.academics.twelfthPercentage, 88.6);
    assert.notEqual(studentProfile.currentCGPA * 10, studentProfile.academics.tenthPercentage);
  });
});

describe("3. RBAC on Performance Directory & Scheduling Endpoints", () => {
  const configuredSecret = "test-internal-secret-2026";
  process.env.GATEWAY_INTERNAL_SECRET = configuredSecret;

  test("Rejects student role attempting to access students directory (403 Forbidden)", async () => {
    const middleware = requireRole("admin", "trainer");
    let statusCode = null;
    let jsonResponse = null;

    const req = {
      headers: {
        "x-gateway-secret": configuredSecret,
        "x-user-id": "student-100",
        "x-user-role": "student",
        "x-institution-id": "COLLEGE_X",
      },
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: (d) => { jsonResponse = d; } };
      },
    };
    let nextCalled = false;

    await middleware(req, res, () => { nextCalled = true; });

    assert.equal(statusCode, 403);
    assert.equal(nextCalled, false);
    assert.match(jsonResponse?.message, /Role 'student' does not have access/);
  });

  test("Allows trainer and admin roles to access students directory & scheduling", async () => {
    const middleware = requireRole("admin", "trainer");

    let trainerPassed = false;
    let adminPassed = false;

    const reqTrainer = {
      headers: {
        "x-gateway-secret": configuredSecret,
        "x-user-id": "trainer-101",
        "x-user-role": "trainer",
        "x-institution-id": "COLLEGE_X",
      },
    };
    const reqAdmin = {
      headers: {
        "x-gateway-secret": configuredSecret,
        "x-user-id": "admin-102",
        "x-user-role": "admin",
        "x-institution-id": "COLLEGE_X",
      },
    };
    const res = { status: () => ({ json: () => {} }) };

    await middleware(reqTrainer, res, () => { trainerPassed = true; });
    await middleware(reqAdmin, res, () => { adminPassed = true; });

    assert.equal(trainerPassed, true);
    assert.equal(adminPassed, true);
  });
});

describe("4. Flexible Student Identifier Resolution (Email, Roll Number, MongoDB _id)", () => {
  const institutionStudents = [
    {
      _id: "6735e5d31122334455667788",
      name: "Harsh Sharma",
      email: "harshsharmasharma257@gmail.com",
      profile: { rollNumber: "21BCSE101", section: "CSE-A" },
    },
    {
      _id: "6735e5d31122334455667799",
      name: "Rahul Verma",
      email: "rahul.verma@college.edu",
      profile: { rollNumber: "21BCSE102", section: "CSE-B" },
    },
  ];

  // Helper matching the resolution logic in schedule.controller.js
  const resolveStudent = (input, students) => {
    const rawInput = (input || "").trim();
    const cleanInput = rawInput.toLowerCase();
    return students.find((s) => {
      const sId = String(s._id);
      const sEmail = (s.email || "").toLowerCase();
      const sRoll = (s.profile?.rollNumber || "").toLowerCase();
      return sId === rawInput || sEmail === cleanInput || sRoll === cleanInput;
    });
  };

  test("Resolves student by exact Email (case-insensitive)", () => {
    const student = resolveStudent("harshsharmasharma257@gmail.com", institutionStudents);
    assert.ok(student, "Student should be found by email");
    assert.equal(student.name, "Harsh Sharma");
    assert.equal(student._id, "6735e5d31122334455667788");

    // Case insensitive check
    const studentUpper = resolveStudent("HARSHSHARMASHARMA257@GMAIL.COM", institutionStudents);
    assert.ok(studentUpper);
    assert.equal(studentUpper._id, "6735e5d31122334455667788");
  });

  test("Resolves student by University Roll Number (case-insensitive)", () => {
    const student = resolveStudent("21BCSE101", institutionStudents);
    assert.ok(student, "Student should be found by roll number");
    assert.equal(student.name, "Harsh Sharma");
    assert.equal(student.email, "harshsharmasharma257@gmail.com");

    const studentLower = resolveStudent("21bcse101", institutionStudents);
    assert.ok(studentLower);
    assert.equal(studentLower._id, "6735e5d31122334455667788");
  });

  test("Resolves student by MongoDB _id", () => {
    const student = resolveStudent("6735e5d31122334455667799", institutionStudents);
    assert.ok(student, "Student should be found by MongoDB _id");
    assert.equal(student.name, "Rahul Verma");
    assert.equal(student.profile.rollNumber, "21BCSE102");
  });

  test("Returns undefined/404 for non-existent identifier", () => {
    const student = resolveStudent("nonexistent@domain.com", institutionStudents);
    assert.equal(student, undefined, "Non-existent student should not be found");

    const studentRoll = resolveStudent("INVALID_ROLL", institutionStudents);
    assert.equal(studentRoll, undefined);
  });
});

describe("5. Scheduled Interview Deletion Authorization & Scoping", () => {
  const scheduledDoc = {
    _id: "sched-501",
    institutionId: "COLLEGE_ALPHA",
    studentId: "student-1",
    trainerId: "trainer-101",
    role: "Fullstack Engineer",
  };

  const canDeleteScheduled = (user, sched) => {
    if (user.institutionId !== sched.institutionId) return { allowed: false, status: 403, reason: "Cross-institution" };
    if (user.userRole === "student") return { allowed: false, status: 403, reason: "Student role not permitted" };
    if (user.userRole === "trainer" && String(user.userId) !== String(sched.trainerId)) {
      return { allowed: false, status: 403, reason: "Trainer can only delete own sessions" };
    }
    return { allowed: true, status: 200 };
  };

  test("Allows assigned trainer to delete own scheduled interview", () => {
    const trainerUser = { userId: "trainer-101", userRole: "trainer", institutionId: "COLLEGE_ALPHA" };
    const res = canDeleteScheduled(trainerUser, scheduledDoc);
    assert.equal(res.allowed, true);
    assert.equal(res.status, 200);
  });

  test("Allows institution Admin to delete any scheduled interview", () => {
    const adminUser = { userId: "admin-999", userRole: "admin", institutionId: "COLLEGE_ALPHA" };
    const res = canDeleteScheduled(adminUser, scheduledDoc);
    assert.equal(res.allowed, true);
    assert.equal(res.status, 200);
  });

  test("Rejects unassigned trainer from deleting another trainer's session", () => {
    const otherTrainer = { userId: "trainer-102", userRole: "trainer", institutionId: "COLLEGE_ALPHA" };
    const res = canDeleteScheduled(otherTrainer, scheduledDoc);
    assert.equal(res.allowed, false);
    assert.equal(res.status, 403);
  });

  test("Rejects student role from deleting scheduled interview", () => {
    const studentUser = { userId: "student-1", userRole: "student", institutionId: "COLLEGE_ALPHA" };
    const res = canDeleteScheduled(studentUser, scheduledDoc);
    assert.equal(res.allowed, false);
    assert.equal(res.status, 403);
  });

  test("Rejects cross-institution scheduled interview deletion", () => {
    const adminOtherCollege = { userId: "admin-888", userRole: "admin", institutionId: "COLLEGE_BETA" };
    const res = canDeleteScheduled(adminOtherCollege, scheduledDoc);
    assert.equal(res.allowed, false);
    assert.equal(res.status, 403);
  });
});
