class Auth {
    constructor() {
        this.currentUser = null;
        this.sessionToken = null;
        this.sessionTimeout = null;
        this.users = this.loadUsers();
        this.initializeEventListeners();
        this.checkExistingSession();
    }

    generateSessionToken() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    setSessionTimeout() {
        // Clear existing timeout
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
        }

        // Set new timeout for 10 minutes
        this.sessionTimeout = setTimeout(() => {
            this.handleSessionExpired();
        }, 10 * 60 * 1000); // 10 minutes
    }

    handleSessionExpired() {
        alert('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
        this.logout();
    }

    saveSession(user, token) {
        const session = {
            user,
            token,
            expiry: Date.now() + (10 * 60 * 1000) // 10 minutes from now
        };
        sessionStorage.setItem('session', JSON.stringify(session));
        this.setSessionTimeout();
    }

    checkExistingSession() {
        const session = sessionStorage.getItem('session');
        if (session) {
            const { user, token, expiry } = JSON.parse(session);
            
            // Check if session is still valid
            if (Date.now() < expiry) {
                this.currentUser = user;
                this.sessionToken = token;
                this.setSessionTimeout();
                this.onLoginSuccess();
            } else {
                this.handleSessionExpired();
            }
        }
    }

    initializeEventListeners() {
        document.getElementById('login-btn').addEventListener('click', () => this.login());
        document.getElementById('register-btn').addEventListener('click', () => this.register());
        document.getElementById('show-register').addEventListener('click', this.showRegisterForm);
        document.getElementById('show-login').addEventListener('click', this.showLoginForm);
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    }

    loadUsers() {
        const users = localStorage.getItem('users');
        return users ? JSON.parse(users) : [];
    }

    saveUsers() {
        localStorage.setItem('users', JSON.stringify(this.users));
    }

    login() {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        const user = this.users.find(u => u.username === username && u.password === password);
        
        if (user) {
            this.currentUser = user;
            this.sessionToken = this.generateSessionToken();
            this.saveSession(user, this.sessionToken);
            this.onLoginSuccess();
        } else {
            alert('Tên đăng nhập hoặc mật khẩu không đúng');
        }
    }

    register() {
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;

        if (!username || !password || !confirmPassword) {
            alert('Vui lòng điền đầy đủ thông tin');
            return;
        }

        if (password !== confirmPassword) {
            alert('Mật khẩu nhập lại không khớp');
            return;
        }

        if (this.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            alert('Tên đăng nhập đã được sử dụng');
            return;
        }

        const newUser = {
            id: Date.now().toString(),
            username,
            password,
            status: 'online'
        };

        this.users.push(newUser);
        this.saveUsers();
        
        this.currentUser = newUser;
        this.sessionToken = this.generateSessionToken();
        this.saveSession(newUser, this.sessionToken);
        
        if (app && app.socket) {
            app.socket.emit('new-user', newUser);
        }
        
        this.onLoginSuccess();
    }

    logout() {
        clearTimeout(this.sessionTimeout);
        this.currentUser = null;
        this.sessionToken = null;
        sessionStorage.removeItem('session');
        
        // Gửi yêu cầu xóa session tới server nếu socket còn kết nối
        if (app && app.socket && app.socket.connected) {
            app.socket.emit('logout', this.sessionToken);
        }
        
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('chat-container').classList.add('hidden');
        
        const event = new CustomEvent('userLoggedOut');
        document.dispatchEvent(event);
    }

    onLoginSuccess() {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('chat-container').classList.remove('hidden');
        document.getElementById('user-name').textContent = this.currentUser.username;

        const event = new CustomEvent('userLoggedIn', { detail: this.currentUser });
        document.dispatchEvent(event);
    }

    showRegisterForm() {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    }

    showLoginForm() {
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    getOtherUsers() {
        return this.users.filter(u => u.id !== this.currentUser?.id);
    }

    // Thêm method để reset session timeout khi có hoạt động
    resetSessionTimeout() {
        const session = sessionStorage.getItem('session');
        if (session) {
            const { user, token } = JSON.parse(session);
            this.saveSession(user, token);
        }
    }
}

// Thêm event listener để reset timeout khi có hoạt động
document.addEventListener('mousemove', () => {
    auth.resetSessionTimeout();
});

document.addEventListener('keypress', () => {
    auth.resetSessionTimeout();
});

const auth = new Auth(); 