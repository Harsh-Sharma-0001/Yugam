import mongoose from "mongoose";

const liveQuestionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    studentAnswer: {
      type: String,
      default: "",
    },
    submittedCode: {
      type: String,
      default: "",
    },
    codeLanguage: {
      type: String,
      default: "javascript",
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    feedback: {
      type: String,
      default: "",
    },
  },
  { _id: true, timestamps: true }
);

const liveEvaluationSchema = new mongoose.Schema(
  {
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    criteria: {
      correctness: { type: Number, default: 0, min: 0, max: 100 },
      clarity: { type: Number, default: 0, min: 0, max: 100 },
      relevance: { type: Number, default: 0, min: 0, max: 100 },
      efficiency: { type: Number, default: 0, min: 0, max: 100 },
      communication: { type: Number, default: 0, min: 0, max: 100 },
      problemSolving: { type: Number, default: 0, min: 0, max: 100 },
    },
    strengths: {
      type: [String],
      default: [],
    },
    weaknesses: {
      type: [String],
      default: [],
    },
    summaryFeedback: {
      type: String,
      default: "",
    },
    evaluatedBy: {
      type: String,
      default: "",
    },
    evaluatedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const liveInterviewSchema = new mongoose.Schema(
  {
    institutionId: {
      type: String,
      required: true,
      index: true,
      default: "DEFAULT_COLLEGE",
    },
    scheduledInterviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ScheduledInterview",
      unique: true,
      sparse: true,
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
    status: {
      type: String,
      enum: ["waiting", "in-progress", "completed", "cancelled"],
      default: "waiting",
      index: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    questions: {
      type: [liveQuestionSchema],
      default: [],
    },
    sharedCode: {
      language: { type: String, default: "javascript" },
      content: { type: String, default: "" },
      lastOutput: { type: String, default: "" },
    },
    trainerPrivateNotes: {
      type: String,
      default: "",
      // Important: Must be stripped from student-facing responses
    },
    evaluation: {
      type: liveEvaluationSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

liveInterviewSchema.index({ institutionId: 1, status: 1 });
liveInterviewSchema.index({ institutionId: 1, studentId: 1, status: 1 });
liveInterviewSchema.index({ institutionId: 1, trainerId: 1, status: 1 });

const LiveInterview = mongoose.model("LiveInterview", liveInterviewSchema);

export default LiveInterview;
