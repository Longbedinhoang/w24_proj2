class ChatUI {
    constructor() {
        this.messages = new Map(); // username -> messages[]
        this.fileUploads = new Map();
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const sendBtn = document.getElementById('sendMessageBtn');
        const messageInput = document.getElementById('messageInput');
        const fileInput = document.getElementById('fileInput');
        const fileUploadBtn = document.getElementById('fileUploadBtn');

        sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        fileUploadBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0]);
        });

        // Thêm xử lý drag & drop cho files
        const dropZone = document.getElementById('messagesContainer');
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            
            if (e.dataTransfer.files.length > 0) {
                this.handleFileUpload(e.dataTransfer.files[0]);
            }
        });

        // Thêm xử lý paste ảnh
        document.addEventListener('paste', (e) => {
            const items = e.clipboardData.items;
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const file = item.getAsFile();
                    this.handleFileUpload(file);
                    break;
                }
            }
        });
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message || !userManager.selectedUser) return;

        try {
            // Integrate with messenger.js
            const [header, ciphertext] = await auth.messenger.wrappedSendMessage(
                userManager.selectedUser,
                message
            );

            this.addMessageToUI({
                sender: auth.currentUser.username,
                content: message,
                timestamp: new Date(),
                type: 'text'
            }, 'sent');

            messageInput.value = '';
            this.scrollToBottom();
        } catch (error) {
            alert('Gửi tin nhắn thất bại: ' + error.message);
        }
    }

    async handleFileUpload(file) {
        if (!file || !userManager.selectedUser) return;

        try {
            const uploadId = Date.now().toString();
            
            // Hiển thị progress
            this.showUploadProgress(uploadId, file.name);
            
            // Register progress callback
            auth.messenger.on('onFileProgress', (data) => {
                if (data.type === 'upload') {
                    this.updateUploadProgress(uploadId, data.percentage);
                }
            });

            // Upload file
            await auth.messenger.sendFile(userManager.selectedUser, file);
            
            // Xóa progress sau khi hoàn thành
            this.removeUploadProgress(uploadId);
            
        } catch (error) {
            alert('Gửi file thất bại: ' + error.message);
        }
    }

    showUploadProgress(uploadId, filename) {
        const progressHtml = `
            <div class="upload-progress" id="upload-${uploadId}">
                <span>${filename}</span>
                <div class="progress-bar">
                    <div class="progress" style="width: 0%"></div>
                </div>
            </div>
        `;
        document.getElementById('messagesContainer').insertAdjacentHTML('beforeend', progressHtml);
    }

    updateUploadProgress(uploadId, percentage) {
        const progressElement = document.querySelector(`#upload-${uploadId} .progress`);
        if (progressElement) {
            progressElement.style.width = `${percentage}%`;
        }
    }

    removeUploadProgress(uploadId) {
        const element = document.getElementById(`upload-${uploadId}`);
        if (element) {
            element.remove();
        }
    }

    addMessageToUI(message, type = 'received') {
        const messagesContainer = document.getElementById('messagesContainer');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;

        if (message.type === 'file') {
            const fileData = message.content;
            messageElement.innerHTML = `
                <div class="file-message">
                    <img src="assets/file-icon.png" alt="File">
                    <span>${fileData.name}</span>
                    <a href="${fileData.data}" download="${fileData.name}">Tải xuống</a>
                </div>
                <div class="message-meta">
                    <span class="timestamp">${this.formatTimestamp(message.timestamp)}</span>
                </div>
            `;
        } else {
            messageElement.innerHTML = `
                <div class="message-content">${message.content}</div>
                <div class="message-meta">
                    <span class="timestamp">${this.formatTimestamp(message.timestamp)}</span>
                </div>
            `;
        }

        messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    loadChatHistory(username) {
        const messages = this.messages.get(username) || [];
        const messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.innerHTML = '';

        messages.forEach(message => {
            const type = message.sender === auth.currentUser.username ? 'sent' : 'received';
            this.addMessageToUI(message, type);
        });
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleTimeString();
    }
}

const chatUI = new ChatUI(); 