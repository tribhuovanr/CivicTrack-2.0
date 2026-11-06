
import { pool } from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            role: user.role,
            level: user.level
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );
};

// REGISTER CITIZEN
export const register = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name?.trim() || !email?.trim() || !phone?.trim() || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must contain at least 6 characters"
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE LOWER(email) = $1",
            [cleanEmail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users
            (name, email, phone, password_hash, role)
            VALUES ($1, $2, $3, $4, 'citizen')
            RETURNING id, name, email, phone, role, created_at`,
            [name.trim(), cleanEmail, phone.trim(), passwordHash]
        );

        const user = result.rows[0];
        const token = generateToken(user);

        return res.status(201).json({
            message: "Registration successful",
            token,
            user
        });

    } catch (error) {
        console.error("Registration error:", error.message);

        return res.status(500).json({
            message: "Registration failed"
        });
    }
};


// LOGIN CITIZEN / OFFICER
export const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({
                message: "Email, password and role are required"
            });
        }

        if (!["citizen", "officer"].includes(role)) {
            return res.status(400).json({
                message: "Invalid role"
            });
        }

        const result = await pool.query(
            `SELECT * FROM users
             WHERE LOWER(email) = $1 AND role = $2`,
            [email.trim().toLowerCase(), role]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        if (!user.active) {
            return res.status(403).json({
                message: "Your account has been deactivated"
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = generateToken(user);

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                level: user.level,
                department_id: user.department_id,
                office: user.office
            }
        });

    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            message: "Login failed"
        });
    }
};
