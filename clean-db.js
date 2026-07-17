import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Trip from "./models/Trip.js";
import Booking from "./models/Booking.js";
import Message from "./models/Message.js";
import Notification from "./models/Notification.js";

dotenv.config({ path: "./server/.env" });

const cleanDatabase = async () => {
    try {
        const uri = process.env.MONGO_URI || "mongodb://localhost:27017/travel-around";
        await mongoose.connect(uri);
        console.log("Connected to MongoDB...");

        const collections = ["users", "trips", "bookings", "messages", "notifications"];

        console.log("Cleaning collections...");

        await Promise.all([
            User.deleteMany({}),
            Trip.deleteMany({}),
            Booking.deleteMany({}),
            Message.deleteMany({}),
            Notification.deleteMany({}),
        ]);

        console.log("✅ All collections cleared successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error cleaning database:", error);
        process.exit(1);
    }
};

cleanDatabase();
