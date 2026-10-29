// Central API client. Base URL from VITE_API_BASE_URL (default: local Express server).
export const BASE=import.meta.env.VITE_API_BASE_URL||'http://localhost:3000/api';
export const getToken=()=>localStorage.getItem('auth_token'); // JWT only; passwords are never stored
export async function api(path,{method='GET',body,auth=true}={}){
  const t=getToken();
  let r;try{r=await fetch(BASE+path,{method,headers:{'Content-Type':'application/json',...(auth&&t?{Authorization:`Bearer ${t}`}:{})},body:body?JSON.stringify(body):undefined});}
  catch{throw Object.assign(new Error('Cannot reach the server. Check that the backend is running.'),{status:0});}
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(d.message||d.error||`Request failed (${r.status})`),{status:r.status});
  return d;}
