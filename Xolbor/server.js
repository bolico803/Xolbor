require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');

const http = require('http');
const { Server } = require("socket.io");
const nodemailer = require('nodemailer'); // Import nodemailer
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_API = 'https://api-m.sandbox.paypal.com'; // Use https://api-m.paypal.com for live production

const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || 'https://xolbor.ma';
const PUBLIC_WWW_ORIGIN = process.env.PUBLIC_WWW_ORIGIN || 'https://www.xolbor.ma';
const LOCAL_ORIGIN = `http://127.0.0.1:${process.env.PORT || 5897}`;

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            const allowedOrigins = new Set([
                PUBLIC_ORIGIN,
                PUBLIC_WWW_ORIGIN,
                LOCAL_ORIGIN,
                'http://localhost:5897'
            ]);
            if (!origin || allowedOrigins.has(origin)) return callback(null, true);
            return callback(null, false);
        },
        credentials: true
    }
});

// --- INSTATOCK PROXY (MUST BE FIRST) ---
const { createProxyMiddleware } = require('http-proxy-middleware');

// Proxy Instatock API
app.use(createProxyMiddleware({
    target: 'http://localhost:4005',
    changeOrigin: true,
    pathFilter: '/api/instatock',
    pathRewrite: {
        '^/api/instatock': '/api', 
    },
}));

// Proxy Instatock WebSocket
const instatockSocketProxy = createProxyMiddleware({
    target: 'http://localhost:4005',
    ws: true,
    changeOrigin: true,
    pathFilter: '/socket.io/instatock',
});
app.use(instatockSocketProxy);

// Serve Instatock uploads directly so images do not depend on the API proxy.
app.use('/Instatock/uploads', express.static(path.join(__dirname, 'Instatock', 'server', 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'Instatock', 'server', 'uploads')));

// Serve Instatock Frontend Static Files
app.use('/Instatock', express.static(path.join(__dirname, 'Instatock')));

const PORT = process.env.PORT || 5897;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SKINS_FILE = path.join(DATA_DIR, 'skins.json');
const TOURNAMENTS_FILE = path.join(DATA_DIR, 'tournaments.json');
const ACHIEVEMENTS_FILE = path.join(DATA_DIR, 'achievements.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const GUILDS_FILE = path.join(DATA_DIR, 'guilds.json');
const COSMETICS_FILE = path.join(DATA_DIR, 'cosmetics.json');
const FACTIONS_FILE = path.join(DATA_DIR, 'factions.json');
const BOUNTIES_FILE = path.join(DATA_DIR, 'bounties.json');

// --- HELPERS FOR NEW FEATURES ---

const readJsonFile = (filePath, defaultVal = []) => {
    if (!fs.existsSync(filePath)) return defaultVal;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        return defaultVal;
    }
};

const writeJsonFile = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// --- NEXUS HUB STATE ---
const nexusState = { players: {} };

