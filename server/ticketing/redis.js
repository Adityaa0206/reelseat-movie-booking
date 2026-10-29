const Redis = require('ioredis');
const config = require('./config');
const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 2 });
redis.on('error', (e) => console.error('[redis]', e.message));

// Atomic multi-seat hold. ARGV: owner("userId|holdId"), ttlMs, userPrefix("userId|").
// Returns 0 on success, or the 1-based index of the first seat held by SOMEONE ELSE.
const HOLD = `
for i=1,#KEYS do
  local cur = redis.call('GET', KEYS[i])
  if cur and string.sub(cur,1,#ARGV[3]) ~= ARGV[3] then return i end
end
for i=1,#KEYS do redis.call('SET', KEYS[i], ARGV[1], 'PX', ARGV[2]) end
return 0`;
// Deletes only keys whose value equals owner. Returns number deleted.
const RELEASE = `
local n=0
for i=1,#KEYS do
  if redis.call('GET', KEYS[i]) == ARGV[1] then redis.call('DEL', KEYS[i]); n=n+1 end
end
return n`;
// Extends TTL only if ALL keys are still owned by owner. Returns 1/0.
const EXTEND = `
for i=1,#KEYS do
  if redis.call('GET', KEYS[i]) ~= ARGV[1] then return 0 end
end
for i=1,#KEYS do redis.call('PEXPIRE', KEYS[i], ARGV[2]) end
return 1`;

const holdKeys = async (keys, userId, holdId, ttlMs) =>
  Number(await redis.eval(HOLD, keys.length, ...keys, `${userId}|${holdId}`, String(ttlMs), `${userId}|`));
const releaseKeys = async (keys, userId, holdId) =>
  keys.length ? Number(await redis.eval(RELEASE, keys.length, ...keys, `${userId}|${holdId}`)) : 0;
const extendKeys = async (keys, userId, holdId, ttlMs) =>
  Number(await redis.eval(EXTEND, keys.length, ...keys, `${userId}|${holdId}`, String(ttlMs))) === 1;

module.exports = { redis, holdKeys, releaseKeys, extendKeys };
