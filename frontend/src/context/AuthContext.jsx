import {createContext,useContext,useState} from 'react';import * as auth from '../services/authService.js';
const Ctx=createContext(null);export const useAuth=()=>useContext(Ctx);
export function AuthProvider({children}){
  const [session,setSession]=useState(auth.getSession());
  const login=async(e,p)=>{const d=await auth.login(e,p);setSession({token:d.token,user:d.user});};
  const logout=()=>{auth.logout();setSession(null);};
  return <Ctx.Provider value={{user:session?.user,isAuthed:!!session,login,logout}}>{children}</Ctx.Provider>;}
