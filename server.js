const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const cors = require('cors');
const path = require('path');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (username) => {
        socket.username = username;
        socket.broadcast.emit('user-connected', username);
    });

    socket.on('send-message', (data) => {
        socket.broadcast.emit('receive-message', data);
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            socket.broadcast.emit('user-disconnected', socket.username);
        }
    });
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});