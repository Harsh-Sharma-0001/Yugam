import mongoose from "mongoose";

const academicRecordSchema = new mongoose.Schema(
  {
    tenthPercentage: { type: Number, min: 0, max: 100 },
    twelfthPercentage: { type: Number, min: 0, max: 100 },
  },
  { _id: false }
);

const pendingAcademicUpdateSchema = new mongoose.Schema(
  {
    currentCGPA: { type: Number, min: 0, max: 10 },
    semester: { type: Number, min: 1, max: 12 },
    year: { type: Number, min: 1, max: 6 },
    tenthPercentage: { type: Number, min: 0, max: 100 },
    twelfthPercentage: { type: Number, min: 0, max: 100 },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userProfileSchema = new mongoose.Schema(
  {
    // Student-specific profile fields
    rollNumber: { type: String, trim: true },
    collegeName: { type: String, trim: true },
    course: { type: String, trim: true }, // e.g. "B.Tech CSE"
    year: { type: Number, min: 1, max: 6 },
    semester: { type: Number, min: 1, max: 12 },
    section: { type: String, trim: true }, // e.g. "CSE-A"
    currentCGPA: { type: Number, min: 0, max: 10 },
    academics: { type: academicRecordSchema, default: () => ({}) },
    academicVerificationStatus: {
      type: String,
      enum: ["verified", "pending", "unsubmitted"],
      default: "unsubmitted",
    },
    pendingAcademicUpdate: {
      type: pendingAcademicUpdateSchema,
      default: null,
    },
    contactNumber: { type: String, trim: true },
    resumeUrl: { type: String, trim: true },

    // Trainer-specific profile fields
    employeeId: { type: String, trim: true },
    department: { type: String, trim: true },
    designation: { type: String, trim: true },
    specializations: { type: [String], default: [] },
    yearsOfExperience: { type: Number, min: 0 },
    bio: { type: String, trim: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    role: {
      type: String,
      enum: ["student", "trainer", "admin"],
      default: "student",
      index: true,
    },

    institutionId: {
      type: String,
      default: "DEFAULT_COLLEGE",
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "suspended", "pending"],
      default: "active",
      index: true,
    },

    permissions: {
      type: [String],
      default: [],
    },

    profile: {
      type: userProfileSchema,
      default: () => ({}),
    },

    interviewCoin: {
      type: Number,
      default: 150,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userSchema.index({ institutionId: 1, "profile.rollNumber": 1 });
userSchema.index({ institutionId: 1, role: 1 });

const User = mongoose.model("User", userSchema);

export default User;
