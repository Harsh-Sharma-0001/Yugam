import express from "express";
import { addCoins, getUserById, login, logout, useInterviewCoins } from "../controllers/auth.controller.js";
import { isInternalService } from "../middleware/internalAuth.js";

const authRouter = express.Router();

authRouter.post("/login", login);
authRouter.get("/logout", logout);
authRouter.post("/add-coins", isInternalService, addCoins);
authRouter.post("/use-coins", useInterviewCoins);
authRouter.get("/internal/user/:id", isInternalService, getUserById);

export default authRouter;