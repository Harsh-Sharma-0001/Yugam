import redis from "../../../shared/redis/redis.js";

/**
 * Middleware factory enforcing role-based access control (RBAC) in interview service.
 * Supports identity passed via Gateway trusted headers (x-gateway-secret + x-user-role)
 * or resolved directly from the Redis session.
 *
 * @param  {...string} allowedRoles Roles permitted to access the route ("student", "trainer", "admin")
 */
export const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      let userId = req.headers["x-user-id"];
      let role = req.headers["x-user-role"];
      let institutionId = req.headers["x-institution-id"];
      const gatewaySecret = req.headers["x-gateway-secret"];

      const isGatewayTrusted =
        Boolean(process.env.GATEWAY_INTERNAL_SECRET) &&
        gatewaySecret === process.env.GATEWAY_INTERNAL_SECRET;

      if (!isGatewayTrusted || !userId || !role) {
        const sessionId = req.cookies?.session || req.headers["x-session-id"];
        if (!sessionId) {
          return res.status(401).json({
            success: false,
            message: "Unauthorized: Active session required.",
          });
        }

        const rawSession = await redis.get(`session:${sessionId}`);
        if (!rawSession) {
          return res.status(401).json({
            success: false,
            message: "Unauthorized: Session expired or invalid.",
          });
        }

        const sessionData = JSON.parse(rawSession);
        userId = sessionData.userId;
        role = sessionData.role || "student";
        institutionId = sessionData.institutionId || "DEFAULT_COLLEGE";
        req.userName = sessionData.name || "User";
        req.userSection = sessionData.profile?.section || "";
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: Invalid identity.",
        });
      }

      req.userId = String(userId);
      req.userRole = role || "student";
      req.institutionId = institutionId || "DEFAULT_COLLEGE";

      if (allowedRoles.length > 0 && !allowedRoles.includes(req.userRole)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Role '${req.userRole}' does not have access to this resource.`,
        });
      }

      next();
    } catch (error) {
      console.error("interview requireRole error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during authorization.",
      });
    }
  };
};

export const requireAuth = requireRole();