// --- SOCKET.IO HANDLER ---
io.on('connection', (socket) => {
    console.log(`[SOCKET] User connected: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`[SOCKET] User disconnected: ${socket.id}`);
        // Emit to nexus that a player has left if they were in the nexus
        if (nexusState.players[socket.id]) {
            delete nexusState.players[socket.id];
        }
        io.to('nexus').emit('nexus-player-left', { id: socket.id });
    });

    // --- NEXUS HUB EVENTS ---
    socket.on('nexus-join', (data) => {
        // data: { x, y, username, skinId, factionColor }
        socket.join('nexus');
        nexusState.players[socket.id] = { id: socket.id, ...data };
        socket.emit('nexus-init', { players: nexusState.players });
        socket.to('nexus').emit('nexus-player-joined', { id: socket.id, ...data });
    });

    socket.on('nexus-move', (data) => {
        // data: { x, y }
        if (nexusState.players[socket.id]) {
            nexusState.players[socket.id].x = data.x;
            nexusState.players[socket.id].y = data.y;
        }
        socket.to('nexus').emit('nexus-player-moved', { id: socket.id, ...data });
    });

    socket.on('nexus-chat', (data) => {
        // data: { message }
        io.to('nexus').emit('nexus-chat-msg', { id: socket.id, message: data.message });
    });

    socket.on('nexus-leave', () => {
        socket.leave('nexus');
        if (nexusState.players[socket.id]) {
            delete nexusState.players[socket.id];
        }
        io.to('nexus').emit('nexus-player-left', { id: socket.id });
    });

    // --- SUPER SPACE NATIVE GAME EVENTS ---
    socket.on('superspace-join', (data) => {
        socket.join('superspace');
        const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
        superSpaceState.players[socket.id] = {
            id: socket.id,
            username: data.username,
            x: Math.random() * 1800 + 100,
            y: Math.random() * 1800 + 100,
            color: colors[Math.floor(Math.random() * colors.length)],
            score: 0,
            health: 100
        };
        socket.emit('superspace-init', { id: socket.id, players: superSpaceState.players });
    });

    socket.on('superspace-move', (data) => {
        const p = superSpaceState.players[socket.id];
        if (!p) return;
        const speed = 5;
        p.x += data.dx * speed;
        p.y += data.dy * speed;
        p.x = Math.max(20, Math.min(1980, p.x));
        p.y = Math.max(20, Math.min(1980, p.y));
    });

    socket.on('superspace-shoot', (data) => {
        const p = superSpaceState.players[socket.id];
        if (!p) return;
        const speed = 10;
        superSpaceState.bullets.push({
            id: uuidv4(),
            ownerId: socket.id,
            x: p.x + Math.cos(data.angle) * 20,
            y: p.y + Math.sin(data.angle) * 20,
            vx: Math.cos(data.angle) * speed,
            vy: Math.sin(data.angle) * speed,
            life: 60 // frames
        });
    });
});

// --- SUPER SPACE GAME LOOP ---
const superSpaceState = { players: {}, bullets: [] };
setInterval(() => {
    // Update bullets
    for (let i = superSpaceState.bullets.length - 1; i >= 0; i--) {
        const b = superSpaceState.bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        b.life--;

        if (b.life <= 0 || b.x < 0 || b.x > 2000 || b.y < 0 || b.y > 2000) {
            superSpaceState.bullets.splice(i, 1);
            continue;
        }

        // Collision
        for (let id in superSpaceState.players) {
            if (id === b.ownerId) continue;
            const p = superSpaceState.players[id];
            const dist = Math.hypot(p.x - b.x, p.y - b.y);
            if (dist < 20) {
                p.health -= 25;
                if (p.health <= 0) {
                    p.health = 100;
                    p.x = Math.random() * 1800 + 100;
                    p.y = Math.random() * 1800 + 100;
                    if (superSpaceState.players[b.ownerId]) {
                        superSpaceState.players[b.ownerId].score += 1;
                    }
                }
                superSpaceState.bullets.splice(i, 1);
                break;
            }
        }
    }

    // Emit state
    if (Object.keys(superSpaceState.players).length > 0) {
        io.to('superspace').emit('superspace-update', superSpaceState);
    }
}, 1000 / 30); // 30 FPS tick

// --- EMAIL SYSTEM ---
const transporter = nodemailer.createTransport({
    service: 'gmail', // Ou autre (Outlook, Yahoo...)
    auth: {
        user: process.env.EMAIL_USER || 'votre_email@gmail.com', // À REMPLACER
        pass: process.env.EMAIL_PASS || 'votre_mot_de_passe_app' // À REMPLACER (Mot de passe d'application)
    }
});

const sendEmail = async (to, subject, html) => {
    if (!to || !to.includes('@')) return;
    try {
        await transporter.sendMail({
            from: '"Xolbor Admin" <no-reply@xolbor.ma>',
            to,
            subject: `[Xolbor] ${subject}`,
            html
        });
        console.log(`[EMAIL] Sent to ${to}: ${subject}`);
    } catch (error) {
        console.error(`[EMAIL] Erreur: ${error.message} (Vérifiez les identifiants SMTP)`);
    }
};

const getLevel = (xp) => {
    return Math.floor(Math.sqrt(xp / 100)) + 1;
};

const staticOptions = {
    setHeaders: (res, path, stat) => {
        if (path.endsWith('.gz')) {
            res.set('Content-Encoding', 'gzip');
            if (path.endsWith('.js.gz') || path.endsWith('.framework.js.gz')) {
                res.set('Content-Type', 'application/javascript');
            } else if (path.endsWith('.wasm.gz')) {
                res.set('Content-Type', 'application/wasm');
            } else if (path.endsWith('.data.gz')) {
                res.set('Content-Type', 'application/octet-stream');
            }
        } else if (path.endsWith('.br')) {
            res.set('Content-Encoding', 'br');
            if (path.endsWith('.js.br') || path.endsWith('.framework.js.br')) {
                res.set('Content-Type', 'application/javascript');
            } else if (path.endsWith('.wasm.br')) {
                res.set('Content-Type', 'application/wasm');
            } else if (path.endsWith('.data.br')) {
                res.set('Content-Type', 'application/octet-stream');
            }
        } else if (path.endsWith('.wasm')) {
            res.set('Content-Type', 'application/wasm');
        }
    }
};

app.use(express.static(path.join(__dirname, '/'), staticOptions));

const existingPath = (candidates) => {
    return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0];
};

const gameFolderPath = (slug, legacyFolder, extraNames = []) => {
    const names = [slug, ...extraNames];
    return existingPath([
        ...names.map(name => path.join(__dirname, 'games', name)),
        ...names.map(name => path.join(__dirname, 'jeux', name)),
        path.join(__dirname, legacyFolder)
    ]);
};

const publicGameFolders = [
    { slug: 'superfight', legacyFolder: 'Superfight', extraNames: ['super-combat', 'super combat'] },
    { slug: 'superplat', legacyFolder: 'Superplat' },
    { slug: 'superspace', legacyFolder: 'SuperSpace', extraNames: ['superespace'] },
    { slug: 'tunnel-runner-3d', legacyFolder: 'games/tunnel-runner-3d' },
    { slug: 'felnas-journey-fx', legacyFolder: 'games/felnas-journey-fx' },
    { slug: '3d-tennis', legacyFolder: 'games/3d-tennis' },
    { slug: 'site-defis-impossibles', legacyFolder: 'site_defis_impossibles', extraNames: ['site_defis_impossibles'] },
    { slug: 'rpg-grande', legacyFolder: 'rpg_grande', extraNames: ['rpg_grande'] },
    { slug: 'paytodelet', legacyFolder: 'PaytoDelet' },
    { slug: 'if-you-have-an-iq', legacyFolder: 'If you have an IQ' },
    { slug: 'instatock', legacyFolder: 'Instatock' }
];

publicGameFolders.forEach(({ slug, legacyFolder, extraNames = [] }) => {
    const folderPath = gameFolderPath(slug, legacyFolder, extraNames);
    app.use(`/games/${slug}`, express.static(folderPath, staticOptions));
});

const publicGameFiles = [
    { slug: '3d-tennis', file: '3D Tennis.html' },
    { slug: 'tunnel-runner-3d', file: 'Tunnel Runner 3D.html' }
];

publicGameFiles.forEach(({ slug, file }) => {
    app.get([`/games/${slug}`, `/games/${slug}/`], (req, res) => {
        res.sendFile(path.join(__dirname, file));
    });
});

app.get(['/games/felnas-journey-ex', '/games/felnas-journey-ex/'], (req, res) => {
    const felnaFile = fs.readdirSync(__dirname).find(file =>
        file.includes("Felna's Journey EX") && file.endsWith('.html')
    );

    if (!felnaFile) {
        return res.status(404).send('Game not found');
    }

    res.sendFile(path.join(__dirname, felnaFile));
});

app.use(bodyParser.json());

// Helper: Read Users
const readUsers = () => {
    if (!fs.existsSync(USERS_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
};

// Helper: Write Users
const writeUsers = (users) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// Helper: Get User by Session
const getUserBySession = (req) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    const users = readUsers();
    return users.find(u => u.sessionToken === token);
};

// Helper: Check if User is King
const isUserKing = (username) => {
    const users = readJsonFile(USERS_FILE);
    if (users.length === 0) return false;
    // Sort by XP descending
    const sorted = [...users].sort((a, b) => (b.xp || 0) - (a.xp || 0));
    return sorted[0].username === username;
};

// --- AUTH APIs ---

app.post('/api/register', async (req, res) => {
    const { username, password, email } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Champs manquants' });

    const users = readUsers();
    if (users.find(u => u.username === username)) {
        return res.status(409).json({ error: 'Pseudo déjà pris' });
    }
    if (email && users.find(u => u.email === email)) {
        return res.status(409).json({ error: 'Email déjà utilisé' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: uuidv4(),
        username,
        password: hashedPassword,
        email: email || "",
        xubor: 0, // Starting currency
        inventory: [],
        equippedSkinId: 0,
        friends: [], // List of usernames
        friendRequests: [], // List of { from: username, to: username, id: uuid }
        sessionToken: uuidv4(),
        // New Features Fields
        xp: 0,
        faction: null,
        level: 1,
        achievements: [], // list of achievement IDs
        tournamentsJoined: [],
        dailyStreak: 0,
        lastLoginDate: new Date().toDateString(),
        bio: "Nouveau joueur sur Xolbor !",
        gameStats: {}, // { gameId: visits }
        joinedAt: new Date().toISOString()
    };

    users.push(newUser);
    writeUsers(users);

    console.log(`[REGISTER] New user: ${username}`);
    // Return everything except password
    const { password: _, ...userWithoutPass } = newUser;
    userWithoutPass.isKing = isUserKing(newUser.username);

    // Send Welcome Email
    if (email) {
        const registrationTime = new Date().toLocaleString('fr-FR');
        sendEmail(email, "Bienvenue sur Xolbor !", `
            <h1>🎉 Bienvenue ${username} ! 🎉</h1>
            <p>Votre compte Xolbor a été créé avec succès !</p>

            <h2>📊 Vos statistiques de départ :</h2>
            <ul>
                <li>💰 Xubor: 0 pièces</li>
                <li>⭐ XP: 0 (Niveau 1)</li>
                <li>🔥 Série quotidienne: 0 jour(s)</li>
                <li>📅 Date d'inscription: ${registrationTime}</li>
            </ul>

            <h2>🎮 Que faire maintenant ?</h2>
            <ul>
                <li>Explorez les jeux populaires dans l'onglet "Accueil"</li>
                <li>Jouez pour gagner de l'XP et monter en niveau</li>
                <li>Achetez des skins dans la boutique</li>
                <li>Invitez des amis et créez votre réseau</li>
                <li>Participez aux tournois pour gagner des récompenses</li>
            </ul>

            <h2>🔔 Notifications</h2>
            <p>Vous recevrez des emails pour :</p>
            <ul>
                <li>Chaque connexion à votre compte</li>
                <li>Les événements spéciaux et thèmes festifs</li>
                <li>Les récompenses de tournois</li>
                <li>Les décrets royaux importants</li>
            </ul>

            <p style="color: #e11d48; font-weight: bold;">⚠️ Sécurité : Conservez vos identifiants en lieu sûr !</p>

            <p>Préparez-vous à dominer le classement et amusez-vous bien ! 🚀</p>

            <br>
            <p style="color: #666; font-size: 0.9em;">Cet email est automatique, merci de ne pas y répondre.</p>
        `);
    }

    res.json(userWithoutPass);
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(`[LOGIN] Attempt for user: ${username}`);

    const users = readUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
        console.log(`[LOGIN] User not found: ${username}`);
        return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
        console.log(`[LOGIN] Password mismatch for: ${username}`);
        return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    // Refresh session token
    user.sessionToken = uuidv4();

    // Handle Daily Streak
    const today = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toDateString();

    if (user.lastLoginDate === yesterdayString) {
        user.dailyStreak = (user.dailyStreak || 0) + 1;
    } else if (user.lastLoginDate !== today) {
        user.dailyStreak = 1; // Reset streak if missed a day
    }
    user.lastLoginDate = today;

    // Grant XP for login
    user.xp = (user.xp || 0) + 50;
    user.level = getLevel(user.xp);
    if (user.faction) {
        const factions = readJsonFile(FACTIONS_FILE, {});
        if (factions[user.faction]) {
            factions[user.faction].xp += 50;
            writeJsonFile(FACTIONS_FILE, factions);
            io.emit('faction-update', factions);
        }
    }

    writeUsers(users);

    console.log(`[LOGIN] Success for: ${username}`);
    const { password: _, ...userWithoutPass } = user;
    userWithoutPass.isKing = isUserKing(user.username);

    // Send login notification email
    if (user.email) {
        const loginTime = new Date().toLocaleString('fr-FR');
        const streakBonus = user.dailyStreak > 1 ? ` (Série: ${user.dailyStreak} jours!)` : '';
        sendEmail(user.email, "Connexion à Xolbor", `
            <h2>Salut ${username} ! 👋</h2>
            <p>Nous avons détecté une connexion à votre compte Xolbor.</p>
            <p><strong>Détails de connexion :</strong></p>
            <ul>
                <li>📅 Date/Heure: ${loginTime}</li>
                <li>⭐ XP gagné: +50</li>
                <li>📊 Niveau actuel: ${user.level}</li>
                <li>🔥 Série quotidienne: ${user.dailyStreak} jour(s)${streakBonus}</li>
            </ul>
            <p>Si ce n'était pas vous, changez immédiatement votre mot de passe !</p>
            <p>Continuez à jouer et à grimper dans le classement ! 🎮</p>
            <br>
            <p style="color: #666; font-size: 0.9em;">Cet email est automatique, merci de ne pas y répondre.</p>
        `);
    }

    res.json(userWithoutPass);
});

// --- PROFILE & SOCIAL APIs ---

// Public Profile
app.get('/api/user/:username', (req, res) => {
    const { username } = req.params;
    const users = readUsers();
    const user = users.find(u => u.username === username);

    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // Calculate Favorite Game
    let favoriteGame = null;
    if (user.gameStats) {
        const sortedGames = Object.entries(user.gameStats).sort((a, b) => b[1] - a[1]);
        if (sortedGames.length > 0) {
            const games = readGames();
            const g = games.find(x => x.id === sortedGames[0][0]);
            if (g) favoriteGame = { title: g.title, visits: sortedGames[0][1] };
        }
    }

    const publicProfile = {
        username: user.username,
        level: user.level,
        xp: user.xp,
        bio: user.bio || "Aucune bio.",
        equippedSkinId: user.equippedSkinId,
        isKing: isUserKing(user.username),
        favoriteGame,
        joinedAt: user.joinedAt || "Inconnu",
        xubor: user.xubor,
        inventory: user.inventory || [],
        friends: user.friends || [],
        gameStats: user.gameStats || {},
        totalGamesPlayed: Object.values(user.gameStats || {}).reduce((sum, visits) => sum + visits, 0)
    };

    res.json(publicProfile);
});

// Get user's friends with their public profiles
app.get('/api/user/:username/friends', (req, res) => {
    const { username } = req.params;
    const users = readUsers();
    const user = users.find(u => u.username === username);

    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const friendsProfiles = user.friends.map(friendUsername => {
        const friend = users.find(u => u.username === friendUsername);
        if (!friend) return null;

        // Calculate favorite game for friend
        let favoriteGame = null;
        if (friend.gameStats) {
            const sortedGames = Object.entries(friend.gameStats).sort((a, b) => b[1] - a[1]);
            if (sortedGames.length > 0) {
                const games = readGames();
                const g = games.find(x => x.id === sortedGames[0][0]);
                if (g) favoriteGame = { title: g.title, visits: sortedGames[0][1] };
            }
        }

        return {
            username: friend.username,
            level: friend.level,
            bio: friend.bio || "Aucune bio.",
            isKing: isUserKing(friend.username),
            favoriteGame,
            totalGamesPlayed: Object.values(friend.gameStats || {}).reduce((sum, visits) => sum + visits, 0),
            isOnline: connectedUsers[friend.username] !== undefined
        };
    }).filter(f => f !== null);

    res.json(friendsProfiles);
});

// Update Bio
app.post('/api/profile/update', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { bio } = req.body;
    if (bio && bio.length > 200) return res.status(400).json({ error: 'Bio trop longue (max 200)' });

    const users = readUsers();
    const currentUser = users.find(u => u.username === user.username);

    currentUser.bio = bio;
    writeUsers(users);

    res.json({ success: true, bio: currentUser.bio });
});

// Change Username (Cost: 100 X)
app.post('/api/profile/rename', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { newUsername } = req.body;
    if (!newUsername || newUsername.length < 3) return res.status(400).json({ error: 'Pseudo invalide' });

    const users = readUsers();

    // Check cost
    const currentUser = users.find(u => u.username === user.username);
    if (currentUser.xubor < 100) return res.status(400).json({ error: 'Pas assez de Xubor (100 requis)' });

    // Check uniqueness
    if (users.find(u => u.username === newUsername)) return res.status(409).json({ error: 'Pseudo déjà pris' });

    // Update
    const oldName = currentUser.username;
    currentUser.username = newUsername;
    currentUser.xubor -= 100;

    // Update friends lists of OTHER users (expensive operation but necessary)
    users.forEach(u => {
        const idx = u.friends.indexOf(oldName);
        if (idx !== -1) u.friends[idx] = newUsername;

        // Update requests if any
        u.friendRequests.forEach(r => {
            if (r.from === oldName) r.from = newUsername;
        });
    });

    writeUsers(users);

    // Send username change confirmation email
    if (currentUser.email) {
        sendEmail(currentUser.email, "🔄 Pseudo changé avec succès !", `
            <h2>Votre pseudo a été modifié !</h2>
            <p>Ancien pseudo : <strong>${oldName}</strong></p>
            <p>Nouveau pseudo : <strong>${newUsername}</strong></p>
            <p>Coût : <strong>100 X</strong></p>
            <p>Solde restant : <strong>${currentUser.xubor} X</strong></p>
            <br>
            <p style="color: #666; font-size: 12px;">Date : ${new Date().toLocaleString('fr-FR')}</p>
        `);
    }

    // Update session token or require relogin? Let's just return success
    res.json({ success: true, newUsername, newBalance: currentUser.xubor });
});

// Change Password (Cost: 100 X)
app.post('/api/profile/password', async (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Mot de passe trop court' });

    const users = readUsers();
    const currentUser = users.find(u => u.username === user.username);

    if (currentUser.xubor < 100) return res.status(400).json({ error: 'Pas assez de Xubor (100 requis)' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    currentUser.password = hashedPassword;
    currentUser.xubor -= 100;

    writeUsers(users);

    // Send password change confirmation email
    if (currentUser.email) {
        sendEmail(currentUser.email, "🔐 Mot de passe changé avec succès !", `
            <h2>Votre mot de passe a été modifié !</h2>
            <p>Votre mot de passe a été changé avec succès.</p>
            <p>Coût : <strong>100 X</strong></p>
            <p>Solde restant : <strong>${currentUser.xubor} X</strong></p>
            <p>Si vous n'avez pas demandé ce changement, contactez immédiatement le support.</p>
            <br>
            <p style="color: #666; font-size: 12px;">Date : ${new Date().toLocaleString('fr-FR')}</p>
        `);
    }

    res.json({ success: true, newBalance: currentUser.xubor });
});

app.post('/api/logout', (req, res) => {
    // Client just clears token, optionally we could invalidate on server
    res.json({ success: true });
});

// Get current user info (session check)
app.get('/api/me', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { password: _, ...userWithoutPass } = user;
    userWithoutPass.isKing = isUserKing(user.username);
    res.json(userWithoutPass);
});

app.post('/api/king/decree', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    if (!isUserKing(user.username)) {
        return res.status(403).json({ error: 'Seul le Roi peut publier un décret !' });
    }

    const { content } = req.body;
    if (!content || content.length > 100) {
        return res.status(400).json({ error: 'Message trop long ou vide (max 100 car.)' });
    }

    // Broadcast to everyone
    io.emit('king-decree', {
        king: user.username,
        content: content,
        timestamp: Date.now()
    });

    // Notify all users by email (Spammy? Maybe limit to those who opted in, but user said "toutes")
    const users = readUsers();
    users.forEach(u => {
        if (u.email) {
            sendEmail(u.email, `👑 Décret Royal de ${user.username}`, `
                <h2>Le Roi a parlé !</h2>
                <blockquote>"${content}"</blockquote>
                <p>Connectez-vous vite pour réagir !</p>
            `);
        }
    });

    res.json({ success: true, message: 'Décret publié !' });
});

app.post('/api/admin/special-theme', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    // Only king can trigger special themes (or could add admin check)
    if (!isUserKing(user.username)) {
        return res.status(403).json({ error: 'Seul le Roi peut déclencher des thèmes spéciaux !' });
    }

    const { theme, duration = 30000 } = req.body;
    if (!specialThemes.includes(theme)) {
        return res.status(400).json({ error: 'Thème invalide' });
    }

    io.emit('special-theme', { theme, duration });
    console.log(`[THEME] Special theme triggered by ${user.username}: ${theme} for ${duration}ms`);

    res.json({ success: true, message: `Thème ${theme} déclenché pour tous les utilisateurs !` });
});

// --- FRIENDS APIs ---

app.get('/api/search-users', (req, res) => {
    const query = req.query.q?.toLowerCase();
    if (!query) return res.json([]);
    const users = readUsers();
    const matches = users
        .filter(u => u.username.toLowerCase().includes(query))
        .map(u => ({ username: u.username })); // Only return public info
    res.json(matches);
});

app.post('/api/friend-request', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { targetUsername } = req.body;
    if (targetUsername === user.username) return res.status(400).json({ error: 'Impossible de s\'ajouter soi-même' });

    const users = readUsers();
    const target = users.find(u => u.username === targetUsername);

    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (target.friends.includes(user.username)) return res.status(400).json({ error: 'Déjà amis' });

    // Check if request already exists
    const existing = target.friendRequests.find(r => r.from === user.username);
    if (existing) return res.status(400).json({ error: 'Demande déjà envoyée' });

    target.friendRequests.push({
        id: uuidv4(),
        from: user.username,
        timestamp: Date.now()
    });

    writeUsers(users);

    if (target.email) {
        sendEmail(target.email, "Nouvelle demande d'ami", `
            <h3>${user.username} veut être votre ami !</h3>
            <p>Connectez-vous sur Xolbor pour accepter.</p>
        `);
    }

    res.json({ success: true, message: 'Demande envoyée' });
});

app.get('/api/friend-requests', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    res.json(user.friendRequests || []);
});

app.post('/api/friend-respond', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { requestId, action } = req.body; // action: 'accept' | 'reject'
    const users = readUsers();

    // Reload user from disk to get latest state including updates from others
    const currentUserIndex = users.findIndex(u => u.id === user.id);
    const currentUser = users[currentUserIndex];

    const reqIndex = currentUser.friendRequests.findIndex(r => r.id === requestId);
    if (reqIndex === -1) return res.status(404).json({ error: 'Demande introuvable' });

    const request = currentUser.friendRequests[reqIndex];
    const requester = users.find(u => u.username === request.from);

    if (action === 'accept') {
        if (requester) {
            currentUser.friends.push(requester.username);
            requester.friends.push(currentUser.username);

            if (requester.email) {
                sendEmail(requester.email, "Demande d'ami acceptée", `
                    <p><strong>${currentUser.username}</strong> est maintenant votre ami !</p>
                `);
            }
        }
    }

    // Remove request
    currentUser.friendRequests.splice(reqIndex, 1);
    writeUsers(users);

    res.json({ success: true, friends: currentUser.friends });
});

app.get('/api/friends', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    // In a real app, might want to return online status here
    res.json(user.friends);
});

// --- FACTIONS APIs ---
app.get('/api/factions', (req, res) => {
    res.json(readJsonFile(FACTIONS_FILE, {}));
});

app.post('/api/faction/choose', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { faction } = req.body;
    const factions = readJsonFile(FACTIONS_FILE, {});
    if (!factions[faction]) return res.status(400).json({ error: 'Faction invalide' });

    const users = readUsers();
    const currentUser = users.find(u => u.id === user.id);
    if (currentUser.faction) return res.status(400).json({ error: 'Faction déjà choisie' });

    currentUser.faction = faction;
    writeUsers(users);

    res.json({ success: true, faction });
});

// --- BOUNTIES APIs ---
app.get('/api/bounties', (req, res) => {
    res.json(readJsonFile(BOUNTIES_FILE, []));
});

app.post('/api/bounties/place', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { target, reward, condition } = req.body;
    if (!target || !reward || !condition) return res.status(400).json({ error: 'Champs manquants' });
    const parsedReward = parseInt(reward, 10);
    if (isNaN(parsedReward) || parsedReward < 100) return res.status(400).json({ error: 'La prime minimum est de 100 X' });

    const users = readUsers();

    // Find the correct instance of currentUser from the fresh 'users' array
    const currentUserIndex = users.findIndex(u => u.username === user.username);
    if (currentUserIndex === -1) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const currentUser = users[currentUserIndex];

    if ((currentUser.xubor || 0) < parsedReward) return res.status(400).json({ error: 'Fonds insuffisants' });

    const targetUser = users.find(u => u.username.toLowerCase() === target.toLowerCase());
    if (!targetUser) return res.status(404).json({ error: 'Cible introuvable' });

    // Deduct xubor correctly
    currentUser.xubor -= parsedReward;
    writeUsers(users);

    const bounties = readJsonFile(BOUNTIES_FILE, []);
    const bounty = {
        id: uuidv4(),
        creator: currentUser.username,
        target,
        reward: parsedReward,
        condition,
        timestamp: Date.now(),
        status: 'active'
    };
    bounties.push(bounty);
    writeJsonFile(BOUNTIES_FILE, bounties);

    io.emit('notification', { type: 'system', message: `🎯 Nouvelle prime placée sur ${target} pour ${parsedReward} X !` });
    io.emit('bounty-update', bounties);
    res.json({ success: true, newBalance: currentUser.xubor });
});

// --- NEW FEATURES APIs (Tournaments, Achievements, Events) ---

app.get('/api/tournaments', (req, res) => {
    const tournaments = readJsonFile(TOURNAMENTS_FILE, []);
    // Update active tournaments status in real-time response if needed, 
    // but the background loop handles persistence.
    res.json(tournaments);
});

// Calculate prizes based on rank
const distributePrizes = (tournament) => {
    if (tournament.participants.length === 0) return;

    // Sort by score descending
    const ranked = [...tournament.participants].sort((a, b) => b.score - a.score);
    const users = readUsers();
    let winners = [];

    // Top 1: 50%
    if (ranked[0]) {
        const u = users.find(x => x.username === ranked[0].username);
        if (u) {
            const prize = Math.floor(tournament.prizePool * 0.5);
            u.xubor += prize;
            winners.push({ username: u.username, prize, rank: 1 });
            if (u.email) sendEmail(u.email, "Victoire Tournoi !", `Bravo ! Vous avez gagné ${prize} X dans ${tournament.title}.`);
        }
    }
    // Top 2: 30%
    if (ranked[1]) {
        const u = users.find(x => x.username === ranked[1].username);
        if (u) {
            const prize = Math.floor(tournament.prizePool * 0.3);
            u.xubor += prize;
            winners.push({ username: u.username, prize, rank: 2 });
            if (u.email) sendEmail(u.email, "Podium Tournoi !", `Bien joué ! Vous avez gagné ${prize} X (2ème place) dans ${tournament.title}.`);

        }
    }
    // Top 3: 20%
    if (ranked[2]) {
        const u = users.find(x => x.username === ranked[2].username);
        if (u) {
            const prize = Math.floor(tournament.prizePool * 0.2);
            u.xubor += prize;
            winners.push({ username: u.username, prize, rank: 3 });
            if (u.email) sendEmail(u.email, "Podium Tournoi !", `3ème place ! Vous avez gagné ${prize} X dans ${tournament.title}.`);
        }
    }

    writeUsers(users);
    console.log(`[TOURNAMENT] Distributed prizes for ${tournament.id}:`, winners);
    return winners;
};

// Background loop for tournaments
setInterval(() => {
    const tournaments = readJsonFile(TOURNAMENTS_FILE, []);
    const now = Date.now();
    let changed = false;

    tournaments.forEach(t => {
        if (t.status === 'upcoming' && now >= t.startTime) {
            t.status = 'active';
            changed = true;
            console.log(`[TOURNAMENT] Started: ${t.title}`);
            io.emit('notification', { type: 'system', message: `🏆 Le tournoi ${t.title} vient de commencer !` });
        } else if (t.status === 'active' && now >= t.endTime) {
            t.status = 'completed';
            changed = true;
            console.log(`[TOURNAMENT] Ended: ${t.title}`);
            const winners = distributePrizes(t);
            io.emit('notification', { type: 'system', message: `🏁 Le tournoi ${t.title} est terminé !` });
            if (winners && winners.length > 0) {
                io.emit('notification', { type: 'system', message: `🥇 Vainqueur : ${winners[0].username} (+${winners[0].prize} X)` });
            }
        }
    });

    if (changed) writeJsonFile(TOURNAMENTS_FILE, tournaments);
}, 60000); // Check every minute

app.post('/api/tournaments/:id/score', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { id } = req.params;
    const { score } = req.body;

    // Basic anti-cheat: limit unreasonable scores if possible, but hard without game integration
    // For now, assume score is valid (but user wants "real" tournaments, so this is critical)

    const tournaments = readJsonFile(TOURNAMENTS_FILE, []);
    const t = tournaments.find(x => x.id === id);

    if (!t) return res.status(404).json({ error: 'Tournoi introuvable' });
    if (t.status !== 'active') return res.status(400).json({ error: 'Tournoi non actif' });

    const participant = t.participants.find(p => p.username === user.username);
    if (!participant) return res.status(403).json({ error: 'Vous devez rejoindre le tournoi d\'abord' });

    // Update if high score
    if (score > participant.score) {
        participant.score = score;
        writeJsonFile(TOURNAMENTS_FILE, tournaments);
        console.log(`[SCORE] Updated for ${user.username} in ${t.id}: ${score}`);

        // Broadcast live update for leaderboard
        io.emit('tournament-update', { id: t.id, participants: t.participants });
    }

    res.json({ success: true, newHighScore: participant.score });
});

app.post('/api/tournaments/join', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { tournamentId } = req.body;
    const tournaments = readJsonFile(TOURNAMENTS_FILE, []);
    const tournament = tournaments.find(t => t.id === tournamentId);

    if (!tournament) return res.status(404).json({ error: 'Tournoi introuvable' });
    if (tournament.status !== 'active' && tournament.status !== 'upcoming') {
        return res.status(400).json({ error: 'Le tournoi est terminé' });
    }

    // Check if already joined
    if (tournament.participants.find(p => p.username === user.username)) {
        return res.status(400).json({ error: 'Déjà inscrit' });
    }

    // Check entry fee
    const users = readUsers();
    const currentUser = users.find(u => u.id === user.id);
    const isKing = isUserKing(currentUser.username);

    if (tournament.entryFee > 0 && !isKing) {
        if (currentUser.xubor < tournament.entryFee) {
            return res.status(400).json({ error: 'Fonds insuffisants' });
        }
        currentUser.xubor -= tournament.entryFee;
        writeUsers(users);
    }

    tournament.participants.push({
        username: user.username,
        score: 0,
        joinedAt: Date.now()
    });

    writeJsonFile(TOURNAMENTS_FILE, tournaments);

    // Send tournament join confirmation email
    if (currentUser.email && tournament.entryFee > 0) {
        sendEmail(currentUser.email, "🏆 Inscription tournoi confirmée !", `
            <h2>Vous êtes inscrit au tournoi !</h2>
            <p><strong>${tournament.title}</strong></p>
            <p>Frais d'entrée : <strong>${tournament.entryFee} X</strong></p>
            <p>Solde restant : <strong>${currentUser.xubor} X</strong></p>
            <p>Bonne chance ! Montrez votre talent et remportez le prix !</p>
            <br>
            <p style="color: #666; font-size: 12px;">Date : ${new Date().toLocaleString('fr-FR')}</p>
        `);
    }

    // Notify user via socket could be added here
    res.json({ success: true, message: 'Inscription réussie !' });
});

app.get('/api/achievements', (req, res) => {
    const achievements = readJsonFile(ACHIEVEMENTS_FILE, []);
    res.json(achievements);
});

// Check and claim achievement manually (or just return status)
app.get('/api/my-achievements', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const allAchievements = readJsonFile(ACHIEVEMENTS_FILE, []);
    const userAchievements = user.achievements || [];

    const result = allAchievements.map(ach => ({
        ...ach,
        unlocked: userAchievements.includes(ach.id)
    }));

    res.json(result);
});

// --- GUILD SYSTEM ---
app.get('/api/guilds', (req, res) => {
    const guilds = readJsonFile(GUILDS_FILE, []);
    res.json(guilds);
});

app.post('/api/guilds/create', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { name, description, emblem } = req.body;
    if (!name || name.length < 3 || name.length > 20) {
        return res.status(400).json({ error: 'Nom de guilde invalide (3-20 caractères)' });
    }

    const guilds = readJsonFile(GUILDS_FILE, []);
    const users = readUsers();
    const currentUser = users.find(u => u.id === user.id);

    // Check if user already in a guild
    if (currentUser.guild) {
        return res.status(400).json({ error: 'Vous êtes déjà dans une guilde' });
    }

    // Check if guild name exists
    if (guilds.find(g => g.name.toLowerCase() === name.toLowerCase())) {
        return res.status(400).json({ error: 'Nom de guilde déjà pris' });
    }

    // Check creation cost (1000 Xubor)
    if (currentUser.xubor < 1000) {
        return res.status(400).json({ error: 'Fonds insuffisants (1000 Xubor requis)' });
    }

    const newGuild = {
        id: uuidv4(),
        name,
        description: description || '',
        leader: user.username,
        members: [user.username],
        xp: 0,
        level: 1,
        emblem: emblem || '🏰',
        createdAt: Date.now(),
        wins: 0,
        losses: 0
    };

    guilds.push(newGuild);
    writeJsonFile(GUILDS_FILE, guilds);

    // Deduct cost and assign guild
    currentUser.xubor -= 1000;
    currentUser.guild = newGuild.id;
    writeUsers(users);

    res.json({ success: true, guild: newGuild });
});

app.post('/api/guilds/join', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { guildId } = req.body;
    const guilds = readJsonFile(GUILDS_FILE, []);
    const guild = guilds.find(g => g.id === guildId);

    if (!guild) return res.status(404).json({ error: 'Guilde introuvable' });

    const users = readUsers();
    const currentUser = users.find(u => u.id === user.id);

    if (currentUser.guild) {
        return res.status(400).json({ error: 'Vous êtes déjà dans une guilde' });
    }

    if (guild.members.length >= 50) {
        return res.status(400).json({ error: 'Guilde pleine (max 50 membres)' });
    }

    guild.members.push(user.username);
    writeJsonFile(GUILDS_FILE, guilds);

    currentUser.guild = guild.id;
    writeUsers(users);

    res.json({ success: true, message: 'Rejoint la guilde !' });
});

app.post('/api/guilds/leave', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const users = readUsers();
    const currentUser = users.find(u => u.id === user.id);

    if (!currentUser.guild) {
        return res.status(400).json({ error: 'Vous n\'êtes pas dans une guilde' });
    }

    const guilds = readJsonFile(GUILDS_FILE, []);
    const guild = guilds.find(g => g.id === currentUser.guild);

    if (guild) {
        // If leader, disband guild
        if (guild.leader === user.username) {
            // Remove guild from all members
            guild.members.forEach(member => {
                const memberUser = users.find(u => u.username === member);
                if (memberUser) memberUser.guild = null;
            });
            // Remove guild
            const index = guilds.indexOf(guild);
            guilds.splice(index, 1);
        } else {
            // Remove member
            guild.members = guild.members.filter(m => m !== user.username);
        }
        writeJsonFile(GUILDS_FILE, guilds);
    }

    currentUser.guild = null;
    writeUsers(users);

    res.json({ success: true, message: 'Quitté la guilde' });
});

app.get('/api/my-guild', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const users = readUsers();
    const currentUser = users.find(u => u.id === user.id);

    if (!currentUser.guild) {
        return res.json({ guild: null });
    }

    const guilds = readJsonFile(GUILDS_FILE, []);
    const guild = guilds.find(g => g.id === currentUser.guild);

    if (!guild) {
        currentUser.guild = null;
        writeUsers(users);
        return res.json({ guild: null });
    }

    res.json({ guild });
});

app.get('/api/events/active', (req, res) => {
    const events = readJsonFile(EVENTS_FILE, {});
    res.json(events.activeEvent || null);
});

app.get('/api/leaderboard', (req, res) => {
    const users = readUsers();
    // Sort by level and then xp (or just xp since level depends on xp)
    // Return every player so late-joined users do not disappear from the ranking.
    const leaderboard = users
        .map(u => ({ username: u.username, level: u.level || 1, xp: u.xp || 0, id: u.id, equippedSkinId: u.equippedSkinId || 0 }))
        .sort((a, b) => b.xp - a.xp);

    res.json(leaderboard);
});

// --- SKINS & SHOP APIs ---

app.get('/api/skins', (req, res) => {
    if (fs.existsSync(SKINS_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(SKINS_FILE, 'utf8'));
            return res.json(data);
        } catch (e) {
            return res.json([]);
        }
    }
    res.json([]);
});

app.get('/api/cosmetics', (req, res) => {
    const cosmetics = readJsonFile(COSMETICS_FILE, []);
    res.json(cosmetics);
});

app.post('/api/buy-cosmetic', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { cosmeticId, price } = req.body;
    const users = readUsers();
    const currentUser = users.find(u => u.id === user.id);
    const isKing = isUserKing(currentUser.username);

    if (price > 0 && !isKing) {
        if (currentUser.xubor < price) {
            return res.status(400).json({ error: 'Fonds insuffisants' });
        }
        currentUser.xubor -= price;
    }

    if (!currentUser.equippedCosmetics) {
        currentUser.equippedCosmetics = {};
    }

    const cosmetics = readJsonFile(COSMETICS_FILE, []);
    const cosmetic = cosmetics.find(c => c.id === cosmeticId);

    if (!currentUser.cosmetics) {
        currentUser.cosmetics = [];
    }
    if (!currentUser.cosmetics.includes(cosmeticId)) {
        currentUser.cosmetics.push(cosmeticId);
    }

    currentUser.equippedCosmetics[cosmetic.type] = cosmeticId;

    writeUsers(users);

    res.json({
        success: true,
        newBalance: currentUser.xubor,
        message: `${cosmetic.name} acquis et équipé !`
    });
});

app.post('/api/equip-cosmetic', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { cosmeticId } = req.body;
    const users = readUsers();
    const currentUser = users.find(u => u.id === user.id);

    if (!currentUser.cosmetics || !currentUser.cosmetics.includes(cosmeticId)) {
        return res.status(400).json({ error: 'Cosmétique non possédé' });
    }

    if (!currentUser.equippedCosmetics) {
        currentUser.equippedCosmetics = {};
    }

    const cosmetics = readJsonFile(COSMETICS_FILE, []);
    const cosmetic = cosmetics.find(c => c.id === cosmeticId);

    currentUser.equippedCosmetics[cosmetic.type] = cosmeticId;
    writeUsers(users);

    res.json({ success: true, message: 'Cosmétique équipé !' });
});

app.post('/api/buy-skin', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { skinId, price } = req.body;
    const numSkinId = parseInt(skinId);
    const users = readUsers();
    const currentUser = users.find(u => u.id === user.id);
    const isKing = isUserKing(currentUser.username);

    if (!isKing && currentUser.xubor < price) return res.status(400).json({ error: 'Fonds insuffisants' });
    if (currentUser.inventory.includes(numSkinId)) return res.json({ success: true }); // Already owned

    if (!isKing) currentUser.xubor -= price;
    currentUser.inventory.push(numSkinId);
    writeUsers(users);

    // Send purchase confirmation email
    if (currentUser.email) {
        const skins = readJsonFile(SKINS_FILE, []);
        const skin = skins.find(s => s.id === numSkinId);
        sendEmail(currentUser.email, "🎨 Skin acheté avec succès !", `
            <h2>Merci pour votre achat !</h2>
            <p>Vous avez acheté le skin <strong>${skin ? skin.name : 'Inconnu'}</strong> pour <strong>${price} X</strong>.</p>
            <p>Votre solde restant : <strong>${currentUser.xubor} X</strong></p>
            <p>Connectez-vous pour l'équiper et montrer votre style !</p>
            <br>
            <p style="color: #666; font-size: 12px;">Date : ${new Date().toLocaleString('fr-FR')}</p>
        `);
    }

    res.json({ success: true, xubor: currentUser.xubor, inventory: currentUser.inventory });
});

app.post('/api/add-funds', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Montant invalide' });

    const users = readUsers();
    const currentUser = users.find(u => u.id === user.id);

    currentUser.xubor += amount;
    writeUsers(users);

    // Send funds added confirmation email
    if (currentUser.email) {
        sendEmail(currentUser.email, "💰 Fonds ajoutés avec succès !", `
            <h2>Votre compte a été rechargé !</h2>
            <p><strong>${amount} X</strong> ont été ajoutés à votre compte.</p>
            <p>Nouveau solde : <strong>${currentUser.xubor} X</strong></p>
            <p>Profitez de vos X pour acheter des skins, participer aux tournois et dominer le classement !</p>
            <br>
            <p style="color: #666; font-size: 12px;">Date : ${new Date().toLocaleString('fr-FR')}</p>
        `);
    }

    res.json({ success: true, xubor: currentUser.xubor });
});

app.post('/api/equip-skin', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { skinId } = req.body;
    const users = readUsers();
    const currentUser = users.find(u => u.id === user.id);

    if (!currentUser.inventory.includes(skinId)) return res.status(403).json({ error: 'Skin non possédé' });

    currentUser.equippedSkinId = skinId;
    writeUsers(users);

    res.json({ success: true });
});

// --- GAMES APIs ---

const GAMES_FILE = path.join(DATA_DIR, 'games.json');

const readGames = () => {
    if (!fs.existsSync(GAMES_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(GAMES_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
};

const writeGames = (games) => {
    fs.writeFileSync(GAMES_FILE, JSON.stringify(games, null, 2));
};

app.get('/api/games', (req, res) => {
    try {
        const games = readGames();
        const user = getUserBySession(req);

        // Enrich games with "isLiked" if user is logged in
        const gamesWithState = games.map(g => ({
            ...g,
            likesCount: g.likes ? g.likes.length : 0,
            isLiked: user && g.likes ? g.likes.includes(user.username) : false,
            likes: undefined // Don't send full list of likers to client
        }));

        res.json(gamesWithState);
    } catch (error) {
        console.error("Error in /api/games:", error);
        res.status(500).json({ error: error.message });
    }
});

// Get most popular games globally
app.get('/api/games/popular', (req, res) => {
    try {
        const games = readGames();
        const limit = parseInt(req.query.limit) || 10;

        // Sort games by visits (descending)
        const popularGames = games
            .filter(g => g.visits && g.visits > 0)
            .sort((a, b) => (b.visits || 0) - (a.visits || 0))
            .slice(0, limit)
            .map(g => ({
                id: g.id,
                title: g.title,
                visits: g.visits || 0,
                thumbnail: g.thumbnail,
                category: g.category
            }));

        res.json(popularGames);
    } catch (error) {
        console.error("Error in /api/games/popular:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/games/:id/play', (req, res) => {
    const { id } = req.params;
    const games = readGames();
    const game = games.find(g => g.id === id);

    if (game) {
        game.visits = (game.visits || 0) + 1;
        writeGames(games);
    }

    // Track user stats
    const user = getUserBySession(req);
    if (user) {
        const users = readUsers();
        const currentUser = users.find(u => u.username === user.username);
        if (currentUser) {
            if (!currentUser.gameStats) currentUser.gameStats = {};
            currentUser.gameStats[id] = (currentUser.gameStats[id] || 0) + 1;
            writeUsers(users);
        }
    }

    res.json({ success: true });
});

app.post('/api/games/:id/like', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { id } = req.params;
    const games = readGames();
    const game = games.find(g => g.id === id);

    if (!game) return res.status(404).json({ error: 'Jeu introuvable' });

    if (!game.likes) game.likes = [];

    const likeIndex = game.likes.indexOf(user.username);
    let liked = false;

    if (likeIndex === -1) {
        game.likes.push(user.username);
        liked = true;
    } else {
        game.likes.splice(likeIndex, 1);
        liked = false;
    }

    writeGames(games);

    res.json({
        success: true,
        liked,
        likesCount: game.likes.length
    });
});

// --- CHAT APIs ---

const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

const readMessages = () => {
    if (!fs.existsSync(MESSAGES_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
};

const writeMessages = (msgs) => {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(msgs, null, 2));
};

app.get('/api/chat/history', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { friend } = req.query;
    if (!friend) return res.json([]);

    const messages = readMessages();
    // Filter messages between current user and 'friend'
    const history = messages.filter(m =>
        (m.from === user.username && m.to === friend) ||
        (m.from === friend && m.to === user.username)
    );

    res.json(history);
});

app.post('/api/chat/send', (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { to, content } = req.body;
    if (!to || !content) return res.status(400).json({ error: 'Message vide ou destinataire manquant' });

    const messages = readMessages();
    const newMessage = {
        id: uuidv4(),
        from: user.username,
        to,
        content,
        timestamp: Date.now()
    };

    messages.push(newMessage);
    writeMessages(messages);

    res.json({ success: true, message: newMessage });
});

// --- PAYPAL PAYMENT SYSTEM ---

// Helper function to get PayPal Access Token
async function getPayPalAccessToken() {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
        throw new Error("Missing PayPal credentials in .env");
    }
    const auth = Buffer.from(PAYPAL_CLIENT_ID + ':' + PAYPAL_CLIENT_SECRET).toString('base64');
    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    const data = await response.json();
    return data.access_token;
}

app.post('/api/create-paypal-order', async (req, res) => {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { amount, price } = req.body; // price in euros, amount in Xubor

    try {
        const accessToken = await getPayPalAccessToken();

        const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: 'EUR',
                        value: price.toString()
                    },
                    description: `${amount} Xubor`,
                    custom_id: JSON.stringify({ username: user.username, xuborAmount: amount })
                }],
                application_context: {
                    return_url: `${req.protocol}://${req.get('host')}/api/paypal-success`,
                    cancel_url: `${req.protocol}://${req.get('host')}/?payment=cancelled`
                }
            })
        });

        const order = await response.json();

        // Find the approve URL
        let approveLink = null;
        if (order && order.links) {
            approveLink = order.links.find(link => link.rel === 'approve');
        }

        if (approveLink) {
            res.json({ checkoutUrl: approveLink.href });
        } else {
            console.error("PayPal Order creation failed. API Response:", JSON.stringify(order, null, 2));
            res.status(500).json({ error: "Erreur PayPal: " + JSON.stringify(order).substring(0, 100) });
        }
    } catch (error) {
        console.error("PayPal Session Error:", error.message || error);
        res.status(500).json({ error: "Erreur serveur: " + (error.message || "Erreur inconnue").substring(0, 100) });
    }
});

