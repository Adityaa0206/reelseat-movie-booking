// Drop-in API layer for the new ticketing endpoints. No UI/styling here.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEYS = ['token', 'accessToken', 'jwt'];           // adjust to the key your login code uses
const getToken = () => { for (const k of TOKEN_KEYS) { const v = localStorage.getItem(k); if (v) return v; } return null; };

export class ApiError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}
async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = auth && getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  let res;
  try { res = await fetch(`${BASE}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new ApiError(0, 'NETWORK', 'Cannot reach the server.'); }
  const data = await res.json().catch(() => ({}));
  // 501 from /checkout is an honest "payment not integrated" answer that carries the pending booking.
  if (!res.ok && !(path === '/checkout' && res.status === 501)) {
    const e = data.error || {};
    throw new ApiError(res.status, e.code || 'HTTP_' + res.status, e.message || `Request failed (${res.status})`, e);
  }
  return { ...data, httpStatus: res.status };
}

export const getCities = () => request('/cities', { auth: false });
export const getShows = (city) => request(`/shows?city=${encodeURIComponent(city)}`, { auth: false });
export const getShowSeats = (showtimeId) => request(`/shows/${showtimeId}/seats`);
export const holdSeats = (showtimeId, seatIds, holdId) => request('/holds', { method: 'POST', body: { showtimeId, seatIds, holdId } });
export const getHold = (holdId) => request(`/holds/${holdId}`);
export const releaseHold = (holdId) => request(`/holds/${holdId}`, { method: 'DELETE' });
export const checkout = (holdId) => request('/checkout', { method: 'POST', body: { holdId } });
export const cancelBooking = (id) => request(`/bookings/${id}/cancel`, { method: 'POST' });
export const myBookings = () => request('/bookings/mine');
