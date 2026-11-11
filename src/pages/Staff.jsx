import {useState} from 'react'
import {LayoutDashboard, ShieldAlert} from 'lucide-react'
import {Shell,Stat,Card,Badge,Photo,Loc,PriorityBadge,SLABadge,fmt} from '../ui'
import {useDB,me,visible,rosterFor,OFFICES,createOfficer,updateOfficer,setActive,DEPTS,CENTRAL,LEVELS,acceptReview,forward,assignWorker,regenLink,revokeLink,linkFor,linkState,verify,addWorker} from '../store'
const cnt=(cs,a)=>cs.filter(c=>a.includes(c.status)).length
function Fwd({c}){const [to,setTo]=useState(''),[r,setR]=useState(''),[k,setK]=useState(false)
 return <div className="flex gap-2 flex-wrap items-center text-sm"><select className="inp !w-auto" value={to} onChange={e=>setTo(e.target.value)}><option value="">Forward to…</option>{DEPTS.filter(d=>d!==c.currentDept).map(d=><option key={d}>{d}</option>)}</select>
  <input className="inp !w-48" placeholder="Reason (required)" value={r} onChange={e=>setR(e.target.value)}/><label className="text-xs"><input type="checkbox" checked={k} onChange={e=>setK(e.target.checked)}/> keep copy</label>
  <button className="btn2" disabled={!to||!r} onClick={()=>{forward(c.id,to,r,k);setTo('');setR('')}}>Forward</button></div>}
function LinkBox({c}){const db=useDB(),l=linkFor(c.id),st=linkState(l),url=l&&`${location.origin}/task/${l.token}`,w=c.workerId
 const wk=db.workers.find(x=>x.id===w)
 if(!l)return null
 return <div className="bg-slate-50 p-3 rounded-lg text-sm space-y-1"><p>Worker: {wk?.name} · Link: <b>{st}</b> · Expires {fmt(l.exp)}</p><p className="break-all text-xs text-slate-500">{url}</p>
  <div className="flex gap-2 flex-wrap"><button className="btn2" onClick={()=>navigator.clipboard?.writeText(url)}>Copy link</button>
   <a className="btn2" target="_blank" rel="noreferrer" href={`https://wa.me/${wk?.phone}?text=${encodeURIComponent('CivicTrack task '+c.id+': '+url)}`}>Send via WhatsApp</a>
   <a className="btn2" href={url} target="_blank" rel="noreferrer">Open as worker</a>
   <button className="btn2" onClick={()=>revokeLink(c.id)}>Revoke</button><button className="btn2" onClick={()=>regenLink(c.id)}>New link</button></div></div>}