app.get('/api/paypal-success', async (req, res) => {
    const { token } = req.query; // PayPal returns the order ID as 'token'
    if (!token) return res.redirect('/?payment=error');

    try {
        const accessToken = await getPayPalAccessToken();

        // Capture the order
        const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${token}/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const captureData = await response.json();

        if (captureData.status === 'COMPLETED') {
            const customId = captureData.purchase_units[0].payments.captures[0].custom_id;
            let metadata = {};
            try {
                metadata = JSON.parse(customId);
            } catch (e) {
                console.error("Failed to parse custom_id from PayPal", e);
            }

            const username = metadata.username;
            const xuborAmount = parseInt(metadata.xuborAmount);

            if (username && xuborAmount) {
                const users = readUsers();
                const user = users.find(u => u.username === username);

                if (user) {
                    // Ensure we don't grant twice for the same order
                    if (!user.processedPayments) user.processedPayments = [];
                    if (!user.processedPayments.includes(token)) {
                        user.xubor += xuborAmount;
                        user.processedPayments.push(token);
                        writeUsers(users);
                        console.log(`[PAYMENT] Granted ${xuborAmount} Xubor to ${username} via PayPal`);
                    }
                }
            }
            res.redirect('/?payment=success');
        } else {
            res.redirect('/?payment=error');
        }
    } catch (error) {
        console.error("PayPal Capture Error:", error);
        res.redirect('/?payment=error');
    }
});


