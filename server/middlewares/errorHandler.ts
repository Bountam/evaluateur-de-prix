import type { Request, Response, NextFunction } from "express";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error("Global Express Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Erreur interne du serveur backend."
  });
}
