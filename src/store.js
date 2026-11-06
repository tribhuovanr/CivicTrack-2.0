// SIMULATED backend: LocalStorage stands in for API + database. Every export below maps to a server endpoint.
import { useEffect, useState } from "react";
export const DEPTS = [
  "Roads and Infrastructure",
  "Waste Management",
  "Water Supply",
  "Drainage and Sanitation",
  "Street Lighting",
  "Other",
];
export const OFFICES = ["North Zone Office", "South Zone Office"];
export const CENTRAL = "Central Review Queue";
export const LEVELS = {
  local: "Local/Station Officer",
  dept: "Department Officer",
  dc: "Deputy Commissioner",
};
export const zoneOf = (w) =>
  (parseInt(w) || 0) <= 10 ? OFFICES[0] : OFFICES[1];
const K = "ct_db2",
  S = "ct_sess",
  uid = () => Math.random().toString(36).slice(2, 8),
  now = () => new Date().toISOString();
const H = (s, note) => ({ s, at: now(), note });
const hex = () =>
  [...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
function seed() {
  const sl = ["roads", "waste", "water", "drainage", "lighting", "other"];
  const users = [
    {
      id: "cit1",
      role: "citizen",
      name: "Demo Citizen",
      email: "citizen@demo.com",
      password: "demo123",
      phone: "9000000000",
    },
    {
      id: "dc",
      role: "officer",
      level: "dc",
      name: "Deputy Commissioner",
      email: "dc@civictrack.gov",
      password: "dc123",
    },
    ...OFFICES.map((o, i) => ({
      id: "lo" + i,
      role: "officer",
      level: "local",
      name: o.split(" ")[0] + " Station Officer",
      email: `local.${o.split(" ")[0].toLowerCase()}@civictrack.gov`,
      password: "officer123",
      office: o,
    })),
    ...DEPTS.map((d, i) => ({
      id: "do" + i,
      role: "officer",
      level: "dept",
      name: d + " Officer",
      email: `officer.${sl[i]}@civictrack.gov`,
      password: "officer123",
      dept: d,
    })),
  ];
  const workers = [
    ...DEPTS.flatMap((d, i) =>
      [1, 2].map((n) => ({
        id: `w${i}${n}`,
        name: `${d.split(" ")[0]} Worker ${n}`,
        phone: `91900000${i}${n}00`,
        group: d,
      })),
    ),
    ...OFFICES.map((o, i) => ({
      id: "wo" + i,
      name: o.split(" ")[0] + " Field Worker",
      phone: `9180000000${i}`,
      group: o,
    })),
  ];
  const mk = (
    id,
    title,
    description,
    location,
    ward,
    sel,
    status,
    extra = {},
  ) => ({
    id,
    title,
    description,
    location,
    ward,
    photo: null,
    citizenId: "cit1",
    status,
    civilianDept: sel,
    aiDept: null,
    aiConfidence: null,
    finalDept: null,
    currentDept: sel || null,
    depts: sel ? [sel] : [],
    office: zoneOf(ward),
    forwards: [],
    workerId: null,
    remarks: "",
    completionPhoto: null,
    feedback: null,
    history: [
      H(
        "Submitted",
        sel
          ? "Complaint received and sent to " + sel
          : "Complaint received and sent for central review",
      ),
    ],
    ...extra,
  });
  const L = (token, cid, wid, x = {}) => ({
    token,
    cid,
    wid,
    exp: Date.now() + 48 * 36e5,
    revoked: false,
    submitted: false,
    ...x,
  });
  const complaints = [
    mk(
      "CT-100001",
      "Large pothole near school",
      "Big pothole near the school gate.",
      "MG Road, near St. Mary School",
      "12",
      "Roads and Infrastructure",
      "Submitted",
    ),
    mk(
      "CT-100002",
      "Overflowing drain",
      "Drain overflowing onto the street.",
      "5th Cross Market",
      "7",
      "Drainage and Sanitation",
      "Submitted",
    ),
    mk(
      "CT-100003",
      "Garbage pile",
      "Garbage not collected for a week.",
      "Lake View Colony",
      "3",
      "Waste Management",
      "In Progress",
      {
        workerId: "w11",
        finalDept: "Waste Management",
        history: [
          H("Submitted", "Complaint received and sent to Waste Management"),
          H("Under Review", "Complaint verified by the department"),
          H("Assigned", "Assigned to the department field team"),
          H("In Progress", "Work has started"),
        ],
      },
    ),
    mk(
      "CT-100004",
      "Streetlight not working",
      "Streetlight dark for two weeks.",
      "Park Street",
      "15",
      "Street Lighting",
      "Awaiting Officer Verification",
      {
        workerId: "w41",
        finalDept: "Street Lighting",
        remarks: "Bulb and fuse replaced.",
        history: [
          H("Submitted", "Complaint received and sent to Street Lighting"),
          H(
            "Awaiting Officer Verification",
            "Work completed, awaiting officer verification",
          ),
        ],
      },
    ),
  ];
  return {
    audit: [],
    users,
    workers,
    complaints,
    links: [
      L("demo-task-garbage-0001", "CT-100003", "w11"),
      L("demo-task-light-0002", "CT-100004", "w41", { submitted: true }),
    ],
    notes: [
      {
        id: "n0",
        uid: "cit1",
        text: "Welcome to CivicTrack!",
        at: now(),
        read: false,
      },
    ],
  };
}
let db = JSON.parse(localStorage.getItem(K) || "null") || seed();
db.audit = db.audit || [];
const subs = new Set();
const commit = () => {
  try {
    localStorage.setItem(K, JSON.stringify(db));
  } catch (e) {
    alert("Storage full: use smaller photos");
  }
  subs.forEach((f) => f());
};
export const useDB = () => {
  const [, s] = useState(0);
  useEffect(() => {
    const f = () => s((n) => n + 1);
    subs.add(f);
    return () => subs.delete(f);
  }, []);
  return db;
};
import { apiRequest } from "./api";

export const me = () => {
    try {
        return JSON.parse(localStorage.getItem(S) || "null");
    } catch {
        return null;
    }
};

export const resetDemo = () => {
    db = seed();
    localStorage.removeItem(S);
    localStorage.removeItem("ct_token");
    commit();
};

export async function login(email, password, role) {
    try {
        const data = await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password, role })
        });

        localStorage.setItem("ct_token", data.token);
        localStorage.setItem(S, JSON.stringify(data.user));

        commit();
        return data.user;

    } catch (error) {
        console.error("Login failed:", error.message);
        return null;
    }
}

