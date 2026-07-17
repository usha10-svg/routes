import express from "express";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Middleware
// Token verification removed

// Request to Join (Book Destination)
router.post("/join", verifyToken, async (req, res) => {
    try {
        const { destination, tripId, hotelId, hotelName, hotelImage, hotelAddress, price } = req.body;

        // Check if already requested for this specific trip
        const existing = await Booking.findOne({
            userId: req.user.id,
            tripId: tripId
        });

        if (existing) {
            return res.status(400).json({ message: "You already have a request for this specific trip." });
        }

        // Fetch full user details
        const currentUser = await User.findById(req.user.id);
        if (!currentUser) {
            console.error(`[BOOKING_JOIN] User with ID ${req.user.id} not found in database. Token might be stale.`);
            return res.status(401).json({ message: "[SERVER] Session invalid: User not found in DB" });
        }

        const newBooking = new Booking({
            userId: req.user.id,
            destination,
            tripId: tripId || undefined,
            hotelId,
            hotelName,
            hotelImage,
            hotelAddress,
            price,
            userName: currentUser.username,
            userEmail: currentUser.email,
            status: "pending" // Default
        });

        await newBooking.save();

        const io = req.app.get('io');

        // Always notify Organiser if exists
        if (tripId) {
            const Trip = await import("../models/Trip.js").then(m => m.default);
            const trip = await Trip.findById(tripId);
            if (trip) {
                const notif = new Notification({
                    userId: trip.userId,
                    type: "booking_request",
                    message: `New join request from ${currentUser.username} for your trip to ${destination}`,
                    link: `/organiser`
                });
                await notif.save();
                if (io) io.to(`user_${trip.userId}`).emit("new_notification", notif);
            }
        }

        res.status(201).json(newBooking);
    } catch (err) {
        console.error("BOOKING JOIN ERROR:", err); // Debug Log
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// Check Status for a specific trip/user
router.get("/status/id/:tripId", verifyToken, async (req, res) => {
    try {
        const booking = await Booking.findOne({
            userId: req.user.id,
            tripId: req.params.tripId
        });
        res.json(booking || { status: "none" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check Status for a specific destination/user (Legacy)
router.get("/status/:destination", verifyToken, async (req, res) => {
    try {
        const booking = await Booking.findOne({
            userId: req.user.id,
            destination: req.params.destination
        });
        res.json(booking || { status: "none" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get ALL Bookings for the current user
router.get("/user-bookings", verifyToken, async (req, res) => {
    try {
        const bookings = await Booking.find({ userId: req.user.id }).populate('tripId');
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Requests for Trips Created by Me
router.get("/creator-requests", verifyToken, async (req, res) => {
    try {
        // Find trips created by me
        const myTrips = await import("../models/Trip.js").then(m => m.default.find({ userId: req.user.id }).select('_id'));
        const tripIds = myTrips.map(t => t._id);

        // Find bookings for these trips
        const requests = await Booking.find({ tripId: { $in: tripIds } })
            .populate('userId', 'username email')
            .populate('tripId', 'destination');

        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// Get Approved Members for a specific Trip
router.get("/trip/:tripId/members", verifyToken, async (req, res) => {
    const { tripId } = req.params;

    // Validate ObjectId
    if (!tripId || tripId.length < 24 || !/^[0-9a-fA-F]{24}$/.test(tripId)) {
        return res.status(400).json({ message: "Invalid trip ID format" });
    }

    try {
        const members = await Booking.find({
            tripId: tripId,
            status: "approved"
        }).populate("userId", "username email avatar");
        res.json(members);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// DELETE BOOKING (User cancels their own request)
router.delete("/:id", verifyToken, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        // Ensure ownership
        if (booking.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        await Booking.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Booking cancelled successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
