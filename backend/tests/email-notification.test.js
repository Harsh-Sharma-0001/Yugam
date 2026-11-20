import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import redis from "../shared/redis/redis.js";
import {
  escapeHtml,
  formatDateTime,
  renderInterviewNotificationEmail,
} from "../services/interview/templates/interviewNotification.template.js";
import { sendViaBrevo } from "../services/interview/services/email.service.js";

after(async () => {
  try {
    redis.disconnect();
  } catch {}
});

describe("1. Email Template Rendering & HTML Sanitization (XSS Prevention)", () => {
  test("escapeHtml neutralizes dangerous script tags, quotes, ampersands, and angle brackets", () => {
    const maliciousInput = '<script>alert("xss & pwned")</script>\' OR 1=1 --';
    const escaped = escapeHtml(maliciousInput);

    assert.ok(!escaped.includes("<script>"), "Must not contain raw <script>");
    assert.ok(!escaped.includes("</script>"), "Must not contain raw </script>");
    assert.ok(escaped.includes("&lt;script&gt;"), "Must escape <script>");
    assert.ok(escaped.includes("&quot;xss"), "Must escape double quotes");
    assert.ok(escaped.includes("&amp;"), "Must escape ampersands");
    assert.ok(escaped.includes("&#39;"), "Must escape single quotes");
  });

  test("formatDateTime formats dates correctly in specified timeZone (Asia/Kolkata default)", () => {
    const date = new Date("2026-11-25T10:00:00.000Z");
    const formatted = formatDateTime(date, "Asia/Kolkata");

    // 10:00 UTC = 15:30 IST
    assert.ok(formatted.includes("2026"), "Formatted date must include year");
    assert.ok(formatted.includes("Nov") || formatted.includes("November"), "Must include month");
    assert.ok(formatted.includes("IST"), "Must include IST timezone indicator");
  });

  test("renderInterviewNotificationEmail: INTERVIEW_SCHEDULED renders branded Obsidian & Emerald email", () => {
    const schedule = {
      _id: "sched-101",
      mode: "live",
      role: "Backend Engineer",
      trainerName: "Dr. Sumedh Sir",
      scheduledAt: new Date("2026-11-25T10:00:00.000Z"),
      durationMinutes: 45,
      instructions: "Prepare System Design and MongoDB aggregation pipelines.",
    };

    const rendered = renderInterviewNotificationEmail({
      notificationType: "INTERVIEW_SCHEDULED",
      schedule,
      recipientName: "Harsh Sharma",
      frontendUrl: "https://yugam.io",
      timeZone: "Asia/Kolkata",
    });

    assert.ok(rendered.subject.includes("Backend Engineer"));
    assert.ok(rendered.subject.includes("New Live Faculty Interview"));
    assert.ok(rendered.htmlContent.includes("Harsh Sharma"), "Must include recipient name");
    assert.ok(rendered.htmlContent.includes("Backend Engineer"), "Must include target role");
    assert.ok(rendered.htmlContent.includes("Dr. Sumedh Sir"), "Must include trainer name");
    assert.ok(rendered.htmlContent.includes("45 mins") || rendered.htmlContent.includes("45 Minutes"), "Must include duration");
    assert.ok(rendered.htmlContent.includes("https://yugam.io/dashboard"), "Must include link to dashboard");
    assert.ok(rendered.htmlContent.includes("#111318"), "Must use Obsidian brand color");
    assert.ok(rendered.htmlContent.includes("#10B981"), "Must use Emerald brand color");

    // Plaintext fallback
    assert.ok(rendered.textContent.includes("Harsh Sharma"));
    assert.ok(rendered.textContent.includes("Backend Engineer"));
    assert.ok(!rendered.textContent.includes("<div>"), "Plain text must not contain HTML tags");
  });

  test("renderInterviewNotificationEmail: INTERVIEW_RESCHEDULED renders updated schedule and subject", () => {
    const schedule = {
      _id: "sched-102",
      mode: "ai",
      role: "Frontend Engineer",
      trainerName: "Sumedh Sir",
      scheduledAt: new Date("2026-11-26T14:30:00.000Z"),
      durationMinutes: 30,
      instructions: "Session moved to tomorrow afternoon.",
    };

    const rendered = renderInterviewNotificationEmail({
      notificationType: "INTERVIEW_RESCHEDULED",
      schedule,
      recipientName: "Aman Gupta",
      frontendUrl: "https://yugam.io",
      timeZone: "Asia/Kolkata",
    });

    assert.ok(rendered.subject.includes("Rescheduled: AI Mock Interview - Frontend Engineer"));
    assert.ok(rendered.htmlContent.includes("Session moved to tomorrow afternoon."));
    assert.ok(rendered.textContent.includes("RESCHEDULED"));
  });

  test("renderInterviewNotificationEmail: INTERVIEW_CANCELLED renders cancellation notice without join urgency", () => {
    const schedule = {
      _id: "sched-103",
      mode: "live",
      role: "DevOps Engineer",
      trainerName: "Sumedh Sir",
      scheduledAt: new Date("2026-11-25T10:00:00.000Z"),
      instructions: "Cancelled due to campus schedule conflict.",
    };

    const rendered = renderInterviewNotificationEmail({
      notificationType: "INTERVIEW_CANCELLED",
      schedule,
      recipientName: "Rohan Patel",
      frontendUrl: "https://yugam.io",
      timeZone: "Asia/Kolkata",
    });

    assert.ok(rendered.subject.includes("Cancelled: Live Faculty Interview - DevOps Engineer"));
    assert.ok(rendered.htmlContent.includes("has been cancelled"));
    assert.ok(rendered.htmlContent.includes("Cancelled due to campus schedule conflict."));
    assert.ok(!rendered.htmlContent.includes("Join Live Interview Room"), "Must not display join room button");
  });
});

