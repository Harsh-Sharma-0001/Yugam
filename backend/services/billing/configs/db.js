import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("Billing DB Connected");
    } catch (error) {
        console.error("Billing MongoDB Connection Error:", error);
        throw error;
    }
};