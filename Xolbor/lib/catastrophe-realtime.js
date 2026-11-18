'use strict';
const { profileAvatar } = require('./profile-avatars');
const { randomUUID, randomBytes, randomInt } = require('node:crypto');

function chance(exponent) {
  const bits = Math.ceil(exponent * Math.log2(10)), bytes = Math.ceil(bits / 8), range = 10n ** BigInt(exponent);
  let n;
  do {
    const b = randomBytes(bytes);
    b[0] &= (1 << (bits % 8 || 8)) - 1;
    n = BigInt('0x' + b.toString('hex'));
  } while (n >= range);
  return n === 0n;
}

function nextTornado() {
  const roll = randomInt(100), mutation = roll < 6 ? 'Amour' : roll < 12 ? 'Radioactive' : roll < 17 ? 'Électrique' : roll < 21 ? 'Glaciale' : null;
  const color = randomInt(6);
  if (chance(95)) return { model: 10, rarity: 'Hacker', mutation, color, start: Date.now() };
  if (chance(17)) return { model: 9, rarity: 'OG', mutation, color, start: Date.now() };
  if (randomInt(100) < 2) return { model: 8, rarity: 'Secret', mutation, color, start: Date.now() };
  return { model: randomInt(8), rarity: 'Commun', mutation, color, start: Date.now() };
}

const TORNADO_NAMES = ['Cyclone Bonbon', 'Spirale Astrale', 'Tourbillon Taz', 'Tempête Oméga', 'Cyclone Acide', 'Tornade Sauvage', 'Ouragan Fantôme', 'Tourbillon Orageux', 'Secret : Vortex Zéro', 'OG : Cyclone Originel', 'Hacker : Tempête Système'];
const PRICE = { Commun: 50, Secret: 500, OG: 5000, Hacker: 50000 };
const INCOME_PER_SECOND = { Commun: 1, Secret: 5, OG: 25, Hacker: 100 };
const BASES = [-5, 64, -74].flatMap(z => [{ x: -32, z }, { x: 32, z }]);
const CAPACITY = 6;