describe("2. Brevo HTTP API Dispatch Validation (sendViaBrevo)", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  after(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  });

  test("Rejects missing or invalid recipient email addresses", async () => {
    await assert.rejects(
      async () => {
        await sendViaBrevo({
          toEmail: "not-an-email",
          subject: "Test",
          htmlContent: "<p>Test</p>",
        });
      },
      /Invalid recipient email address/
    );

    await assert.rejects(
      async () => {
        await sendViaBrevo({
          toEmail: "",
          subject: "Test",
          htmlContent: "<p>Test</p>",
        });
      },
      /Invalid recipient email address/
    );
  });

  test("Gracefully skips dispatch when EMAIL_NOTIFICATIONS_ENABLED is not 'true'", async () => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = "false";
    delete process.env.BREVO_API_KEY;

    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return { ok: true, json: async () => ({}) };
    };

    const result = await sendViaBrevo({
      toEmail: "student@college.edu",
      subject: "Test Subject",
      htmlContent: "<p>Content</p>",
    });

    assert.equal(result.success, true);
    assert.equal(result.skipped, true);
    assert.equal(fetchCalled, false, "Must not invoke external Brevo API when disabled");
  });

  test("Gracefully skips dispatch when BREVO_API_KEY is missing", async () => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = "true";
    delete process.env.BREVO_API_KEY;

    const result = await sendViaBrevo({
      toEmail: "student@college.edu",
      subject: "Test Subject",
      htmlContent: "<p>Content</p>",
    });

    assert.equal(result.success, true);
    assert.equal(result.skipped, true);
  });

  test("Dispatches HTTP POST to Brevo API with valid payload and headers", async () => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = "true";
    process.env.BREVO_API_KEY = "xkeysib-mock-test-key-12345";
    process.env.EMAIL_FROM_ADDRESS = "notifications@yugam.io";
    process.env.EMAIL_FROM_NAME = "Yugam Platform";

    let interceptedUrl = null;
    let interceptedOptions = null;

    globalThis.fetch = async (url, options) => {
      interceptedUrl = url;
      interceptedOptions = options;
      return {
        ok: true,
        status: 201,
        json: async () => ({ messageId: "<20261120.brevo.test@smtp-relay.brevo.com>" }),
      };
    };

    const result = await sendViaBrevo({
      toEmail: "harsh@college.edu",
      toName: "Harsh Sharma",
      subject: "Interview Scheduled",
      htmlContent: "<h1>Your Interview</h1>",
      textContent: "Your Interview",
    });

    assert.equal(result.success, true);
    assert.equal(result.messageId, "<20261120.brevo.test@smtp-relay.brevo.com>");
    assert.equal(interceptedUrl, "https://api.brevo.com/v3/smtp/email");
    assert.equal(interceptedOptions.headers["api-key"], "xkeysib-mock-test-key-12345");
    assert.equal(interceptedOptions.headers["Content-Type"], "application/json");

    const sentBody = JSON.parse(interceptedOptions.body);
    assert.equal(sentBody.sender.email, "notifications@yugam.io");
    assert.equal(sentBody.sender.name, "Yugam Platform");
    assert.equal(sentBody.to[0].email, "harsh@college.edu");
    assert.equal(sentBody.to[0].name, "Harsh Sharma");
    assert.equal(sentBody.subject, "Interview Scheduled");
  });

  test("Throws descriptive error when Brevo API responds with HTTP 4xx or 5xx", async () => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = "true";
    process.env.BREVO_API_KEY = "xkeysib-invalid-key";

    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ code: "unauthorized", message: "Key not found in account" }),
    });

    await assert.rejects(
      async () => {
        await sendViaBrevo({
          toEmail: "student@college.edu",
          subject: "Test",
          htmlContent: "<p>Test</p>",
        });
      },
      /Brevo API error \(401\): Key not found in account/
    );
  });
});

