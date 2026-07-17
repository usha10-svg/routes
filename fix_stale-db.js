import mongoose from "mongoose";
import dotenv from "dotenv";
import Trip from "./models/Trip.js";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_GEMINI_AI_API_KEY || "YOUR_KEY");

const fixTrips = async () => {
    try {
        console.log("Connecting to DB...");
        await mongoose.connect(process.env.MONGO_URI);

        const trips = await Trip.find({
            $or: [
                { "tripData.itinerary.places.placeName": /Local Attraction/i },
                { "tripData.itinerary.places.placeName": /Activity/i }
            ]
        });

        console.log(`Found ${trips.length} trips with placeholders.`);

        for (const trip of trips) {
            console.log(`Fixing trip: ${trip.destination} (${trip._id})`);

            const prompt = `
                The following trip itinerary for ${trip.destination} (${trip.duration} days) has placeholders like "Local Attraction".
                Please replace these placeholders with ACTUAL REAL LANDMARKS and tourist spots in ${trip.destination}.
                Keep the same budget theme: ${trip.budget}.
                
                Current (Broken) Itinerary JSON:
                ${JSON.stringify(trip.tripData.itinerary)}
                
                Return ONLY a valid JSON array of the updated itinerary.
            `;

            try {
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const result = await model.generateContent(prompt);
                let text = result.response.text();
                text = text.replace(/```json/g, "").replace(/```/g, "").trim();
                const newItinerary = JSON.parse(text);

                trip.tripData.itinerary = newItinerary;
                trip.markModified('tripData');
                await trip.save();
                console.log("✅ Fixed!");
            } catch (err) {
                console.error("Failed to fix trip", trip._id, err.message);
            }
        }

        console.log("Cleanup complete.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

fixTrips();
