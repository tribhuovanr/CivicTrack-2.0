import { Link, useParams } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  CheckCircle2,
  Brain,
  Loader2,
  AlertCircle,
  ShieldAlert,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  Shell,
  Stat,
  Card,
  Badge,
  Tracker,
  Photo,
  Loc,
  PhotoInput,
  PriorityBadge,
  SLABadge,
  fmt,
} from "../ui";
import {
  useDB,
  me,
  DEPTS,
  CENTRAL,
  addComplaint,
  giveFeedback,
} from "../store";

const AI_API = "http://localhost:8000";
const links = [
  ["/citizen", "Dashboard", LayoutDashboard],
  ["/citizen/new", "New Complaint", PlusCircle],
];

export function CitizenDash() {
  const db = useDB(),
    u = me(),
    cs = db.complaints.filter((c) => c.citizenId === u.id),
    n = (f) => cs.filter((c) => f.includes(c.status)).length;
  return (
    <Shell links={links}>
      <h1 className="text-xl font-bold mb-4">Welcome, {u.name}</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total complaints" value={cs.length} />
        <Stat
          label="Pending"
          value={n(["Submitted", "Under Review", "Forwarded", "Assigned"])}
        />
        <Stat
          label="In progress"
          value={n([
            "In Progress",
            "Awaiting Officer Verification",
            "Rejected – Rework Required",
          ])}
        />
        <Stat label="Resolved" value={n(["Resolved"])} />
      </div>
      <div className="flex justify-between items-center mt-6 mb-3">
        <h2 className="font-semibold">My Complaints</h2>
        <Link to="/citizen/new" className="btn">
          Register New Complaint
        </Link>
      </div>
      <div className="space-y-2">
        {cs.length === 0 && (
          <p className="text-sm text-slate-500">No complaints yet.</p>
        )}
        {cs.map((c) => (
          <Card
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="font-medium text-sm">
                  {c.id} · {c.title}
                </p>
                {c.priority && (
                  <PriorityBadge p={c.priority} lifeSafety={c.lifeSafety} />
                )}
                {c.slaHours && (
                  <SLABadge deadline={c.deadline} slaHours={c.slaHours} status={c.status} />
                )}
              </div>
              <p className="text-xs text-slate-500">
                {c.currentDept || CENTRAL} · {fmt(c.history[0].at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge s={c.status} />
              <Link to={"/citizen/track/" + c.id} className="btn2">
                View Details
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </Shell>
  );
}

/* ── AI Triage Hook ── */
function useAITriage() {
  const [ai, setAi] = useState({
    dept: null,
    confidence: null,
    priority: null,
    priorityScore: null,
    slaHours: null,
    lifeSafety: false,
    hazardLevel: null,
    hazardKeywords: [],
    subType: null,
    summary: "",
    loading: false,
    error: null,
  });
  const timer = useRef(null);
  const abort = useRef(null);

  const analyze = useCallback((title, description) => {
    if (timer.current) clearTimeout(timer.current);
    if (abort.current) abort.current.abort();
    if (!description || description.trim().length < 8) {
      setAi({
        dept: null,
        confidence: null,
        priority: null,
        priorityScore: null,
        slaHours: null,
        lifeSafety: false,
        hazardLevel: null,
        hazardKeywords: [],
        subType: null,
        summary: "",
        loading: false,
        error: null,
      });
      return;
    }
    setAi((prev) => ({ ...prev, loading: true, error: null }));
    timer.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        let res = await fetch(`${AI_API}/api/triage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description }),
          signal: ctrl.signal,
        });

        if (res.status === 404) {
          res = await fetch(`${AI_API}/api/classify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, description }),
            signal: ctrl.signal,
          });
        }

        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();
        if (data.error && !data.department) {
          setAi((prev) => ({
            ...prev,
            loading: false,
            error: data.error,
          }));
        } else {
          setAi({
            dept: data.department,
            confidence: data.confidence,
            priority: data.priority || "P3",
            priorityScore: data.priorityScore || 50,
            slaHours: data.slaHours || 72,
            lifeSafety: Boolean(data.lifeSafety),
            hazardLevel: data.hazardLevel ?? 0.5,
            hazardKeywords: data.hazardKeywords || [],
            subType: data.subType || "civic_issue",
            summary: data.summary || "",
            loading: false,
            error: data.error || null,
          });
        }
      } catch (e) {
        if (e.name !== "AbortError") {
          setAi((prev) => ({
            ...prev,
            loading: false,
            error: e.message?.includes("fetch")
              ? "AI triage offline — select department manually"
              : e.message,
          }));
        }
      }
    }, 600); // debounce 600ms
  }, []);

  return [ai, analyze];
}