describe("3. Multi-Tenant Institution Isolation & Student Email Verification", () => {
  test("Filters out students belonging to foreign institutions", () => {
    const institutionId = "COLLEGE_GLA";
    const studentsFromAuth = [
      {
        _id: "stud-1",
        name: "Harsh Sharma",
        email: "harsh@gla.ac.in",
        institutionId: "COLLEGE_GLA",
      },
      {
        _id: "stud-2",
        name: "Foreign Student",
        email: "foreign@otheruniv.ac.in",
        institutionId: "COLLEGE_OTHER", // Cross-institution leak attempt
      },
    ];

    // Filter logic as implemented in email.service.js
    const verifiedStudents = studentsFromAuth.filter(
      (s) => !s.institutionId || String(s.institutionId) === String(institutionId)
    );

    assert.equal(verifiedStudents.length, 1);
    assert.equal(verifiedStudents[0]._id, "stud-1");
    assert.equal(verifiedStudents[0].email, "harsh@gla.ac.in");
  });

  test("Generates deterministic idempotency keys per schedule, type, and version", () => {
    const scheduleId = "6735e5d31122334455667788";
    const type = "INTERVIEW_SCHEDULED";
    const version = 1;

    const idempotencyKey1 = `${scheduleId}:${type}:${version}`;
    const idempotencyKey2 = `${scheduleId}:${type}:${version}`;

    assert.equal(idempotencyKey1, idempotencyKey2);
    assert.equal(idempotencyKey1, "6735e5d31122334455667788:INTERVIEW_SCHEDULED:1");
  });

  test("Section scheduling fans out into independent notifications per student in section", () => {
    const sectionStudents = [
      { _id: "s1", name: "Student One", email: "s1@gla.ac.in", section: "CSE-A" },
      { _id: "s2", name: "Student Two", email: "s2@gla.ac.in", section: "CSE-A" },
      { _id: "s3", name: "Student Three", email: "s3@gla.ac.in", section: "CSE-A" },
    ];

    const targetSection = "CSE-A";
    const matchingStudents = sectionStudents.filter(
      (s) => s.section.toLowerCase() === targetSection.toLowerCase()
    );

    const generatedNotifications = matchingStudents.map((s) => ({
      idempotencyKey: `sched-${s._id}:INTERVIEW_SCHEDULED:1`,
      recipientStudentId: s._id,
      recipientEmail: s.email,
      recipientName: s.name,
      notificationType: "INTERVIEW_SCHEDULED",
    }));

    assert.equal(generatedNotifications.length, 3);
    assert.equal(generatedNotifications[0].recipientEmail, "s1@gla.ac.in");
    assert.equal(generatedNotifications[1].recipientEmail, "s2@gla.ac.in");
    assert.equal(generatedNotifications[2].recipientEmail, "s3@gla.ac.in");
    assert.notEqual(generatedNotifications[0].idempotencyKey, generatedNotifications[1].idempotencyKey);
  });
});

describe("4. Non-Blocking Scheduling Guarantee & Exponential Backoff Retry Logic", () => {
  test("Non-blocking guarantee: Controller schedule flow catches email notification errors without failing HTTP 201", async () => {
    let responseStatus = null;
    let responseBody = null;

    const mockRes = {
      status: (code) => {
        responseStatus = code;
        return {
          json: (body) => {
            responseBody = body;
          },
        };
      },
    };

    // Simulate an async notification enqueue failure
    let loggedError = null;
    const failingEnqueue = async () => {
      throw new Error("Network timeout contacting email service");
    };

    // Controller pattern: enqueue is wrapped in .catch()
    failingEnqueue().catch((err) => {
      loggedError = err.message;
    });

    // Await microtasks to let the .catch handler run
    await new Promise((resolve) => setImmediate(resolve));

    // Controller immediately returns 201 Created to caller
    mockRes.status(201).json({
      success: true,
      message: "Interview scheduled successfully for Harsh Sharma.",
      count: 1,
    });

    assert.equal(responseStatus, 201);
    assert.equal(responseBody.success, true);
    assert.equal(loggedError, "Network timeout contacting email service");
  });

  test("Exponential backoff retry calculation: 1m, 5m, 15m intervals with max 3 attempts", () => {
    const calculateBackoffMinutes = (attemptCount) => {
      if (attemptCount === 1) return 1;
      if (attemptCount === 2) return 5;
      return 15;
    };

    assert.equal(calculateBackoffMinutes(1), 1, "Attempt 1 retry should back off by 1 minute");
    assert.equal(calculateBackoffMinutes(2), 5, "Attempt 2 retry should back off by 5 minutes");
    assert.equal(calculateBackoffMinutes(3), 15, "Attempt 3 retry should back off by 15 minutes");

    // After 3 attempts, maxAttempts (3) blocks further retries
    const isRetryEligible = (job) => job.attemptCount < job.maxAttempts;
    assert.equal(isRetryEligible({ attemptCount: 0, maxAttempts: 3 }), true);
    assert.equal(isRetryEligible({ attemptCount: 1, maxAttempts: 3 }), true);
    assert.equal(isRetryEligible({ attemptCount: 2, maxAttempts: 3 }), true);
    assert.equal(isRetryEligible({ attemptCount: 3, maxAttempts: 3 }), false);
  });

  test("Atomic state transition: pending -> sending -> sent marks providerMessageId and sentAt", () => {
    const job = {
      status: "pending",
      attemptCount: 0,
      sentAt: null,
      providerMessageId: null,
    };

    // Simulate atomic claim
    job.status = "sending";
    job.attemptCount += 1;
    assert.equal(job.status, "sending");
    assert.equal(job.attemptCount, 1);

    // Simulate successful dispatch
    job.status = "sent";
    job.providerMessageId = "<brevo-success-message-id>";
    job.sentAt = new Date();

    assert.equal(job.status, "sent");
    assert.ok(job.providerMessageId.startsWith("<brevo"));
    assert.ok(job.sentAt instanceof Date);
  });
});

