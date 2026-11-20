/**
 * Branded HTML & Plain-Text Email Templates for Yugam Interview Scheduling Notifications
 * Matching Yugam's White (#F8F9FA), Obsidian (#111318) and Emerald (#10B981) visual identity.
 */

export const escapeHtml = (str) => {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export const formatDateTime = (dateInput, timeZone = process.env.EMAIL_TIMEZONE || "Asia/Kolkata") => {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "To Be Announced";

  try {
    const formattedDate = new Intl.DateTimeFormat("en-IN", {
      timeZone,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);

    const formattedTime = new Intl.DateTimeFormat("en-IN", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);

    return `${formattedDate}, ${formattedTime} IST`;
  } catch {
    return d.toISOString();
  }
};

/**
 * Renders subject, HTML content, and text content for interview notifications.
 */
export function renderInterviewNotificationEmail({
  notificationType = "INTERVIEW_SCHEDULED",
  schedule = {},
  recipientName = "Student",
  frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173",
  timeZone = process.env.EMAIL_TIMEZONE || "Asia/Kolkata",
} = {}) {
  const safeRecipientName = escapeHtml(recipientName || schedule.studentName || "Student");
  const safeRole = escapeHtml(schedule.role || "Software Engineer");
  const isLive = String(schedule.mode).toLowerCase() === "live";
  const formatTitle = isLive ? "Live Faculty Interview" : "AI Mock Interview";
  const safeFormatTitle = escapeHtml(formatTitle);
  const safeCategory = escapeHtml(String(schedule.interviewType || "technical").toUpperCase());
  const safeSection = escapeHtml(schedule.section || "General");

  const isSlug = (val) => {
    if (!val) return true;
    const lower = String(val).toLowerCase().trim();
    return lower === "default_college" || lower === "default" || lower === "null" || lower === "undefined";
  };

  const rawCollegeName =
    schedule.collegeName ||
    schedule.institutionName ||
    schedule.college ||
    schedule.university ||
    "";

  const resolvedCollege = !isSlug(rawCollegeName)
    ? rawCollegeName.trim()
    : (!isSlug(schedule.institutionId) ? schedule.institutionId.trim() : "Institutional Placement Cell");

  const safeCollege = escapeHtml(resolvedCollege);
  const safeTrainer = escapeHtml(schedule.trainerName || "Faculty Instructor");
  const safeDuration = escapeHtml(`${schedule.durationMinutes || 45} Minutes`);
  const safeInstructions = escapeHtml(schedule.instructions || "");
  const formattedDateTime = formatDateTime(schedule.scheduledAt, timeZone);
  const dashboardUrl = `${frontendUrl.replace(/\/+$/, "")}/dashboard`;

  let badgeColor = "#10B981"; // Emerald
  let badgeText = "SCHEDULED";
  let bannerTitle = "Your Interview is Scheduled!";
  let bannerSub = `An interview session has been arranged for you on Yugam.`;
  let subject = `[Yugam] New ${formatTitle}: ${schedule.role || "Software Engineer"} on ${formattedDateTime}`;

  if (notificationType === "INTERVIEW_RESCHEDULED") {
    badgeColor = "#F59E0B"; // Amber
    badgeText = "RESCHEDULED";
    bannerTitle = "Interview Schedule Updated";
    bannerSub = `Your scheduled interview timing or instructions have been updated by faculty.`;
    subject = `[Yugam] Rescheduled: ${formatTitle} - ${schedule.role || "Software Engineer"} on ${formattedDateTime}`;
  } else if (notificationType === "INTERVIEW_CANCELLED") {
    badgeColor = "#EF4444"; // Red
    badgeText = "CANCELLED";
    bannerTitle = "Scheduled Interview Cancelled";
    bannerSub = `This scheduled interview session has been cancelled by the placement coordinator or trainer.`;
    subject = `[Yugam] Cancelled: ${formatTitle} - ${schedule.role || "Software Engineer"}`;
  }

  const preparationGuidance = isLive
    ? "Please join the live room 5–10 minutes before the scheduled time with your microphone, webcam, and code editor ready in a quiet room."
    : "Ensure a quiet environment and stable internet connection. You can complete your proctored AI interview from your Yugam student dashboard.";

  // Plain-Text Fallback
  const textContent = `
Hello ${recipientName},

${bannerTitle}
${bannerSub}

--------------------------------------------------
INTERVIEW DETAILS
--------------------------------------------------
Role: ${schedule.role || "Software Engineer"}
Format: ${formatTitle}
Category: ${String(schedule.interviewType || "technical").toUpperCase()}
Date & Time: ${formattedDateTime}
Duration: ${schedule.durationMinutes || 45} Minutes
Institution: ${resolvedCollege} (Section: ${schedule.section || "General"})
${isLive ? `Trainer: ${schedule.trainerName || "Faculty Instructor"}\n` : ""}Status: ${badgeText}

${safeInstructions ? `Trainer Instructions:\n${schedule.instructions}\n` : ""}
Preparation Guidance:
${preparationGuidance}

Open your dashboard to view the room or session:
${dashboardUrl}

Best regards,
${resolvedCollege} • Yugam Assessment Platform
`.trim();

  // Responsive HTML Email Template
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F8F9FA;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111318;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #F8F9FA;
      padding: 30px 10px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid #E5E7EB;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #111318;
      padding: 32px 36px 24px 36px;
      text-align: left;
    }
    .brand-mark {
      display: inline-block;
      background-color: #10B981;
      color: #000000;
      font-weight: 900;
      font-size: 14px;
      width: 28px;
      height: 28px;
      line-height: 28px;
      text-align: center;
      border-radius: 6px;
      margin-right: 8px;
      vertical-align: middle;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.5px;
      vertical-align: middle;
      display: inline-block;
    }
    .brand-subtitle {
      font-size: 11px;
      color: #9CA3AF;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 4px;
      display: block;
    }
    .status-pill {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      background-color: ${badgeColor}20;
      color: ${badgeColor};
      border: 1px solid ${badgeColor}40;
      margin-top: 18px;
    }
    .banner {
      padding: 28px 36px 12px 36px;
    }
    .banner h1 {
      margin: 0 0 6px 0;
      font-size: 22px;
      font-weight: 800;
      color: #111318;
      letter-spacing: -0.4px;
    }
    .banner p {
      margin: 0;
      font-size: 14px;
      color: #4B5563;
      line-height: 1.5;
    }
    .details-box {
      margin: 20px 36px;
      background-color: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      overflow: hidden;
    }
    .details-table {
      width: 100%;
    }
    .details-table td {
      padding: 12px 18px;
      font-size: 13px;
      border-bottom: 1px solid #E5E7EB;
    }
    .details-table tr:last-child td {
      border-bottom: none;
    }
    .label {
      color: #6B7280;
      font-weight: 600;
      width: 35%;
    }
    .value {
      color: #111318;
      font-weight: 700;
    }
    .instructions-box {
      margin: 20px 36px;
      padding: 16px 20px;
      background-color: #F0FDF4;
      border-left: 4px solid #10B981;
      border-radius: 8px;
    }
    .instructions-box h3 {
      margin: 0 0 4px 0;
      font-size: 13px;
      font-weight: 700;
      color: #065F46;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .instructions-box p {
      margin: 0;
      font-size: 13px;
      color: #047857;
      line-height: 1.4;
    }
    .cta-area {
      text-align: center;
      padding: 24px 36px 36px 36px;
    }
    .cta-button {
      display: inline-block;
      background-color: #111318;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      padding: 14px 32px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(17, 19, 24, 0.2);
    }
    .footer {
      background-color: #F3F4F6;
      padding: 20px 36px;
      text-align: center;
      border-top: 1px solid #E5E7EB;
    }
    .footer p {
      margin: 4px 0;
      font-size: 11px;
      color: #9CA3AF;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div>
          <span class="brand-mark">Y</span>
          <span class="brand-title">Yugam</span>
          <span class="brand-subtitle">Institutional Assessment & Placement Platform</span>
        </div>
        <div>
          <span class="status-pill">${escapeHtml(badgeText)}</span>
        </div>
      </div>

      <div class="banner">
        <h1>${escapeHtml(bannerTitle)}</h1>
        <p>Dear <strong>${safeRecipientName}</strong>, ${escapeHtml(bannerSub)}</p>
      </div>

      <div class="details-box">
        <table class="details-table">
          <tr>
            <td class="label">Target Role</td>
            <td class="value">${safeRole}</td>
          </tr>
          <tr>
            <td class="label">Interview Format</td>
            <td class="value">${safeFormatTitle} (${safeCategory})</td>
          </tr>
          <tr>
            <td class="label">Scheduled Timing</td>
            <td class="value" style="color: #059669;">${escapeHtml(formattedDateTime)}</td>
          </tr>
          <tr>
            <td class="label">Duration</td>
            <td class="value">${safeDuration}</td>
          </tr>
          ${
            isLive
              ? `<tr><td class="label">Faculty Trainer</td><td class="value">${safeTrainer}</td></tr>`
              : ""
          }
          <tr>
            <td class="label">Institution / Section</td>
            <td class="value">${safeCollege} (Section ${safeSection})</td>
          </tr>
        </table>
      </div>

      ${
        safeInstructions
          ? `
      <div class="instructions-box">
        <h3>Trainer Instructions</h3>
        <p>${safeInstructions}</p>
      </div>`
          : ""
      }

      <div class="instructions-box" style="background-color: #EFF6FF; border-left-color: #3B82F6;">
        <h3 style="color: #1E40AF;">Preparation Guidance</h3>
        <p style="color: #1D4ED8;">${escapeHtml(preparationGuidance)}</p>
      </div>

      <div class="cta-area">
        <a href="${escapeHtml(dashboardUrl)}" class="cta-button" target="_blank">
          Open Yugam Dashboard →
        </a>
      </div>

      <div class="footer">
        <p>This is an automated notification from the Yugam Campus Placement Platform.</p>
        <p>${safeCollege} • Placement & Assessment Division</p>
      </div>
    </div>
  </div>
</body>
</html>
`.trim();

  return { subject, htmlContent, textContent };
}
