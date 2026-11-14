import mongoose from "mongoose";

export const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("Auth DB Connected");
    } catch (err) {
        console.error("Error connecting to Auth MongoDB:", err);
        throw err;
    }
};