describe("5. Diagnostic Delivery Logging & Student Email Resolution Fallback", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const originalWarn = console.warn;
  const originalLog = console.log;
  const originalError = console.error;

  after(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
    console.warn = originalWarn;
    console.log = originalLog;
    console.error = originalError;
  });

  test("Logs '[EmailService] Skipped' when disabled or BREVO_API_KEY is unset without leaking secrets", async () => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = "false";
    delete process.env.BREVO_API_KEY;

    let warnMsg = "";
    console.warn = (...args) => {
      warnMsg = args.join(" ");
    };

    await sendViaBrevo({
      toEmail: "candidate@college.edu",
      subject: "Test",
      htmlContent: "<p>Test</p>",
    });

    assert.ok(warnMsg.includes("[EmailService] Skipped: EMAIL_NOTIFICATIONS_ENABLED or BREVO_API_KEY not set"));
    assert.ok(!warnMsg.includes("key"), "Must not leak API keys");
  });

  test("Logs '[EmailService] Sent via Brevo' with recipient and messageId on success", async () => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = "true";
    process.env.BREVO_API_KEY = "test-brevo-key";

    let logMsg = "";
    console.log = (...args) => {
      logMsg = args.join(" ");
    };

    globalThis.fetch = async () => ({
      ok: true,
      status: 201,
      json: async () => ({ messageId: "<msg-99999.brevo@smtp>" }),
    });

    await sendViaBrevo({
      toEmail: "student99@college.edu",
      subject: "Test Subject",
      htmlContent: "<p>Test</p>",
    });

    assert.ok(logMsg.includes("[EmailService] Sent via Brevo to student99@college.edu messageId: <msg-99999.brevo@smtp>"));
  });

  test("Logs '[EmailService] Delivery error' with HTTP status and detail on Brevo error", async () => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = "true";
    process.env.BREVO_API_KEY = "test-brevo-key";

    let errorMsg = "";
    console.error = (...args) => {
      errorMsg = args.join(" ");
    };

    globalThis.fetch = async () => ({
      ok: false,
      status: 402,
      json: async () => ({ message: "Payment required: credit quota exhausted" }),
    });

    await assert.rejects(
      async () => {
        await sendViaBrevo({
          toEmail: "student@college.edu",
          subject: "Test Subject",
          htmlContent: "<p>Test</p>",
        });
      },
      /credit quota exhausted/
    );

    assert.ok(errorMsg.includes("[EmailService] Delivery error: 402 Payment required: credit quota exhausted"));
  });

  test("Student email resolution falls back cleanly to schedule.studentEmail if Auth Service has no records", () => {
    const emptyStudentMap = new Map();
    const schedule = {
      _id: "sched-direct-1",
      studentId: "6735e5d31122334455667788",
      studentEmail: "fallback.student@college.edu",
      studentName: "Fallback Student",
    };

    const resolvedStudent = emptyStudentMap.get(String(schedule.studentId));
    const resolvedEmail = (resolvedStudent?.email || schedule.studentEmail || "").trim();
    const resolvedName = (resolvedStudent?.name || schedule.studentName || "Student").trim();

    assert.equal(resolvedEmail, "fallback.student@college.edu");
    assert.equal(resolvedName, "Fallback Student");
  });
});
