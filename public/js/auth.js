class Auth {
    constructor() {
        this.currentUser = null;
        this.users = this.loadUsers();
        this.initializeEventListeners();
        this.checkExistingSession();

        // Lắng nghe sự kiện storage change từ tab khác
        window.addEventListener('storage', (e) => {
            if (e.key === 'users') {
                this.users = JSON.parse(e.newValue || '[]');
            }
        });
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

    checkExistingSession() {
        // Đọc từ sessionStorage thay vì localStorage
        const savedUser = sessionStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.onLoginSuccess();
        }
    }

    login() {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        const user = this.users.find(u => u.username === username && u.password === password);
        
        if (user) {
            this.currentUser = user;
            // Lưu currentUser vào sessionStorage thay vì localStorage
            sessionStorage.setItem('currentUser', JSON.stringify(user));
            this.onLoginSuccess();
        } else {
            alert('Tên đăng nhập hoặc mật khẩu không đúng');
        }
    }

    register() {
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;

        if (!username || !password) {
            alert('Vui lòng điền đầy đủ thông tin');
            return;
        }

        // Kiểm tra username đã tồn tại
        if (this.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            alert('Tên đăng nhập đã được sử dụng');
            return;
        }

        const newUser = {
            id: Date.now().toString(),
            username,
            password
        };

        this.users.push(newUser);
        this.saveUsers();
        
        this.currentUser = newUser;
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        this.onLoginSuccess();
    }

    logout() {
        this.currentUser = null;
        // Xóa từ sessionStorage thay vì localStorage
        sessionStorage.removeItem('currentUser');
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
}

const auth = new Auth(); 