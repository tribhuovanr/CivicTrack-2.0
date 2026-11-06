import { pool } from "../config/db.js";

const DEPTS = [
    "Roads and Infrastructure",
    "Waste Management",
    "Water Supply",
    "Drainage and Sanitation",
    "Street Lighting",
    "Other"
];

const zoneOf = (ward) =>
    (parseInt(ward) || 0) <= 10
        ? "North Zone Office"
        : "South Zone Office";

export const createComplaint = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            title,
            description,
            location,
            ward,
            dept,
            aiDept,
            aiConfidence,
            photo
        } = req.body;

        if (
            !title?.trim() ||
            !description?.trim() ||
            !location?.trim() ||
            !ward?.toString().trim()
        ) {
            return res.status(400).json({
                message: "All complaint fields are required"
            });
        }

        const selectedDept =
            dept || (DEPTS.includes(aiDept) ? aiDept : null);

        if (!selectedDept || !DEPTS.includes(selectedDept)) {
            return res.status(400).json({
                message: "Please select a valid department"
            });
        }

        await client.query("BEGIN");

        const departmentResult = await client.query(
            `SELECT department_id
             FROM departments
             WHERE department_name = $1`,
            [selectedDept]
        );

        if (departmentResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "Department not found"
            });
        }

        const departmentId =
            departmentResult.rows[0].department_id;

        let aiDepartmentId = null;

        if (DEPTS.includes(aiDept)) {
            const aiResult = await client.query(
                `SELECT department_id
                 FROM departments
                 WHERE department_name = $1`,
                [aiDept]
            );

            aiDepartmentId =
                aiResult.rows[0]?.department_id || null;
        }

        const complaintCode =
            "CT-" +
            Date.now().toString().slice(-8) +
            Math.floor(Math.random() * 100);

        const office = zoneOf(ward);

        const historyNote = aiDept
            ? `Complaint received. AI classified → ${aiDept} (${Math.round((aiConfidence || 0) * 100)}% confidence)${dept && dept !== aiDept ? `. Citizen override → ${dept}` : ""}`
            : `Complaint received and sent to ${selectedDept}`;

        const result = await client.query(
            `INSERT INTO complaints (
                complaint_code,
                title,
                description,
                location,
                ward,
                citizen_id,
                photo_url,
                status,
                civilian_department_id,
                ai_department_id,
                ai_confidence,
                current_department_id,
                office
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                'Submitted', $8, $9, $10, $11, $12
            )
            RETURNING *`,
            [
                complaintCode,
                title.trim(),
                description.trim(),
                location.trim(),
                ward.toString().trim(),
                req.user.id,
                photo || null,
                dept ? departmentId : null,
                aiDepartmentId,
                aiConfidence ?? null,
                departmentId,
                office
            ]
        );

        const complaint = result.rows[0];

        await client.query(
            `INSERT INTO complaint_departments
             (complaint_id, department_id)
             VALUES ($1, $2)`,
            [complaint.id, departmentId]
        );

        await client.query(
            `INSERT INTO complaint_history
             (complaint_id, new_status, note, changed_by)
             VALUES ($1, 'Submitted', $2, $3)`,
            [complaint.id, historyNote, req.user.id]
        );

        await client.query(
            `INSERT INTO notifications (user_id, message)
             VALUES ($1, $2)`,
            [
                req.user.id,
                `Complaint ${complaintCode} submitted successfully.`
            ]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            message: "Complaint submitted successfully",
            complaint: {
                id: complaint.complaint_code,
                title: complaint.title,
                description: complaint.description,
                location: complaint.location,
                ward: complaint.ward,
                photo: complaint.photo_url,
                citizenId: complaint.citizen_id,
                status: complaint.status,
                civilianDept: selectedDept,
                aiDept: aiDept || null,
                aiConfidence: complaint.ai_confidence,
                finalDept: null,
                currentDept: selectedDept,
                depts: [selectedDept],
                office: complaint.office,
                history: [{
                    s: "Submitted",
                    at: complaint.created_at,
                    note: historyNote
                }]
            }
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Complaint creation error:", error.message);

        return res.status(500).json({
            message: "Could not submit complaint"
        });

    } finally {
        client.release();
    }
};