function installCatastrophe({ io, auth, store }) {
  store.db.exec('CREATE TABLE IF NOT EXISTS catastrophe_accounts (user_id TEXT PRIMARY KEY REFERENCES users(id), dollars INTEGER NOT NULL DEFAULT 100 CHECK(dollars>=0))');
  store.db.exec('CREATE TABLE IF NOT EXISTS catastrophe_owned (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), model INTEGER NOT NULL, rarity TEXT NOT NULL, mutation TEXT, color INTEGER NOT NULL, created_at INTEGER NOT NULL)');
  const columns = new Set(store.db.prepare('PRAGMA table_info(catastrophe_owned)').all().map(column => column.name));
  if (!columns.has('income_collected_at')) {
    store.db.exec('ALTER TABLE catastrophe_owned ADD COLUMN income_collected_at INTEGER NOT NULL DEFAULT 0');
    store.db.exec('UPDATE catastrophe_owned SET income_collected_at=created_at WHERE income_collected_at=0');
  }

  const nsp = io.of('/catastrophe'), rooms = new Map();
  nsp.use((socket, next) => {
    const user = auth.resolve(socket.request);
    if (!user) return next(new Error('Connexion requise'));
    socket.data.userId = user.id;
    next();
  });

  const account = userId => store.db.prepare('SELECT dollars FROM catastrophe_accounts WHERE user_id=?').get(userId).dollars;
  const owned = userId => store.db.prepare('SELECT id,user_id,model,rarity,mutation,color,created_at,income_collected_at FROM catastrophe_owned WHERE user_id=? ORDER BY created_at,id').all(userId);
  const slotPosition = (baseIndex, index) => {
    const base = BASES[baseIndex];
    const column = index % 4, row = Math.floor(index / 4);
    return { x: (base.x < 0 ? -37.5 : 25) + column * 5, z: base.z + (row === 0 ? -9 : 8) };
  };
  const isInside = (player, baseIndex) => {
    const base = BASES[baseIndex];
    return Math.abs(player.x - base.x) < 17 && Math.abs(player.z - base.z) < 13;
  };
  const pendingFor = (item, now) => Math.floor(Math.max(0, now - item.income_collected_at) / 1000) * INCOME_PER_SECOND[item.rarity];

  const state = room => {
    const now = Date.now();
    return {
      serverTime: now,
      players: [...room.players.values()].map(p => ({
        id: p.id, username: p.username, verified: p.verified, avatar: p.avatar, base: p.base,
        dollars: account(p.id),
        owned: owned(p.id).map((item, index) => ({
          ...item,
          name: TORNADO_NAMES[item.model],
          incomeRate: INCOME_PER_SECOND[item.rarity],
          pending: pendingFor(item, now),
          slot: slotPosition(p.base, index),
          delivery: room.deliveries[item.id] || null,
          carriedBy: room.carrying[item.id]?.userId || null
        })),
        x: p.x, y: p.y, z: p.z, rotation: p.rotation, moving: p.moving, jumping: p.jumping
      })),
      carrying: Object.entries(room.carrying).map(([itemId, carry]) => {
        const item = store.db.prepare('SELECT id,model,rarity,mutation,color FROM catastrophe_owned WHERE id=?').get(itemId);
        return item ? { ...item, name: TORNADO_NAMES[item.model], carrierId: carry.userId } : null;
      }).filter(Boolean),
      locks: room.locks,
      tornadoes: room.tornadoes.map(t => ({ ...t, name: TORNADO_NAMES[t.model], price: PRICE[t.rarity] }))
    };
  };
  const publish = room => nsp.to(room.id).emit('state', state(room));
  const openHold = (socket, player, hold, ack) => {
    if (!auth.resolve(socket.request)) return ack({ error: 'Connexion requise.' });
    if (player.hold) return ack({ error: 'Une action est déjà en cours.' });
    player.hold = hold;
    ack({ ok: true });
  };
  const cancelHold = (room, player) => {
    if (player.hold?.itemId) delete room.reservations[player.hold.itemId];
    player.hold = null;
  };
  const collect = userId => {
    const now = Date.now(), items = owned(userId);
    const total = items.reduce((sum, item) => sum + pendingFor(item, now), 0);
    if (total) {
      store.transaction(() => {
        store.db.prepare('UPDATE catastrophe_accounts SET dollars=dollars+? WHERE user_id=?').run(total, userId);
        store.db.prepare('UPDATE catastrophe_owned SET income_collected_at=? WHERE user_id=?').run(now, userId);
      });
    }
    return { collected: total, dollars: account(userId) };
  };

  nsp.on('connection', socket => {
    const user = auth.resolve(socket.request);
    if (!user) return socket.disconnect(true);
    store.db.prepare('INSERT OR IGNORE INTO catastrophe_accounts(user_id,dollars) VALUES(?,100)').run(user.id);
    let room = [...rooms.values()].find(r => r.players.size < CAPACITY && ![...r.players.values()].some(p => p.id === user.id));
    if (!room) {
      room = { id: randomUUID(), players: new Map(), locks: Array(CAPACITY).fill(0), tornadoes: [nextTornado()], lastTornado: Date.now(), deliveries: {}, carrying: {}, reservations: {} };
      rooms.set(room.id, room);
    }
    const used = new Set([...room.players.values()].map(p => p.base));
    const base = BASES.findIndex((_, i) => !used.has(i));
    const spawnX = (base - 2.5) * 5;
    const player = { id: user.id, username: user.username, verified: !!user.founder, avatar: profileAvatar(user), base, x: spawnX, y: 0, z: 48, rotation: 0, moving: false, jumping: false, inside: false, lastUpdate: Date.now(), hold: null, carrying: null };
    room.players.set(socket.id, player);
    socket.join(room.id);
    socket.emit('welcome', { id: user.id, base, bases: BASES, spawn: { x: spawnX, z: 48 }, dollars: account(user.id), ...state(room) });
    publish(room);

    const tornadoZ = t => -94 + 188 * Math.max(0, Math.min(1, (Date.now() - t.start) / 22000));
    const nearTornado = t => Math.hypot(player.x, player.z - tornadoZ(t)) <= 10;
    const isOpen = baseIndex => room.locks[baseIndex] <= Date.now();
    const validStealTarget = (itemId, ownerId) => {
      const owner = [...room.players.values()].find(p => p.id === ownerId);
      if (!owner || owner.id === player.id || !isOpen(owner.base)) return null;
      const items = owned(ownerId), index = items.findIndex(item => item.id === itemId);
      if (index < 0 || room.carrying[itemId]) return null;
      const pos = slotPosition(owner.base, index);
      return Math.hypot(player.x - pos.x, player.z - pos.z) <= 8 ? { owner, item: items[index], pos } : null;
    };

    socket.on('move', data => {
      if (!auth.resolve(socket.request)) return socket.disconnect(true);
      if (!data || ![data.x, data.y, data.z, data.rotation].every(Number.isFinite)) return;
      const now = Date.now(), elapsed = Math.max(.05, Math.min(1, (now - player.lastUpdate) / 1000)), dx = data.x - player.x, dz = data.z - player.z, dist = Math.hypot(dx, dz), limit = 24 * elapsed + 2;
      let nextX = dist > limit ? player.x + dx / dist * limit : data.x, nextZ = dist > limit ? player.z + dz / dist * limit : data.z;
      const inPlot = (x, z, b) => Math.abs(x - b.x) < 14 && Math.abs(z - b.z) < 13;
      const denied = BASES.some((b, i) => i !== player.base && room.locks[i] > now && !inPlot(player.x, player.z, b) && inPlot(nextX, nextZ, b));
      if (denied) { nextX = player.x; nextZ = player.z; socket.emit('correction', { x: nextX, z: nextZ }); }
      const overlaps = (x, z) => [...room.players.values()].some(other => {
        if (other === player) return false;
        const vx = x - player.x, vz = z - player.z, len = vx * vx + vz * vz, old = Math.hypot(player.x - other.x, player.z - other.z), end = Math.hypot(x - other.x, z - other.z);
        if (old < 2.4) return end < old - .0001;
        const t = len ? Math.max(0, Math.min(1, ((other.x - player.x) * vx + (other.z - player.z) * vz) / len)) : 0;
        return Math.hypot(player.x + vx * t - other.x, player.z + vz * t - other.z) < 2.4;
      });
      if (overlaps(nextX, nextZ)) { nextX = player.x; nextZ = player.z; socket.emit('correction', { x: nextX, z: nextZ, reason: 'player' }); }
      player.x = Math.max(-60, Math.min(60, nextX));
      player.z = Math.max(-98, Math.min(98, nextZ));
      player.y = Math.max(-5, Math.min(15, data.y));
      player.rotation = data.rotation;
      player.moving = !!data.moving && !denied;
      player.jumping = !!data.jumping;
      player.lastUpdate = now;

      if (player.hold) {
        const hold = player.hold;
        const stillNear = hold.type === 'buy'
          ? room.tornadoes.some(t => t.start === hold.start && t.model === hold.model && nearTornado(t))
          : hold.type === 'steal' ? !!validStealTarget(hold.itemId, hold.ownerId)
            : hold.type === 'sell' && Math.hypot(player.x - hold.x, player.z - hold.z) <= 8;
        if (!stillNear) cancelHold(room, player);
      }

      if (player.carrying) {
        const touched = [...room.players.values()].some(other => other !== player && Math.hypot(player.x - other.x, player.z - other.z) < 2.5);
        if (touched) {
          delete room.carrying[player.carrying];
          player.carrying = null;
          socket.emit('action-result', { error: 'Un joueur t’a touché : la tornade est retournée dans sa base.' });
        } else if (isInside(player, player.base)) {
          const itemId = player.carrying;
          store.db.prepare('UPDATE catastrophe_owned SET user_id=?,created_at=?,income_collected_at=? WHERE id=?').run(player.id, now, now, itemId);
          delete room.carrying[itemId];
          player.carrying = null;
          socket.emit('action-result', { message: 'Tornade volée et installée dans ta base !' });
        }
      }

      const inside = isInside(player, player.base);
      if (inside && !player.inside) {
        room.locks[player.base] = now + 30000;
        const result = collect(player.id);
        socket.emit('wallet', result);
      }
      player.inside = inside;
      publish(room);
    });

    socket.on('buy-start', (data, ack) => {
      if (typeof ack !== 'function') return;
      const tornado = room.tornadoes.find(t => t.start === data?.start && t.model === data?.model);
      if (!tornado || !nearTornado(tornado)) return ack({ error: 'Approche-toi de la tornade.' });
      if (owned(user.id).length >= CAPACITY) return ack({ error: 'Ta base est pleine : vends une tornade avant d’en acheter une autre.' });
      openHold(socket, player, { type: 'buy', start: tornado.start, model: tornado.model, since: Date.now() }, ack);
    });
    socket.on('buy-cancel', () => cancelHold(room, player));
    socket.on('buy-finish', ack => {
      if (typeof ack !== 'function') return;
      const hold = player.hold;
      cancelHold(room, player);
      if (!hold || hold.type !== 'buy' || Date.now() - hold.since < 4900) return ack({ error: 'Maintiens E pendant 5 secondes.' });
      if (!auth.resolve(socket.request)) return ack({ error: 'Connexion requise.' });
      const tornado = room.tornadoes.find(t => t.start === hold.start && t.model === hold.model);
      if (!tornado || !nearTornado(tornado)) return ack({ error: 'Reste près de la tornade pendant l’achat.' });
      if (owned(user.id).length >= CAPACITY) return ack({ error: 'Ta base est pleine : vends une tornade avant d’en acheter une autre.' });
      const price = PRICE[tornado.rarity];
      if (account(user.id) < price) return ack({ error: 'Pas assez de dollars.' });
      const now = Date.now(), itemId = randomUUID();
      store.transaction(() => {
        store.db.prepare('UPDATE catastrophe_accounts SET dollars=dollars-? WHERE user_id=?').run(price, user.id);
        store.db.prepare('INSERT INTO catastrophe_owned (id,user_id,model,rarity,mutation,color,created_at,income_collected_at) VALUES(?,?,?,?,?,?,?,?)').run(itemId, user.id, tornado.model, tornado.rarity, tornado.mutation, tornado.color, now, now);
      });
      room.deliveries[itemId] = { start: now, x: player.x, z: player.z };
      room.tornadoes = room.tornadoes.filter(t => t !== tornado);
      publish(room);
      ack({ ok: true, dollars: account(user.id) });
    });

    socket.on('steal-start', (data, ack) => {
      if (typeof ack !== 'function') return;
      if (!auth.resolve(socket.request)) return ack({ error: 'Connexion requise.' });
      if (player.carrying) return ack({ error: 'Ramène d’abord la tornade que tu portes à ta base.' });
      const target = validStealTarget(data?.itemId, data?.ownerId);
      if (!target) return ack({ error: 'Cette base est verrouillée ou tu es trop loin.' });
      if (owned(user.id).length >= CAPACITY) return ack({ error: 'Ta base est pleine : libère un emplacement avant de voler.' });
      if (room.reservations[data.itemId]) return ack({ error: 'Quelqu’un essaie déjà de voler cette tornade.' });
      if (player.hold) return ack({ error: 'Une action est déjà en cours.' });
      room.reservations[data.itemId] = socket.id;
      openHold(socket, player, { type: 'steal', itemId: data.itemId, ownerId: data.ownerId, since: Date.now() }, ack);
    });
    socket.on('steal-cancel', () => cancelHold(room, player));
    socket.on('steal-finish', ack => {
      if (typeof ack !== 'function') return;
      const hold = player.hold;
      cancelHold(room, player);
      if (!hold || hold.type !== 'steal' || Date.now() - hold.since < 4900) return ack({ error: 'Maintiens E pendant 5 secondes.' });
      if (!auth.resolve(socket.request)) return ack({ error: 'Connexion requise.' });
      if (!validStealTarget(hold.itemId, hold.ownerId)) return ack({ error: 'La base est verrouillée ou tu n’es plus assez proche.' });
      if (owned(user.id).length >= CAPACITY) return ack({ error: 'Ta base est pleine.' });
      player.carrying = hold.itemId;
      room.carrying[hold.itemId] = { userId: player.id };
      const item = store.db.prepare('SELECT user_id,rarity,income_collected_at FROM catastrophe_owned WHERE id=?').get(hold.itemId);
      const accrued = pendingFor(item, Date.now());
      store.transaction(() => {
        if (accrued) store.db.prepare('UPDATE catastrophe_accounts SET dollars=dollars+? WHERE user_id=?').run(accrued, item.user_id);
        store.db.prepare('UPDATE catastrophe_owned SET income_collected_at=? WHERE id=?').run(Date.now(), hold.itemId);
      });
      publish(room);
      ack({ ok: true });
    });

    socket.on('sell-start', (data, ack) => {
      if (typeof ack !== 'function') return;
      const items = owned(user.id), index = items.findIndex(item => item.id === data?.itemId);
      if (index < 0 || room.carrying[data.itemId]) return ack({ error: 'Cette tornade ne peut pas être vendue.' });
      const pos = slotPosition(player.base, index);
      if (Math.hypot(player.x - pos.x, player.z - pos.z) > 8) return ack({ error: 'Approche-toi de ta tornade.' });
      openHold(socket, player, { type: 'sell', itemId: data.itemId, x: pos.x, z: pos.z, since: Date.now() }, ack);
    });
    socket.on('sell-cancel', () => cancelHold(room, player));
    socket.on('sell-finish', ack => {
      if (typeof ack !== 'function') return;
      const hold = player.hold;
      cancelHold(room, player);
      if (!hold || hold.type !== 'sell' || Date.now() - hold.since < 4900) return ack({ error: 'Maintiens E pendant 5 secondes.' });
      if (!auth.resolve(socket.request)) return ack({ error: 'Connexion requise.' });
      const items = owned(user.id), item = items.find(entry => entry.id === hold.itemId);
      if (!item || room.carrying[hold.itemId] || Math.hypot(player.x - hold.x, player.z - hold.z) > 8) return ack({ error: 'Tu es trop loin de ta tornade.' });
      const refund = Math.floor(PRICE[item.rarity] / 2);
      const collected = pendingFor(item, Date.now());
      store.transaction(() => {
        store.db.prepare('DELETE FROM catastrophe_owned WHERE id=? AND user_id=?').run(item.id, user.id);
        store.db.prepare('UPDATE catastrophe_accounts SET dollars=dollars+? WHERE user_id=?').run(refund + collected, user.id);
      });
      publish(room);
      ack({ ok: true, dollars: account(user.id), refund, collected });
    });

    socket.on('chat', (data, ack = () => {}) => {
      if (typeof ack !== 'function') ack = () => {};
      if (!auth.resolve(socket.request)) return ack({ error: 'Connexion requise.' });
      const text = typeof data?.text === 'string' ? data.text.trim() : '';
      if (!text || text.length > 200) return ack({ error: 'Message : 1 à 200 caractères.' });
      if (/(?:https?:|www\.)/i.test(text)) return ack({ error: 'Les liens sont désactivés dans le chat.' });
      const now = Date.now();
      if (now - (player.lastChat || 0) < 1000) return ack({ error: 'Attends une seconde avant de renvoyer un message.' });
      player.lastChat = now;
      nsp.to(room.id).emit('chat', { userId: player.id, username: player.username, verified: player.verified, text, time: now });
      ack({ ok: true });
    });
    socket.on('respawn', (ack = () => {}) => {
      if (typeof ack !== 'function') ack = () => {};
      if (!auth.resolve(socket.request)) return ack({ error: 'Connexion requise.' });
      const now = Date.now();
      if (now - (player.lastRespawn || 0) < 1000) return ack({ error: 'Patiente un instant.' });
      player.lastRespawn = now;
      Object.assign(player, { x: spawnX, y: 0, z: 48, rotation: 0, moving: false, jumping: false, inside: false, lastUpdate: now });
      ack({ ok: true, x: player.x, z: player.z });
      publish(room);
    });
    socket.on('disconnect', () => {
      cancelHold(room, player);
      if (player.carrying) delete room.carrying[player.carrying];
      room.players.delete(socket.id);
      room.locks[player.base] = 0;
      if (!room.players.size) rooms.delete(room.id);
      else publish(room);
    });
  });

  const tick = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      for (const [id, delivery] of Object.entries(room.deliveries)) if (now - delivery.start > 5000) delete room.deliveries[id];
      room.tornadoes = room.tornadoes.filter(t => now - t.start < 22000);
      if (now - room.lastTornado >= 5000) {
        room.tornadoes.push(nextTornado());
        room.lastTornado = now;
      }
      publish(room);
    }
  }, 1000);
  tick.unref();
  return { rooms };
}

module.exports = { installCatastrophe, BASES, INCOME_PER_SECOND, TORNADO_NAMES };
