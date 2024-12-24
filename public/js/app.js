class ChatApp {
    constructor() {
        this.initialized = false;
        this.socket = null;
        this.currentUser = null;
        this.initializeApp();
        this.setupVisibilityHandler();
        this.setupBeforeUnloadHandler();
    }

    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.currentUser && !this.socket?.connected) {
                this.initializeChat(this.currentUser);
            }
        });
    }

    setupBeforeUnloadHandler() {
        window.addEventListener('beforeunload', () => {
            if (this.socket && this.socket.connected) {
                this.socket.emit('page-close', auth.sessionToken);
            }
        });
    }

    async initializeApp() {
        try {
            // Kiểm tra đăng nhập
            if (auth.currentUser) {
                await this.initializeChat(auth.currentUser);
            }

            // Lắng nghe sự kiện đăng nhập thành công
            document.addEventListener('userLoggedIn', async (e) => {
                const user = e.detail;
                await this.initializeChat(user);
            });

            // Lắng nghe sự kiện đăng xuất
            document.addEventListener('userLoggedOut', () => {
                this.handleLogout();
            });

        } catch (error) {
            console.error('Lỗi khởi tạo ứng dụng:', error);
        }
    }

    async initializeChat(user) {
        if (this.initialized) return;

        try {
            this.currentUser = user;
            this.socket = io('http://localhost:3000', {
                auth: {
                    token: auth.sessionToken,
                    userId: user.id,
                    username: user.username
                }
            });

            // Disable chat input cho đến khi chọn người nhận
            document.getElementById('message-input').disabled = true;
            document.getElementById('send-btn').disabled = true;

            this.socket.on('session_expired', () => {
                auth.handleSessionExpired();
            });

            // Nhận danh sách users
            this.socket.on('users-list', (users) => {
                users.forEach(user => {
                    userManager.addUser({
                        id: user.id,
                        username: user.username,
                        status: user.status
                    });
                });
            });

            // Load danh sách users từ localStorage
            userManager.loadInitialUsers();

            // Nhận user mới
            this.socket.on('user-added', (user) => {
                userManager.addUser(user);
            });

            // Lắng nghe tin nhắn mới
            this.socket.on('receive-message', (data) => {
                // Chỉ hiển thị tin nhắn nếu là người gửi hoặc người nhận
                if (data.sender === chatUI.currentReceiver?.username || 
                    (data.receiver === auth.currentUser.username && 
                     data.sender === chatUI.currentReceiver?.username)) {
                    chatUI.addMessage(data);
                }
            });

            // Lắng nghe user mới kết nối
            this.socket.on('user-connected', (userData) => {
                userManager.addUser({
                    id: userData.id,
                    username: userData.username,
                    status: 'online'
                });
            });

            // Lắng nghe user ngắt kết nối
            this.socket.on('user-disconnected', (username) => {
                userManager.updateUserStatus(username, 'offline');
            });

            this.initialized = true;

        } catch (error) {
            console.error('Lỗi khởi tạo chat:', error);
        }
    }

    handleLogout() {
        this.initialized = false;
        this.currentUser = null;
        if (this.socket) {
            this.socket.emit('logout', auth.sessionToken);
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

// Khởi tạo ứng dụng
const app = new ChatApp();

// Thêm styles cho dialog reconnect
const appStyles = document.createElement('style');
appStyles.textContent = `
    .reconnect-dialog {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .reconnect-content {
        background: white;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
    }

    .reconnect-content h3 {
        margin: 0 0 10px;
    }

    .reconnect-content button {
        margin-top: 15px;
        padding: 8px 20px;
        background: #0084ff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
`;

document.head.appendChild(appStyles);

// Đăng ký service worker nếu được hỗ trợ
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('ServiceWorker đã được đăng ký:', registration);
        }).catch(error => {
            console.error('Lỗi đăng ký ServiceWorker:', error);
        });
    });
} 