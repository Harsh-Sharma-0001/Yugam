import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    institutionId: {
      type: String,
      required: true,
      index: true,
      default: "DEFAULT_COLLEGE",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    targetType: {
      type: String,
      enum: ["INDIVIDUAL", "SECTION", "ALL_STUDENTS"],
      default: "ALL_STUDENTS",
      index: true,
    },
    targetSection: {
      type: String,
      trim: true,
      default: "",
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
      },
    ],
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    assignedByName: {
      type: String,
      default: "Instructor",
    },
    assignedByRole: {
      type: String,
      enum: ["trainer", "admin"],
      default: "trainer",
    },
    dueDate: {
      type: Date,
      default: null,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
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

taskSchema.index({ institutionId: 1, createdAt: -1 });

const Task = mongoose.model("Task", taskSchema);

export default Task;
