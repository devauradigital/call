const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const PORT = process.env.PORT || 3000;

const rooms = {};

io.on('connection', (socket) => {
    socket.on('create-room', (roomId) => {
        if (rooms[roomId]) {
            socket.emit('room-error', 'Room already exists');
            return;
        }
        rooms[roomId] = { users: [socket.id] };
        socket.join(roomId);
    });

    socket.on('join-room', (roomId) => {
        if (!rooms[roomId]) {
            socket.emit('room-error', 'Room does not exist');
            return;
        }
        if (rooms[roomId].users.length >= 2) {
            socket.emit('room-error', 'Room is full');
            return;
        }
        rooms[roomId].users.push(socket.id);
        socket.join(roomId);
        socket.to(roomId).emit('user-joined');
    });

    socket.on('offer', ({ roomId, offer }) => {
        socket.to(roomId).emit('offer', { roomId, offer });
    });

    socket.on('answer', ({ roomId, answer }) => {
        socket.to(roomId).emit('answer', { answer });
    });

    socket.on('ice-candidate', ({ roomId, candidate }) => {
        socket.to(roomId).emit('ice-candidate', { candidate });
    });

    socket.on('disconnect', () => {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const index = room.users.indexOf(socket.id);
            if (index !== -1) {
                room.users.splice(index, 1);
                if (room.users.length === 0) {
                    delete rooms[roomId];
                } else {
                    socket.to(roomId).emit('user-disconnected');
                }
            }
        }
    });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));