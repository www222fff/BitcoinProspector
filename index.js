require('isomorphic-fetch');
const crypto = require('crypto');
const tinysecp = require('tiny-secp256k1');
const { ECPairFactory } = require('ecpair');
const bitcoin = require('bitcoinjs-lib');

bitcoin.initEccLib(tinysecp);

const NETWORK = bitcoin.networks.bitcoin;
const ECPair = ECPairFactory(tinysecp);

WEBHOOK_URL = "https://discord.com/api/webhooks/1342822282627907654/t9EjJ6BOlkz7IShJOApUFy-m2AwHRdLZ9RljoI5Js7RAV29-IMxP72oQ591hKwMVCEu0"

async function sendToDiscord(message) {
    const data = { content: message };

    for (let i = 0; i < 3; i++) {  
        try {
            const response = await fetch(WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (response.status === 204) {
                return;
            } else {
                console.error(`Failed to send message: ${response.status}`);
            }
        } catch (error) {
            console.error(`Error sending message (attempt ${i + 1}):`, error);
        }
        await new Promise(r => setTimeout(r, 1000)); 
    }
}

async function getBalance(address) {
    const url = `https://mempool.space/api/address/${address}/utxo`;

    try {
        const response = await fetch(url);
        const utxos = await response.json();
	if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        if (!Array.isArray(utxos)) {
            throw new Error('Invalid response format');
        }
	    
	return utxos.length;
    } catch (error) {
	console.error(`Error checking UTXO for ${address}:`, error);
        return 0;
    }
}

async function main() {
    console.log("Start ...");
    let count = 0;

    while (true) {
        let privateKey = crypto.randomBytes(32);
        const keyPair = ECPair.fromPrivateKey(privateKey, { network: NETWORK });
        const xOnlyPubKey = Buffer.from(keyPair.publicKey.slice(1, 33));

        const { address: address_p2pkh } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: NETWORK });
        const { address: address_p2wpkh } = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: NETWORK });
        const { address: address_p2tr } = bitcoin.payments.p2tr({ internalPubkey: xOnlyPubKey, network: NETWORK });

        const balances = await Promise.all([
            getBalance(address_p2pkh),
            getBalance(address_p2wpkh),
            getBalance(address_p2tr),
        ]);

        const privateKeyHex = privateKey.toString('hex');
        if (balances[0] !== 0) sendToDiscord(`Balance: ${balances[0]}, Private Key: ${privateKeyHex}`);
        if (balances[1] !== 0) sendToDiscord(`Balance: ${balances[1]}, Private Key: ${privateKeyHex}`);
        if (balances[2] !== 0) sendToDiscord(`Balance: ${balances[2]}, Private Key: ${privateKeyHex}`);

        count++;
        if (count % 100 === 0) {
            sendToDiscord(`BTC scan attempt: ${count}`);
        }
	    
        await new Promise(r => setTimeout(r, 10));
    }
}


main();
