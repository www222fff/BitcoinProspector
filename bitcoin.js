const bitcoin = require("bitcoinjs-lib");
const ec = require("elliptic").ec;
const sha256 = require('js-sha256');
const ripemd160 = require('ripemd160');
const base58 = require('bs58');
const crypto = require('crypto');

let Bitcoin = {};

// Generate the key and address
Bitcoin.createWalletAddress = (callback) => {
    let privateKey = Bitcoin.createPrivateKey();
    let hash = Bitcoin.generatePublicKeyHash(privateKey);
    let address = Bitcoin.createPublicAddress(hash);
    callback({
        key: privateKey,
        address: address
    });
}

// Create the private key 
Bitcoin.createPrivateKey = () => {
    var keyPair = bitcoin.ECPair.makeRandom();
    let privateKey = keyPair.privateKey.toString('hex');
    return privateKey;
}

/**
 * Generate the public key hash
 * 
 * @param {String} privateKey 
 */
Bitcoin.generatePublicKeyHash = privateKey => {
    const ecdsa = new ec('secp256k1'),
        keys = ecdsa.keyFromPrivate(privateKey),
        publicKey = keys.getPublic('hex'),
        hash = sha256(Buffer.from(publicKey, 'hex')),
        publicKeyHash = new ripemd160().update(Buffer.from(hash, 'hex')).digest();

    return publicKeyHash.toString('hex');
}

Bitcoin.createPublicAddress = publicKeyHash => {
    // Step 1: Add prefix "00" in hex
    const step1 = Buffer.from("00" + publicKeyHash, 'hex');

    // Step 2: Create SHA256 hash of step 1
    const step2 = crypto.createHash('sha256').update(step1).digest();

    // Step 3: Create SHA256 hash of step 2
    const step3 = crypto.createHash('sha256').update(step2).digest();

    // Step 4: Find the 1st four bytes of step 3 - save as "checksum"
    const checksum = step3.slice(0, 4).toString('hex');

    // Step 5: Add step 1 + checksum
    const step4 = step1.toString('hex') + checksum;

    // Return base58 encoding of step 5
    const address = base58.encode(Buffer.from(step4, 'hex'));

    return address;
}

module.exports = Bitcoin;

