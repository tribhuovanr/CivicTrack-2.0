import {Routes,Route,Navigate} from 'react-router-dom'
import {useDB,me} from './store'
import {Landing,Login,Register} from './pages/Public'
import {CitizenDash,NewComplaint,Track} from './pages/Citizen'
import OfficerDash from './pages/Staff'
import Task from './pages/Task'
const G=({role,children})=>{useDB();const u=me();return u&&u.role===role?children:<Navigate to="/login" replace/>}
export default function App(){return <Routes>
 <Route path="/" element={<Landing/>}/><Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/>
 <Route path="/citizen" element={<G role="citizen"><CitizenDash/></G>}/>
 <Route path="/citizen/new" element={<G role="citizen"><NewComplaint/></G>}/>
 <Route path="/citizen/track/:id" element={<G role="citizen"><Track/></G>}/>
 <Route path="/officer" element={<G role="officer"><OfficerDash/></G>}/>
  <Route path="/task/:token" element={<Task/>}/>
 <Route path="*" element={<Navigate to="/"/>}/></Routes>}
