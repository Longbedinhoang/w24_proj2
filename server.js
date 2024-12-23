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

const activeSessions = new Map();

io.use((socket, next) => {
    const { token, userId, username } = socket.handshake.auth;
    
    // Kiểm tra session hiện tại
    const existingSession = activeSessions.get(userId);
    if (existingSession && existingSession.token === token) {
        existingSession.lastActivity = Date.now();
        socket.userId = userId;
        socket.username = username;
        socket.sessionToken = token;
        return next();
    }
    
    // Tạo session mới
    if (token && userId) {
        activeSessions.set(userId, {
            token,
            lastActivity: Date.now()
        });
        socket.userId = userId;
        socket.username = username;
        socket.sessionToken = token;
        return next();
    }
    
    next(new Error('Authentication error'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`User ${socket.username} reconnected with session`);
    
    // Broadcast to others that user is online
    socket.broadcast.emit('user-connected', {
        id: socket.userId,
        username: socket.username
    });
    
    // Cập nhật session khi có kết nối mới
    activeSessions.set(socket.userId, {
        token: socket.sessionToken,
        lastActivity: Date.now(),
        socketId: socket.id
    });

    // Gửi danh sách users
    const users = Array.from(io.sockets.sockets.values())
        .filter(s => s.username && s.userId !== socket.userId)
        .map(s => ({
            id: s.userId,
            username: s.username,
            status: 'online'  // Nếu có trong socket list thì chắc chắn đang online
        }));
    socket.emit('users-list', users);

    // Xử lý đăng xuất chủ động
    socket.on('logout', (token) => {
        if (socket.sessionToken === token) {
            activeSessions.delete(socket.userId);
            socket.broadcast.emit('user-disconnected', socket.username);
            console.log(`User ${socket.username} logged out`);
        }
    });

    // Xử lý đóng trang
    socket.on('page-close', (token) => {
        if (socket.sessionToken === token) {
            activeSessions.delete(socket.userId);
            console.log(`User ${socket.username} closed page`);
        }
    });

    // Clean up on disconnect
    socket.on('disconnect', () => {
        setTimeout(() => {
            // Kiểm tra xem user còn kết nối nào khác không
            const stillConnected = Array.from(io.sockets.sockets.values())
                .some(s => s.userId === socket.userId && s.id !== socket.id);
            
            if (!stillConnected) {
                // Chỉ xóa session nếu không còn kết nối nào
                activeSessions.delete(socket.userId);
                socket.broadcast.emit('user-disconnected', socket.username);
            }
        }, 2000);
    });

    socket.on('send-message', (data) => {
        socket.broadcast.emit('receive-message', data);
    });

    socket.on('new-user', (user) => {
        socket.broadcast.emit('user-added', user);
    });
});

// Cleanup expired sessions periodically
setInterval(() => {
    const now = Date.now();
    activeSessions.forEach((session, userId) => {
        if (now - session.lastActivity > 10 * 60 * 1000) { // 10 minutes
            activeSessions.delete(userId);
            const socket = Array.from(io.sockets.sockets.values())
                .find(s => s.userId === userId);
            if (socket) {
                socket.emit('session_expired');
                socket.disconnect(true);
                console.log(`User ${socket.username} session expired`);
            }
        }
    });
}, 60 * 1000); // Check every minute

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});