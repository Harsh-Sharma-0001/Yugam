import EmailNotification from "../models/emailNotification.model.js";
import { renderInterviewNotificationEmail } from "../templates/interviewNotification.template.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sends a transactional email directly via Brevo HTTP API.
 */
export async function sendViaBrevo({
  toEmail,
  toName = "Student",
  subject,
  htmlContent,
  textContent,
}) {
  const isEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED === "true";
  const apiKey = process.env.BREVO_API_KEY;

  if (!toEmail || !EMAIL_REGEX.test(String(toEmail).trim())) {
    throw new Error(`Invalid recipient email address: '${toEmail}'`);
  }

  // Gracefully skip if notifications are disabled or API key is not configured
  if (!isEnabled || !apiKey) {
    return {
      success: true,
      messageId: "MOCK_DISPATCH_BREVO_DISABLED",
      skipped: true,
    };
  }

  const senderEmail = process.env.EMAIL_FROM_ADDRESS || "notifications@yugam.io";
  const senderName = process.env.EMAIL_FROM_NAME || "Yugam";

  const payload = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [
      {
        email: toEmail.trim(),
        name: toName.trim() || "Student",
      },
    ],
    subject,
    htmlContent,
    textContent,
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errJson = await response.json();
      errorDetail = errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`Brevo API error (${response.status}): ${errorDetail}`);
  }

  const data = await response.json();
  return {
    success: true,
    messageId: data.messageId || "BREVO_SENT",
  };
}

/**
 * Helper to fetch authoritative students list from auth microservice.
 */
async function fetchAuthStudents(institutionId) {
  try {
    const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:8001";
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || "";

    const authRes = await fetch(
      `${authServiceUrl}/internal/institution/students?institutionId=${encodeURIComponent(
        institutionId
      )}`,
      {
        headers: { "x-internal-service-key": internalSecret },
      }
    );

    if (authRes.ok) {
      const data = await authRes.json();
      if (Array.isArray(data?.students)) {
        return data.students;
      }
    }
  } catch (err) {
    console.warn("fetchAuthStudents warning:", err.message);
  }
  return [];
}

/**
 * Enqueues email notifications for newly scheduled, rescheduled, or cancelled interviews.
 * Guaranteed idempotent via unique idempotencyKey.
 */
