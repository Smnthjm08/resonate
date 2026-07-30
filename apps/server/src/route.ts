import type { Request, Response } from "express";

export const healthRoute = (req: Request, res: Response) => {
  res.status(200).json({ message: "hello" });
};
