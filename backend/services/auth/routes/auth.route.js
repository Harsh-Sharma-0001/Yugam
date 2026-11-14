import express from "express";
import {
  addCoins,
  deductFeatureCoins,
  getUserById,
  login,
  logout,
  refundFeatureCoins,
  useInterviewCoins,
} from "../controllers/auth.controller.js";
import { isInternalService } from "../middleware/internalAuth.js";

const authRouter = express.Router();

authRouter.post("/login", login);
authRouter.get("/logout", logout);
authRouter.post("/add-coins", isInternalService, addCoins);
authRouter.post("/use-coins", useInterviewCoins);
authRouter.get("/internal/user/:id", isInternalService, getUserById);
authRouter.post("/internal/coins/deduct", isInternalService, deductFeatureCoins);
authRouter.post("/internal/coins/refund", isInternalService, refundFeatureCoins);

export default authRouter;