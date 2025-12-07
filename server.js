// server.js - Backend Node.js pour Xolbor
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/xolbor', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Modèles
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    xubor: { type: Number, default: 100 },
    avatar: { type: String, default: 'default' },
    skins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Skin' }],
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    games: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Game' }],
    createdAt: { type: Date, default: Date.now },
    lastLogin: Date
});

const SkinSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
    imageUrl: String,
    model3dUrl: String,
    createdAt: { type: Date, default: Date.now }
});

const GameSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    imageUrl: String,
    gameUrl: String,
    players: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const TransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['purchase', 'refund', 'gift'], required: true },
    itemId: mongoose.Schema.Types.ObjectId,
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Skin = mongoose.model('Skin', SkinSchema);
const Game = mongoose.model('Game', GameSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);

// Middleware d'authentification
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Routes d'authentification
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Vérifier si l'utilisateur existe déjà
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Créer l'utilisateur
        const user = new User({
            username,
            email,
            password: hashedPassword,
            xubor: 100, // Xubor de bienvenue
            avatar: 'default'
        });

        await user.save();

        // Générer le token JWT
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                xubor: user.xubor,
                avatar: user.avatar
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Trouver l'utilisateur
        const user = await User.findOne({ 
            $or: [{ username }, { email: username }] 
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Vérifier le mot de passe
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Mettre à jour la dernière connexion
        user.lastLogin = new Date();
        await user.save();

        // Générer le token JWT
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                xubor: user.xubor,
                avatar: user.avatar,
                skins: user.skins,
                friends: user.friends,
                games: user.games
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Routes des skins
app.get('/api/skins', async (req, res) => {
    try {
        const { rarity, search, page = 1, limit = 20 } = req.query;
        const query = {};

        if (rarity && rarity !== 'all') {
            query.rarity = rarity;
        }

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const skins = await Skin.find(query)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ price: 1 });

        const total = await Skin.countDocuments(query);

        res.json({
            skins,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/skins/:id/purchase', authenticateToken, async (req, res) => {
    try {
        const skinId = req.params.id;
        const userId = req.user.userId;

        const skin = await Skin.findById(skinId);
        if (!skin) {
            return res.status(404).json({ error: 'Skin not found' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Vérifier si l'utilisateur possède déjà le skin
        if (user.skins.includes(skinId)) {
            return res.status(400).json({ error: 'Skin already owned' });
        }

        // Vérifier le solde Xubor
        if (user.xubor < skin.price) {
            return res.status(400).json({ error: 'Insufficient Xubor balance' });
        }

        // Déduire le prix et ajouter le skin
        user.xubor -= skin.price;
        user.skins.push(skinId);
        await user.save();

        // Créer une transaction
        const transaction = new Transaction({
            userId,
            amount: skin.price,
            type: 'purchase',
            itemId: skinId,
            status: 'completed'
        });
        await transaction.save();

        res.json({
            message: 'Purchase successful',
            user: {
                xubor: user.xubor,
                skins: user.skins
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Routes des jeux
app.get('/api/games', async (req, res) => {
    try {
        const games = await Game.find().sort({ players: -1 }).limit(10);
        res.json(games);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Routes des amis
app.get('/api/friends', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .populate('friends', 'username avatar xubor')
            .select('friends');

        res.json(user.friends || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/friends/add', authenticateToken, async (req, res) => {
    try {
        const { friendId } = req.body;
        const userId = req.user.userId;

        // Vérifier que l'utilisateur n'ajoute pas lui-même
        if (userId === friendId) {
            return res.status(400).json({ error: 'Cannot add yourself as friend' });
        }

        const user = await User.findById(userId);
        const friend = await User.findById(friendId);

        if (!friend) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Vérifier si déjà ami
        if (user.friends.includes(friendId)) {
            return res.status(400).json({ error: 'Already friends' });
        }

        // Ajouter l'ami
        user.friends.push(friendId);
        await user.save();

        res.json({ message: 'Friend added successfully', friend });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Routes de paiement avec Stripe
app.post('/api/payment/create-intent', authenticateToken, async (req, res) => {
    try {
        const { amount, currency = 'eur' } = req.body;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100, // Convertir en centimes
            currency,
            metadata: {
                userId: req.user.userId
            }
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            amount: amount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/payment/confirm', authenticateToken, async (req, res) => {
    try {
        const { paymentIntentId, xuborAmount } = req.body;
        const userId = req.user.userId;

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ error: 'Payment not successful' });
        }

        // Ajouter les Xubor à l'utilisateur
        const user = await User.findById(userId);
        user.xubor += parseInt(xuborAmount);
        await user.save();

        // Créer une transaction
        const transaction = new Transaction({
            userId,
            amount: xuborAmount,
            type: 'purchase',
            status: 'completed'
        });
        await transaction.save();

        res.json({
            message: 'Payment confirmed',
            xubor: user.xubor
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route pour vérifier la disponibilité du pseudo
app.get('/api/check-username/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const user = await User.findOne({ username });
        
        res.json({
            available: !user,
            username
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route pour obtenir le profil utilisateur
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select('-password')
            .populate('skins')
            .populate('friends', 'username avatar')
            .populate('games');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route pour mettre à jour le profil
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { avatar, currentSkin } = req.body;
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (avatar) user.avatar = avatar;
        if (currentSkin) user.currentSkin = currentSkin;

        await user.save();

        res.json({
            message: 'Profile updated successfully',
            user: {
                avatar: user.avatar,
                currentSkin: user.currentSkin
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route pour obtenir les statistiques
app.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        const skinsCount = await Skin.countDocuments();
        const gamesCount = await Game.countDocuments();
        const usersCount = await User.countDocuments();

        res.json({
            userStats: {
                xubor: user.xubor,
                skins: user.skins.length,
                friends: user.friends.length,
                games: user.games.length
            },
            platformStats: {
                totalSkins: skinsCount,
                totalGames: gamesCount,
                totalUsers: usersCount
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route pour les données de démo (seed)
app.post('/api/seed', async (req, res) => {
    try {
        // Vider les collections existantes
        await Skin.deleteMany({});
        await Game.deleteMany({});

        // Créer des skins de démo
        const skins = [];
        const skinNames = [
            'Dragon Rouge', 'Ninja Shadow', 'Cyber Warrior', 'Phantom Assassin',
            'Golden Knight', 'Ice Mage', 'Fire Demon', 'Electric Samurai'
        ];

        for (let i = 0; i < 100; i++) {
            const rarities = ['common', 'rare', 'epic', 'legendary'];
            const rarity = rarities[Math.floor(Math.random() * rarities.length)];
            
            let price;
            switch(rarity) {
                case 'common': price = 100 + Math.floor(Math.random() * 400); break;
                case 'rare': price = 500 + Math.floor(Math.random() * 500); break;
                case 'epic': price = 1000 + Math.floor(Math.random() * 1500); break;
                case 'legendary': price = 2500 + Math.floor(Math.random() * 5000); break;
            }

            skins.push({
                name: `${skinNames[i % skinNames.length]} ${Math.floor(i / skinNames.length) + 1}`,
                description: `Skin ${rarity} unique avec des effets spéciaux`,
                price,
                rarity,
                imageUrl: `https://via.placeholder.com/300x200?text=Skin+${i+1}`,
                model3dUrl: `https://example.com/models/skin${i+1}.glb`
            });
        }

        await Skin.insertMany(skins);

        // Créer des jeux de démo
        const games = [
            {
                name: 'Cyber Arena',
                description: 'Battle royale futuriste avec des graphismes époustouflants',
                imageUrl: 'https://via.placeholder.com/400x300?text=Cyber+Arena',
                gameUrl: '/games/cyber-arena',
                players: 125000,
                rating: 4.8
            },
            {
                name: 'Dragon Realm',
                description: 'MMORPG fantastique avec des dragons et des quêtes épiques',
                imageUrl: 'https://via.placeholder.com/400x300?text=Dragon+Realm',
                gameUrl: '/games/dragon-realm',
                players: 89000,
                rating: 4.9
            },
            {
                name: 'Space Racer',
                description: 'Course spatiale à haute vitesse avec personnalisation avancée',
                imageUrl: 'https://via.placeholder.com/400x300?text=Space+Racer',
                gameUrl: '/games/space-racer',
                players: 67000,
                rating: 4.7
            }
        ];

        await Game.insertMany(games);

        res.json({ message: 'Database seeded successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route racine
app.get('/', (req, res) => {
    res.send('Xolbor API is running');
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});