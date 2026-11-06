import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Construction, Trash2, Droplets, Lightbulb } from "lucide-react";
import { Logo, Card } from "../ui";
import { login, register, resetDemo } from "../store";
const cats = [
  ["Roads", "Potholes & damaged roads", Construction],
  ["Waste", "Garbage accumulation", Trash2],
  ["Water", "Leakage & pipeline damage", Droplets],
  ["Streetlights", "Non-working streetlights", Lightbulb],
];
const steps = [
  "Report the issue with details and a photo",
  "It goes to the chosen department (or central review) for officer verification",
  "An officer assigns it to a field worker",
  "Track progress until it is resolved and share feedback",
];
export function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-4 sm:px-8 h-16 border-b flex-wrap gap-2">
        <Logo />
        <nav className="flex gap-4 text-sm text-slate-600 items-center">
          <a href="#top">Home</a>
          <a href="#about">About</a>
          <a href="#how">How It Works</a>
          <Link to="/login">Login</Link>
          <Link to="/register" className="btn">
            Register
          </Link>
        </nav>
      </header>
      <section
        id="top"
        className="bg-gradient-to-br from-blue-700 to-teal-500 text-white text-center py-16 px-4"
      >
        <h1 className="text-3xl sm:text-5xl font-bold">
          Your City. Your Voice. Our Responsibility.
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-blue-50">
          Report potholes, garbage, water leaks and broken streetlights.
          CivicTrack routes every complaint to the right department and tracks
          it until it is resolved.
        </p>
        <div className="mt-8 flex gap-3 justify-center flex-wrap">
          <Link to="/citizen/new" className="btn !bg-white !text-blue-700">
            Report an Issue
          </Link>
          <Link
            to="/citizen"
            className="btn2 !text-white !border-white hover:!bg-white/10"
          >
            Track Complaint
          </Link>
        </div>
      </section>
      <section className="max-w-5xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        {cats.map(([t, d, I]) => (
          <Card key={t} className="text-center">
            <I className="mx-auto text-teal-600" size={30} />
            <h3 className="font-semibold mt-2">{t}</h3>
            <p className="text-xs text-slate-500">{d}</p>
          </Card>
        ))}
      </section>
      <section id="about" className="bg-slate-50 py-12 px-4 text-center">
        <h2 className="text-2xl font-bold text-blue-800">About CivicTrack</h2>
        <p className="max-w-2xl mx-auto mt-3 text-slate-600">
          A unified municipal complaint platform improving accountability and
          transparency across city departments. Citizen and worker identities
          stay private; officers coordinate between them.
        </p>
      </section>
      <section id="how" className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-blue-800 text-center mb-6">
          How It Works
        </h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <Card key={i}>
              <span className="bg-teal-500 text-white rounded-full w-7 h-7 inline-flex items-center justify-center text-sm">
                {i + 1}
              </span>
              <p className="text-sm mt-2">{s}</p>
            </Card>
          ))}
        </div>
      </section>
      <footer className="border-t py-6 text-center text-sm text-slate-500">
        © 2026 CivicTrack · Hackathon prototype (demo data stored in your
        browser)
      </footer>
    </div>
  );
}
const demo = {
  citizen: ["citizen@demo.com", "demo123"],
  officer: ["officer.roads@civictrack.gov", "officer123"],
};
const offs = [
  ["Local/Station", "local.north@civictrack.gov", "officer123"],
  ["Department", "officer.roads@civictrack.gov", "officer123"],
  ["Deputy Commissioner", "dc@civictrack.gov", "dc123"],
];
export function Login() {
  const nav = useNavigate(),
    [role, setRole] = useState("citizen"),
    [e, setE] = useState(""),
    [p, setP] = useState(""),
    [err, setErr] = useState("");
  const go = async (ev) => {
    ev.preventDefault();
    const u = await login(e.trim(), p, role);
    u ? nav("/" + role) : setErr("Invalid credentials for the selected role");
  };
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="flex justify-center mb-4">
          <Logo />
        </div>
        <div className="grid grid-cols-2 gap-1 mb-4">
          {Object.keys(demo).map((r) => (
            <button
              key={r}
              onClick={() => {
                setRole(r);
                setErr("");
              }}
              className={`py-1.5 rounded-lg text-xs capitalize ${role === r ? "bg-blue-600 text-white" : "bg-slate-100"}`}
            >
              {r}
            </button>
          ))}
        </div>
        <form onSubmit={go} className="space-y-3">
          <input
            className="inp"
            type="email"
            placeholder="Email"
            value={e}
            onChange={(x) => setE(x.target.value)}
            required
          />
          <input
            className="inp"
            type="password"
            placeholder="Password"
            value={p}
            onChange={(x) => setP(x.target.value)}
            required
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button className="btn w-full">Login as {role}</button>
        </form>
        <button
          className="text-xs text-teal-700 mt-3"
          onClick={() => {
            setE(demo[role][0]);
            setP(demo[role][1]);
          }}
        >
          Fill demo credentials ({role})
        </button>
        {role === "citizen" ? (
          <p className="text-sm mt-3">
            New here?{" "}
            <Link to="/register" className="text-blue-600">
              Register
            </Link>
          </p>
        ) : (
          <p className="text-xs text-slate-500 mt-3">
            {
              "Officer accounts are issued by the administration. Workers use task links and need no account."
            }
          </p>
        )}
        {role === "officer" && (
          <p className="text-[11px] text-slate-500 mt-2">
            Demo: {offs.map((o) => `${o[0]}: ${o[1]} / ${o[2]}`).join(" · ")}
          </p>
        )}
        <button
          className="text-[11px] text-slate-400 mt-3 block"
          onClick={() => confirm("Reset all demo data?") && resetDemo()}
        >
          Reset demo data
        </button>
        <Link to="/" className="text-xs text-slate-500 block mt-1">
          ← Back to home
        </Link>
      </Card>
    </div>
  );
}
export function Register() {
  const nav = useNavigate(),
    [f, setF] = useState({ name: "", email: "", phone: "", password: "" }),
    [err, setErr] = useState("");
  const s = (k) => (x) => setF({ ...f, [k]: x.target.value });
  const go = async (ev) => {
  ev.preventDefault();

  const r = await register(f);

  if (r) {
    setErr(r);
  } else {
    nav("/citizen");
  }
};
  // const go = (ev) => {
  //   ev.preventDefault();
  //   const r = register(f);
  //   r ? setErr(r) : nav("/citizen");
  // };
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="flex justify-center mb-2">
          <Logo />
        </div>
        <h2 className="text-center font-semibold mb-4">Citizen Registration</h2>
        <form onSubmit={go} className="space-y-3">
          <input
            className="inp"
            placeholder="Full name"
            value={f.name}
            onChange={s("name")}
            required
          />
          <input
            className="inp"
            type="email"
            placeholder="Email"
            value={f.email}
            onChange={s("email")}
            required
          />
          <input
            className="inp"
            placeholder="Phone"
            value={f.phone}
            onChange={s("phone")}
            required
          />
          <input
            className="inp"
            type="password"
            minLength={6}
            placeholder="Password (min 6)"
            value={f.password}
            onChange={s("password")}
            required
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button className="btn w-full">Create account</button>
        </form>
        <p className="text-sm mt-3">
          Already registered?{" "}
          <Link to="/login" className="text-blue-600">
            Login
          </Link>
        </p>
      </Card>
    </div>
  );
}
