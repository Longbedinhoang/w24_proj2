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

    // Generate IVs
    const ivGov = genRandomSalt();
    const receiverIV = genRandomSalt();

    // Generate ephemeral keypair for government
    const new_gov_pair = await generateEG();
    const dh_secret = await computeDH(new_gov_pair.sec, this.govPublicKey);
    const govKey = await HMACtoAESKey(dh_secret, govEncryptionDataStr);

    // Tạo header
    const header = {
      vGov: new_gov_pair.pub,
      ivGov: ivGov,
      receiverIV: receiverIV,
      pk_sender: this.myKeyPairs[name].pub_key
    };

    // Mã hóa cho government
    const cGov = await encryptWithGCM(govKey, mk_buffer, ivGov);
    header.cGov = cGov;

    // Mã hóa tin nhắn
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
    if (!(name in this.conns)) {
      // Khởi tạo kết nối mới như cũ
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
        initialKey: chain_key
      };

      // Khởi tạo prevKeys khi tạo connection mới
      if (!this.conns[name].prevKeys) {
        this.conns[name].prevKeys = new Map();
      }

    } else if (!this.conns[name].seenPks.has(header.pk_sender)) {
      // Đảm bảo prevKeys tồn tại
      if (!this.conns[name].prevKeys) {
        this.conns[name].prevKeys = new Map();
      }

      // Lưu khóa hiện tại vào Map trước khi ratchet
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

    // Thử giải mã với khóa hiện tại
    try {
      const ck_r = await HMACtoHMACKey(this.conns[name].ck_r, "ck-str");
      const mk = await HMACtoAESKey(this.conns[name].ck_r, "mk-str");
      this.conns[name].ck_r = ck_r;
      this.conns[name].seenPks.add(header.pk_sender);
      
      const plaintext = await decryptWithGCM(mk, ciphertext, header.receiverIV, JSON.stringify(header));
      return bufferToString(plaintext);
    } catch (error) {
      // Thử với các trạng thái khác nhau của khóa ban đầu
      let testKey = this.conns[name].initialKey;
      for (let i = 0; i < 10; i++) {
        try {
          const mk = await HMACtoAESKey(testKey, "mk-str");
          const plaintext = await decryptWithGCM(mk, ciphertext, header.receiverIV, JSON.stringify(header));
          return bufferToString(plaintext);
        } catch (decryptError) {
          testKey = await HMACtoHMACKey(testKey, "ck-str");
        }
      }

      // Đảm bảo prevKeys tồn tại trước khi kiểm tra
      if (this.conns[name].prevKeys && this.conns[name].prevKeys.has(header.pk_sender)) {
        let testKey = this.conns[name].prevKeys.get(header.pk_sender);
        for (let i = 0; i < 5; i++) {
          try {
            const mk = await HMACtoAESKey(testKey, "mk-str");
            const plaintext = await decryptWithGCM(mk, ciphertext, header.receiverIV, JSON.stringify(header));
            return bufferToString(plaintext);
          } catch (decryptError) {
            testKey = await HMACtoHMACKey(testKey, "ck-str");
          }
        }
      }
      
      throw error;
    }
  }
}

module.exports = { MessengerClient };