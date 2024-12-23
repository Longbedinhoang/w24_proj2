class ChatApp {
    constructor() {
        this.initialized = false;
        this.socket = io('http://localhost:3000');
        this.initializeApp();
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
            // Kết nối socket với username
            this.socket.emit('join', user.username);

            // Lắng nghe tin nhắn mới
            this.socket.on('receive-message', (data) => {
                chatUI.addMessage(data);
            });

            // Lắng nghe user mới kết nối
            this.socket.on('user-connected', (username) => {
                userManager.updateUserStatus(username, 'online');
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
        if (this.socket) {
            this.socket.disconnect();
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