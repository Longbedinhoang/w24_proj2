'use strict'

/********* Imports ********/

const {
  /* The following functions are all of the cryptographic
  primatives that you should need for this assignment.
  See lib.js for details on usage. */
  bufferToString,
  genRandomSalt,
  generateEG, // async
  computeDH, // async
  verifyWithECDSA, // async
  HMACtoAESKey, // async
  HMACtoHMACKey, // async
  HKDF, // async
  encryptWithGCM, // async
  decryptWithGCM,
  cryptoKeyToJSON, // async
  govEncryptionDataStr
} = require('./lib')

/********* Implementation ********/


class MessengerClient {
  constructor(certAuthorityPublicKey, govPublicKey) {
      // the certificate authority DSA public key is used to
      // verify the authenticity and integrity of certificates
      // of other users (see handout and receiveCertificate)

      this.caPublicKey = certAuthorityPublicKey;
      this.govPublicKey = govPublicKey;
      this.conns = {}; // data for each active connection
      this.certs = {}; // certificates of other users
      this.myKeyPairs = {}; // store the EG key pairs for all the people I talk to! 

      // Initialize callbacks with bound empty functions
      const noop = () => {};
      this.callbacks = {
        onMessageReceived: noop.bind(null),
        onMessageSent: noop.bind(null), 
        onError: noop.bind(null),
        onConnectionStateChange: noop.bind(null),
        onFileProgress: noop.bind(null),
        onFileReceived: noop.bind(null)
      };
      
      this.currentUser = null;
      this.isInitialized = false;
      this.transfers = {}; // Initialize transfers object
    };

  /**
   * Generate a certificate to be stored with the certificate authority.
   * The certificate must contain the field "username".
   *
   * Arguments:
   *   username: string
   *
   * Return Type: certificate object/dictionary
   */ 
  async generateCertificate(username) {
    const certificate = {};
    certificate.username = username;
    const key_pair = await generateEG();
    certificate.pub_key = key_pair.pub;
    
    // this.conns.seenPks = new Set();
    this.myKeyPairs = {cert_pk: key_pair.pub, cert_sk: key_pair.sec};
    return certificate;
  }

  /**
   * Receive and store another user's certificate.
   *
   * Arguments:
   *   certificate: certificate object/dictionary
   *   signature: string
   *
   * Return Type: void
   */
  async receiveCertificate(certificate, signature) {
    //check this is a valid signature on the certificate

    const valid = await verifyWithECDSA(this.caPublicKey, JSON.stringify(certificate), signature)
    if(!valid) throw("invalid signature provided");
    this.certs[certificate.username] = certificate;
  }

  /**
   * Generate the message to be sent to another user.
   *
   * Arguments:
   *   name: string
   *   plaintext: string
   *
   * Return Type: Tuple of [dictionary, string]
   */

  async sendMessage(name, plaintext) {    
    if (!(name in this.conns)) {
      const bob_public_key = this.certs[name].pub_key;
      const raw_root_key = await computeDH(this.myKeyPairs.cert_sk, bob_public_key);
      const fresh_pair = await generateEG();
      this.myKeyPairs[name] = {pub_key: fresh_pair.pub, sec_key: fresh_pair.sec};

      const hkdf_input_key = await computeDH(this.myKeyPairs[name].sec_key, bob_public_key);
      const [root_key, chain_key] = await HKDF(hkdf_input_key, raw_root_key, "ratchet-salt");
      
      this.conns[name] = {rk: root_key, ck_s: chain_key};
      this.conns[name].seenPks = new Set();
    }

    // Generate message key
    const ck_s = await HMACtoHMACKey(this.conns[name].ck_s, "ck-str");
    const mk = await HMACtoAESKey(this.conns[name].ck_s, "mk-str");
    const mk_buffer = await HMACtoAESKey(this.conns[name].ck_s, "mk-str", true);
    this.conns[name].ck_s = ck_s;

    // Generate IVs for encryption
    const ivGov = genRandomSalt();
    const receiverIV = genRandomSalt();

    // Generate ephemeral keypair for government
    const new_gov_pair = await generateEG();
    const dh_secret = await computeDH(new_gov_pair.sec, this.govPublicKey);
    const govKey = await HMACtoAESKey(dh_secret, govEncryptionDataStr);

    // Create header
    const header = {
      vGov: new_gov_pair.pub,
      ivGov: ivGov,
      receiverIV: receiverIV,
      pk_sender: this.myKeyPairs[name].pub_key
    };

    // Encrypt for government
    const cGov = await encryptWithGCM(govKey, mk_buffer, ivGov);
    header.cGov = cGov;

    // Encrypt message
    const ciphertext = await encryptWithGCM(mk, plaintext, receiverIV, JSON.stringify(header));
    return [header, ciphertext];
  }


