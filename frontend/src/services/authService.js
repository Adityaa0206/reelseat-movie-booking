import {api} from './api.js';
const K='auth_token',U='auth_user';
export const getSession=()=>{try{const t=localStorage.getItem(K);return t?{token:t,user:JSON.parse(localStorage.getItem(U)||'null')}:null}catch{return null}};
const save=d=>{localStorage.setItem(K,d.token);localStorage.setItem(U,JSON.stringify(d.user||{}));return d;};
export const login=async(email,password)=>save(await api('/auth/login',{method:'POST',body:{email,password},auth:false}));
export const register=(username,email,password)=>api('/auth/register',{method:'POST',body:{username,email,password},auth:false});
export const logout=()=>{localStorage.removeItem(K);localStorage.removeItem(U);};
// TODO(backend): POST /auth/forgot-password {email}; POST /auth/reset-password {token,password}
export const forgotPassword=email=>api('/auth/forgot-password',{method:'POST',body:{email},auth:false});
export const resetPassword=(token,password)=>api('/auth/reset-password',{method:'POST',body:{token,password},auth:false});
