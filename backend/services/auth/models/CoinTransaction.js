import mongoose from "mongoose";

const coinTransactionSchema = new mongoose.Schema({
  idempotencyKey: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ["PURCHASE_CREDIT", "INTERVIEW_DEDUCTION", "FEATURE_DEDUCTION", "FEATURE_REFUND", "BONUS"],
    default: "PURCHASE_CREDIT",
  },
  balanceAfter: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const CoinTransaction = mongoose.model("CoinTransaction", coinTransactionSchema);

export default CoinTransaction;
