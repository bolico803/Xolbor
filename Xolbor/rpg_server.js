const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

function startRpgServer() {
    const app = express();
    const server = createServer(app);
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    const rooms = {
        'public': {
            players: {},
            spawnedObjects: [
                { type: 'car', id: 'police_1', initialPosition: [35, 1, 95], color: '#1e3a8a', ownerId: 'server' },
                { type: 'car', id: 'fire_1', initialPosition: [10, 1, 45], color: '#b91c1c', ownerId: 'server' },
                { type: 'car', id: 'civilian_1', initialPosition: [150, 1, 60], color: '#ffffff', ownerId: 'server' },
                { type: 'car', id: 'civilian_2', initialPosition: [60, 1, 120], color: '#ef4444', ownerId: 'server' },
                { type: 'car', id: 'civilian_3', initialPosition: [110, 1, 40], color: '#3b82f6', ownerId: 'server' },
                { type: 'car', id: 'agency_1', initialPosition: [250, 1, -80], color: '#000000', ownerId: 'server' }
            ],
            modernHouse: { owner: null, isLocked: false }
        }
    };

    const MAX_PLAYERS = 16;

    io.on('connection', (socket) => {
        console.log('[RPG] Player connected:', socket.id);

        // Join Room logic
        socket.on('joinRoom', ({ roomCode, username, gender }, callback) => {
            const room = roomCode || 'public';

            // Initialize room if it doesn't exist
            if (!rooms[room]) {
                rooms[room] = { players: {}, spawnedObjects: [], modernHouse: { owner: null, isLocked: false } };
            }

            const currentPlayers = Object.keys(rooms[room].players).length;
            if (currentPlayers >= MAX_PLAYERS) {
                return callback({ success: false, message: "Ce serveur est plein (16/16 joueurs)." });
            }

            socket.join(room);
            socket.room = room; // Store room on socket instance

            // Create player in room
            rooms[room].players[socket.id] = {
                position: [0, 1.5, 0],
                rotation: [0, 0, 0],
                isMoving: false,
                username: username,
                gender: gender
            };

            // Send current state to the new player
            socket.emit('currentPlayers', rooms[room].players);
            socket.emit('initialObjects', rooms[room].spawnedObjects);
            socket.emit('houseStateUpdate', rooms[room].modernHouse);

            // Tell others in the room
            socket.to(room).emit('newPlayer', { id: socket.id, player: rooms[room].players[socket.id] });

            callback({ success: true, message: `Rejoint: ${room}` });
        });

        // Handle player movement
        socket.on('playerMovement', (movementData) => {
            const room = socket.room;
            if (room && rooms[room] && rooms[room].players[socket.id]) {
                rooms[room].players[socket.id] = { ...rooms[room].players[socket.id], ...movementData };
                socket.to(room).emit('playerMoved', { id: socket.id, player: rooms[room].players[socket.id] });
            }
        });

        // Handle object spawning (Cars, Villas)
        socket.on('spawnObject', (objectData) => {
            const room = socket.room;
            if (!room || !rooms[room]) return;

            // Enforce ONE villa per player
            if (objectData.type === 'villa') {
                const index = rooms[room].spawnedObjects.findIndex(obj => obj.type === 'villa' && obj.ownerId === socket.id);
                if (index !== -1) {
                    rooms[room].spawnedObjects.splice(index, 1);
                }
            }

            const newObject = {
                ...objectData,
                ownerId: socket.id
            };
            rooms[room].spawnedObjects.push(newObject);
            io.to(room).emit('objectSpawned', newObject);
        });

        // Handle object updates (Position, Rotation sync)
        socket.on('updateObject', (updateData) => {
            const room = socket.room;
            if (!room || !rooms[room]) return;

            const index = rooms[room].spawnedObjects.findIndex(obj => obj.id === updateData.id);
            if (index !== -1) {
                rooms[room].spawnedObjects[index] = {
                    ...rooms[room].spawnedObjects[index],
                    ...updateData
                };
                // Broadcast the update to others
                socket.to(room).emit('objectUpdated', rooms[room].spawnedObjects[index]);
            }
        });

        // Handle object deletion
        socket.on('deleteObject', (data) => {
            const room = socket.room;
            if (!room || !rooms[room]) return;

            if (data.type === 'villa') {
                const index = rooms[room].spawnedObjects.findIndex(obj => obj.type === 'villa' && obj.ownerId === socket.id);
                if (index !== -1) {
                    const deletedObj = rooms[room].spawnedObjects.splice(index, 1)[0];
                    io.to(room).emit('objectDeleted', { id: deletedObj.id, type: 'villa' });
                }
            }
        });

        // Handle remote house kick
        socket.on('kickPlayerFromHouse', ({ targetId }) => {
            const room = socket.room;
            if (room && rooms[room]) {
                io.to(room).emit('kickFromHouse', { targetId, kickerId: socket.id });
            }
        });

        // Handle Modern House state update
        socket.on('updateHouseState', (newState) => {
            const room = socket.room;
            if (room && rooms[room]) {
                rooms[room].modernHouse = { ...rooms[room].modernHouse, ...newState };
                io.to(room).emit('houseStateUpdate', rooms[room].modernHouse);
            }
        });

        // Handle chat messages
        socket.on('sendChatMessage', (msg) => {
            if (socket.room) {
                io.to(socket.room).emit('chatMessage', { id: socket.id, text: msg });
            }
        });

        // Handle interactive player actions
        socket.on('playerAction', ({ targetId, action }) => {
            const room = socket.room;
            if (!room || !rooms[room]) return;

            const p1 = rooms[room].players[socket.id];
            const p2 = rooms[room].players[targetId];

            if (action === 'arrest') {
                // Teleport target to the Police Station Cell
                // Cell world coordinates: X: 28, Y: 3, Z: 87
                io.to(targetId).emit('teleportPlayer', { x: 28, y: 3, z: 87 });
                io.to(room).emit('chatMessage', { id: 'server', text: `${p1.username} a mis ${p2.username} en cellule !` });
                return;
            }

            if (p1 && p2 && p1.position.x !== undefined && p2.position.x !== undefined) {
                const dx = p1.position.x - p2.position.x;
                const dz = p1.position.z - p2.position.z;
                const angle1 = Math.atan2(dx, dz) + Math.PI;
                const angle2 = Math.atan2(dx, dz);

                p1.rotation = { y: angle1 };
                p2.rotation = { y: angle2 };

                io.to(room).emit('playerMoved', { id: socket.id, player: p1 });
                io.to(room).emit('playerMoved', { id: targetId, player: p2 });
            }

            io.to(room).emit('playerForceAction', { id: targetId, action });
            io.to(room).emit('playerForceAction', { id: socket.id, action });
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log('[RPG] Player disconnected:', socket.id);
            const room = socket.room;
            if (room && rooms[room]) {
                delete rooms[room].players[socket.id];
                io.to(room).emit('playerDisconnected', socket.id);

                // Clean up empty private rooms
                if (room !== 'public' && Object.keys(rooms[room].players).length === 0) {
                    delete rooms[room];
                }
            }
        });
    });

    const PORT = process.env.RPG_PORT || 3001;
    server.on('error', (error) => {
        console.error(`[RPG GRANDE] Multiplayer Server failed on port ${PORT}: ${error.message}`);
    });
    server.listen(PORT, () => {
        console.log(`[RPG GRANDE] Multiplayer Server running on port ${PORT}`);
    });
}

module.exports = startRpgServer;