  /**
   * Decrypt a message received from another user.
   *
   * Arguments:
   *   name: string
   *   [header, ciphertext]: Tuple of [dictionary, string]
   *
   * Return Type: string
   */
  async receiveMessage(name, [header, ciphertext]) {
    // Check if message has been received before
    const messageId = JSON.stringify(header) + ciphertext;

    if (!(name in this.conns)) {
      // Initialize new connection
      const sender_cerk_pk = this.certs[name].pub_key;
      const raw_root_key = await computeDH(this.myKeyPairs.cert_sk, sender_cerk_pk);
      const hkdf_input_key = await computeDH(this.myKeyPairs.cert_sk, header.pk_sender);
      const [root_key, chain_key] = await HKDF(hkdf_input_key, raw_root_key, "ratchet-salt");

      const fresh_pair = await generateEG();
      this.myKeyPairs[name] = {pub_key: fresh_pair.pub, sec_key: fresh_pair.sec};

      const dh_result = await computeDH(this.myKeyPairs[name].sec_key, header.pk_sender);
      const [final_root_key, ck_s] = await HKDF(dh_result, root_key, "ratchet-salt");
    
      this.conns[name] = {
        rk: final_root_key, 
        ck_r: chain_key, 
        ck_s: ck_s,
        seenPks: new Set(),
        initialKey: chain_key,
        prevKeys: new Map(),
        seenMessages: new Set() // Initialize seenMessages
      };

    } else {
      // Ensure seenMessages exists
      if (!this.conns[name].seenMessages) {
        this.conns[name].seenMessages = new Set();
      }

      if (!this.conns[name].seenPks.has(header.pk_sender)) {
        // Ensure prevKeys exists
        if (!this.conns[name].prevKeys) {
          this.conns[name].prevKeys = new Map();
        }

        // Store current key in Map before ratcheting
        this.conns[name].prevKeys.set(header.pk_sender, this.conns[name].ck_r);

        const first_dh_output = await computeDH(this.myKeyPairs[name].sec_key, header.pk_sender);
        let [rk_first, ck_r] = await HKDF(first_dh_output, this.conns[name].rk, "ratchet-salt");

        const fresh_pair = await generateEG();
        this.myKeyPairs[name] = {pub_key: fresh_pair.pub, sec_key: fresh_pair.sec};

        const second_dh_output = await computeDH(this.myKeyPairs[name].sec_key, header.pk_sender);
        const [rk, ck_s] = await HKDF(second_dh_output, rk_first, "ratchet-salt");
        
        this.conns[name].rk = rk;
        this.conns[name].ck_s = ck_s;
        this.conns[name].ck_r = ck_r;
      }
    }

    // Check for message replay
    if (this.conns[name].seenMessages.has(messageId)) {
      throw new Error("Message replay detected");
    }

    // Try to decrypt with current key
    try {
      const ck_r = await HMACtoHMACKey(this.conns[name].ck_r, "ck-str");
      const mk = await HMACtoAESKey(this.conns[name].ck_r, "mk-str");
      this.conns[name].ck_r = ck_r;
      this.conns[name].seenPks.add(header.pk_sender);
      
      const plaintext = await decryptWithGCM(mk, ciphertext, header.receiverIV, JSON.stringify(header));
      
      // Add message to seen messages list
      this.conns[name].seenMessages.add(messageId);
      
      return bufferToString(plaintext);
    } catch (error) {
      // Try with different states of initial key
      let testKey = this.conns[name].initialKey;
      for (let i = 0; i < 10; i++) {
        try {
          const mk = await HMACtoAESKey(testKey, "mk-str");
          const plaintext = await decryptWithGCM(mk, ciphertext, header.receiverIV, JSON.stringify(header));
          
          // Add message to seen messages list
          this.conns[name].seenMessages.add(messageId);
          
          return bufferToString(plaintext);
        } catch (decryptError) {
          testKey = await HMACtoHMACKey(testKey, "ck-str");
        }
      }

      // Ensure prevKeys exists before checking
      if (this.conns[name].prevKeys && this.conns[name].prevKeys.has(header.pk_sender)) {
        let testKey = this.conns[name].prevKeys.get(header.pk_sender);
        for (let i = 0; i < 5; i++) {
          try {
            const mk = await HMACtoAESKey(testKey, "mk-str");
            const plaintext = await decryptWithGCM(mk, ciphertext, header.receiverIV, JSON.stringify(header));
            
            // Add message to seen messages list
            this.conns[name].seenMessages.add(messageId);
            
            return bufferToString(plaintext);
          } catch (decryptError) {
            testKey = await HMACtoHMACKey(testKey, "ck-str");
          }
        }
      }
      
      throw error;
    }
  }

