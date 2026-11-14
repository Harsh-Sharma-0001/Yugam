import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("Roadmap DB Connected");
    } catch (error) {
        console.error("Roadmap MongoDB Connection Error:", error);
        throw error;
    }
};