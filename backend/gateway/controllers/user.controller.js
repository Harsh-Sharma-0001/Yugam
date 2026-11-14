
import redis from "../../shared/redis/redis.js";

export const getCurrentUser = async (req, res) => {
    try {
        const sessionId = req.cookies?.session;
        const userId = req.user?.userId;

        let currentUser = req.user;

        if (userId) {
            const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:8001";
            const internalSecret = process.env.INTERNAL_SERVICE_SECRET;

            try {
                const response = await fetch(`${authServiceUrl}/internal/user/${userId}`, {
                    method: "GET",
                    headers: {
                        "x-internal-service-key": internalSecret || "",
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data?.success && data?.user) {
                        currentUser = {
                            ...currentUser,
                            name: data.user.name || currentUser?.name,
                            email: data.user.email || currentUser?.email,
                            interviewCoin: data.user.interviewCoin,
                        };

                        // Synchronize Redis session cache so all subsequent reads are consistent
                        if (sessionId) {
                            const ttl = await redis.ttl(`session:${sessionId}`);
                            await redis.set(
                                `session:${sessionId}`,
                                JSON.stringify(currentUser),
                                "EX",
                                ttl > 0 ? ttl : 60 * 60 * 24 * 7
                            );

                            // Track sessionId in userSessions set
                            await redis.sadd(`userSessions:${userId}`, sessionId);
                            await redis.expire(`userSessions:${userId}`, 60 * 60 * 24 * 7);
                        }
                    }
                }
            } catch (authErr) {
                console.error("getCurrentUser failed to fetch authoritative user from auth service:", authErr.message);
                // Fall back gracefully to req.user from Redis session
            }
        }

        return res.status(200).json({ success: true, user: currentUser });
    } catch (error) {
        console.error("getCurrentUser error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};