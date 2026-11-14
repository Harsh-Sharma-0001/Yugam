import mongoose from "mongoose";

const taskSubmissionSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
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
    submissionText: {
      type: String,
      default: "",
      trim: true,
    },
    submissionLink: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["submitted", "reviewed"],
      default: "submitted",
      index: true,
    },
    trainerRemarks: {
      type: String,
      default: "",
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce one submission record per student per task (upsertable)
taskSubmissionSchema.index({ taskId: 1, studentId: 1 }, { unique: true });

const TaskSubmission = mongoose.model("TaskSubmission", taskSubmissionSchema);

export default TaskSubmission;
