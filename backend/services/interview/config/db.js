import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("Interview DB Connected");
    } catch (error) {
        console.error("Interview MongoDB Connection Error:", error);
        throw error;
    }
};