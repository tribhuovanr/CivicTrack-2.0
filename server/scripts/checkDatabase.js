
import "dotenv/config";
import { pool } from "../config/db.js";

try {
    const result = await pool.query(`
        SELECT
            table_name,
            column_name,
            data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
    `);

    console.log("\n===== CIVICTRACK DATABASE =====\n");

    if (result.rows.length === 0) {
        console.log("No tables found.");
    } else {
        let currentTable = "";

        for (const row of result.rows) {
            if (currentTable !== row.table_name) {
                currentTable = row.table_name;
                console.log(`\nTABLE: ${currentTable}`);
            }

            console.log(`  - ${row.column_name} (${row.data_type})`);
        }
    }

} catch (error) {
    console.error("Database inspection failed:", error.message);
} finally {
    await pool.end();
}