// Fallback
app.get('*', (req, res) => {
    if (path.extname(req.path)) {
        return res.status(404).type('text/plain').send('Not found');
    }

    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).send('Not found');
});

// --- SOCKET.IO SIGNALING & PRESENCE ---

let connectedUsers = {}; // username -> socketId
let userStatus = {}; // username -> { state: 'online'|'ingame'|'offline', game: null }

function broadcastStatus(username, status) {
    const users = readUsers();
    const user = users.find(u => u.username === username);
    if (!user) return;

    user.friends.forEach(friendName => {
        const friendSocketId = connectedUsers[friendName];
        if (friendSocketId) {
            io.to(friendSocketId).emit('status-update', { username, status });
        }
    });
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join-user', (username) => {
        connectedUsers[username] = socket.id;
        userStatus[username] = { state: 'online' };
        console.log(`${username} joined with socket ${socket.id}`);

        // Broadcast online status
        broadcastStatus(username, userStatus[username]);

        // Send current status of all friends to the joining user
        const users = readUsers();
        const me = users.find(u => u.username === username);
        if (me) {
            me.friends.forEach(f => {
                if (userStatus[f] && userStatus[f].state !== 'offline') {
                    socket.emit('status-update', { username: f, status: userStatus[f] });
                }
            });
        }
    });

    socket.on('start-game', (data) => {
        // data: { username, gameId, gameTitle }
        userStatus[data.username] = { state: 'ingame', game: data.gameTitle, gameId: data.gameId };
        broadcastStatus(data.username, userStatus[data.username]);
    });

    socket.on('stop-game', (username) => {
        userStatus[username] = { state: 'online' };
        broadcastStatus(username, userStatus[username]);
    });

    socket.on('send-game-invite', (data) => {
        const user = Object.keys(connectedUsers).find(key => connectedUsers[key] === socket.id);
        if (!user) return;

        const users = readUsers();
        const me = users.find(u => u.username === user);
        if (!me) return;

        const status = userStatus[user] || {};
        const gameName = status.game || 'un jeu';

        if (data.targetFriend) {
            const targetSocket = connectedUsers[data.targetFriend];
            if (targetSocket && me.friends.includes(data.targetFriend)) {
                io.to(targetSocket).emit('game-invite-received', {
                    from: user,
                    gameName: gameName,
                    link: data.link,
                    gameId: data.gameId
                });
            }
            return;
        }

        me.friends.forEach(f => {
            const friendSocket = connectedUsers[f];
            if (friendSocket) {
                io.to(friendSocket).emit('game-invite-received', {
                    from: user,
                    gameName: gameName,
                    link: data.link,
                    gameId: data.gameId
                });
            }
        });
    });


    socket.on('call-user', (data) => {
        const targetSocket = connectedUsers[data.to];
        if (targetSocket) {
            io.to(targetSocket).emit('call-made', {
                offer: data.offer,
                socket: socket.id,
                from: data.from
            });
        }
    });

    socket.on('make-answer', (data) => {
        io.to(data.to).emit('answer-made', {
            socket: socket.id,
            answer: data.answer
        });
    });

    socket.on('ice-candidate', (data) => {
        const targetSocket = connectedUsers[data.to];
        if (targetSocket) {
            io.to(targetSocket).emit('ice-candidate', {
                candidate: data.candidate,
                from: data.from
            });
        }
    });

    socket.on('end-call', (data) => {
        const targetSocket = connectedUsers[data.to];
        if (targetSocket) {
            io.to(targetSocket).emit('end-call');
        }
    });

    socket.on('disconnect', () => {
        const user = Object.keys(connectedUsers).find(key => connectedUsers[key] === socket.id);
        if (user) {
            delete connectedUsers[user];
            userStatus[user] = { state: 'offline' };
            console.log(`${user} disconnected`);
            broadcastStatus(user, { state: 'offline' });
        }

        // Also notify Nexus Hub
        io.to('nexus').emit('nexus-player-left', { id: socket.id });
    });

    // --- GLITCH EVENT HANDLERS ---
    socket.on('claim-glitch', () => {
        if (!isGlitchActive) return;

        // Find user
        const userEntry = Object.entries(connectedUsers).find(([k, v]) => v === socket.id);
        if (userEntry) {
            const username = userEntry[0];
            const users = readUsers();
            const user = users.find(u => u.username === username);

            if (user) {
                const reward = Math.floor(Math.random() * 500) + 100;
                user.xubor += reward;
                writeUsers(users);

                socket.emit('glitch-claimed', { reward, newBalance: user.xubor });

                // End event globally
                isGlitchActive = false;
                if (glitchTimeout) clearTimeout(glitchTimeout);
                io.emit('end-glitch', { winner: username });

                io.emit('notification', {
                    type: 'system',
                    message: `⚡ ${username} a stabilisé l'Anomalie et gagné ${reward} Xubor !`
                });

                if (user.email) {
                    sendEmail(user.email, "Anomalie Stabilisée !", `
                        <h3>Bravo ${username} !</h3>
                        <p>Vous avez été le plus rapide pour stabiliser l'Anomalie.</p>
                        <p><strong>Récompense :</strong> ${reward} Xubor.</p>
                    `);
                }

                scheduleNextGlitch();
            }
        }
    });
});


