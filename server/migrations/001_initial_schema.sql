
-- ==========================================
-- CIVICTRACK INITIAL DATABASE SCHEMA
-- PostgreSQL / Supabase
-- ==========================================
-- 0. DEPARTMENTS
CREATE TABLE IF NOT EXISTS departments (
    department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('citizen', 'officer')),
    level VARCHAR(20)
        CHECK (level IN ('local', 'dept', 'dc')),
    phone VARCHAR(20),
    department_id UUID REFERENCES departments(department_id),
    office VARCHAR(100),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
ON users (LOWER(email));


-- 2. WORKERS
CREATE TABLE IF NOT EXISTS workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    department_id UUID REFERENCES departments(department_id),
    office VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 3. COMPLAINTS
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_code VARCHAR(30) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    ward VARCHAR(30) NOT NULL,

    citizen_id UUID NOT NULL REFERENCES users(id),

    photo_url TEXT,

    status VARCHAR(60) NOT NULL DEFAULT 'Submitted',

    civilian_department_id UUID REFERENCES departments(department_id),
    ai_department_id UUID REFERENCES departments(department_id),
    ai_confidence NUMERIC(5,4),
    final_department_id UUID REFERENCES departments(department_id),
    current_department_id UUID REFERENCES departments(department_id),

    office VARCHAR(100),
    worker_id UUID REFERENCES workers(id),

    remarks TEXT,
    completion_photo_url TEXT,
    reject_note TEXT,

    feedback_rating INTEGER CHECK (
        feedback_rating BETWEEN 1 AND 5
    ),
    feedback_text TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- 4. COMPLAINT DEPARTMENTS
CREATE TABLE IF NOT EXISTS complaint_departments (
    complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(department_id),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (complaint_id, department_id)
);


-- 5. COMPLAINT HISTORY
CREATE TABLE IF NOT EXISTS complaint_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    old_status VARCHAR(60),
    new_status VARCHAR(60) NOT NULL,
    note TEXT,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 6. COMPLAINT FORWARDS
CREATE TABLE IF NOT EXISTS complaint_forwards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    from_department_id UUID REFERENCES departments(department_id),
    to_department_id UUID REFERENCES departments(department_id),
    reason TEXT,
    forwarded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 7. WORKER LINKS
CREATE TABLE IF NOT EXISTS worker_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT UNIQUE NOT NULL,
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES workers(id),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    submitted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 8. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 9. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    detail TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 10. SEED DEPARTMENTS
INSERT INTO departments (department_name)
VALUES
    ('Roads and Infrastructure'),
    ('Waste Management'),
    ('Water Supply'),
    ('Drainage and Sanitation'),
    ('Street Lighting'),
    ('Other')
ON CONFLICT (department_name) DO NOTHING;


-- 11. INDEXES
CREATE INDEX IF NOT EXISTS complaints_citizen_idx
ON complaints(citizen_id);

CREATE INDEX IF NOT EXISTS complaints_status_idx
ON complaints(status);

CREATE INDEX IF NOT EXISTS complaints_department_idx
ON complaints(current_department_id);

CREATE INDEX IF NOT EXISTS complaint_history_complaint_idx
ON complaint_history(complaint_id);

CREATE INDEX IF NOT EXISTS notifications_user_idx
ON notifications(user_id);