  async initializeForUser(username) {
    if (!username) {
      throw new Error("Username is required");
    }
    
    // Create certificate for user
    const certificate = await this.generateCertificate(username);
    
    // Skip certificate verification for initialization
    this.currentUser = username;
    this.isInitialized = true;

    // Notify connection state change
    this.triggerCallback('onConnectionStateChange', {
      status: 'connected',
      username: username
    });

    return certificate;
  }

  async wrappedSendMessage(name, plaintext) {
    try {
      // Kiểm tra đã khởi tạo chưa
      if (!this.isInitialized) {
        throw new Error("Client chưa được khởi tạo");
      }

      // Gọi phương thức gốc
      const [header, ciphertext] = await this.sendMessage(name, plaintext);

      // Thông báo tin nhắn đã gửi
      this.triggerCallback('onMessageSent', {
        to: name,
        message: plaintext,
        header: header,
        timestamp: new Date()
      });

      return [header, ciphertext];
    } catch (error) {
      this.triggerCallback('onError', {
        type: 'send_failed',
        error: error
      });
      throw error;
    }
  }

  async wrappedReceiveMessage(name, [header, ciphertext]) {
    try {
      const plaintext = await this.receiveMessage(name, [header, ciphertext]);
      if (!plaintext) return false;

      try {
        // Check if this is a file message
        const isFileMessage = await this.handleReceivedFile(name, plaintext);
        
        if (!isFileMessage) {
          // Regular message notification
          this.triggerCallback('onMessageReceived', {
            from: name,
            message: plaintext,
            header: header,
            timestamp: new Date()
          });
        }

        return plaintext;
      } catch (error) {
        console.error('Error handling file message:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in wrappedReceiveMessage:', error);
      this.triggerCallback('onError', {
        type: 'receive_failed', 
        error: error
      });
      return false;
    }
  }

  async sendFile(name, file) {
    try {
      console.log('DEBUG: Starting file send process for:', file.name);
      console.log('DEBUG: File details:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      // Send file metadata first
      const metadata = await this.createFileMetadata(file);
      console.log('DEBUG: Created metadata:', metadata);
      
      await this.sendMessage(name, JSON.stringify({ type: 'file_metadata', data: metadata }));
      console.log('DEBUG: Sent metadata message');

      // Split file into chunks and send each chunk
      const chunks = this.splitFileIntoChunks(file);
      console.log('DEBUG: Split file into', chunks.length, 'chunks');
      
      let sentBytes = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log('DEBUG: Processing chunk', i + 1, 'of', chunks.length);
        
        const base64Chunk = await this.fileChunkToBase64(chunk);
        console.log('DEBUG: Converted chunk to base64, length:', base64Chunk.length);

        // Send chunk with metadata
        await this.sendMessage(name, JSON.stringify({
          type: 'file_chunk',
          data: {
            id: metadata.id,
            chunkIndex: i,
            totalChunks: chunks.length,
            content: base64Chunk
          }
        }));
        console.log('DEBUG: Sent chunk', i + 1);

        // Update sent bytes based on original chunk size
        sentBytes += chunk.size;
        
        // Report progress
        const progress = Math.min(100, Math.round((sentBytes / file.size) * 100));
        console.log('DEBUG: Progress update:', progress + '%');
        
        this.triggerCallback('onFileProgress', {
          type: 'upload',
          filename: file.name,
          totalBytes: file.size,
          sentBytes: sentBytes,
          percentage: progress
        });
      }

      console.log('DEBUG: Completed sending all chunks');
      return true;
    } catch (error) {
      console.error('DEBUG: Error in sendFile:', error);
      this.triggerCallback('onError', {
        type: 'file_send_failed',
        error: error
      });
      throw error;
    }
  }

  async fileChunkToBase64(chunk) {
    const buffer = await chunk.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }

  async handleReceivedFile(name, message) {
    try {
      console.log('DEBUG: Starting handleReceivedFile');
      console.log('DEBUG: Message from:', name);
      
      let data;
      try {
        data = JSON.parse(message);
        console.log('DEBUG: Parsed message data:', {
          type: data.type,
          hasData: !!data.data
        });
      } catch (e) {
        console.log('DEBUG: Failed to parse message as JSON');
        return false;
      }
      
      if (!data || !data.type || !data.data) {
        console.log('DEBUG: Invalid message format');
        return false;
      }

      if (data.type === 'file_metadata') {
        console.log('DEBUG: Received file metadata');
        const metadata = data.data;
        console.log('DEBUG: Metadata:', metadata);
        
        this.transfers[metadata.id] = {
          metadata: metadata,
          chunks: new Array(metadata.totalChunks).fill(null),
          receivedChunks: 0,
          receivedBytes: 0,
          completed: false
        };
        console.log('DEBUG: Initialized transfer object for:', metadata.filename);
        return true;
      }

      if (data.type === 'file_chunk') {
        const { id, chunkIndex, totalChunks, content } = data.data;
        console.log('DEBUG: Received chunk:', {
          id,
          chunkIndex,
          totalChunks,
          contentLength: content.length
        });

        const transfer = this.transfers[id];
        if (!transfer) {
          console.log('DEBUG: No transfer found for id:', id);
          return false;
        }

        if (transfer.completed) {
          console.log('DEBUG: Transfer already completed');
          return false;
        }

        try {
          const chunkBlob = await this.base64ToBlob(content);
          console.log('DEBUG: Converted chunk to blob, size:', chunkBlob.size);

          if (!transfer.chunks[chunkIndex]) {
            transfer.chunks[chunkIndex] = chunkBlob;
            transfer.receivedChunks++;
            transfer.receivedBytes += chunkBlob.size;

            console.log('DEBUG: Updated transfer progress:', {
              receivedChunks: transfer.receivedChunks,
              totalChunks,
              receivedBytes: transfer.receivedBytes,
              totalBytes: transfer.metadata.size
            });

            if (typeof this.callbacks.onFileProgress === 'function') {
              console.log('DEBUG: Triggering onFileProgress callback');
              this.callbacks.onFileProgress({
                type: 'download',
                filename: transfer.metadata.filename,
                totalBytes: transfer.metadata.size,
                receivedBytes: transfer.receivedBytes,
                percentage: Math.min(100, Math.round((transfer.receivedBytes / transfer.metadata.size) * 100))
              });
            }

            if (transfer.receivedChunks === totalChunks) {
              console.log('DEBUG: All chunks received, verifying...');
              
              const missingChunks = transfer.chunks.findIndex(chunk => !chunk);
              if (missingChunks !== -1) {
                console.error('DEBUG: Missing chunk at index:', missingChunks);
                return false;
              }

              console.log('DEBUG: All chunks verified, combining...');
              const file = new Blob(transfer.chunks, { type: transfer.metadata.type });
              
              console.log('DEBUG: Created blob, size:', file.size);
              const finalFile = new File([file], transfer.metadata.filename, {
                type: transfer.metadata.type,
                lastModified: new Date(transfer.metadata.timestamp).getTime()
              });

              console.log('DEBUG: Created final file:', {
                name: finalFile.name,
                size: finalFile.size,
                type: finalFile.type
              });

              // Create callback data
              const callbackData = {
                from: name,
                file: finalFile,
                metadata: transfer.metadata
              };

              // Mark as completed and clean up
              transfer.completed = true;
              delete this.transfers[id];

              // Execute callback if it exists
              if (typeof this.callbacks.onFileReceived === 'function') {
                console.log('DEBUG: Executing onFileReceived callback directly');
                try {
                  this.callbacks.onFileReceived(callbackData);
                  console.log('DEBUG: onFileReceived callback completed successfully');
                } catch (error) {
                  console.error('DEBUG: Error in onFileReceived callback:', error);
                  console.error('DEBUG: Error details:', error.stack);
                }
              } else {
                console.error('DEBUG: onFileReceived callback is not a function');
                console.error('DEBUG: Callback state:', this.callbacks);
              }
            }
          }
          return true;
        } catch (error) {
          console.error('DEBUG: Error processing chunk:', error);
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error('DEBUG: Error in handleReceivedFile:', error);
      return false;
    }
  }

  async base64ToBlob(base64String) {
    try {
      const byteCharacters = atob(base64String);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray]);
    } catch (error) {
      console.error('DEBUG: Error in base64ToBlob:', error);
      throw error;
    }
  }

  async createFileMetadata(file) {
    const chunkSize = 1024 * 1024; // 1MB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    const metadata = {
      filename: file.name,
      type: file.type,
      size: file.size,
      totalChunks: totalChunks,
      timestamp: new Date().toISOString(),
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      chunkSize: chunkSize
    };
    return metadata;
  }

