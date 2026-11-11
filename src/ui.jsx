import {NavLink,useNavigate} from 'react-router-dom'
import {useState} from 'react'
import {Bell,LogOut,Menu,Landmark,MapPin} from 'lucide-react'
import {useDB,me,logout,markRead} from './store'
export const STAGES=['Submitted','Under Review','Assigned','In Progress','Resolved']
const IDX={Submitted:0,'Under Review':1,Forwarded:1,Assigned:2,'In Progress':3,'Awaiting Officer Verification':3,'Rejected – Rework Required':3,Resolved:4}
const col={Submitted:'bg-slate-100 text-slate-700','Under Review':'bg-sky-100 text-sky-700',Forwarded:'bg-indigo-100 text-indigo-700',Assigned:'bg-blue-100 text-blue-700','In Progress':'bg-amber-100 text-amber-700','Awaiting Officer Verification':'bg-purple-100 text-purple-700','Rejected – Rework Required':'bg-red-100 text-red-700',Resolved:'bg-teal-100 text-teal-700'}
export const fmt=d=>new Date(d).toLocaleString()
export const Badge=({s})=><span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${col[s]}`}>{s}</span>
export const Prio=({p})=><span className={`text-xs font-medium ${p==='High'?'text-red-600':p==='Low'?'text-slate-500':'text-amber-600'}`}>{p} priority</span>
export const PriorityBadge = ({ p, lifeSafety }) => {
  const styles = {
    P1: "bg-red-100 text-red-800 border-red-200",
    P2: "bg-orange-100 text-orange-800 border-orange-200",
    P3: "bg-blue-100 text-blue-800 border-blue-200",
    P4: "bg-slate-100 text-slate-700 border-slate-200",
  };
  const labels = {
    P1: "P1 Critical",
    P2: "P2 High",
    P3: "P3 Medium",
    P4: "P4 Low",
  };
  const band = p || "P3";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[band] || styles.P3}`}>
      {lifeSafety && <span className="animate-pulse text-red-600 font-bold">⚠</span>}
      {labels[band] || band}
    </span>
  );
};
export const SLABadge = ({ deadline, slaHours, status }) => {
  if (status === "Resolved") {
    return <span className="text-xs text-teal-600 font-medium">SLA: Met</span>;
  }
  if (!deadline) {
    return slaHours ? <span className="text-xs text-slate-500 font-mono">SLA: {slaHours}h target</span> : null;
  }
  const diffMs = new Date(deadline).getTime() - Date.now();
  const diffHours = Math.round(diffMs / 36e5);
  const isBreached = diffMs < 0;
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${isBreached ? "bg-red-50 text-red-700 border-red-200 font-bold" : diffHours <= 6 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {isBreached ? `⚠ SLA Breached (${Math.abs(diffHours)}h ago)` : `⏱ SLA: ${diffHours}h left`}
    </span>
  );
};
export const Logo=()=><span className="flex items-center gap-2 font-bold text-blue-700"><span className="bg-gradient-to-br from-blue-600 to-teal-500 text-white p-1.5 rounded-lg"><Landmark size={18}/></span>CivicTrack</span>
export const Card=({children,className=''})=><div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 ${className}`}>{children}</div>
export const Stat=({label,value})=><Card><p className="text-2xl font-bold text-blue-700">{value}</p><p className="text-xs text-slate-500">{label}</p></Card>
export const Tracker=({s})=>{const i=IDX[s];return <div className="flex gap-1">{STAGES.map((x,k)=><div key={x} className="flex-1 text-center"><div className={`h-2 rounded ${k<=i?'bg-teal-500':'bg-slate-200'}`}/><p className={`text-[11px] sm:text-xs mt-1 ${k<=i?'text-teal-700 font-medium':'text-slate-400'}`}>{x}</p></div>)}</div>}
export const Photo=({src,label})=>src?<div><p className="text-xs text-slate-500 mb-1">{label}</p><img src={src} className="h-32 rounded-lg object-cover"/></div>:<p className="text-xs text-slate-400">No {label.toLowerCase()}</p>
export const Loc=({c})=><p className="text-sm text-slate-600 flex items-center gap-1"><MapPin size={14}/>{c.location} · Ward {c.ward}</p>
export function PhotoInput({value,onChange}){
 const pick=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const k=Math.min(1,600/i.width),c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);onChange(c.toDataURL('image/jpeg',.6))};i.src=r.result};r.readAsDataURL(f)}
 return <div><input type="file" accept="image/*" onChange={pick} className="text-sm"/>{value&&<img src={value} className="mt-2 h-32 rounded-lg object-cover"/>}</div>}
export function Shell({links,children}){
 const db=useDB(),u=me(),nav=useNavigate(),[o,setO]=useState(false),[m,setM]=useState(false)
 const ns=db.notes.filter(n=>n.uid===u.id),un=ns.filter(n=>!n.read).length
 return <div className="min-h-screen bg-slate-50">
 <header className="bg-white border-b px-4 h-14 flex items-center justify-between sticky top-0 z-20">
  <div className="flex items-center gap-2"><button className="md:hidden" onClick={()=>setM(!m)}><Menu/></button><Logo/></div>
  <div className="flex items-center gap-3 relative">
   <span className="text-sm text-slate-500 hidden sm:block capitalize">{u.name} · {u.role}</span>
   <button onClick={()=>{setO(!o);markRead(u.id)}} className="relative p-2"><Bell size={20}/>{un>0&&<span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] rounded-full px-1">{un}</span>}</button>
   {o&&<div className="absolute right-8 top-11 w-72 bg-white border rounded-xl shadow-lg max-h-80 overflow-auto">{ns.length?ns.map(n=><div key={n.id} className="p-3 border-b text-sm">{n.text}<p className="text-[10px] text-slate-400">{fmt(n.at)}</p></div>):<p className="p-3 text-sm">No notifications</p>}</div>}
   <button onClick={()=>{logout();nav('/')}} title="Logout"><LogOut size={20}/></button></div></header>
 <div className="flex">
  <aside className={`${m?'block':'hidden'} md:block w-56 shrink-0 bg-white border-r min-h-[calc(100vh-3.5rem)] p-3 space-y-1`}>
   {links.map(([to,label,I])=><NavLink key={to} to={to} end onClick={()=>setM(false)} className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isActive?'bg-blue-600 text-white':'text-slate-600 hover:bg-slate-100'}`}><I size={16}/>{label}</NavLink>)}</aside>
  <main className="flex-1 p-4 md:p-6 min-w-0 max-w-5xl">{children}</main></div></div>}
