import express from "express";
import {
  addCoins,
  createInternalAuditLog,
  deductFeatureCoins,
  getAuditLogs,
  getInstitutionUsers,
  getInternalStudents,
  getPendingVerifications,
  getUserById,
  login,
  logout,
  provisionUsers,
  refundFeatureCoins,
  updateProfile,
  updateUserRole,
  useInterviewCoins,
  verifyStudentAcademics,
} from "../controllers/auth.controller.js";
import { isInternalService } from "../middleware/internalAuth.js";
import { requireRole } from "../middleware/roleAuth.js";

const authRouter = express.Router();

// Public / Session Auth
authRouter.post("/login", login);
authRouter.get("/logout", logout);

// Profile Management (Authenticated user)
authRouter.put("/profile", requireRole("student", "trainer", "admin"), updateProfile);

// Governance & Academic Verification
authRouter.patch(
  "/students/:studentId/verify-academics",
  requireRole("admin", "trainer"),
  verifyStudentAcademics
);

authRouter.patch(
  "/users/:targetUserId/role",
  requireRole("admin"),
  updateUserRole
);

authRouter.post(
  "/admin/provision-users",
  requireRole("admin"),
  provisionUsers
);

// Institution Queries
authRouter.get(
  "/users",
  requireRole("admin", "trainer"),
  getInstitutionUsers
);

authRouter.get(
  "/students/pending-verifications",
  requireRole("admin", "trainer"),
  getPendingVerifications
);

authRouter.get(
  "/audit-logs",
  requireRole("admin"),
  getAuditLogs
);

// Coin Economy & Internal Endpoints
authRouter.post("/add-coins", isInternalService, addCoins);
authRouter.post("/use-coins", useInterviewCoins);
authRouter.get("/internal/user/:id", isInternalService, getUserById);
authRouter.get("/internal/institution/students", isInternalService, getInternalStudents);
authRouter.post("/internal/audit-logs", isInternalService, createInternalAuditLog);
authRouter.post("/internal/coins/deduct", isInternalService, deductFeatureCoins);
authRouter.post("/internal/coins/refund", isInternalService, refundFeatureCoins);

export default authRouter;