// --- GLITCH EVENT SYSTEM ---
let isGlitchActive = false;
let glitchTimeout = null;

const specialThemes = ['valentine', 'halloween', 'ramadan', 'christmas', 'newyear', 'easter', 'summer'];

const startGlitchEvent = () => {
    isGlitchActive = true;
    const duration = 20000; // 20 seconds to catch it

    // 30% chance to trigger a special theme during glitch
    if (Math.random() < 0.3) {
        const randomTheme = specialThemes[Math.floor(Math.random() * specialThemes.length)];
        io.emit('special-theme', { theme: randomTheme, duration: duration + 10000 }); // Theme lasts 10s longer than glitch
        console.log(`[GLITCH] Special theme triggered: ${randomTheme}`);
    }

    io.emit('start-glitch', { duration });
    console.log(`[GLITCH] Event started!`);

    glitchTimeout = setTimeout(() => {
        if (isGlitchActive) {
            isGlitchActive = false;
            io.emit('end-glitch', { winner: null });
            console.log(`[GLITCH] Event ended (no winner).`);
            scheduleNextGlitch();
        }
    }, duration);
};

const scheduleNextGlitch = () => {
    // Random time between 5 and 20 minutes (for engagement)
    const minTime = 5 * 60 * 1000;
    const maxTime = 20 * 60 * 1000;
    const nextTime = Math.random() * (maxTime - minTime) + minTime;

    // For DEV purposes, let's make it faster: 30s to 2 mins initially
    // const nextTime = Math.random() * (120000 - 30000) + 30000;

    console.log(`[GLITCH] Next event in ${(nextTime / 60000).toFixed(2)} minutes`);
    setTimeout(startGlitchEvent, nextTime);
};

