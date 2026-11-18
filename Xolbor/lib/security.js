'use strict';
const crypto = require('node:crypto');
function hash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function cookieToken(req) {
  const match = /(?:^|;\s*)xolbor_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '');
  if (match) return match[1];
  const bearer = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
  return bearer?.[1] || null;
}
function sessions(store) {
  const db = store.db;
  function resolve(req) {
    const token = cookieToken(req);
    if (!token) return null;
    const row = db.prepare('SELECT user_id FROM sessions WHERE hash=? AND expires_at>?').get(hash(token), Date.now());
    return row ? store.userById(row.user_id) : null;
  }
  function issue(req, res, user) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(hash(token), user.id, Date.now(), Date.now() + 7 * 86400000, String(req.headers['user-agent'] || 'Inconnu').slice(0, 200));
    res.cookie('xolbor_session', token, { httpOnly:true, sameSite:'strict', secure:process.env.NODE_ENV === 'production', maxAge:7 * 86400000, path:'/' });
  }
  function revoke(req) { const token = cookieToken(req); if (token) db.prepare('DELETE FROM sessions WHERE hash=?').run(hash(token)); }
  return { resolve, issue, revoke, cookieToken, hash };
}
function limiter({ limit=100, windowMs=60000, maxBuckets=10000 }={}) {
  const buckets = new Map();
  return (req,res,next) => {
    const now=Date.now(), key=req.ip;
    if (buckets.size >= maxBuckets && !buckets.has(key)) {
      for (const [k,b] of buckets) if (b.until<=now) buckets.delete(k);
      if (buckets.size >= maxBuckets) return res.status(503).json({error:'Serveur occupé. Réessayez plus tard.'});
    }
    let b=buckets.get(key);
    if (!b || b.until<=now) { b={ count:0, until:now+windowMs }; buckets.set(key,b); }
    if (++b.count>limit) { res.set('Retry-After', String(Math.ceil((b.until-now)/1000))); return res.status(429).json({error:'Trop de requêtes. Réessayez plus tard.'}); }
    next();
  };
}
function protect(app, origins) {
  app.disable('x-powered-by');
  app.use((req,res,next) => {
    res.set('X-Content-Type-Options','nosniff'); res.set('Referrer-Policy','same-origin');
    res.set('X-Frame-Options','SAMEORIGIN');
    if (req.path.startsWith('/api/')) {
      res.set('Cache-Control','no-store');
      if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
        const origin=req.headers.origin;
        if ((origin && !origins.has(origin)) || req.headers['sec-fetch-site']==='cross-site') return res.status(403).json({error:'Origine refusée'});
        if (!req.is('application/json')) return res.status(415).json({error:'JSON requis'});
      }
    }
    next();
  });
  app.use('/api/', limiter({limit:240}));
  app.use(['/api/login','/api/register'], limiter({limit:20,windowMs:900000}));
}
module.exports={sessions,limiter,protect};
