import mongoose from "mongoose";

const scheduledInterviewSchema = new mongoose.Schema(
  {
    institutionId: {
      type: String,
      required: true,
      index: true,
      default: "DEFAULT_COLLEGE",
    },
    mode: {
      type: String,
      enum: ["ai", "live"],
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    studentName: {
      type: String,
      default: "Student",
    },
    studentRollNumber: {
      type: String,
      default: "",
    },
    section: {
      type: String,
      default: "",
      trim: true,
    },
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    trainerName: {
      type: String,
      default: "Instructor",
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    interviewType: {
      type: String,
      enum: ["technical", "hr"],
      default: "technical",
    },
    experience: {
      type: String,
      default: "Fresher / Campus",
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    durationMinutes: {
      type: Number,
      default: 45,
    },
    instructions: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "in-progress", "completed", "cancelled"],
      default: "scheduled",
      index: true,
    },
    linkedInterviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Interview",
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

scheduledInterviewSchema.index({ institutionId: 1, studentId: 1, status: 1 });
scheduledInterviewSchema.index({ institutionId: 1, scheduledAt: -1 });

const ScheduledInterview = mongoose.model("ScheduledInterview", scheduledInterviewSchema);

export default ScheduledInterview;
