'use strict';
const { DatabaseSync, backup } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

class Store {
  constructor(filename) {
    if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        balance INTEGER NOT NULL CHECK(balance >= 0), payload TEXT NOT NULL CHECK(json_valid(payload)), version INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS documents(name TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)));
      CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
        created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, device TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
      CREATE TABLE IF NOT EXISTS wallet_ledger(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
        delta INTEGER NOT NULL, balance INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON wallet_ledger BEGIN SELECT RAISE(ABORT, 'immutable ledger'); END;
      CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON wallet_ledger BEGIN SELECT RAISE(ABORT, 'immutable ledger'); END;
      CREATE TABLE IF NOT EXISTS room_messages(id TEXT PRIMARY KEY, room_id TEXT NOT NULL, user_id TEXT NOT NULL,
        username TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS room_messages_recent ON room_messages(room_id,created_at);
      CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
        type TEXT NOT NULL, actor TEXT NOT NULL, reference_id TEXT NOT NULL, created_at INTEGER NOT NULL, read_at INTEGER);
      CREATE INDEX IF NOT EXISTS notifications_user_unread ON notifications(user_id,read_at,type);
      CREATE INDEX IF NOT EXISTS notifications_user_created ON notifications(user_id,created_at DESC);
      INSERT OR IGNORE INTO migrations VALUES(1, datetime('now'));`);
    // Existing pending friend requests already represent real unread events.
    // Historical chats had no read flag, so do not invent notification states for them.
    if(!this.db.prepare('SELECT 1 FROM migrations WHERE version=2').get())this.transaction(()=>{
      this.addPendingFriendNotifications();
      this.db.prepare("INSERT INTO migrations VALUES(2,datetime('now'))").run();
    });
  }
  addPendingFriendNotifications() {
    const add=this.db.prepare('INSERT INTO notifications(id,user_id,type,actor,reference_id,created_at) VALUES(?,?,?,?,?,?)');
    const exists=this.db.prepare("SELECT 1 FROM notifications WHERE user_id=? AND type='friend_request' AND reference_id=?");
    for(const user of this.users())for(const request of Array.isArray(user.friendRequests)?user.friendRequests:[]){
      if(typeof request.id!=='string'||typeof request.from!=='string'||exists.get(user.id,request.id))continue;
      const timestamp=Number.isSafeInteger(request.timestamp)&&request.timestamp>0?request.timestamp:Date.now();
      add.run(randomUUID(),user.id,'friend_request',request.from,request.id,timestamp);
    }
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  users() {
    return this.db.prepare('SELECT payload,version FROM users').all().map(row => {
      const user = JSON.parse(row.payload);
      Object.defineProperty(user, '_version', { value: row.version, writable: true });
      return user;
    });
  }
  userById(id) {
    const row = this.db.prepare('SELECT payload,version FROM users WHERE id=?').get(id);
    if (!row) return null;
    const user = JSON.parse(row.payload);
    Object.defineProperty(user, '_version', { value: row.version, writable: true });
    return user;
  }
  saveUsers(users, reason = 'legacy-operation') {
    if (!Array.isArray(users)) throw new Error('Invalid users');
    return this.transaction(() => this._saveUsers(users, reason));
  }
  _saveUsers(users, reason) {
    for (const user of users) {
      if (!user.id || typeof user.username !== 'string' || !Number.isSafeInteger(user.xubor) || user.xubor < 0) throw new Error('Invalid account data');
      // Old session tokens must never survive import or database writes.
      delete user.sessionToken;
      const payload = JSON.stringify(user);
      const previous = this.db.prepare('SELECT payload,balance,version FROM users WHERE id=?').get(user.id);
      if (previous?.payload === payload) continue;
      if (previous && user._version !== previous.version) {
        const error = new Error('Les données ont changé. Réessayez.'); error.status = 409; throw error;
      }
      this.db.prepare(`INSERT INTO users(id,username,balance,payload) VALUES(?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET username=excluded.username,balance=excluded.balance,payload=excluded.payload,version=users.version+1`)
        .run(user.id, user.username, user.xubor, payload);
      const delta = user.xubor - (previous?.balance || 0);
      if (delta || !previous) this.db.prepare('INSERT INTO wallet_ledger VALUES(?,?,?,?,?,?)')
        .run(randomUUID(), user.id, delta, user.xubor, reason, new Date().toISOString());
    }
  }
  read(name, fallback = []) {
    if (name === 'users') return this.users();
    const row = this.db.prepare('SELECT payload FROM documents WHERE name=?').get(name);
    return row ? JSON.parse(row.payload) : structuredClone(fallback);
  }
  write(name, value) {
    if (name === 'users') return this.saveUsers(value);
    this.db.prepare('INSERT INTO documents VALUES(?,?) ON CONFLICT(name) DO UPDATE SET payload=excluded.payload').run(name, JSON.stringify(value));
  }
  seed(directory) {
    for (const name of ['games','skins','cosmetics','achievements']) {
      if (this.db.prepare('SELECT 1 FROM documents WHERE name=?').get(name)) continue;
      const file = path.join(directory, `${name}.json`);
      if (fs.existsSync(file)) this.write(name, JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')));
    }
  }
  async backup(filename) { await backup(this.db, filename); }
  close() { this.db.close(); }
}
module.exports = { Store };
