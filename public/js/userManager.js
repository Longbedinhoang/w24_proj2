class UserManager {
    constructor() {
        this.users = new Map();
        this.onlineUsers = new Set();
        this.selectedUser = null;
        this.statusCheckInterval = null;
        
        this.initializeEventListeners();
        this.startStatusChecking();
    }

    startStatusChecking() {
        // Kiểm tra trạng thái online mỗi 30 giây
        this.statusCheckInterval = setInterval(() => {
            this.checkUsersStatus();
        }, 30000);
    }

    async checkUsersStatus() {
        // Trong thực tế, sẽ gọi API để kiểm tra status
        this.users.forEach((userData, username) => {
            // Random status for demo
            const isOnline = Math.random() > 0.5;
            this.setUserStatus(username, isOnline ? 'online' : 'offline');
        });
    }

    stopStatusChecking() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
        }
    }

    initializeEventListeners() {
        const searchInput = document.querySelector('.user-search input');
        searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
    }

    addUser(username, status = 'offline') {
        this.users.set(username, { status });
        this.updateUsersList();
    }

    setUserStatus(username, status) {
        if (this.users.has(username)) {
            this.users.get(username).status = status;
            if (status === 'online') {
                this.onlineUsers.add(username);
            } else {
                this.onlineUsers.delete(username);
            }
            this.updateUsersList();
        }
    }

    handleSearch(query) {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '';

        this.users.forEach((userData, username) => {
            if (username.toLowerCase().includes(query.toLowerCase())) {
                this.addUserToList(username, userData.status);
            }
        });
    }

    addUserToList(username, status) {
        const usersList = document.getElementById('usersList');
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
            <div class="user-avatar">
                <img src="assets/default-avatar.png" alt="${username}">
                <span class="status-indicator ${status}"></span>
            </div>
            <div class="user-info">
                <span class="username">${username}</span>
                <span class="status">${status}</span>
            </div>
        `;

        userItem.addEventListener('click', () => {
            this.selectUser(username);
        });

        usersList.appendChild(userItem);
    }

    selectUser(username) {
        this.selectedUser = username;
        document.getElementById('currentChatUser').textContent = username;
        document.querySelectorAll('.user-item').forEach(item => {
            item.classList.remove('selected');
            if (item.querySelector('.username').textContent === username) {
                item.classList.add('selected');
            }
        });

        // Trigger chat history load
        chatUI.loadChatHistory(username);
    }

    updateUsersList() {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '';
        
        // Show online users first
        this.onlineUsers.forEach(username => {
            this.addUserToList(username, 'online');
        });

        // Then show offline users
        this.users.forEach((userData, username) => {
            if (!this.onlineUsers.has(username)) {
                this.addUserToList(username, 'offline');
            }
        });
    }
}

const userManager = new UserManager(); 