/* ── AI Triage Panel ── */
function AISuggestion({ ai, onAccept }) {
  if (ai.loading)
    return (
      <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-xl border border-blue-100">
        <Loader2 className="animate-spin text-blue-600" size={16} />
        <span className="font-medium">Ollama (Gemma4) analyzing complaint triage & priority…</span>
      </div>
    );
  if (ai.error)
    return (
      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
        <AlertCircle size={15} />
        {ai.error}
      </div>
    );
  if (!ai.dept) return null;

  const pct = Math.round((ai.confidence || 0) * 100);
  return (
    <div className="bg-gradient-to-br from-slate-50 to-teal-50/40 border border-teal-200 p-4 rounded-xl space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-teal-600" />
          <span className="text-sm font-semibold text-slate-800">
            AI Triage Assessment
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-mono">
            {pct}% confidence
          </span>
        </div>
        <div className="flex items-center gap-2">
          {ai.priority && (
            <PriorityBadge p={ai.priority} lifeSafety={ai.lifeSafety} />
          )}
          {ai.slaHours && (
            <span className="text-xs bg-slate-100 border text-slate-700 px-2 py-0.5 rounded-full font-mono">
              Target SLA: {ai.slaHours}h
            </span>
          )}
        </div>
      </div>

      {ai.lifeSafety && (
        <div className="bg-red-50 border border-red-200 p-2.5 rounded-lg flex items-center gap-2 text-xs text-red-800">
          <ShieldAlert className="text-red-600 shrink-0" size={16} />
          <span className="font-semibold">
            Critical Life Safety Hazard Detected: Priority escalated to P1.
          </span>
        </div>
      )}

      {ai.summary && (
        <p className="text-xs text-slate-600 italic bg-white/80 p-2 rounded-lg border border-slate-100">
          "{ai.summary}"
        </p>
      )}

      {ai.hazardKeywords?.length > 0 && (
        <div className="flex gap-1.5 flex-wrap items-center text-xs">
          <span className="text-slate-500 font-medium">Detected risks:</span>
          {ai.hazardKeywords.map((kw, i) => (
            <span
              key={i}
              className="bg-amber-50 text-amber-800 border border-amber-200 text-[11px] px-2 py-0.5 rounded-md"
            >
              #{kw}
            </span>
          ))}
        </div>
      )}

      <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs">
          <span className="text-slate-500">Recommended Department: </span>
          <b className="text-teal-800">{ai.dept}</b>
        </div>
        <button
          type="button"
          className="btn text-xs !py-1 !px-3"
          onClick={() => onAccept(ai.dept)}
        >
          Confirm {ai.dept}
        </button>
      </div>
    </div>
  );
}

