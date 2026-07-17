import express from "express";
import User from "../models/User.js";
import Trip from "../models/Trip.js";
import Booking from "../models/Booking.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();









// UPDATE PROFILE
router.put("/profile", verifyToken, async (req, res) => {
    try {
        const { bio, phone, avatar, username } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) return res.status(404).json({ message: "[USERS] User not found" });

        // Update fields
        if (bio !== undefined) user.bio = bio;
        if (phone !== undefined) user.phone = phone;
        if (avatar !== undefined) user.avatar = avatar;
        if (username !== undefined) user.username = username;

        await user.save();

        // Return updated user info without password
        const { password, ...userInfo } = user._doc;
        res.json(userInfo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET PROFILE
router.get("/profile", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) return res.status(404).json({ message: "[USERS] User not found" });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CHANGE PASSWORD
router.put("/change-password", verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) return res.status(404).json({ message: "[USERS] User not found" });

        // Verify current password
        const bcrypt = await import("bcryptjs"); // Dynamic import to avoid top-level if not present
        const isMatch = await bcrypt.default.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: "Incorrect current password" });

        // Hash new password
        const salt = await bcrypt.default.genSalt(10);
        user.password = await bcrypt.default.hash(newPassword, salt);

        await user.save();
        res.json({ message: "Password updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// TOGGLE FAVORITE TRIP
router.post("/favorites/:tripId", verifyToken, async (req, res) => {
    try {
        const { tripId } = req.params;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "[USERS] User not found" });

        const index = user.favorites.indexOf(tripId);
        if (index > -1) {
            user.favorites.splice(index, 1); // Remove if exists
        } else {
            user.favorites.push(tripId); // Add if doesn't
        }

        await user.save();
        res.json({ favorites: user.favorites });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET USER BY ID (Public info)
router.get("/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("username email avatar role bio");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
