import mongoose from "mongoose";

// Education sub-schema
const educationSchema = new mongoose.Schema(
  {
    degree: {
      type: String,
      default: "",
    },
    institution: {
      type: String,
      default: "",
    },
    dates: {
      type: String,
      default: "",
    },
    cgpa: {
      type: String,
      default: "",
    },
    percentage: {
      type: String,
      default: "",
    },
    coursework: {
      type: [String],
      default: [],
    },
  },
  { _id: false },
);

// Experience sub-schema
const experienceSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      default: "",
    },
    company: {
      type: String,
      default: "",
    },
    dates: {
      type: String,
      default: "",
    },
    responsibilities: {
      type: [String],
      default: [],
    },
  },
  { _id: false },
);

// Project sub-schema
const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    technologies: {
      type: [String],
      default: [],
    },
  },
  { _id: false },
);

const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },

    extractedText: {
      type: String,
      required: true,
    },

    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    summary: {
      type: String,
      default: "",
    },

    name: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
    },

    education: {
      type: [educationSchema],
      default: [],
    },

    skills: {
      type: [String],
      default: [],
    },

    projects: {
      type: [projectSchema],
      default: [],
    },

    experience: {
      type: [experienceSchema],
      default: [],
    },

    strengths: {
      type: [String],
      default: [],
    },

    weaknesses: {
      type: [String],
      default: [],
    },

    targetRole: {
      type: String,
      default: "",
    },

    roleSkillAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    missingSkills: {
      type: [String],
      default: [],
    },

    suggestedRole: {
      type: String,
      default: "",
    },

    recommendations: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

const Resume = mongoose.model("Resume", resumeSchema);

export default Resume;