  splitFileIntoChunks(file, chunkSize = 1024 * 1024) { // 1MB chunks
    const chunks = [];
    let offset = 0;
    
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      chunks.push(chunk);
      offset += chunkSize;
    }
    
    return chunks;
  }

  on(eventName, callback) {
    console.log('DEBUG: Registering callback for:', eventName);
    console.log('DEBUG: Callback type:', typeof callback);
    
    if (typeof callback !== 'function') {
      console.error('DEBUG: Attempted to register non-function callback for:', eventName);
      return;
    }

    // Bind the callback to preserve context
    const boundCallback = callback.bind(null);
    
    // Store callback directly
    this.callbacks[eventName] = boundCallback;
    
    console.log('DEBUG: Successfully registered callback for:', eventName);
    console.log('DEBUG: Callback verification:', {
      exists: eventName in this.callbacks,
      isFunction: typeof this.callbacks[eventName] === 'function',
      callbackRef: this.callbacks[eventName] === boundCallback
    });
  }

  triggerCallback(eventName, data) {
    console.log('DEBUG: Attempting to trigger callback:', eventName);
    const callback = this.callbacks[eventName];
    
    console.log('DEBUG: Callback state:', {
      exists: eventName in this.callbacks,
      type: typeof callback,
      isFunction: typeof callback === 'function'
    });

    if (typeof callback === 'function') {
      console.log('DEBUG: Executing callback with data:', data);
      try {
        callback(data);
        console.log('DEBUG: Callback executed successfully');
      } catch (error) {
        console.error('DEBUG: Error executing callback:', error);
      }
    } else {
      console.log('DEBUG: Callback not found or not a function for event:', eventName);
    }
  }

  isConnected() {
    return this.isInitialized && this.currentUser !== null;
  }

  disconnect() {
    this.currentUser = null;
    this.isInitialized = false;
    this.triggerCallback('onConnectionStateChange', {
      status: 'disconnected'
    });
  }
}

module.exports = { MessengerClient };