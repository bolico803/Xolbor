const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const { User, Skin, Friend, Game } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'xolbor_secret_key_2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Middleware d'authentification
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token manquant' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token invalide' });
        }
        req.user = user;
        next();
    });
};

// Routes publiques
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Vérification de la disponibilité du pseudo
app.get('/api/check-username', async (req, res) => {
    const { username } = req.query;
    
    if (!username || username.length < 3) {
        return res.json({ available: false });
    }
    
    User.checkUsernameExists(username, (err, exists) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        res.json({ available: !exists });
    });
});

// Inscription
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    if (username.length < 3) {
        return res.status(400).json({ error: 'Le pseudo doit faire au moins 3 caractères' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
    }

    // Vérifier si l'utilisateur existe déjà
    User.findByUsername(username, (err, existingUser) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }

        if (existingUser) {
            return res.status(400).json({ error: 'Ce pseudo est déjà utilisé' });
        }

        User.findByEmail(email, (err, existingEmail) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }

            if (existingEmail) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé' });
            }

            // Créer l'utilisateur
            User.create(username, email, password, (err, user) => {
                if (err) {
                    return res.status(500).json({ error: 'Erreur lors de la création du compte' });
                }

                // Générer le token JWT
                const token = jwt.sign(
                    { id: user.id, username: user.username },
                    JWT_SECRET,
                    { expiresIn: '7d' }
                );

                res.status(201).json({
                    message: 'Compte créé avec succès',
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        xubor: 100, // Bonus de bienvenue
                        avatar: 'default'
                    }
                });
            });
        });
    });
});

// Connexion
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Pseudo et mot de passe requis' });
    }

    User.findByUsername(username, async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }

        // Vérifier le mot de passe
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }

        // Générer le token JWT
        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                xubor: user.xubor,
                avatar: user.avatar
            }
        });
    });
});

// Vérification du token
app.get('/api/verify', authenticateToken, (req, res) => {
    User.findById(req.user.id, (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        res.json({ user });
    });
});

// Routes protégées
// Récupérer le profil utilisateur
app.get('/api/profile', authenticateToken, (req, res) => {
    User.findById(req.user.id, (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        
        // Récupérer les skins de l'utilisateur
        Skin.getUserSkins(req.user.id, (err, skins) => {
            if (err) {
                skins = [];
            }
            
            res.json({ ...user, skins });
        });
    });
});

// Mettre à jour l'avatar
app.put('/api/profile/avatar', authenticateToken, (req, res) => {
    const { avatar } = req.body;
    
    if (!avatar) {
        return res.status(400).json({ error: 'Avatar requis' });
    }
    
    User.updateAvatar(req.user.id, avatar, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la mise à jour' });
        }
        
        res.json({ message: 'Avatar mis à jour', avatar });
    });
});

// Marketplace - Liste des skins
app.get('/api/skins', authenticateToken, (req, res) => {
    const { rarity, search } = req.query;
    
    Skin.getAll({ rarity, search }, (err, skins) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        // Vérifier quels skins sont déjà possédés
        Skin.getUserSkins(req.user.id, (err, userSkins) => {
            const userSkinIds = userSkins ? userSkins.map(skin => skin.id) : [];
            
            const skinsWithOwnership = skins.map(skin => ({
                ...skin,
                owned: userSkinIds.includes(skin.id)
            }));
            
            res.json({ skins: skinsWithOwnership });
        });
    });
});

// Acheter un skin
app.post('/api/skins/:id/purchase', authenticateToken, (req, res) => {
    const skinId = parseInt(req.params.id);
    
    Skin.purchase(req.user.id, skinId, (err, result) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        
        // Récupérer le nouveau solde
        User.findById(req.user.id, (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            res.json({ 
                success: true, 
                message: 'Skin acheté avec succès',
                xubor: user.xubor 
            });
        });
    });
});

// Liste des jeux
app.get('/api/games', authenticateToken, (req, res) => {
    Game.getAll((err, games) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        res.json({ games });
    });
});

// Rechercher des jeux
app.get('/api/games/search', authenticateToken, (req, res) => {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
        return res.json({ games: [] });
    }
    
    Game.search(q, (err, games) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        res.json({ games });
    });
});

// Amis - Envoyer une demande
app.post('/api/friends/request', authenticateToken, (req, res) => {
    const { username } = req.body;
    
    if (!username) {
        return res.status(400).json({ error: 'Pseudo requis' });
    }
    
    Friend.sendRequest(req.user.id, username, (err, result) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        
        res.json({ 
            success: true, 
            message: `Demande d'ami envoyée à ${username}` 
        });
    });
});

// Amis - Liste
app.get('/api/friends', authenticateToken, (req, res) => {
    Friend.getFriends(req.user.id, (err, friends) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        Friend.getPendingRequests(req.user.id, (err, pendingRequests) => {
            if (err) {
                pendingRequests = [];
            }
            
            res.json({ friends, pendingRequests });
        });
    });
});

// Amis - Accepter une demande
app.post('/api/friends/:id/accept', authenticateToken, (req, res) => {
    const friendId = parseInt(req.params.id);
    
    Friend.acceptRequest(req.user.id, friendId, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        res.json({ success: true, message: 'Demande d\'ami acceptée' });
    });
});

// Acheter des Xubor (simulé)
app.post('/api/xubor/purchase', authenticateToken, (req, res) => {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Montant invalide' });
    }
    
    User.updateXubor(req.user.id, amount, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        // Enregistrer la transaction
        const db = require('./database').db;
        db.run(
            'INSERT INTO transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
            [req.user.id, amount, 'purchase', `Achat de ${amount} Xubor`],
            (err) => {
                if (err) {
                    console.error('Erreur enregistrement transaction:', err);
                }
                
                // Récupérer le nouveau solde
                User.findById(req.user.id, (err, user) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur serveur' });
                    }
                    
                    res.json({ 
                        success: true, 
                        message: `${amount} Xubor ajoutés à votre compte`,
                        xubor: user.xubor 
                    });
                });
            }
        );
    });
});

// Historique des transactions
app.get('/api/transactions', authenticateToken, (req, res) => {
    const db = require('./database').db;
    
    db.all(
        'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
        [req.user.id],
        (err, transactions) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            res.json({ transactions });
        }
    );
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`Serveur Xolbor démarré sur http://localhost:${PORT}`);
});