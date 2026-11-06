
import "dotenv/config";
import fs from "node:fs/promises";
import { pool } from "../config/db.js";

async function runMigration() {
    try {
        const sql = await fs.readFile(
            new URL("../migrations/001_initial_schema.sql", import.meta.url),
            "utf8"
        );

        await pool.query(sql);

        console.log("================================");
        console.log("CivicTrack database setup complete!");
        console.log("All tables created successfully.");
        console.log("Departments seeded successfully.");
        console.log("================================");

    } catch (error) {
        console.error("Migration failed:", error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
