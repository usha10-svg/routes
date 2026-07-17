import express from "express";
import mongoose from "mongoose";
import Trip from "../models/Trip.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Message from "../models/Message.js";
import jwt from "jsonwebtoken";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();



// CREATE TRIP
router.post("/", verifyToken, async (req, res) => {
    try {
        const { tripData, destination, duration, budget, capacity, price, requestOrganiser, startDate, endDate } = req.body;

        const newTrip = new Trip({
            userId: req.user.id,
            tripData,
            destination,
            duration,
            budget,
            capacity: capacity || 10,
            price,
            status: "approved", // Auto-approve as Admin is removed
            isPublic: req.body.isPublic !== undefined ? req.body.isPublic : true,
            requestOrganiser: requestOrganiser || false,
            startDate,
            endDate
        });

        const savedTrip = await newTrip.save();
        res.status(201).json(savedTrip);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET USER TRIPS
router.get("/user-trips", verifyToken, async (req, res) => {
    try {
        const trips = await Trip.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(trips);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET ALL APPROVED TRIPS (SEARCH/FILTER) - Public
router.get("/", async (req, res) => {
    try {
        const { query, minDays, maxDays, budget } = req.query;
        let filter = { isPublic: true, status: "approved" }; // Only approved trips

        if (query) {
            filter.destination = { $regex: query, $options: "i" };
        }
        if (minDays || maxDays) {
            filter.duration = {};
            if (minDays) filter.duration.$gte = Number(minDays);
            if (maxDays) filter.duration.$lte = Number(maxDays);
        }
        if (budget) {
            filter.budget = budget;
        }

        const trips = await Trip.find(filter).sort({ createdAt: -1 });
        res.status(200).json(trips);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// UPDATE TRIP (OWNER ONLY)
router.put("/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { destination, budget, duration, capacity, price, status, terms, packageNotes, isBooked, isPublic, selectedHotel, startDate, endDate } = req.body;

        const trip = await Trip.findById(id);
        if (!trip) return res.status(404).json({ message: "Trip not found" });

        // Security check
        if (trip.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized: You don't own this trip" });
        }

        // Update fields if provided
        if (destination) trip.destination = destination;
        if (budget) trip.budget = budget;
        if (duration) trip.duration = Number(duration);
        if (capacity) trip.capacity = Number(capacity);
        if (price !== undefined) trip.price = Number(price);
        if (status) trip.status = status;
        if (terms) trip.terms = terms;
        if (packageNotes) trip.packageNotes = packageNotes;
        if (isBooked !== undefined) trip.isBooked = isBooked;
        if (isPublic !== undefined) trip.isPublic = isPublic;
        if (selectedHotel !== undefined) trip.selectedHotel = selectedHotel;
        if (startDate) trip.startDate = startDate;
        if (endDate) trip.endDate = endDate;

        const updatedTrip = await trip.save();
        res.json(updatedTrip);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET TRIP BY ID (PUBLIC/SHARED)
router.get("/:id", async (req, res) => {
    const { id } = req.params;

    // Validate ObjectId to prevent 500 CastError
    if (!id || id.length < 24 || !/^[0-9a-fA-F]{24}$/.test(id)) {
        console.warn(`[GET_TRIP] Invalid ID format received: ${id}`);
        return res.status(400).json({ message: "Invalid trip ID format" });
    }

    try {
        const trip = await Trip.findById(id);
        if (!trip) {
            console.warn(`[GET_TRIP] Trip ${id} not found`);
            return res.status(404).json({ message: "Trip not found" });
        }

        res.status(200).json(trip);
    } catch (err) {
        console.error(`[GET_TRIP] Server Error for ID ${id}:`, err.message);
        res.status(500).json({ error: "Internal server error" });
    }
});


// DELETE TRIP (ADMIN OR OWNER)
router.delete("/:id", verifyToken, async (req, res) => {
    const tripId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`[DELETE_TRIP] Request for ID: ${tripId} by User: ${userId} (${userRole})`);

    try {
        const trip = await Trip.findById(tripId);

        if (!trip) {
            console.warn(`[DELETE_TRIP] Trip ${tripId} not found`);
            return res.status(404).json({ message: "Trip not found" });
        }

        // Check permissions: Owner only
        const isOwner = trip.userId.toString() === userId;

        if (!isOwner) {
            console.warn(`[DELETE_TRIP] Unauthorized attempt on ${tripId} by ${userId}`);
            return res.status(403).json({ message: "Unauthorized: You don't own this trip" });
        }

        // Perform deletion
        await Trip.findByIdAndDelete(tripId);
        console.log(`[DELETE_TRIP] Trip ${tripId} deleted from MongoDB`);

        // Cascade delete: Remove all bookings for this trip
        const bookingDeleteResult = await Booking.deleteMany({ tripId: new mongoose.Types.ObjectId(tripId) });
        console.log(`[DELETE_TRIP] Cascade deleted ${bookingDeleteResult.deletedCount} bookings`);

        // Cascade delete: Remove all messages for this trip
        const messageDeleteResult = await Message.deleteMany({ tripId: new mongoose.Types.ObjectId(tripId) });
        console.log(`[DELETE_TRIP] Cascade deleted ${messageDeleteResult.deletedCount} messages`);

        // Cleanup: Remove from all users' favorites
        await User.updateMany({}, { $pull: { favorites: tripId } });

        res.status(200).json({
            message: "Trip and its bookings deleted successfully",
            deletedId: tripId,
            bookingsRemoved: bookingDeleteResult.deletedCount
        });
    } catch (err) {
        console.error("[DELETE_TRIP] Server Error:", err);
        res.status(500).json({ error: "Server error during deletion", details: err.message });
    }
});

export default router;
