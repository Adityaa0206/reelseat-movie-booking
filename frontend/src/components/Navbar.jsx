import {useState} from 'react';import {Link,NavLink,useNavigate} from 'react-router-dom';import {Search,MapPin,User,Ticket,LogOut} from 'lucide-react';
import {useAuth} from '../context/AuthContext.jsx';import {CITIES} from '../data/mockData.js';
export default function Navbar(){const {isAuthed,user,logout}=useAuth();const nav=useNavigate();const [q,setQ]=useState('');const [city,setCity]=useState(CITIES[0]);
  const submit=e=>{e.preventDefault();nav(`/?q=${encodeURIComponent(q)}`);};
  return(<header className="nav"><Link to="/" className="logo">Reelseat</Link>
  <label className="city"><MapPin size={16}/><select value={city} onChange={e=>setCity(e.target.value)} aria-label="City">{CITIES.map(c=><option key={c}>{c}</option>)}</select></label>
  <form onSubmit={submit} className="search"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search movies by title" aria-label="Search movies"/></form>
  <nav className="navlinks"><NavLink to="/my-bookings"><Ticket size={16}/><span>My Bookings</span></NavLink>
  {isAuthed?<button className="link" onClick={()=>{logout();nav('/');}}><LogOut size={16}/><span>{user?.username||'Logout'}</span></button>:<NavLink to="/login"><User size={16}/><span>Login</span></NavLink>}</nav></header>)}
