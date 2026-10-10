import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.path.includes("/scrape/status") ||
    req.path.includes("/state") ||
    req.path.includes("/version") ||
    req.path.includes("/health"),
  message: { success: false, error: "Trop de requêtes, veuillez réessayer plus tard." }
});

export const intensiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, error: "Trop de requêtes lourdes. Ralentissez." }
});
