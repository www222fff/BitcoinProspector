require('isomorphic-fetch');
const crypto = require('crypto');
const tinysecp = require('tiny-secp256k1');
const { ECPairFactory } = require('ecpair');
const bitcoin = require('bitcoinjs-lib');

bitcoin.initEccLib(tinysecp);

const NETWORK = bitcoin.networks.bitcoin;
const ECPair = ECPairFactory(tinysecp);

count = 0;
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
            console.log("Balance > 0:!!!!!!!!", val_p2pkh, privateKey.toString('hex'), address_p2pkh);
        } else {
            console.log("Balance 0:---------", val_p2pkh, privateKey.toString('hex'), address_p2pkh);
        }

        let val_p2wpkh = await getBalance(address_p2wpkh);
        if (val_p2wpkh !== 0) {
            console.log("Balance > 0:!!!!!!!!", val_p2wpkh, privateKey.toString('hex'), address_p2wpkh);
        } else {
            console.log("Balance 0:---------", val_p2wpkh, privateKey.toString('hex'), address_p2wpkh);
        }

        let val_p2tr = await getBalance(address_p2tr);
        if (val_p2tr !== 0) {
            console.log("Balance > 0:!!!!!!!!", val_p2tr, privateKey.toString('hex'), address_p2tr);
        } else {
            console.log("Balance 0:---------", val_p2tr, privateKey.toString('hex'), address_p2tr);
        }

        count++;
        if (count%100 === 0) {
           count = 0;
           console.log("working......");
        }
    }
}

main();
