import { Link, useParams } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  CheckCircle2,
  Brain,
  Loader2,
  AlertCircle,
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
              <p className="font-medium text-sm">
                {c.id} · {c.title}
              </p>
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

/* ── AI Classification Hook ── */
function useAIClassify() {
  const [ai, setAi] = useState({
    dept: null,
    confidence: null,
    loading: false,
    error: null,
  });
  const timer = useRef(null);
  const abort = useRef(null);

  const classify = useCallback((title, description) => {
    if (timer.current) clearTimeout(timer.current);
    if (abort.current) abort.current.abort();
    if (!description || description.trim().length < 10) {
      setAi({ dept: null, confidence: null, loading: false, error: null });
      return;
    }
    setAi((prev) => ({ ...prev, loading: true, error: null }));
    timer.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch(`${AI_API}/api/classify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();
        if (data.error)
          setAi({
            dept: null,
            confidence: null,
            loading: false,
            error: data.error,
          });
        else
          setAi({
            dept: data.department,
            confidence: data.confidence,
            loading: false,
            error: null,
          });
      } catch (e) {
        if (e.name !== "AbortError")
          setAi({
            dept: null,
            confidence: null,
            loading: false,
            error: e.message?.includes("fetch")
              ? "AI service unavailable — select department manually"
              : e.message,
          });
      }
    }, 800); // debounce 800ms
  }, []);

  return [ai, classify];
}

/* ── AI Suggestion Badge ── */
function AISuggestion({ ai, onAccept }) {
  if (ai.loading)
    return (
      <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
        <Loader2 className="animate-spin" size={16} />
        AI is analyzing your complaint…
      </div>
    );
  if (ai.error)
    return (
      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
        <AlertCircle size={16} />
        {ai.error}
      </div>
    );
  if (!ai.dept) return null;
  const pct = Math.round((ai.confidence || 0) * 100);
  const color = pct >= 75 ? "emerald" : pct >= 50 ? "yellow" : "red";
  return (
    <div
      className={`bg-${color}-50 border border-${color}-200 p-3 rounded-lg space-y-2`}
    >
      <div className="flex items-center gap-2">
        <Brain size={18} className={`text-${color}-600`} />
        <p className="text-sm font-medium">
          AI Recommendation:{" "}
          <span className={`text-${color}-700`}>{ai.dept}</span>
        </p>
        <span
          className={`text-xs px-2 py-0.5 rounded-full bg-${color}-100 text-${color}-700`}
        >
          {pct}% confidence
        </span>
      </div>
      <button
        type="button"
        className="btn text-xs !py-1"
        onClick={() => onAccept(ai.dept)}
      >
        Accept this department
      </button>
      <p className="text-xs text-slate-500">
        Or select a different department below to override.
      </p>
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
  const [ai, classify] = useAIClassify();

  const s = (k) => (x) => setF((prev) => ({ ...prev, [k]: x.target.value }));

  // Trigger AI classification when title or description changes
  useEffect(() => {
    classify(f.title, f.description);
  }, [f.title, f.description, classify]);

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

  const submission = { ...f };

  if (!submission.dept && ai.dept && !ai.error) {
    submission.dept = ai.dept;
    submission.aiDept = ai.dept;
    submission.aiConfidence = ai.confidence;
  }
  else if (submission.dept && ai.dept) {
    submission.aiDept = ai.dept;
    submission.aiConfidence = ai.confidence;
  }

  if (
    !submission.dept ||
    !DEPTS.includes(submission.dept)
  ) {
    return setErr(
      "Could not determine department. Please select one manually."
    );
  }

  try {
    const result = await addComplaint(submission, u.id);

    setDone(result);

  } catch (error) {
    setErr(
      error.message || "Could not submit complaint"
    );
  }
};
  // const go = (e) => {
  //   e.preventDefault();
  //   // If AI classified but citizen didn't explicitly accept or override, auto-use AI result
  //   const submission = { ...f };
  //   if (!submission.dept && ai.dept && !ai.error) {
  //     submission.dept = ai.dept;
  //     submission.aiDept = ai.dept;
  //     submission.aiConfidence = ai.confidence;
  //   } else if (submission.dept && ai.dept) {
  //     submission.aiDept = ai.dept;
  //     submission.aiConfidence = ai.confidence;
  //   }
  //   if (!submission.dept || !DEPTS.includes(submission.dept))
  //     return setErr(
  //       "Could not determine department. Please select one manually.",
  //     );
  //   const r = addComplaint(submission, u.id);
  //   r.error ? setErr(r.error) : setDone(r);
  // };

  if (done)
    return (
      <Shell links={links}>
        <Card className="text-center space-y-2">
          <CheckCircle2 className="mx-auto text-teal-500" size={40} />
          <h2 className="font-bold">Complaint submitted successfully</h2>
          <p>
            Your complaint ID: <b>{done.id}</b>
          </p>
          <p className="text-sm text-slate-600">
            Sent to the {done.currentDept} officer queue for verification
          </p>
          {done.aiDept && (
            <p className="text-xs text-slate-500">
              AI classified as: {done.aiDept} (
              {Math.round((done.aiConfidence || 0) * 100)}% confidence)
              {done.civilianDept && done.civilianDept !== done.aiDept
                ? ` · You selected: ${done.civilianDept}`
                : ""}
            </p>
          )}
          <div className="flex gap-2 justify-center">
            <Link to={"/citizen/track/" + done.id} className="btn">
              Track this complaint
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
        <div className="flex justify-between flex-wrap gap-2">
          <h1 className="font-bold">
            {c.id} · {c.title}
          </h1>
          <Badge s={c.status} />
        </div>
        <Tracker s={c.status} />
        <p className="text-sm">{c.description}</p>
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
