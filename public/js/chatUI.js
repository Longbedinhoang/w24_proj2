class ChatUI {
    constructor() {
        this.messages = [];
        this.messageContainer = document.getElementById('messages');
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-btn');
        this.fileButton = document.getElementById('file-btn');
        this.fileInput = document.getElementById('file-input');
        this.currentReceiver = null;
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Xử lý gửi tin nhắn
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Xử lý upload file
        this.fileButton.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        // Auto-scroll khi có tin nhắn mới
        this.messageContainer.addEventListener('DOMNodeInserted', () => {
            this.scrollToBottom();
        });
    }

    // Thiết lập người nhận tin nhắn
    setReceiver(user) {
        this.currentReceiver = user;
        this.clearMessages();
        document.getElementById('chat-title').textContent = user.name;
    }

    // Gửi tin nhắn
    async sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content || !this.currentReceiver) return;

        try {
            const message = {
                content,
                sender: auth.currentUser.id,
                receiver: this.currentReceiver.id,
                timestamp: new Date(),
                type: 'text'
            };

            // Gửi tin nhắn qua messenger.js
            await messenger.sendMessage(message);
            
            // Hiển thị tin nhắn ngay lập tức
            this.addMessage(message);
            
            // Clear input
            this.messageInput.value = '';
            
        } catch (error) {
            console.error('Lỗi khi gửi tin nhắn:', error);
            alert('Không thể gửi tin nhắn. Vui lòng thử lại.');
        }
    }

    // Xử lý upload file
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file || !this.currentReceiver) return;

        try {
            // Hiển thị loading indicator
            this.showLoadingIndicator();

            // Tạo message object cho file
            const message = {
                content: file.name,
                sender: auth.currentUser.id,
                receiver: this.currentReceiver.id,
                timestamp: new Date(),
                type: 'file',
                file: {
                    name: file.name,
                    size: file.size,
                    type: file.type
                }
            };

            // Upload file và gửi tin nhắn
            await messenger.sendFile(file, message);
            
            // Hiển thị tin nhắn
            this.addMessage(message);
            
            // Clear input và loading
            this.fileInput.value = '';
            this.hideLoadingIndicator();
            
        } catch (error) {
            console.error('Lỗi khi upload file:', error);
            alert('Không thể gửi file. Vui lòng thử lại.');
            this.hideLoadingIndicator();
        }
    }

    // Thêm tin nhắn vào UI
    addMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender === auth.currentUser.id ? 'sent' : 'received'}`;
        
        // Xử lý hiển thị theo loại tin nhắn
        if (message.type === 'text') {
            messageElement.innerHTML = `
                <div class="message-content">
                    <p>${this.escapeHtml(message.content)}</p>
                    <span class="message-time">${this.formatTime(message.timestamp)}</span>
                </div>
            `;
        } else if (message.type === 'file') {
            messageElement.innerHTML = `
                <div class="message-content file-message">
                    <i class="file-icon">📎</i>
                    <a href="${message.fileUrl || '#'}" target="_blank" class="file-link">
                        ${this.escapeHtml(message.file.name)}
                    </a>
                    <span class="file-size">${this.formatFileSize(message.file.size)}</span>
                    <span class="message-time">${this.formatTime(message.timestamp)}</span>
                </div>
            `;
        }

        this.messageContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    // Xóa tất cả tin nhắn
    clearMessages() {
        this.messageContainer.innerHTML = '';
    }

    // Cuộn xuống tin nhắn cuối cùng
    scrollToBottom() {
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }

    // Hiển thị loading indicator
    showLoadingIndicator() {
        this.sendButton.disabled = true;
        this.sendButton.textContent = 'Đang gửi...';
    }

    // Ẩn loading indicator
    hideLoadingIndicator() {
        this.sendButton.disabled = false;
        this.sendButton.textContent = 'Gửi';
    }

    // Định dạng thời gian
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit'
        });
    }

    // Định dạng kích thước file
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Escape HTML để tránh XSS
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Thêm styles cho chat UI
const chatStyles = document.createElement('style');
chatStyles.textContent = `
    .message {
        margin: 10px 0;
        max-width: 70%;
        clear: both;
    }

    .message.sent {
        float: right;
    }

    .message.received {
        float: left;
    }

    .message-content {
        padding: 10px 15px;
        border-radius: 15px;
        background: #e9ecef;
        position: relative;
    }

    .message.sent .message-content {
        background: #0084ff;
        color: white;
    }

    .message-time {
        font-size: 11px;
        color: #666;
        margin-top: 5px;
        display: block;
    }

    .message.sent .message-time {
        color: #fff;
        opacity: 0.7;
    }

    .file-message {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .file-icon {
        font-size: 20px;
    }

    .file-link {
        color: inherit;
        text-decoration: none;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .file-size {
        font-size: 12px;
        opacity: 0.7;
    }
`;

document.head.appendChild(chatStyles);

// Khởi tạo ChatUI
const chatUI = new ChatUI(); 