export async function enqueueInterviewNotifications({
  schedules = [],
  type = "INTERVIEW_SCHEDULED",
  version = 1,
} = {}) {
  const scheduleList = Array.isArray(schedules) ? schedules : [schedules];
  if (scheduleList.length === 0) return [];

  // Group schedules by institution to batch student lookup
  const institutionMap = new Map();
  for (const s of scheduleList) {
    const instId = s.institutionId || "DEFAULT_COLLEGE";
    if (!institutionMap.has(instId)) {
      institutionMap.set(instId, []);
    }
    institutionMap.get(instId).push(s);
  }

  const enqueuedDocs = [];

  for (const [instId, instSchedules] of institutionMap.entries()) {
    const institutionStudents = await fetchAuthStudents(instId);

    // Create a student lookup map by ID and Email
    const studentMap = new Map();
    for (const stud of institutionStudents) {
      // Guard against cross-institution student record leak
      if (stud.institutionId && String(stud.institutionId) !== String(instId)) {
        continue;
      }
      studentMap.set(String(stud._id), stud);
      if (stud.email) {
        studentMap.set(String(stud.email).toLowerCase(), stud);
      }
      if (stud.profile?.rollNumber) {
        studentMap.set(String(stud.profile.rollNumber).toLowerCase(), stud);
      }
    }

    for (const schedule of instSchedules) {
      const studentIdStr = String(schedule.studentId || "");
      const resolvedStudent = studentMap.get(studentIdStr);

      // If student was not found in the institution's verified directory
      const studentEmail = (resolvedStudent?.email || schedule.studentEmail || "").trim();
      const studentName = (resolvedStudent?.name || schedule.studentName || "Student").trim();

      if (!studentEmail || !EMAIL_REGEX.test(studentEmail)) {
        console.warn(
          `Skipping email notification for schedule ${schedule._id}: student email not found or invalid.`
        );
        continue;
      }

      // Check cross-institution security constraint
      if (resolvedStudent && resolvedStudent.institutionId && String(resolvedStudent.institutionId) !== String(instId)) {
        console.warn(
          `Cross-institution mismatch: Student ${resolvedStudent._id} does not belong to ${instId}`
        );
        continue;
      }

      const idempotencyKey = `${schedule._id}:${type}:${version}`;

      const notificationDoc = {
        idempotencyKey,
        scheduledInterviewId: schedule._id,
        institutionId: instId,
        recipientStudentId: studentIdStr,
        recipientName: studentName,
        recipientEmail: studentEmail,
        notificationType: type,
        payload: schedule.toObject ? schedule.toObject() : schedule,
        status: "pending",
        attemptCount: 0,
        maxAttempts: 3,
        nextRetryAt: new Date(),
      };

      try {
        const result = await EmailNotification.updateOne(
          { idempotencyKey },
          { $setOnInsert: notificationDoc },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          enqueuedDocs.push(notificationDoc);
        }
      } catch (upsertErr) {
        console.error(`Failed to enqueue notification for ${idempotencyKey}:`, upsertErr.message);
      }
    }
  }

  // Trigger non-blocking asynchronous processor pass
  (async () => {
    try {
      await processPendingNotifications();
    } catch (procErr) {
      console.warn("processPendingNotifications background pass warning:", procErr.message);
    }
  })();

  return enqueuedDocs;
}

/**
 * Bounded worker that claims and processes pending email notifications.
 */
export async function processPendingNotifications() {
  const now = new Date();

  // Find due pending/failed jobs
  const candidates = await EmailNotification.find({
    status: { $in: ["pending", "failed"] },
    attemptCount: { $lt: 3 },
    nextRetryAt: { $lte: now },
  })
    .sort({ nextRetryAt: 1 })
    .limit(50);

  if (candidates.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const job of candidates) {
    // Atomically claim the job
    const claimed = await EmailNotification.findOneAndUpdate(
      {
        _id: job._id,
        status: { $in: ["pending", "failed"] },
        attemptCount: job.attemptCount,
      },
      {
        $set: { status: "sending" },
        $inc: { attemptCount: 1 },
      },
      { new: true }
    );

    if (!claimed) continue; // Concurrently claimed by another worker

    try {
      const emailContent = renderInterviewNotificationEmail({
        notificationType: claimed.notificationType,
        schedule: claimed.payload,
        recipientName: claimed.recipientName,
        frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
        timeZone: process.env.EMAIL_TIMEZONE || "Asia/Kolkata",
      });

      const sendResult = await sendViaBrevo({
        toEmail: claimed.recipientEmail,
        toName: claimed.recipientName,
        subject: emailContent.subject,
        htmlContent: emailContent.htmlContent,
        textContent: emailContent.textContent,
      });

      claimed.status = "sent";
      claimed.providerMessageId = sendResult.messageId || "BREVO_SENT";
      claimed.sentAt = new Date();
      claimed.lastError = null;
      await claimed.save();
      succeeded++;
    } catch (sendErr) {
      failed++;
      const nextAttempt = claimed.attemptCount;
      const backoffMinutes = nextAttempt === 1 ? 1 : nextAttempt === 2 ? 5 : 15;

      claimed.status = "failed";
      claimed.nextRetryAt = new Date(Date.now() + backoffMinutes * 60_000);
      claimed.lastError = sendErr.message || "Failed to dispatch email via Brevo";
      await claimed.save();
    }

    // Small pacing delay to respect Brevo free-tier rate limits during batches
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return { processed: candidates.length, succeeded, failed };
}
