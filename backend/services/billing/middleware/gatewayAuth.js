export const verifyGatewayOrigin = (req, res, next) => {
  const gatewaySecret = req.headers["x-gateway-secret"];
  if (!process.env.GATEWAY_INTERNAL_SECRET || gatewaySecret !== process.env.GATEWAY_INTERNAL_SECRET) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Direct access to microservice is not permitted.",
    });
  }
  next();
};