// Start the cycle
scheduleNextGlitch();


try {
    const startRpgServer = require('./rpg_server.js');
    startRpgServer();
} catch (e) {
    console.error("Failed to start RPG Server:", e);
}

// Auto-start Instatock Server
try {
    const { spawn } = require('child_process');
    const instatockPath = path.join(__dirname, 'Instatock', 'server', 'server.js');

    // We use spawn to run the ES module server
    const instatockProcess = spawn('node', [instatockPath], {
        env: { ...process.env, PORT: 4005 },
        stdio: 'inherit'
    });

    instatockProcess.on('error', (err) => {
        console.error("Failed to start Instatock Server:", err);
    });

    console.log("🚀 Instatock Backend starting on port 4005...");
} catch (e) {
    console.error("Error launching Instatock Server:", e);
}

server.on('upgrade', (req, socket, head) => {
    if (req.url && req.url.startsWith('/socket.io/instatock')) {
        instatockSocketProxy.upgrade(req, socket, head);
    }
});

server.listen(PORT, () => {
    console.log(`---------------------------------------------------`);
    console.log(`🚀 Xolbor Strong Server started!`);
    console.log(`📡 Domain: http://127.0.0.1:${PORT}`);
    console.log(`📱 App (Emulator): http://127.0.0.1:${PORT}`);
    console.log(`---------------------------------------------------`);
});
