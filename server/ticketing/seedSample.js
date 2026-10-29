/* SAMPLE / DEVELOPMENT DATA ONLY. Fictional cinemas & movies. Not a live cinema feed.
   Idempotent: safe to re-run (uses INSERT IGNORE on unique keys). Usage: node ticketing/seedSample.js */
const { pool } = require('./db');

const CITIES = [['Hyderabad','Telangana'],['Mumbai','Maharashtra'],['Delhi','Delhi'],['Bengaluru','Karnataka'],['Vijayawada','Andhra Pradesh'],['Visakhapatnam','Andhra Pradesh']];
const MOVIES = [['Sample: Midnight Express','English',118,'UA'],['Sample: Monsoon Letters','Hindi',132,'U'],['Sample: Red Harbour','Telugu',145,'UA'],['Sample: The Last Orchard','English',101,'U'],['Sample: Neon Sprint','Hindi',126,'UA']];
const LAYOUTS = [ { rows: 8, cols: 12 }, { rows: 10, cols: 14 } ];     // different screens => different inventories
const TIMES = [[10,0],[14,0],[18,30],[21,45]];

(async () => {
  for (const [n, s] of CITIES) await pool.query(`INSERT IGNORE INTO rs_cities (name, state) VALUES (?, ?)`, [n, s]);
  for (const m of MOVIES) await pool.query(`INSERT IGNORE INTO rs_movies (title, language, duration_min, rating) VALUES (?,?,?,?)`, m);
  const [cities] = await pool.query(`SELECT id, name FROM rs_cities`);
  const [movies] = await pool.query(`SELECT id FROM rs_movies WHERE title LIKE 'Sample:%' ORDER BY id`);

  for (const [ci, city] of cities.entries()) {
    for (let k = 1; k <= 2; k++) {
      const cinemaName = `${city.name} Sample Cinema ${k}`;
      await pool.query(`INSERT IGNORE INTO rs_cinemas (city_id, name, address, data_source) VALUES (?,?,?, 'SAMPLE')`, [city.id, cinemaName, `Sample address ${k}, ${city.name}`]);
      const [[cinema]] = await pool.query(`SELECT id FROM rs_cinemas WHERE city_id=? AND name=?`, [city.id, cinemaName]);
      for (let sIdx = 0; sIdx < 2; sIdx++) {
        const layout = LAYOUTS[(ci + k + sIdx) % LAYOUTS.length];
        await pool.query(`INSERT IGNORE INTO rs_screens (cinema_id, name) VALUES (?,?)`, [cinema.id, `Screen ${sIdx + 1}`]);
        const [[screen]] = await pool.query(`SELECT id FROM rs_screens WHERE cinema_id=? AND name=?`, [cinema.id, `Screen ${sIdx + 1}`]);
        for (let r = 0; r < layout.rows; r++) {
          const rowLabel = String.fromCharCode(65 + r);
          const cat = r >= layout.rows - 2 ? ['RECLINER', 2.0] : r >= Math.floor(layout.rows / 2) ? ['PREMIUM', 1.5] : ['STANDARD', 1.0];
          for (let c = 1; c <= layout.cols; c++)
            await pool.query(`INSERT IGNORE INTO rs_screen_seats (screen_id,row_label,seat_number,category,price_multiplier) VALUES (?,?,?,?,?)`, [screen.id, rowLabel, c, cat[0], cat[1]]);
        }
        for (let day = 0; day < 4; day++) for (const [t, [h, mi]] of TIMES.entries()) {
          const movie = movies[(ci + k + sIdx + t + day) % movies.length];     // varies by city/cinema/screen
          await pool.query(
            `INSERT IGNORE INTO rs_showtimes (movie_id, screen_id, starts_at, base_price_paise)
             VALUES (?,?, DATE_ADD(DATE_ADD(UTC_DATE(), INTERVAL ? DAY), INTERVAL ? MINUTE), ?)`,
            [movie.id, screen.id, day, h * 60 + mi, 15000 + ((ci + k) % 3) * 5000]);
        }
      }
    }
  }
  console.log('Sample data seeded (SAMPLE / development only).');
  await pool.end();
})().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
