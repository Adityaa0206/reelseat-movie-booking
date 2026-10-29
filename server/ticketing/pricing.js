// All money is integer paise, computed ONLY on the server.
const seatPrice = (showtime, seat) => Math.round(showtime.base_price_paise * Number(seat.price_multiplier));
const totalPrice = (showtime, seats) => seats.reduce((s, x) => s + seatPrice(showtime, x), 0);
module.exports = { seatPrice, totalPrice };