export const logout = () => {
    localStorage.removeItem(S);
    localStorage.removeItem("ct_token");
    commit();
};

export async function register(f) {
    try {
        const data = await apiRequest("/auth/register", {
            method: "POST",
            body: JSON.stringify(f)
        });

        localStorage.setItem("ct_token", data.token);
        localStorage.setItem(S, JSON.stringify(data.user));

        commit();
        return null;

    } catch (error) {
        return error.message;
    }
}
/*
export const me = () =>
  db.users.find((u) => u.id === localStorage.getItem(S) && u.active !== false);
export const resetDemo = () => {
  db = seed();
  localStorage.removeItem(S);
  commit();
};
export function login(email, password, role) {
  const u = db.users.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase() &&
      u.password === password &&
      u.role === role &&
      u.active !== false,
  );
  if (!u) return null;
  localStorage.setItem(S, u.id);
  commit();
  return u;
}
export const logout = () => {
  localStorage.removeItem(S);
  commit();
};
export function register(f) {
  if (db.users.some((u) => u.email.toLowerCase() === f.email.toLowerCase()))
    return "Email already registered";
  const u = { id: "c" + uid(), role: "citizen", ...f };
  db.users.push(u);
  localStorage.setItem(S, u.id);
  commit();
} */
// ---- Access control (must be enforced server-side in production) ----
export const canAccess = (u, c) =>
  u.level === "dc" ||
  (u.level === "dept" && c.depts.includes(u.dept)) ||
  (u.level === "local" && c.office === u.office);
export const visible = (u) => db.complaints.filter((c) => canAccess(u, c));
export const rosterFor = (u) =>
  db.workers.filter(
    (w) => u.level === "dc" || w.group === u.dept || w.group === u.office,
  );
const note = (u, text) =>
  u && db.notes.unshift({ id: uid(), uid: u, text, at: now(), read: false });