export function NewComplaint() {
  const u = me();
  const [f, setF] = useState({
    title: "",
    description: "",
    location: "",
    ward: "",
    dept: "",
    photo: null,
    aiDept: null,
    aiConfidence: null,
  });
  const [done, setDone] = useState(null),
    [err, setErr] = useState("");
  const [ai, analyze] = useAITriage();

  const s = (k) => (x) => setF((prev) => ({ ...prev, [k]: x.target.value }));

  // Trigger AI classification when title or description changes
  useEffect(() => {
    analyze(f.title, f.description);
  }, [f.title, f.description, analyze]);

  const acceptAI = (dept) => {
    setF((prev) => ({
      ...prev,
      dept,
      aiDept: ai.dept,
      aiConfidence: ai.confidence,
    }));
    setErr("");
  };

  const go = async (e) => {
    e.preventDefault();

    const submission = {
      ...f,
      aiDept: ai.dept || null,
      aiConfidence: ai.confidence || null,
      priority: ai.priority || (ai.lifeSafety ? "P1" : "P3"),
      priorityScore: ai.priorityScore || (ai.lifeSafety ? 95 : 50),
      slaHours: ai.slaHours || 72,
      lifeSafety: Boolean(ai.lifeSafety),
      hazardLevel: ai.hazardLevel ?? 0.5,
      hazardKeywords: ai.hazardKeywords || [],
      subType: ai.subType || "civic_issue",
      summary: ai.summary || f.title,
    };

    if (!submission.dept && ai.dept && !ai.error) {
      submission.dept = ai.dept;
    }

    if (!submission.dept || !DEPTS.includes(submission.dept)) {
      return setErr(
        "Could not determine department. Please select one manually."
      );
    }

    try {
      const result = await addComplaint(submission, u.id);
      setDone(result);
    } catch (error) {
      setErr(error.message || "Could not submit complaint");
    }
  };

  if (done)
    return (
      <Shell links={links}>
        <Card className="text-center space-y-3 max-w-lg mx-auto">
          <CheckCircle2 className="mx-auto text-teal-500" size={44} />
          <h2 className="font-bold text-lg">Complaint Registered with AI Triage</h2>
          <p className="text-sm">
            Tracking ID: <b className="font-mono text-blue-700">{done.id}</b>
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Assigned Priority:</span>
              <PriorityBadge p={done.priority} lifeSafety={done.lifeSafety} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Resolution SLA:</span>
              <span className="font-mono font-semibold text-slate-800">
                {done.slaHours} Hours target
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Responsible Department:</span>
              <span className="font-semibold text-teal-800">{done.currentDept}</span>
            </div>
            {done.summary && (
              <p className="text-slate-600 italic border-t pt-2">
                "{done.summary}"
              </p>
            )}
          </div>

          <div className="flex gap-2 justify-center pt-2">
            <Link to={"/citizen/track/" + done.id} className="btn">
              Track Complaint Status
            </Link>
            <Link to="/citizen" className="btn2">
              Dashboard
            </Link>
          </div>
        </Card>
      </Shell>
    );
  return (
    <Shell links={links}>
      <h1 className="text-xl font-bold mb-4">Register New Complaint</h1>
      <Card>
        <form onSubmit={go} className="space-y-3">
          <input
            className="inp"
            placeholder="Complaint title"
            value={f.title}
            onChange={s("title")}
            required
          />
          <textarea
            className="inp"
            rows={4}
            placeholder="Describe the issue in detail — our AI will automatically detect the right department"
            value={f.description}
            onChange={s("description")}
            required
          />
          <AISuggestion ai={ai} onAccept={acceptAI} />
          <div className="grid sm:grid-cols-3 gap-3">
            <input
              className="inp sm:col-span-2"
              placeholder="Issue location"
              value={f.location}
              onChange={s("location")}
              required
            />
            <input
              className="inp"
              placeholder="Ward number"
              value={f.ward}
              onChange={s("ward")}
              required
            />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">
              {ai.dept && !ai.error
                ? "Override AI selection (optional):"
                : "Select department:"}
            </p>
            <select
              className={`inp ${err ? "!border-red-500" : ""}`}
              aria-invalid={!!err}
              value={f.dept}
              onChange={(e) => {
                s("dept")(e);
                setErr("");
              }}
            >
              <option value="">
                {ai.dept && !ai.error
                  ? `Using AI: ${ai.dept}`
                  : "Select department"}
              </option>
              {DEPTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div>
            <p className="text-sm mb-1">Photograph</p>
            <PhotoInput
              value={f.photo}
              onChange={(p) => setF({ ...f, photo: p })}
            />
          </div>
          <button className="btn">Submit Complaint</button>
        </form>
      </Card>
    </Shell>
  );
}
export function Track() {
  const { id } = useParams(),
    db = useDB(),
    u = me(),
    c = db.complaints.find((c) => c.id === id && c.citizenId === u.id),
    [r, setR] = useState(5),
    [t, setT] = useState("");
  if (!c)
    return (
      <Shell links={links}>
        <p>
          Complaint not found.{" "}
          <Link to="/citizen" className="text-blue-600">
            Back
          </Link>
        </p>
      </Shell>
    );
  return (
    <Shell links={links}>
      <Link to="/citizen" className="text-sm text-blue-600">
        ← My complaints
      </Link>
      <Card className="mt-3 space-y-4">
        <div className="flex justify-between flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-bold text-lg">
              {c.id} · {c.title}
            </h1>
            {c.priority && <PriorityBadge p={c.priority} lifeSafety={c.lifeSafety} />}
            {c.slaHours && <SLABadge deadline={c.deadline} slaHours={c.slaHours} status={c.status} />}
          </div>
          <Badge s={c.status} />
        </div>
        <Tracker s={c.status} />
        <p className="text-sm">{c.description}</p>
        {c.summary && (
          <div className="bg-slate-50 border p-3 rounded-lg text-xs space-y-1">
            <p className="font-semibold text-slate-700">AI Triage Assessment:</p>
            <p className="text-slate-600 italic">"{c.summary}"</p>
            {c.hazardKeywords?.length > 0 && (
              <p className="text-slate-500">
                Risk factors: {c.hazardKeywords.join(", ")}
              </p>
            )}
          </div>
        )}
        <Loc c={c} />
        <p className="text-sm text-slate-600">
          Department: {c.currentDept || CENTRAL} · Submitted:{" "}
          {fmt(c.history[0].at)}
        </p>
        <Photo src={c.photo} label="Your photograph" />
        <div>
          <h3 className="font-semibold text-sm mb-2">Status updates</h3>
          <ul className="space-y-2 border-l-2 border-teal-300 pl-3">
            {c.history.map((h, i) => (
              <li key={i} className="text-sm">
                {h.note}
                <p className="text-xs text-slate-400">
                  {h.s} · {fmt(h.at)}
                </p>
              </li>
            ))}
          </ul>
        </div>
        {c.status === "Resolved" && !c.feedback && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              giveFeedback(c.id, r, t);
            }}
            className="bg-slate-50 p-3 rounded-lg space-y-2"
          >
            <h3 className="font-semibold text-sm">Rate the resolution</h3>
            <select
              className="inp"
              value={r}
              onChange={(e) => setR(+e.target.value)}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} / 5
                </option>
              ))}
            </select>
            <textarea
              className="inp"
              placeholder="Your feedback"
              value={t}
              onChange={(e) => setT(e.target.value)}
            />
            <button className="btn">Submit feedback</button>
          </form>
        )}
        {c.feedback && (
          <p className="text-sm bg-emerald-50 p-3 rounded-lg">
            Your feedback: {c.feedback.rating}/5{" "}
            {c.feedback.text && `· ${c.feedback.text}`}
          </p>
        )}
      </Card>
    </Shell>
  );
}
