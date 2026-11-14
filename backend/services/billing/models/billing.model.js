import mongoose from "mongoose";

const billingSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },

    interviewCoins: {
      type: Number,
      required: true,
    },

    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,

    status: {
      type: String,
      enum: ["created", "processing", "paid", "failed"],
      default: "created",
    },
    processingStartedAt: Date,
    paidAt: Date,
},{timestamps:true})


const Billing = mongoose.model("Billing",billingSchema)


export default Billing