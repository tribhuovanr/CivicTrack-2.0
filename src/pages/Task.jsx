import {useParams} from 'react-router-dom'
import {useState} from 'react'
import {Logo,Card,Photo,PhotoInput} from '../ui'
import {useDB,taskByToken,workerStart,workerComplete} from '../store'
// Public, token-scoped worker page. Shows only task fields (no citizen data, no account).
export default function Task(){const {token}=useParams();useDB();const r=taskByToken(token),[rm,setRm]=useState(''),[ph,setPh]=useState(null),[err,setErr]=useState('')
 const t=r.task
 return <div className="min-h-screen bg-slate-50 p-4 flex justify-center"><div className="w-full max-w-md space-y-3"><div className="flex justify-center"><Logo/></div>
 {r.error?<Card className="text-center text-red-600">{r.error}</Card>:<Card className="space-y-3">
  <p className="font-semibold">{t.id} · {t.title}</p><p className="text-sm">{t.description}</p><p className="text-sm text-slate-600">Location: {t.location}</p><Photo src={t.photo} label="Complaint photograph"/>
  <p className="text-xs text-slate-500">Status: {t.status}</p>
  {t.rejectNote&&t.status.startsWith('Rejected')&&<p className="text-sm bg-red-50 text-red-700 p-2 rounded">Rework required: {t.rejectNote}</p>}
  {t.submitted?<p className="text-sm text-purple-700">Completion submitted. Awaiting officer verification.</p>:
   ['Assigned','Rejected – Rework Required'].includes(t.status)?<button className="btn w-full" onClick={()=>workerStart(token)}>Start Work</button>:
   <div className="space-y-2"><textarea className="inp" placeholder="Remarks" value={rm} onChange={e=>setRm(e.target.value)}/><p className="text-xs">Completion photograph (required)</p><PhotoInput value={ph} onChange={setPh}/>
    {err&&<p className="text-xs text-red-600">{err}</p>}<button className="btn w-full" onClick={()=>!ph?setErr('Upload a photo as proof'):workerComplete(token,rm,ph)}>Mark as Completed</button></div>}</Card>}</div></div>}
