const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: '*', // Adjust to specific origins in production
        methods: ['GET', 'POST']
    }
});
const { v4: uuidv4 } = require('uuid');
const PORT = process.env.PORT || 3000;

const rooms = {};

io.on('connection', (socket) => {
    socket.on('create-room', (callback) => {
        const roomId = uuidv4();
        if (rooms[roomId]) {
            socket.emit('room-error', { message: 'Room already exists', roomId });
            return;
        }
        rooms[roomId] = { users: [socket.id] };
        socket.join(roomId);
        callback(roomId);
    });

    socket.on('join-room', (roomId) => {
        if (!rooms[roomId]) {
            socket.emit('room-error', { message: 'Room does not exist', roomId });
            return;
        }
        if (rooms[roomId].users.length >= 2) {
            socket.emit('room-error', { message: 'Room is full', roomId });
            return;
        }
        rooms[roomId].users.push(socket.id);
        socket.join(roomId);
        socket.to(roomId).emit('user-joined', { roomId });
    });

    socket.on('offer', ({ roomId, offer }) => {
        socket.to(roomId).emit('offer', { roomId, offer });
    });

    socket.on('answer', ({ roomId, answer }) => {
        socket.to(roomId).emit('answer', { roomId, answer });
    });

    socket.on('ice-candidate', ({ roomId, candidate }) => {
        socket.to(roomId).emit('ice-candidate', { roomId, candidate });
    });

    socket.on('leave-room', (roomId) => {
        if (rooms[roomId]) {
            const index = rooms[roomId].users.indexOf(socket.id);
            if (index !== -1) {
                rooms[roomId].users.splice(index, 1);
                if (rooms[roomId].users.length === 0) {
                    socket.to(roomId).emit('room-deleted', { roomId });
                    delete rooms[roomId];
                } else {
                    socket.to(roomId).emit('user-disconnected', { roomId });
                }
            }
        }
    });

    socket.on('disconnect', () => {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const index = room.users.indexOf(socket.id);
            if (index !== -1) {
                room.users.splice(index, 1);
                if (room.users.length === 0) {
                    socket.to(roomId).emit('room-deleted', { roomId });
                    delete rooms[roomId];
                } else {
                    socket.to(roomId).emit('user-disconnected', { roomId });
                }
            }
        }
    });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
