const jwt = require('jsonwebtoken');
const { HttpError } = require('./errors');

function decode(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  if (!process.env.JWT_SECRET) throw new HttpError(500, 'SERVER_MISCONFIGURED', 'Server authentication is not configured.');
  try {
    const p = jwt.verify(m[1], process.env.JWT_SECRET);
    const id = p.id ?? p.userId ?? p.user_id ?? p.sub;   // adapt if your token uses another claim
    return id == null ? null : String(id);
  } catch (_) { return null; }
}
const requireAuth = (req, _res, next) => {
  try {
    const id = decode(req);
    if (!id) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
    req.userId = id; next();
  } catch (e) { next(e); }
};
const optionalAuth = (req, _res, next) => { try { req.userId = decode(req); } catch (_) { req.userId = null; } next(); };
module.exports = { requireAuth, optionalAuth };