export const markRead = (u) => {
  db.notes.forEach((n) => n.uid === u && (n.read = true));
  commit();
};
const guard = (id) => {
  const c = db.complaints.find((c) => c.id === id),
    u = me();
  if (!c || !u || u.role !== "officer" || !canAccess(u, c))
    throw new Error("Forbidden");
  return c;
};
const set = (c, s, msg, patch = {}) => {
  Object.assign(c, patch, { status: s });
  c.history.push(H(s, msg));
};
const alertOfficers = (c, t) =>
  db.users
    .filter(
      (o) =>
        o.role === "officer" &&
        ((o.level === "dc" && !c.currentDept) ||
          (o.level === "dept" && o.dept === c.currentDept) ||
          (o.level === "local" && o.office === c.office)),
    )
    .forEach((o) => note(o.id, t));
  export async function addComplaint(f, citizenId) {

  const response = await apiRequest("/complaints", {
    method: "POST",
    body: JSON.stringify({
      title: f.title,
      description: f.description,
      location: f.location,
      ward: f.ward,
      dept: f.dept,
      aiDept: f.aiDept,
      aiConfidence: f.aiConfidence,
      photo: f.photo
    })
  });

  const x = {
    ...response.complaint,
    citizenId,
    forwards: [],
    workerId: null,
    remarks: "",
    completionPhoto: null,
    feedback: null
  };

  db.complaints.unshift(x);

  note(citizenId, `Complaint ${x.id} submitted.`);

  commit();

  return x;
}
/* export function addComplaint(f, citizenId) {
  // Department can come from AI classification or manual override
  const sel =
    f.dept || (f.aiDept && DEPTS.includes(f.aiDept) ? f.aiDept : null);
  if (!sel || !DEPTS.includes(sel))
    return {
      error: "Could not determine department. Please select one manually.",
    };
  const x = {
    id: "CT-" + Date.now().toString().slice(-6),
    title: f.title,
    description: f.description,
    location: f.location,
    ward: f.ward,
    photo: f.photo,
    citizenId,
    status: "Submitted",
    civilianDept: f.dept || null,
    aiDept: f.aiDept || null,
    aiConfidence: f.aiConfidence ?? null,
    finalDept: null,
    currentDept: sel,
    depts: [sel],
    office: zoneOf(f.ward),
    forwards: [],
    workerId: null,
    remarks: "",
    completionPhoto: null,
    feedback: null,
    history: [
      H(
        "Submitted",
        f.aiDept
          ? `Complaint received. AI classified → ${f.aiDept} (${Math.round((f.aiConfidence || 0) * 100)}% confidence)${f.dept && f.dept !== f.aiDept ? `. Citizen override → ${f.dept}` : ""}`
          : "Complaint received and sent to " + sel,
      ),
    ],
  };
  db.complaints.unshift(x);
  note(citizenId, `Complaint ${x.id} submitted.`);
  alertOfficers(x, `New complaint ${x.id} awaiting verification.`);
  commit();
  return x;
} */
export function acceptReview(id) {
  const c = guard(id);
  set(c, "Under Review", "Complaint verified by the department", {
    finalDept: c.currentDept,
  });
  note(c.citizenId, `Complaint ${id} is under review.`);
  commit();
}
export function forward(id, to, reason, keep) {
  const c = guard(id),
    from = c.currentDept || CENTRAL;
  c.forwards.push({ from, to, reason, by: me().name, at: now() });
  c.depts = keep ? [...new Set([...c.depts, to])] : [to];
  Object.assign(c, { currentDept: to, finalDept: null });
  set(c, "Forwarded", "Forwarded to " + to);
  note(c.citizenId, `Complaint ${id} was forwarded to ${to}.`);
  alertOfficers(c, `Complaint ${id} forwarded to your queue.`);
  commit();
}
function newLink(c, wid) {
  db.links.filter((l) => l.cid === c.id).forEach((l) => (l.revoked = true));
  db.links.push({
    token: hex(),
    cid: c.id,
    wid,
    exp: Date.now() + 48 * 36e5,
    revoked: false,
    submitted: false,
  });
  c.workerId = wid;
}
export function assignWorker(id, wid) {
  const c = guard(id);
  newLink(c, wid);
  set(c, "Assigned", "Assigned to the department field team");
  note(c.citizenId, `Complaint ${id} has been assigned.`);
  commit();
}
export function regenLink(id) {
  const c = guard(id);
  newLink(c, c.workerId);
  commit();
}
export function revokeLink(id) {
  guard(id);
  db.links.filter((l) => l.cid === id).forEach((l) => (l.revoked = true));
  commit();
}
export const linkFor = (id) =>
  db.links.filter((l) => l.cid === id).slice(-1)[0];
export const linkState = (l) =>
  !l
    ? "none"
    : l.revoked
      ? "Revoked"
      : Date.now() > l.exp
        ? "Expired"
        : l.submitted
          ? "Submitted"
          : "Active";
