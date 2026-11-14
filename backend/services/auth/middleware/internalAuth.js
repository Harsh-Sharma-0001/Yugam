export const isInternalService = (req, res, next) => {
  const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
  const providedKey = req.headers["x-internal-service-key"];

  if (!internalSecret || !providedKey || providedKey !== internalSecret) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Invalid or missing internal service key.",
    });
  }

  next();
};

