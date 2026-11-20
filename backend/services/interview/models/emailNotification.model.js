import mongoose from "mongoose";

const emailNotificationSchema = new mongoose.Schema(
  {
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    scheduledInterviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ScheduledInterview",
      required: true,
      index: true,
    },
    institutionId: {
      type: String,
      required: true,
      index: true,
    },
    recipientStudentId: {
      type: String,
      required: true,
    },
    recipientName: {
      type: String,
      default: "Student",
    },
    recipientEmail: {
      type: String,
      required: true,
    },
    notificationType: {
      type: String,
      enum: ["INTERVIEW_SCHEDULED", "INTERVIEW_RESCHEDULED", "INTERVIEW_CANCELLED"],
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: "pending",
      index: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    nextRetryAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastError: {
      type: String,
      default: null,
    },
    providerMessageId: {
      type: String,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

emailNotificationSchema.index({ status: 1, nextRetryAt: 1, attemptCount: 1 });
emailNotificationSchema.index({ institutionId: 1, scheduledInterviewId: 1 });

const EmailNotification = mongoose.model("EmailNotification", emailNotificationSchema);

export default EmailNotification;
