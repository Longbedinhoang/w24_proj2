class App {
    constructor() {
        this.initializeApp();
    }

    async initializeApp() {
        try {
            // Kiểm tra session
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                await auth.initializeMessenger();
                await auth.messenger.initializeForUser(user.username);
                auth.currentUser = user;
                auth.showChatInterface();
                userManager.addUser('alice', 'online');
                userManager.addUser('bob', 'offline');
                userManager.addUser('charlie', 'online');
            }

            // Đăng ký service worker cho PWA support
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js');
            }

            // Xử lý khi mất kết nối
            window.addEventListener('offline', () => {
                document.body.classList.add('offline');
            });

            window.addEventListener('online', () => {
                document.body.classList.remove('offline');
            });

        } catch (error) {
            console.error('App initialization failed:', error);
        }
    }
}

// Initialize the application
const app = new App(); 