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

        // Verify Razorpay HMAC signature
        const genSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (genSign !== razorpay_signature) {
            await Billing.findOneAndUpdate(
                { razorpayOrderId: razorpay_order_id },
                { status: "failed" }
            );
            return res.status(400).json({
                success: false,
                message: "Payment verification failed",
            });
        }

        // Atomic idempotent transition: only transition if status is not 'paid'
        const payment = await Billing.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id, status: { $ne: "paid" } },
            {
                $set: {
                    status: "paid",
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature,
                    paidAt: new Date(),
                },
            },
            { new: true }
        );

        if (!payment) {
            return res.status(200).json({
                success: true,
                message: "Payment already verified and credited.",
            });
        }

        // Internal service-to-service call to Auth Service to credit interview coins
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
            // Revert payment status back to 'created' so user is not stuck with paid status and 0 coins
            await Billing.findByIdAndUpdate(payment._id, { status: "created" });
            return res.status(502).json({
                success: false,
                message: "Failed to credit coins. Please contact support.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Payment verified and coins credited successfully",
            interviewCoin: authData?.interviewCoin,
        });
    } catch (error) {
        console.error("verifyPayment error:", error);

        if (req.body?.razorpay_order_id) {
            await Billing.findOneAndUpdate(
                { razorpayOrderId: req.body.razorpay_order_id },
                { status: "failed" }
            );
        }

        return res.status(500).json({
            success: false,
            message: "Payment verification failed",
        });
    }
};
