class UserManager {
    constructor() {
        this.users = new Map();
        this.selectedUser = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.getElementById('users-list').addEventListener('click', (e) => {
            const userItem = e.target.closest('.user-item');
            if (userItem) {
                const userId = userItem.dataset.userId;
                this.selectUser(userId);
            }
        });
    }

    addUser(user) {
        if (user.username === auth.currentUser.username || 
            Array.from(this.users.values()).some(u => u.username === user.username)) {
            return;
        }
        user.status = 'online';
        this.users.set(user.id, user);
        this.renderUsersList();
    }

    updateUserStatus(userId, status) {
        const user = Array.from(this.users.values()).find(u => u.username === userId);
        if (user) {
            user.status = status;
            this.renderUsersList();
        }
    }

    selectUser(userId) {
        const user = this.users.get(userId);
        if (user) {
            this.selectedUser = user;
            document.querySelectorAll('.user-item').forEach(item => {
                item.classList.remove('selected');
                if (item.dataset.userId === userId) {
                    item.classList.add('selected');
                }
            });

            // Emit selected user event
            const event = new CustomEvent('userSelected', { detail: user });
            document.dispatchEvent(event);
        }
    }

    renderUsersList() {
        const usersList = document.getElementById('users-list');
        usersList.innerHTML = '';

        this.users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = `user-item ${user.status === 'online' ? 'online' : 'offline'}`;
            userElement.dataset.userId = user.id;
            
            userElement.innerHTML = `
                <div class="user-item-content">
                    <div class="user-info">
                        <div class="user-name">${user.username}</div>
                        <div class="user-status">${user.status === 'online' ? 'Đang hoạt động' : 'Không hoạt động'}</div>
                    </div>
                </div>
            `;

            usersList.appendChild(userElement);
        });
    }

    loadInitialUsers() {
        const users = auth.getOtherUsers();
        this.users.clear();
        users.filter(user => user.username !== auth.currentUser.username)
            .forEach(user => {
                if (!Array.from(this.users.values()).some(u => u.username === user.username)) {
                    this.users.set(user.id, user);
                }
            });
        this.renderUsersList();
    }

    removeUser(username) {
        // Tìm và xóa user theo username
        for (let [id, user] of this.users.entries()) {
            if (user.username === username) {
                this.users.delete(id);
                break;
            }
        }
        this.renderUsersList();
    }
}

const userManager = new UserManager(); 