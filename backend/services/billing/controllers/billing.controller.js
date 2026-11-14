import razorpay from "../configs/razorpay.js";
import Billing from "../models/billing.model.js";
import crypto from "crypto"



const PLANS = {
    starter: {
        amount: 199,
        interviewCoins: 300,
    },
};

export const createOrder = async (req, res) => {
    try {
        const { planId } = req.body
        const userId = req.headers["x-user-id"]
        const plan = PLANS[planId]

        if (!plan) {
            return res.status(400).json({
                success: false,
                message: "Invalid plan",
            });
        }

        const order = await razorpay.orders.create({
            amount: plan.amount * 100,
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
        })

        await Billing.create({
            userId,
            amount: plan.amount,
            interviewCoins: plan.interviewCoins,
            razorpayOrderId: order.id,
            status: "created",
        })

        return res.status(201).json({
            success: true,
            order,
        })

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: "Failed to create order",
        });
    }
}

export const verifyPayment = async (req, res) => {
    try {
        const userId = req.headers["x-user-id"];
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Missing user authentication",
            });
        }

        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Missing payment verification parameters",
            });
        }

        // Query stored order record using both razorpayOrderId and authenticated userId
        const existingOrder = await Billing.findOne({
            razorpayOrderId: razorpay_order_id,
            userId,
        });

        if (!existingOrder) {
            return res.status(404).json({
                success: false,
                message: "Order not found or does not belong to the authenticated user.",
            });
        }

        // Step A — Signature Check: Verify HMAC signature using stored existingOrder.razorpayOrderId
        const genSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${existingOrder.razorpayOrderId}|${razorpay_payment_id}`)
            .digest("hex");

        if (genSign !== razorpay_signature) {
            // Scope failed status update strictly to existingOrder and userId in created status
            await Billing.findOneAndUpdate(
                { _id: existingOrder._id, userId, status: "created" },
                { status: "failed" }
            );
            return res.status(400).json({
                success: false,
                message: "Payment verification failed",
            });
        }

        // Step B — Check Already Paid
        if (existingOrder.status === "paid") {
            return res.status(200).json({
                success: true,
                message: "Payment already verified and credited.",
            });
        }

        // Step C — Atomic Lock (created / stale processing -> processing, with 30s stale recovery)
        const staleThreshold = new Date(Date.now() - 30 * 1000);
        const payment = await Billing.findOneAndUpdate(
            {
                _id: existingOrder._id,
                userId,
                $or: [
                    { status: "created" },
                    { status: "processing", processingStartedAt: { $lt: staleThreshold } }
                ]
            },
            {
                $set: {
                    status: "processing",
                    processingStartedAt: new Date(),
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature,
                }
            },
            { new: true }
        );

        if (!payment) {
            return res.status(202).json({
                success: false,
                message: "Payment verification is currently in progress. Please retry shortly.",
            });
        }

        // Step D — Idempotent Credit Call to Auth Service
        const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:8001";
        const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
        const sessionId = req.headers["x-session-id"] || req.cookies?.session;

        let authData;
        try {
            const authRes = await fetch(`${authServiceUrl}/add-coins`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-internal-service-key": internalSecret || "",
                },
                body: JSON.stringify({
                    userId: String(payment.userId),
                    amount: payment.interviewCoins,
                    idempotencyKey: existingOrder.razorpayOrderId,
                    sessionId: sessionId || undefined,
                }),
            });

            if (!authRes.ok) {
                const errorText = await authRes.text();
                throw new Error(`Auth service returned ${authRes.status}: ${errorText}`);
            }

            authData = await authRes.json();
        } catch (authError) {
            console.error("Failed to credit coins in Auth Service:", authError.message);
            // Do NOT roll back to "created" - leave in "processing" for safe retry after lock window
            return res.status(502).json({
                success: false,
                message: "Payment processing error with coin credit. Please retry shortly or contact support.",
            });
        }

        // Step E — Finalize to "paid"
        await Billing.findOneAndUpdate(
            { _id: payment._id, userId },
            {
                $set: {
                    status: "paid",
                    paidAt: new Date(),
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: "Payment verified and coins credited successfully",
            interviewCoin: authData?.interviewCoin,
        });
    } catch (error) {
        console.error("verifyPayment error:", error);
        return res.status(500).json({
            success: false,
            message: "Payment verification failed",
        });
    }
};
