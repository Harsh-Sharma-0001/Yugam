import crypto from "crypto";

export const deductCoins = async ({ userId, action, reservationId = crypto.randomUUID(), sessionId }) => {
  const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:8001";
  const internalSecret = process.env.INTERNAL_SERVICE_SECRET;

  const response = await fetch(`${authServiceUrl}/internal/coins/deduct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-service-key": internalSecret || "",
    },
    body: JSON.stringify({
      userId,
      action,
      reservationId,
      sessionId,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Failed to deduct coins");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return { ...data, reservationId };
};

export const refundCoins = async ({ userId, action, reservationId, sessionId }) => {
  try {
    const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:8001";
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET;

    const response = await fetch(`${authServiceUrl}/internal/coins/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-key": internalSecret || "",
      },
      body: JSON.stringify({
        userId,
        action,
        reservationId,
        sessionId,
      }),
    });

    const data = await response.json().catch(() => ({}));
    return data;
  } catch (err) {
    console.error(`Automatic coin refund error for reservation ${reservationId}:`, err);
    return null;
  }
};
