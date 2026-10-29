import {api} from './api.js';
// Real backend endpoints required. Nothing is simulated: failures are shown to the user.
// TODO(backend): POST /holds {showId,seatIds} -> {holdId,expiresAt}
export const holdSeats=(showId,seatIds)=>api('/holds',{method:'POST',body:{showId,seatIds}});
// TODO(backend): DELETE /holds/:holdId
export const releaseHold=id=>api(`/holds/${id}`,{method:'DELETE'});
// TODO(backend): POST /checkout {holdId} -> {bookingId,paymentUrl}
export const initiatePayment=holdId=>api('/checkout',{method:'POST',body:{holdId}});
// TODO(backend): GET /bookings/:id -> {id,status:'CONFIRMED'|'PENDING'|'FAILED',paymentStatus,movie,cinema,showtime,seats}
export const getBooking=id=>api(`/bookings/${id}`);
// Existing endpoint
export const getMyBookings=userId=>api(`/my-bookings/${userId}`);
