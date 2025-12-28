const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// Connexion à la base de données
const db = new sqlite3.Database('./xolbor.db', (err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données:', err);
    } else {
        console.log('Connecté à la base de données SQLite');
        initializeDatabase();
    }
});

// Initialisation des tables
function initializeDatabase() {
    db.serialize(() => {
        // Table utilisateurs
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            xubor INTEGER DEFAULT 100,
            avatar TEXT DEFAULT 'default',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Table skins
        db.run(`CREATE TABLE IF NOT EXISTS skins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price INTEGER NOT NULL,
            rarity TEXT DEFAULT 'common',
            category TEXT,
            image_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Table inventaire des skins
        db.run(`CREATE TABLE IF NOT EXISTS user_skins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            skin_id INTEGER NOT NULL,
            purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (skin_id) REFERENCES skins(id),
            UNIQUE(user_id, skin_id)
        )`);

        // Table amis
        db.run(`CREATE TABLE IF NOT EXISTS friends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            friend_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (friend_id) REFERENCES users(id),
            UNIQUE(user_id, friend_id)
        )`);

        // Table jeux
        db.run(`CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            image_url TEXT,
            category TEXT,
            rating REAL DEFAULT 0,
            play_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Table transactions
        db.run(`CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Insérer des skins et jeux par défaut après la création des tables
        insertDefaultSkins();
        insertDefaultGames();
    });
}

// Insérer des skins par défaut
function insertDefaultSkins() {
    const skins = [
        { name: 'Dragon Rouge', price: 1000, rarity: 'legendary', category: 'animaux' },
        { name: 'Samouraï', price: 500, rarity: 'rare', category: 'personnages' },
        { name: 'Cyborg', price: 750, rarity: 'rare', category: 'futuriste' },
        { name: 'Pirate', price: 300, rarity: 'common', category: 'historique' },
        { name: 'Astronaute', price: 800, rarity: 'rare', category: 'espace' },
        { name: 'Ninja', price: 400, rarity: 'common', category: 'personnages' },
        { name: 'Sorcier', price: 600, rarity: 'rare', category: 'fantastique' },
        { name: 'Robot', price: 900, rarity: 'legendary', category: 'futuriste' },
        { name: 'Chevalier', price: 350, rarity: 'common', category: 'historique' },
        { name: 'Alien', price: 700, rarity: 'rare', category: 'espace' }
    ];

    skins.forEach(skin => {
        db.get('SELECT id FROM skins WHERE name = ?', [skin.name], (err, row) => {
            if (!row) {
                db.run(
                    'INSERT INTO skins (name, price, rarity, category) VALUES (?, ?, ?, ?)',
                    [skin.name, skin.price, skin.rarity, skin.category]
                );
            }
        });
    });
}

// Insérer des jeux par défaut
function insertDefaultGames() {
    const games = [
        { 
            name: 'Battle Royale X', 
            description: 'Combattez jusqu\'à la dernière limite', 
            category: 'action',
            image_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=225&fit=crop'
        },
        { 
            name: 'Mystic Quest', 
            description: 'Aventure dans un monde fantastique', 
            category: 'aventure',
            image_url: 'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?w=400&h=225&fit=crop'
        },
        { 
            name: 'Racing Extreme', 
            description: 'Course à grande vitesse', 
            category: 'course',
            image_url: 'https://images.unsplash.com/photo-1533237264986-2c5d56e2d7c1?w=400&h=225&fit=crop'
        },
        { 
            name: 'Puzzle Universe', 
            description: 'Résolvez des énigmes cosmiques', 
            category: 'réflexion',
            image_url: 'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=400&h=225&fit=crop'
        }
    ];

    games.forEach(game => {
        db.get('SELECT id FROM games WHERE name = ?', [game.name], (err, row) => {
            if (!row) {
                db.run(
                    'INSERT INTO games (name, description, category, image_url) VALUES (?, ?, ?, ?)',
                    [game.name, game.description, game.category, game.image_url]
                );
            }
        });
    });
}

// Fonctions pour les utilisateurs
const User = {
    create: (username, email, password, callback) => {
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) return callback(err);
            
            db.run(
                'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                [username, email, hash],
                function(err) {
                    callback(err, this ? { id: this.lastID, username, email } : null);
                }
            );
        });
    },

    findByUsername: (username, callback) => {
        db.get('SELECT * FROM users WHERE username = ?', [username], callback);
    },

    findByEmail: (email, callback) => {
        db.get('SELECT * FROM users WHERE email = ?', [email], callback);
    },

    findById: (id, callback) => {
        db.get('SELECT id, username, email, xubor, avatar FROM users WHERE id = ?', [id], callback);
    },

    updateXubor: (userId, amount, callback) => {
        db.run('UPDATE users SET xubor = xubor + ? WHERE id = ?', [amount, userId], callback);
    },

    updateAvatar: (userId, avatar, callback) => {
        db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, userId], callback);
    },

    checkUsernameExists: (username, callback) => {
        db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
            callback(err, !!row);
        });
    }
};

// Fonctions pour les skins
const Skin = {
    getAll: (filters, callback) => {
        let query = 'SELECT * FROM skins WHERE 1=1';
        let params = [];
        
        if (filters.rarity && filters.rarity !== 'all') {
            query += ' AND rarity = ?';
            params.push(filters.rarity);
        }
        
        if (filters.search) {
            query += ' AND name LIKE ?';
            params.push(`%${filters.search}%`);
        }
        
        query += ' ORDER BY price ASC';
        
        db.all(query, params, callback);
    },

    getById: (id, callback) => {
        db.get('SELECT * FROM skins WHERE id = ?', [id], callback);
    },

    getUserSkins: (userId, callback) => {
        db.all(
            `SELECT s.* FROM skins s 
             JOIN user_skins us ON s.id = us.skin_id 
             WHERE us.user_id = ?`,
            [userId],
            callback
        );
    },

    purchase: (userId, skinId, callback) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Vérifier si l'utilisateur a déjà le skin
            db.get('SELECT id FROM user_skins WHERE user_id = ? AND skin_id = ?', 
                [userId, skinId], (err, row) => {
                    if (row) {
                        db.run('ROLLBACK');
                        return callback(new Error('Vous possédez déjà ce skin'));
                    }
                    
                    // Récupérer le prix du skin
                    db.get('SELECT price FROM skins WHERE id = ?', [skinId], (err, skin) => {
                        if (!skin) {
                            db.run('ROLLBACK');
                            return callback(new Error('Skin non trouvé'));
                        }
                        
                        // Vérifier le solde
                        db.get('SELECT xubor FROM users WHERE id = ?', [userId], (err, user) => {
                            if (user.xubor < skin.price) {
                                db.run('ROLLBACK');
                                return callback(new Error('Solde insuffisant'));
                            }
                            
                            // Débiter le compte
                            db.run('UPDATE users SET xubor = xubor - ? WHERE id = ?', 
                                [skin.price, userId], (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return callback(err);
                                    }
                                    
                                    // Ajouter le skin à l'inventaire
                                    db.run('INSERT INTO user_skins (user_id, skin_id) VALUES (?, ?)',
                                        [userId, skinId], (err) => {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return callback(err);
                                            }
                                            
                                            // Enregistrer la transaction
                                            db.run(`INSERT INTO transactions 
                                                    (user_id, amount, type, description) 
                                                    VALUES (?, ?, ?, ?)`,
                                                [userId, -skin.price, 'purchase', 
                                                 `Achat skin: ${skinId}`], (err) => {
                                                    if (err) {
                                                        db.run('ROLLBACK');
                                                        return callback(err);
                                                    }
                                                    
                                                    db.run('COMMIT');
                                                    callback(null, { success: true });
                                                });
                                        });
                                });
                        });
                    });
                });
        });
    }
};

// Fonctions pour les amis
const Friend = {
    sendRequest: (userId, friendUsername, callback) => {
        db.get('SELECT id FROM users WHERE username = ?', [friendUsername], (err, friend) => {
            if (!friend) return callback(new Error('Utilisateur non trouvé'));
            if (friend.id === userId) return callback(new Error('Vous ne pouvez pas vous ajouter vous-même'));
            
            db.run(
                `INSERT OR IGNORE INTO friends (user_id, friend_id, status) 
                 VALUES (?, ?, 'pending')`,
                [userId, friend.id],
                function(err) {
                    callback(err, { success: !err });
                }
            );
        });
    },

    getFriends: (userId, callback) => {
        db.all(
            `SELECT u.id, u.username, u.avatar, f.status 
             FROM friends f 
             JOIN users u ON u.id = f.friend_id 
             WHERE f.user_id = ? AND f.status = 'accepted'
             UNION
             SELECT u.id, u.username, u.avatar, f.status 
             FROM friends f 
             JOIN users u ON u.id = f.user_id 
             WHERE f.friend_id = ? AND f.status = 'accepted'`,
            [userId, userId],
            callback
        );
    },

    getPendingRequests: (userId, callback) => {
        db.all(
            `SELECT u.id, u.username, u.avatar 
             FROM friends f 
             JOIN users u ON u.id = f.user_id 
             WHERE f.friend_id = ? AND f.status = 'pending'`,
            [userId],
            callback
        );
    },

    acceptRequest: (userId, friendId, callback) => {
        db.run(
            `UPDATE friends SET status = 'accepted' 
             WHERE user_id = ? AND friend_id = ? AND status = 'pending'`,
            [friendId, userId],
            callback
        );
    }
};

// Fonctions pour les jeux
const Game = {
    getAll: (callback) => {
        db.all('SELECT * FROM games ORDER BY play_count DESC', callback);
    },

    search: (query, callback) => {
        db.all(
            'SELECT * FROM games WHERE name LIKE ? OR description LIKE ?',
            [`%${query}%`, `%${query}%`],
            callback
        );
    }
};

module.exports = { db, User, Skin, Friend, Game };