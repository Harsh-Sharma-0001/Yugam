import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("Connected DB");

    } catch (error) {
        console.error("MongoDB Connection Error:", error);
        throw error;
    }
};
