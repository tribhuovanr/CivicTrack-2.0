import express from "express";
import { createComplaint } from "../controllers/complaintController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createComplaint);

export default router;