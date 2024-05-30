require('isomorphic-fetch')
const Bitcoin = require('./bitcoin'); // Import the function from bitcoin.js
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
            console.log(`The UTXO list for ${address} is empty.`);
            return 0;
        }

        const balance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
        return balance / 1e8; // Convert satoshis to BTC
    } catch (error) {
        console.error('Error fetching UTXOs:', error);
    }
}

async function main() {
  const response = await new Promise((resolve) => {
    Bitcoin.createWalletAddress((res) => resolve(res));
  });

  const bal = await getBalance(response.address, proxyUrl);
  if (bal !== 0) {
     console.log("Got Balance:", bal, response);
     return;
  }
  console.log("Balance 0 :",response);
  setTimeout(main, 2000); 
}

main();

