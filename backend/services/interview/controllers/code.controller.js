import { validateCodeboxPayload } from "../utils/codebox.js";
import redis from "../../../shared/redis/redis.js";

const getCodeboxConfig = () => {
  const codeboxUrl = (process.env.CODEBOX_URL || "http://localhost:3000").replace(/\/+$/, "");
  const codeboxToken = process.env.CODEBOX_AUTH_TOKEN;
  if (!codeboxToken) {
    const error = new Error("Code execution engine is not configured (missing CODEBOX_AUTH_TOKEN).");
    error.statusCode = 503;
    throw error;
  }
  return { codeboxUrl, codeboxToken };
};

const isConnectionError = (error) => {
  return (
    error?.code === "ECONNREFUSED" ||
    error?.cause?.code === "ECONNREFUSED" ||
    error?.message?.toLowerCase().includes("fetch failed") ||
    error?.message?.toLowerCase().includes("econnrefused")
  );
};

export const runCode = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing user credentials.",
      });
    }

    // Per-user execution rate limiting: 15 runs per minute
    const rateLimitKey = `ratelimit:code:${userId}`;
    const currentCount = await redis.incr(rateLimitKey);
    if (currentCount === 1) {
      await redis.expire(rateLimitKey, 60);
    }
    if (currentCount > 15) {
      const ttl = await redis.ttl(rateLimitKey);
      return res.status(429).json({
        success: false,
        message: `Too many code execution requests. Rate limit is 15 executions per minute. Please try again in ${ttl > 0 ? ttl : 60} seconds.`,
      });
    }

    const { language, source_code, stdin } = req.body || {};

    const validation = validateCodeboxPayload({
      language,
      source_code,
      stdin,
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const { codeboxUrl, codeboxToken } = getCodeboxConfig();

    const response = await fetch(`${codeboxUrl}/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": codeboxToken,
      },
      body: JSON.stringify({
        source_code: validation.source_code,
        language_id: validation.language_id,
        stdin: validation.stdin || "",
      }),
    });

    if (!response.ok) {
      let errData = {};
      try {
        errData = await response.json();
      } catch {
        // ignore json parse error on non-json error responses
      }
      return res.status(response.status).json({
        success: false,
        message:
          errData.error ||
          errData.message ||
          `Code execution runner returned HTTP ${response.status}`,
      });
    }

    const data = await response.json();

    if (!data?.token) {
      return res.status(502).json({
        success: false,
        message: "Code execution service did not return an execution token",
      });
    }

    // Bind execution token to userId in Redis for 1 hour (3600 seconds)
    await redis.set(`codebox:token:${data.token}`, String(userId), "EX", 3600);

    return res.status(200).json({
      success: true,
      token: data.token,
    });
  } catch (error) {
    console.error("Code execution runCode error:", error);

    if (error?.statusCode === 503 || isConnectionError(error)) {
      return res.status(503).json({
        success: false,
        message: error?.statusCode === 503 ? error.message : "Code execution engine is currently unavailable.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to submit code for execution.",
    });
  }
};

export const getExecutionStatus = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing user credentials.",
      });
    }

    const token = req.params?.token;

    if (!token || typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: "A valid execution token is required.",
      });
    }

    const cleanToken = token.trim();

    // Verify token ownership
    const ownerId = await redis.get(`codebox:token:${cleanToken}`);
    if (!ownerId || ownerId !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Execution token does not belong to you.",
      });
    }

    const { codeboxUrl, codeboxToken } = getCodeboxConfig();

    const response = await fetch(
      `${codeboxUrl}/submissions/${encodeURIComponent(cleanToken)}`,
      {
        method: "GET",
        headers: {
          "X-Auth-Token": codeboxToken,
        },
      }
    );

    if (response.status === 404) {
      return res.status(404).json({
        success: false,
        message: "Execution token not found.",
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `Execution status query failed with HTTP ${response.status}.`,
      });
    }

    const data = await response.json();

    return res.status(200).json({
      success: true,
      status: data.status || null,
      stdout: data.stdout || "",
      stderr: data.stderr || "",
      compile_output: data.compile_output || "",
      time: data.time ?? null,
      memory: data.memory ?? null,
      exit_code: data.exit_code !== undefined ? data.exit_code : null,
    });
  } catch (error) {
    console.error("Code execution getExecutionStatus error:", error);

    if (error?.statusCode === 503 || isConnectionError(error)) {
      return res.status(503).json({
        success: false,
        message: error?.statusCode === 503 ? error.message : "Code execution engine is currently unavailable.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to retrieve execution status.",
    });
  }
};

