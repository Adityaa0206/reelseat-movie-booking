import {useState} from 'react';import {Navigate,useNavigate,useSearchParams} from 'react-router-dom';import {initiatePayment,releaseHold} from '../services/bookingService.js';
import useCountdown from '../hooks/useCountdown.js';import BookingSummary from '../components/BookingSummary.jsx';import {draft} from '../utils/format.js';
export default function Checkout(){const d=draft.get();const nav=useNavigate();const [p]=useSearchParams();const [busy,setBusy]=useState(false);const [msg,setMsg]=useState(p.get('status')==='failed'?'Payment failed. You have not been charged for a confirmed booking.':p.get('status')==='cancelled'?'Payment cancelled. Your seats stay held until the timer ends.':'');
const left=useCountdown(d?.hold?.expiresAt);if(!d?.hold)return <Navigate to="/" replace/>;
const pay=async()=>{setBusy(true);setMsg('');try{const r=await initiatePayment(d.hold.holdId);
  if(r.paymentUrl)window.location.assign(r.paymentUrl);else if(r.bookingId)nav(`/confirmation/${r.bookingId}`);else throw new Error('Server did not return a payment session.');}catch(e){setMsg(`Could not start payment: ${e.message}`);setBusy(false);}};
const cancel=async()=>{try{await releaseHold(d.hold.holdId);}catch{}draft.clear();nav('/');};
const expired=left===0;
return(<div className="split"><div><h2>Checkout</h2>{left!=null&&<p className={expired?'err':'timer'}>{expired?'Your hold expired. Select seats again.':`Seats held for ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`}</p>}
{msg&&<p className="err" role="alert">{msg}</p>}<p className="muted">You will see your booking only after the server confirms payment.</p></div>
<div><BookingSummary {...d}/><button className="btn full" disabled={busy||expired} onClick={pay}>{busy?'Starting payment':'Pay now'}</button><button className="btn ghost full" onClick={cancel}>Cancel booking</button></div></div>)}
