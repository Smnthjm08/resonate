import { Router } from "express";
import {
  guestUserSignup,
  userSignup,
  userSignin,
} from "../controllers/auth.controller";

export const authRouter: Router = Router();

authRouter.post("/guest", guestUserSignup);
authRouter.post("/signup", userSignup);
authRouter.post("/signin", userSignin);

export default authRouter;
