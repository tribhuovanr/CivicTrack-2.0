import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

// Create a connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test database connection
const connectDB = async () => {
    try {
        const result = await pool.query("SELECT NOW()");

        console.log("PostgreSQL Connected Successfully!");
        console.log("Database time:", result.rows[0].now);

    } catch (error) {
        console.error("Database Connection Failed:", error.message);
        process.exit(1);
    }
};

export { pool };
export default connectDB;