function Item({c,u,roster}){const [w,setW]=useState(''),[n,setN]=useState('')
 return <Card className="space-y-2">
  <div className="flex justify-between flex-wrap gap-2 items-center">
   <div className="flex items-center gap-2 flex-wrap">
    <p className="font-semibold text-sm">{c.id} · {c.title}</p>
    {c.priority&&<PriorityBadge p={c.priority} lifeSafety={c.lifeSafety}/>}
    {c.slaHours&&<SLABadge deadline={c.deadline} slaHours={c.slaHours} status={c.status}/>}
   </div>
   <Badge s={c.status}/>
  </div>
  {c.lifeSafety&&<div className="bg-red-50 border border-red-200 text-red-800 text-xs px-3 py-1.5 rounded-lg flex items-center justify-between font-medium">
   <span className="flex items-center gap-1.5"><ShieldAlert className="text-red-600 shrink-0" size={16}/><span><b>CRITICAL LIFE SAFETY HAZARD:</b> Immediate triage required.</span></span>
   <span className="font-mono text-red-700">12h SLA</span></div>}
  <p className="text-sm">{c.description}</p>
  {c.summary&&<p className="text-xs bg-slate-50 border border-slate-200 p-2 rounded text-slate-700 italic"><span className="font-semibold not-italic text-slate-800">AI Triage Summary: </span>"{c.summary}"</p>}
  {c.hazardKeywords?.length>0&&<div className="flex gap-1.5 flex-wrap items-center text-[11px] text-slate-500"><span className="font-medium text-slate-600">Risk keywords:</span>{c.hazardKeywords.map((kw,i)=><span key={i} className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-mono">#{kw}</span>)}</div>}
  <Loc c={c}/>
  <p className="text-xs text-slate-500">Civilian selected: {c.civilianDept||'None'} · Current: {c.currentDept||CENTRAL} · Involved: {c.depts.join(', ')||'—'} · Final approved: {c.finalDept||'—'} · AI recommendation: {c.aiDept||'not available'} {c.aiConfidence!=null&&`(${Math.round(c.aiConfidence*100)}%)`} · {c.office}</p>
  <div className="flex gap-3 flex-wrap"><Photo src={c.photo} label="Complaint photograph"/>{c.completionPhoto&&<Photo src={c.completionPhoto} label="Completion photograph"/>}</div>
  {c.forwards.length>0&&<div className="text-xs text-slate-600"><b>Forwarding history</b>{c.forwards.map((f,i)=><p key={i}>{fmt(f.at)}: {f.from} → {f.to} by {f.by}. Reason: {f.reason}</p>)}</div>}
  {c.rejectNote&&c.status.startsWith('Rejected')&&<p className="text-sm text-red-700">Rejected: {c.rejectNote}</p>}
  {['Submitted','Forwarded'].includes(c.status)&&c.currentDept&&<button className="btn" onClick={()=>acceptReview(c.id)}>Verify department & start review</button>}
  {['Under Review','Rejected – Rework Required'].includes(c.status)&&<div className="flex gap-2 flex-wrap"><select className="inp !w-auto" value={w} onChange={e=>setW(e.target.value)}><option value="">Select worker</option>{roster.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><button className="btn" disabled={!w} onClick={()=>assignWorker(c.id,w)}>Assign & generate link</button></div>}
  {['Assigned','In Progress','Awaiting Officer Verification','Rejected – Rework Required'].includes(c.status)&&<LinkBox c={c}/>}
  {c.status==='Awaiting Officer Verification'&&<div className="bg-purple-50 p-3 rounded-lg space-y-2"><p className="text-sm">Worker remarks: {c.remarks||'—'}</p><input className="inp" placeholder="Rejection reason (if rejecting)" value={n} onChange={e=>setN(e.target.value)}/>
   <div className="flex gap-2"><button className="btn" onClick={()=>verify(c.id,true)}>Approve Resolution</button><button className="btn2" onClick={()=>n?verify(c.id,false,n):alert('Enter a reason')}>Reject</button></div></div>}
  {c.status==='Resolved'&&c.feedback&&<p className="text-xs">Civilian feedback: {c.feedback.rating}/5 {c.feedback.text}</p>}
  {c.status!=='Resolved'&&c.status!=='Awaiting Officer Verification'&&<Fwd c={c}/>}</Card>}
const jur=o=>o.level==='dc'?'All offices & departments':o.level==='local'?o.office:o.dept
const blank={name:'',email:'',level:'dept',dept:DEPTS[0],office:OFFICES[0]}
function OfficerFields({f,setF}){const s=k=>e=>setF({...f,[k]:e.target.value})
 return <div className="grid sm:grid-cols-2 gap-2"><input className="inp" placeholder="Officer name" value={f.name} onChange={s('name')}/><input className="inp" type="email" placeholder="Official email" value={f.email} onChange={s('email')}/>
  <select className="inp" value={f.level} onChange={s('level')}><option value="local">Local/Station Officer</option><option value="dept">Department Officer</option></select>
  {f.level==='local'?<select className="inp" value={f.office} onChange={s('office')}>{OFFICES.map(o=><option key={o}>{o}</option>)}</select>:<select className="inp" value={f.dept} onChange={s('dept')}>{DEPTS.map(d=><option key={d}>{d}</option>)}</select>}</div>}
function ManageOfficers(){const db=useDB(),[f,setF]=useState(blank),[ed,setEd]=useState(null),[msg,setMsg]=useState('')
 const res=r=>setMsg(r.error?'Error: '+r.error:r.password?'Account created. Temporary password (shown once, simulated invite): '+r.password:'Changes saved')
 return <Card className="mb-4 space-y-3"><h2 className="font-semibold">Manage Officers</h2><p className="text-xs text-slate-500">Access is set automatically from designation and assigned office/department. Officers cannot change their own.</p>
  <form onSubmit={e=>{e.preventDefault();const r=createOfficer(f);res(r);if(!r.error)setF(blank)}} className="space-y-2"><p className="text-sm font-medium">Create officer account</p><OfficerFields f={f} setF={setF}/><button className="btn">Create officer</button></form>
  {msg&&<p className="text-sm text-teal-700 break-words">{msg}</p>}
  {ed&&<form onSubmit={e=>{e.preventDefault();const r=updateOfficer(ed.id,ed);res(r);if(!r.error)setEd(null)}} className="space-y-2 bg-slate-50 p-3 rounded-lg"><p className="text-sm font-medium">Edit / reassign officer</p><OfficerFields f={ed} setF={setEd}/><div className="flex gap-2"><button className="btn">Save</button><button type="button" className="btn2" onClick={()=>setEd(null)}>Cancel</button></div></form>}
  <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>Name</th><th>Email</th><th>Designation</th><th>Jurisdiction</th><th>Status</th><th></th></tr></thead><tbody>
   {db.users.filter(x=>x.role==='officer').map(o=><tr key={o.id} className="border-t"><td className="py-1">{o.name}</td><td>{o.email}</td><td>{LEVELS[o.level]}</td><td>{jur(o)}</td><td>{o.active===false?'Inactive':'Active'}</td>
    <td className="whitespace-nowrap">{o.level!=='dc'&&<><button className="btn2 !py-1 mr-1" onClick={()=>setEd({id:o.id,name:o.name,email:o.email,level:o.level,dept:o.dept||DEPTS[0],office:o.office||OFFICES[0]})}>Edit</button><button className="btn2 !py-1" onClick={()=>setActive(o.id,o.active===false)}>{o.active===false?'Reactivate':'Deactivate'}</button></>}</td></tr>)}</tbody></table></div>
  <div><p className="text-sm font-medium mb-1">Audit history</p><div className="max-h-40 overflow-auto text-xs text-slate-600 space-y-1">{db.audit.length===0&&<p>No changes yet.</p>}{db.audit.map(a=><p key={a.id}>{fmt(a.at)} · {a.by} · <b>{a.action}</b> {a.target}: {a.detail}</p>)}</div></div></Card>}
export default function OfficerDash(){const db=useDB(),u=me(),all=visible(u),[st,setSt]=useState(''),[dp,setDp]=useState(''),[prio,setPrio]=useState(''),[q,setQ]=useState(''),[nw,setNw]=useState({name:'',phone:''})
 const prioOrder = { P1: 0, P2: 1, P3: 2, P4: 3 }
 const cs=all
  .filter(c=>(!st||c.status===st)&&(!dp||(dp===CENTRAL?!c.currentDept:c.depts.includes(dp)))&&(!prio||c.priority===prio)&&(!q||(c.id+c.title+c.description).toLowerCase().includes(q.toLowerCase())))
  .sort((a,b)=>(prioOrder[a.priority]??2)-(prioOrder[b.priority]??2))
 const roster=rosterFor(u),grp=u.dept||u.office||'Local office'
 return <Shell links={[['/officer','Complaints',LayoutDashboard]]}><h1 className="text-xl font-bold">{LEVELS[u.level]}</h1><p className="text-sm text-slate-500 mb-4">{u.level==='dc'?'All departments and offices':u.dept||u.office}</p>
 <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4"><Stat label="Total" value={all.length}/><Stat label="P1 Critical" value={all.filter(c=>c.priority==='P1').length}/><Stat label="New" value={cnt(all,['Submitted','Forwarded'])}/><Stat label="Assigned" value={cnt(all,['Assigned'])}/><Stat label="In progress" value={cnt(all,['In Progress','Rejected – Rework Required'])}/><Stat label="Resolved" value={cnt(all,['Resolved'])}/></div>
 {u.level==='dc'&&<Card className="mb-4 overflow-x-auto"><h2 className="font-semibold mb-2">Department performance</h2><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>Department</th><th>Total</th><th>Pending</th><th>Resolved</th><th>Rate</th></tr></thead><tbody>
  {DEPTS.map(d=>{const x=all.filter(c=>d===CENTRAL?!c.currentDept:c.depts.includes(d)),r=cnt(x,['Resolved']);return <tr key={d} className="border-t"><td className="py-1">{d}</td><td>{x.length}</td><td>{x.length-r}</td><td>{r}</td><td>{x.length?Math.round(r/x.length*100)+'%':'—'}</td></tr>})}</tbody></table></Card>}
 {u.level==='dc'&&<ManageOfficers/>}
 <div className="flex gap-2 flex-wrap mb-3"><input className="inp !w-48" placeholder="Search" value={q} onChange={e=>setQ(e.target.value)}/>
  <select className="inp !w-auto" value={st} onChange={e=>setSt(e.target.value)}><option value="">All statuses</option>{['Submitted','Under Review','Assigned','In Progress','Forwarded','Awaiting Officer Verification','Rejected – Rework Required','Resolved'].map(s=><option key={s}>{s}</option>)}</select>
  <select className="inp !w-auto font-medium" value={prio} onChange={e=>setPrio(e.target.value)}><option value="">All priorities</option><option value="P1">P1 Critical</option><option value="P2">P2 High</option><option value="P3">P3 Medium</option><option value="P4">P4 Low</option></select>
  {u.level==='dc'&&<select className="inp !w-auto" value={dp} onChange={e=>setDp(e.target.value)}><option value="">All departments</option>{DEPTS.map(d=><option key={d}>{d}</option>)}</select>}</div>
 <Card className="mb-3 text-sm"><b>Workers ({roster.length})</b>: {roster.map(w=>w.name).join(', ')||'none'} <p className="text-xs text-slate-500">Workers have no website account; they only receive task links.</p>
  {u.level!=='dc'&&<div className="flex gap-2 mt-2 flex-wrap"><input className="inp !w-40" placeholder="Name" value={nw.name} onChange={e=>setNw({...nw,name:e.target.value})}/><input className="inp !w-40" placeholder="Phone (with country code)" value={nw.phone} onChange={e=>setNw({...nw,phone:e.target.value})}/>
  <button className="btn2" disabled={!nw.name||!nw.phone} onClick={()=>{addWorker(nw.name,nw.phone,grp);setNw({name:'',phone:''})}}>Add worker</button></div>}</Card>
 <div className="space-y-3">{cs.length===0&&<p className="text-sm text-slate-500">No complaints match.</p>}{cs.map(c=><Item key={c.id+c.status+c.workerId} c={c} u={u} roster={roster}/>)}</div></Shell>}
