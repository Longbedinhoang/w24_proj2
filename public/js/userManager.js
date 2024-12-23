class UserManager {
    constructor() {
        this.users = new Map(); // Lưu trữ thông tin người dùng
        this.selectedUser = null; // Người dùng đang được chọn để chat
        this.onUserSelectedCallback = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Lắng nghe sự kiện click trên danh sách người dùng
        document.getElementById('users-list').addEventListener('click', (e) => {
            const userItem = e.target.closest('.user-item');
            if (userItem) {
                const userId = userItem.dataset.userId;
                this.selectUser(userId);
            }
        });
    }

    // Thêm người dùng mới vào danh sách
    addUser(user) {
        if (!this.users.has(user.id)) {
            this.users.set(user.id, {
                ...user,
                status: user.status || 'offline',
                lastSeen: user.lastSeen || new Date()
            });
            this.renderUsersList();
        }
    }

    // Cập nhật trạng thái người dùng
    updateUserStatus(userId, status) {
        if (this.users.has(userId)) {
            const user = this.users.get(userId);
            user.status = status;
            user.lastSeen = new Date();
            this.users.set(userId, user);
            this.renderUsersList();
        }
    }

    // Chọn người dùng để chat
    selectUser(userId) {
        const user = this.users.get(userId);
        if (user) {
            this.selectedUser = user;
            // Cập nhật UI để hiển thị người dùng được chọn
            document.querySelectorAll('.user-item').forEach(item => {
                item.classList.remove('selected');
                if (item.dataset.userId === userId) {
                    item.classList.add('selected');
                }
            });

            // Cập nhật tiêu đề chat
            document.getElementById('chat-title').textContent = user.name;

            // Gọi callback nếu có
            if (this.onUserSelectedCallback) {
                this.onUserSelectedCallback(user);
            }
        }
    }

    // Render danh sách người dùng
    renderUsersList() {
        const usersList = document.getElementById('users-list');
        usersList.innerHTML = '';

        // Sắp xếp người dùng: online trước, offline sau
        const sortedUsers = Array.from(this.users.values()).sort((a, b) => {
            if (a.status === 'online' && b.status === 'offline') return -1;
            if (a.status === 'offline' && b.status === 'online') return 1;
            return b.lastSeen - a.lastSeen;
        });

        sortedUsers.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = `user-item ${user.status === 'online' ? 'online' : ''}`;
            userElement.dataset.userId = user.id;
            
            userElement.innerHTML = `
                <div class="user-item-content">
                    <img src="${user.avatar || 'assets/default-avatar.png'}" alt="${user.name}" class="user-avatar">
                    <div class="user-info">
                        <div class="user-name">${user.name}</div>
                        <div class="user-status ${user.status}">
                            ${user.status === 'online' ? 'Đang hoạt động' : this.getLastSeenText(user.lastSeen)}
                        </div>
                    </div>
                    ${user.unreadCount ? `<span class="unread-count">${user.unreadCount}</span>` : ''}
                </div>
            `;

            if (this.selectedUser && this.selectedUser.id === user.id) {
                userElement.classList.add('selected');
            }

            usersList.appendChild(userElement);
        });
    }

    // Định dạng thời gian last seen
    getLastSeenText(lastSeen) {
        const now = new Date();
        const diff = now - new Date(lastSeen);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return 'Vừa mới truy cập';
        if (minutes < 60) return `${minutes} phút trước`;
        if (hours < 24) return `${hours} giờ trước`;
        return `${days} ngày trước`;
    }

    // Cập nhật số tin nhắn chưa đọc
    updateUnreadCount(userId, count) {
        if (this.users.has(userId)) {
            const user = this.users.get(userId);
            user.unreadCount = count;
            this.users.set(userId, user);
            this.renderUsersList();
        }
    }

    // Đăng ký callback khi người dùng được chọn
    onUserSelected(callback) {
        this.onUserSelectedCallback = callback;
    }

    // Xóa người dùng khỏi danh sách
    removeUser(userId) {
        if (this.users.has(userId)) {
            this.users.delete(userId);
            this.renderUsersList();
        }
    }
}

// Thêm styles cho user list
const style = document.createElement('style');
style.textContent = `
    .user-item {
        display: flex;
        padding: 12px 20px;
        border-bottom: 1px solid #eee;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .user-item:hover {
        background-color: #f5f5f5;
    }

    .user-item.selected {
        background-color: #e3f2fd;
    }

    .user-item-content {
        display: flex;
        align-items: center;
        width: 100%;
    }

    .user-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        margin-right: 12px;
    }

    .user-info {
        flex: 1;
    }

    .user-name {
        font-weight: 500;
        margin-bottom: 4px;
    }

    .user-status {
        font-size: 12px;
        color: #666;
    }

    .user-status.online {
        color: #4caf50;
    }

    .unread-count {
        background: #0084ff;
        color: white;
        border-radius: 50%;
        min-width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        padding: 0 6px;
    }
`;

document.head.appendChild(style);

// Khởi tạo UserManager
const userManager = new UserManager(); 