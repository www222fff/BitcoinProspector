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
    const url = `https://blockstream.info/api/address/${address}/utxo`;

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
        //console.error(`Error checking UTXO for ${address}:`, error);
        return 0;
    }
}


function parseArgs() {
    const args = process.argv.slice(2);
    let count = 300000;
    let debug = false;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--debug') debug = true;
        if (args[i] === '--count' && args[i+1]) {
            const val = parseInt(args[i+1], 10);
            if (!isNaN(val)) count = val;
        }
    }
    return {
        debug,
        maxCount: count
    };
}

async function main() {
    const { debug, maxCount } = parseArgs();
    const host = process.env.HOSTNAME;
    if (debug) console.log(`start on host: ${host}`);
    sendToDiscord(`start on host: ${host}`);

    let count = 0;
    while (true) {
        let privateKey = crypto.randomBytes(32);
        const keyPair = ECPair.fromPrivateKey(privateKey, { network: NETWORK });
        const xOnlyPubKey = Buffer.from(keyPair.publicKey.slice(1, 33));

        const { address: address_p2pkh } = bitcoin.payments.p2pkh({ pubkey: Buffer.from(keyPair.publicKey), network: NETWORK });
        const { address: address_p2wpkh } = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(keyPair.publicKey), network: NETWORK });
        const { address: address_p2tr } = bitcoin.payments.p2tr({ internalPubkey: xOnlyPubKey, network: NETWORK });

        let val_p2pkh = await getBalance(address_p2pkh);
        if (val_p2pkh !== 0) {
            console.log("private key:", privateKey.toString('hex'));
            sendToDiscord(`Balance : ${val_p2pkh}, Private Key: ${privateKey.toString('hex')}`);
	    break;
        } else {
            if (debug) console.log("No balance found for P2PKH address:", address_p2pkh);
        }

        let val_p2wpkh = await getBalance(address_p2wpkh);
        if (val_p2wpkh !== 0) {
            console.log("private key:", privateKey.toString('hex'));
            sendToDiscord(`Balance : ${val_p2wpkh}, Private Key: ${privateKey.toString('hex')}`);
	    break;
        } else {
            if (debug) console.log("No balance found for P2WPKH address:", address_p2wpkh);
        }

        let val_p2tr = await getBalance(address_p2tr);
        if (val_p2tr !== 0) {
            console.log("private key:", privateKey.toString('hex'));
            sendToDiscord(`Balance : ${val_p2tr}, Private Key: ${privateKey.toString('hex')}`);
	    break;
        } else {
            if (debug) console.log("No balance found for P2TR address:", address_p2tr);
        }

        count++;
        if (count === maxCount) {
            sendToDiscord(`${host} BTC scan attempt: ${count}`);
            count = 0;
        }
    }
}

main();
