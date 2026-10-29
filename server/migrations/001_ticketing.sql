-- ReelSeat migration 001: seat holds / checkout / locations.
-- ADDITIVE ONLY: every table is new, prefixed "rs_" so nothing existing is touched. No DROP, no DELETE.
-- Run:  mysql -u <user> -p <database> < server/migrations/001_ticketing.sql
-- Money is stored as integer paise. Times are UTC.
-- rs_bookings.user_id references your existing users table id (type/name not visible to the author),
-- so no FOREIGN KEY is declared; add one yourself, e.g.:
--   ALTER TABLE rs_bookings ADD CONSTRAINT fk_rs_bookings_user FOREIGN KEY (user_id) REFERENCES users(id);
-- (user_id type must match users.id exactly.)

CREATE TABLE IF NOT EXISTS rs_cities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  state VARCHAR(100) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_rs_city (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rs_cinemas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  city_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255) NULL,
  data_source VARCHAR(20) NOT NULL DEFAULT 'SAMPLE',   -- 'SAMPLE' = development data, 'LIVE' = real feed
  UNIQUE KEY uq_rs_cinema (city_id, name),
  CONSTRAINT fk_rs_cinema_city FOREIGN KEY (city_id) REFERENCES rs_cities(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rs_screens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cinema_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  UNIQUE KEY uq_rs_screen (cinema_id, name),
  CONSTRAINT fk_rs_screen_cinema FOREIGN KEY (cinema_id) REFERENCES rs_cinemas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rs_screen_seats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  screen_id INT NOT NULL,
  row_label VARCHAR(4) NOT NULL,
  seat_number SMALLINT NOT NULL,
  category ENUM('STANDARD','PREMIUM','RECLINER') NOT NULL DEFAULT 'STANDARD',
  price_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  UNIQUE KEY uq_rs_seat (screen_id, row_label, seat_number),
  CONSTRAINT fk_rs_seat_screen FOREIGN KEY (screen_id) REFERENCES rs_screens(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rs_movies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  language VARCHAR(50) NULL,
  duration_min SMALLINT NULL,
  rating VARCHAR(10) NULL,
  UNIQUE KEY uq_rs_movie (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rs_showtimes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  movie_id INT NOT NULL,
  screen_id INT NOT NULL,
  starts_at DATETIME NOT NULL,
  base_price_paise INT NOT NULL,
  status ENUM('ACTIVE','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  UNIQUE KEY uq_rs_show (screen_id, starts_at),
  KEY ix_rs_show_time (starts_at),
  CONSTRAINT fk_rs_show_movie FOREIGN KEY (movie_id) REFERENCES rs_movies(id),
  CONSTRAINT fk_rs_show_screen FOREIGN KEY (screen_id) REFERENCES rs_screens(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rs_bookings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  showtime_id INT NOT NULL,
  hold_id CHAR(36) NOT NULL,
  status ENUM('PENDING_PAYMENT','CONFIRMED','CANCELLED','PAYMENT_FAILED','EXPIRED') NOT NULL,
  total_paise INT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  expires_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rs_booking_hold (hold_id),
  KEY ix_rs_booking_user (user_id),
  KEY ix_rs_booking_pending (status, expires_at),
  CONSTRAINT fk_rs_booking_show FOREIGN KEY (showtime_id) REFERENCES rs_showtimes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- active_key = 1 while the seat is taken (pending or confirmed); NULL once released.
-- The unique key makes double-selling a seat for one showtime impossible at the DB level.
CREATE TABLE IF NOT EXISTS rs_booking_seats (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT NOT NULL,
  showtime_id INT NOT NULL,
  seat_id INT NOT NULL,
  price_paise INT NOT NULL,
  active_key TINYINT NULL,
  UNIQUE KEY uq_rs_active_seat (showtime_id, seat_id, active_key),
  KEY ix_rs_bs_booking (booking_id),
  CONSTRAINT fk_rs_bs_booking FOREIGN KEY (booking_id) REFERENCES rs_bookings(id),
  CONSTRAINT fk_rs_bs_show FOREIGN KEY (showtime_id) REFERENCES rs_showtimes(id),
  CONSTRAINT fk_rs_bs_seat FOREIGN KEY (seat_id) REFERENCES rs_screen_seats(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rs_payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT NOT NULL,
  provider VARCHAR(30) NOT NULL,
  provider_payment_id VARCHAR(100) NOT NULL,
  amount_paise INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  verified_at DATETIME NULL,
  UNIQUE KEY uq_rs_payment (provider, provider_payment_id),
  CONSTRAINT fk_rs_pay_booking FOREIGN KEY (booking_id) REFERENCES rs_bookings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
