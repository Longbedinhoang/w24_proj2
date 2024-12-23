class Auth {
    constructor() {
        this.currentUser = null;
        this.messenger = null;
        this.initializeEventListeners();
    }

    async initializeMessenger() {
        try {
            // Load keys từ server trong thực tế
            const caPublicKey = await this.loadCAPublicKey();
            const govPublicKey = await this.loadGovPublicKey();
            
            this.messenger = new MessengerClient(caPublicKey, govPublicKey);
            
            // Đăng ký các callbacks
            this.messenger.on('onMessageReceived', (data) => {
                chatUI.addMessageToUI(data);
            });

            this.messenger.on('onError', (error) => {
                console.error('Messenger error:', error);
                alert(`Lỗi: ${error.message}`);
            });

            this.messenger.on('onConnectionStateChange', (data) => {
                if (data.status === 'connected') {
                    this.showChatInterface();
                }
            });

            return this.messenger;
        } catch (error) {
            console.error('Messenger initialization failed:', error);
            throw error;
        }
    }

    async loadCAPublicKey() {
        // Return a dummy key for testing
        return {
            key: "demo_ca_key",
            verify: async () => true
        };
    }

    async loadGovPublicKey() {
        // Return a dummy key for testing
        return {
            key: "demo_gov_key"
        };
    }

    initializeEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Form submissions
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin(e.target);
        });

        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister(e.target);
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.add('hidden');
        });

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Form`).classList.remove('hidden');
    }

    async handleLogin(form) {
        const username = form.querySelector('input[type="text"]').value;
        const password = form.querySelector('input[type="password"]').value;

        try {
            // Initialize messenger
            await this.initializeMessenger();
            
            // Initialize user in messenger
            await this.messenger.initializeForUser(username);
            
            this.currentUser = { username };
            
            // Store session
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            
            // Show chat interface after successful initialization
            this.showChatInterface();
            
            // Load demo users
            userManager.addUser('alice', 'online');
            userManager.addUser('bob', 'offline');
            userManager.addUser('charlie', 'online');
            
        } catch (error) {
            console.error('Login failed:', error);
            alert('Đăng nhập thất bại: ' + error.message);
        }
    }

    async handleRegister(form) {
        const username = form.querySelector('input[type="text"]').value;
        const password = form.querySelector('input[type="password"]').value;
        const confirmPassword = form.querySelectorAll('input[type="password"]')[1].value;

        if (password !== confirmPassword) {
            alert('Mật khẩu không khớp!');
            return;
        }

        try {
            // Implement actual registration logic here
            this.switchTab('login');
            alert('Đăng ký thành công! Vui lòng đăng nhập.');
        } catch (error) {
            alert('Đăng ký thất bại: ' + error.message);
        }
    }

    handleLogout() {
        if (this.messenger) {
            this.messenger.disconnect();
        }
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        document.getElementById('authForms').classList.remove('hidden');
        document.getElementById('chatInterface').classList.add('hidden');
    }

    showChatInterface() {
        document.getElementById('authForms').classList.add('hidden');
        document.getElementById('chatInterface').classList.remove('hidden');
        document.getElementById('userName').textContent = this.currentUser.username;
    }
}

const auth = new Auth(); 