
import "dotenv/config";
import complaintRoutes from "./routes/complaintRoutes.js";
import express from "express";
import cors from "cors";

import connectDB, { pool } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";

import { protect } from "./middleware/authMiddleware.js";

const app = express();

app.use(cors({
    origin: "http://localhost:5173"
}));

app.use(express.json());
//API Routes
app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
// Health check
app.get("/api/health", (req, res) => {
    res.json({
        message: "CivicTrack Backend is running!",
        status: "success"
    });
});

// Database test
app.get("/api/db-test", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT current_database()"
        );

        res.json({
            message: "Database working successfully!",
            database: result.rows[0].current_database
        });
    } catch (error) {
        res.status(500).json({
            message: "Database query failed"
        });
    }
});


// Protected test route
app.get("/api/auth/me", protect, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, phone, role, level,
                    department_id, office
             FROM users WHERE id = $1 AND active = TRUE`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found or inactive"
            });
        }

        res.json({
            user: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            message: "Could not fetch user"
        });
    }
});

// Start server
const startServer = async () => {
    await connectDB();

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();
