require('isomorphic-fetch')
const CoinKey = require('coinkey');
const crypto = require('crypto');
const { HttpsProxyAgent } = require('https-proxy-agent');

const proxyUrl = 'http://135.245.192.7:8000'; // Replace with your proxy URL

async function getBalance(address, proxyUrl) {
    const url = `https://mempool.space/api/address/${address}/utxo`;

    const options = {};
    if (proxyUrl) {
        const agent = new HttpsProxyAgent(proxyUrl);
        options.agent = agent;
    }

    try {
        const response = await fetch(url, options);
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
        console.error('Error fetching UTXOs:', error);
    }
}

async function main() {
  let privateKey = crypto.randomBytes(32);
  let ck = new CoinKey(new Buffer.from(privateKey, 'hex'));

  const bal = await getBalance(ck.publicAddress, proxyUrl);
  if (bal !== 0) {
     console.log("Got Balance:---------", bal, privateKey, ck.publicAddress);
     return;
  }
  console.log("Balance 0 :---------", privateKey.toString('hex'), ck.publicAddress);
  setTimeout(main, 2000); 
}

main();

