class ChatApp {
    constructor() {
        this.initialized = false;
        this.messenger = null;
        this.initializeApp();
    }

    async initializeApp() {
        try {
            // Kiểm tra đăng nhập
            if (auth.currentUser) {
                await this.initializeChat();
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
            alert('Không thể khởi tạo ứng dụng. Vui lòng tải lại trang.');
        }
    }

    async initializeChat(user) {
        if (this.initialized) return;

        try {
            // Khởi tạo messenger
            this.messenger = new Messenger({
                userId: user.id,
                onMessage: this.handleIncomingMessage.bind(this),
                onUserStatusChange: this.handleUserStatusChange.bind(this),
                onError: this.handleError.bind(this)
            });

            await this.messenger.connect();

            // Kết nối các components
            this.connectComponents();

            // Load danh sách người dùng
            await this.loadUsers();

            this.initialized = true;

        } catch (error) {
            console.error('Lỗi khởi tạo chat:', error);
            alert('Không thể kết nối tới server chat. Vui lòng thử lại sau.');
        }
    }

    connectComponents() {
        // Kết nối UserManager với ChatUI
        userManager.onUserSelected(user => {
            chatUI.setReceiver(user);
            this.loadChatHistory(user.id);
        });

        // Kết nối ChatUI với Messenger
        chatUI.onSendMessage = async (message) => {
            try {
                await this.messenger.sendMessage(message);
            } catch (error) {
                console.error('Lỗi gửi tin nhắn:', error);
                alert('Không thể gửi tin nhắn. Vui lòng thử lại.');
            }
        };

        // Xử lý upload file
        chatUI.onFileUpload = async (file, message) => {
            try {
                await this.messenger.sendFile(file, message);
            } catch (error) {
                console.error('Lỗi upload file:', error);
                alert('Không thể gửi file. Vui lòng thử lại.');
            }
        };
    }

    async loadUsers() {
        try {
            const users = await this.messenger.getUsers();
            users.forEach(user => {
                if (user.id !== auth.currentUser.id) {
                    userManager.addUser(user);
                }
            });
        } catch (error) {
            console.error('Lỗi tải danh sách người dùng:', error);
        }
    }

    async loadChatHistory(userId) {
        try {
            const messages = await this.messenger.getMessages(userId);
            chatUI.clearMessages();
            messages.forEach(message => chatUI.addMessage(message));
        } catch (error) {
            console.error('Lỗi tải lịch sử chat:', error);
        }
    }

    handleIncomingMessage(message) {
        // Cập nhật UI khi có tin nhắn mới
        chatUI.addMessage(message);

        // Cập nhật số tin nhắn chưa đọc nếu không phải chat hiện tại
        if (!chatUI.currentReceiver || message.sender !== chatUI.currentReceiver.id) {
            userManager.updateUnreadCount(message.sender, 1);
        }
    }

    handleUserStatusChange(userId, status) {
        userManager.updateUserStatus(userId, status);
    }

    handleError(error) {
        console.error('Lỗi messenger:', error);
        if (error.type === 'connection') {
            this.showReconnectDialog();
        }
    }

    handleLogout() {
        this.initialized = false;
        if (this.messenger) {
            this.messenger.disconnect();
            this.messenger = null;
        }
        chatUI.clearMessages();
        userManager.clearUsers();
    }

    showReconnectDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'reconnect-dialog';
        dialog.innerHTML = `
            <div class="reconnect-content">
                <h3>Mất kết nối</h3>
                <p>Đang cố gắng kết nối lại...</p>
                <button id="retry-btn">Thử lại</button>
            </div>
        `;

        document.body.appendChild(dialog);

        document.getElementById('retry-btn').onclick = async () => {
            try {
                await this.messenger.reconnect();
                dialog.remove();
            } catch (error) {
                console.error('Không thể kết nối lại:', error);
            }
        };
    }
}

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

// Khởi tạo ứng dụng
const app = new ChatApp();

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