export function verify(id, ok, reason) {
  const c = guard(id);
  if (ok) {
    set(c, "Resolved", "Issue verified and resolved");
    note(
      c.citizenId,
      `Complaint ${id} is resolved. Please share your feedback.`,
    );
  } else {
    set(
      c,
      "Rejected – Rework Required",
      "Resolution not accepted, further work required",
      { rejectNote: reason },
    );
    const l = linkFor(id);
    if (l) l.submitted = false;
    note(c.citizenId, `Complaint ${id}: further work is required.`);
  }
  commit();
}
export function giveFeedback(id, rating, text) {
  db.complaints.find((c) => c.id === id).feedback = { rating, text };
  commit();
}
export function addWorker(name, phone, group) {
  db.workers.push({ id: uid(), name, phone, group });
  commit();
}
// ---- DC-only officer management (SIMULATED; must be a secured backend admin API). Permissions derive from level + office/dept via canAccess ----
const dcOnly = () => {
  const u = me();
  if (!u || u.level !== "dc") throw new Error("Forbidden");
};
const audit = (t, action, detail) =>
  db.audit.unshift({
    id: uid(),
    at: now(),
    by: me().name,
    target: t.name,
    action,
    detail,
  });
const jurOf = (o) => (o.level === "local" ? o.office : o.dept);
const chk = (f) =>
  !f.name?.trim() || !f.email?.trim()
    ? "Name and email are required"
    : !["local", "dept"].includes(f.level)
      ? "Invalid designation"
      : f.level === "local" && !OFFICES.includes(f.office)
        ? "Select an office/zone"
        : f.level === "dept" && !DEPTS.includes(f.dept)
          ? "Select a department"
          : "";
const desc = (o) => `${o.name} · ${o.email} · ${LEVELS[o.level]} · ${jurOf(o)}`;
export function createOfficer(f) {
  dcOnly();
  const e = chk(f);
  if (e) return { error: e };
  if (
    db.users.some((u) => u.email.toLowerCase() === f.email.trim().toLowerCase())
  )
    return { error: "Email already exists" };
  const password = Math.random().toString(36).slice(2, 10),
    o = {
      id: "o" + uid(),
      role: "officer",
      level: f.level,
      name: f.name.trim(),
      email: f.email.trim(),
      password,
      active: true,
      ...(f.level === "local" ? { office: f.office } : { dept: f.dept }),
    };
  db.users.push(o);
  audit(o, "Created", desc(o));
  commit();
  return { password };
}
export function updateOfficer(id, f) {
  dcOnly();
  const o = db.users.find(
    (u) => u.id === id && u.role === "officer" && u.level !== "dc",
  );
  if (!o) return { error: "Account not editable" };
  const e = chk(f);
  if (e) return { error: e };
  const em = f.email.trim();
  if (
    db.users.some(
      (u) => u.id !== id && u.email.toLowerCase() === em.toLowerCase(),
    )
  )
    return { error: "Email already exists" };
  const before = desc(o);
  Object.assign(o, {
    name: f.name.trim(),
    email: em,
    level: f.level,
    dept: f.level === "dept" ? f.dept : undefined,
    office: f.level === "local" ? f.office : undefined,
  });
  audit(o, "Updated", before + " → " + desc(o));
  commit();
  return {};
}
export function setActive(id, active) {
  dcOnly();
  const o = db.users.find(
    (u) => u.id === id && u.role === "officer" && u.level !== "dc",
  );
  if (!o) return;
  o.active = active;
  audit(o, active ? "Reactivated" : "Deactivated", desc(o));
  commit();
}
// ---- Worker (no account): token-scoped access only ----
export function taskByToken(t) {
  const l = db.links.find((l) => l.token === t);
  if (!l) return { error: "Invalid link" };
  const s = linkState(l);
  if (s === "Revoked") return { error: "This link has been revoked" };
  if (s === "Expired")
    return { error: "This link has expired. Ask your officer for a new one" };
  const c = db.complaints.find((c) => c.id === l.cid);
  return {
    link: l,
    task: {
      id: c.id,
      title: c.title,
      description: c.description,
      location: c.location,
      photo: c.photo,
      status: c.status,
      rejectNote: c.rejectNote,
      submitted: l.submitted,
    },
  };
}
export function workerStart(t) {
  const r = taskByToken(t);
  if (r.error) return;
  const c = db.complaints.find((c) => c.id === r.link.cid);
  if (["Assigned", "Rejected – Rework Required"].includes(c.status)) {
    set(c, "In Progress", "Work has started");
    note(c.citizenId, `Complaint ${c.id}: work has started.`);
    commit();
  }
}
export function workerComplete(t, remarks, photo) {
  const r = taskByToken(t);
  if (r.error || !photo) return;
  const c = db.complaints.find((c) => c.id === r.link.cid);
  r.link.submitted = true;
  set(
    c,
    "Awaiting Officer Verification",
    "Work completed, awaiting officer verification",
    { remarks, completionPhoto: photo },
  );
  alertOfficers(c, `Complaint ${c.id} awaiting verification.`);
  commit();
}
