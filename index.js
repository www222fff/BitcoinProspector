require('isomorphic-fetch')
const CoinKey = require('coinkey');
const crypto = require('crypto');
const { HttpsProxyAgent } = require('https-proxy-agent');

//const proxyUrl = 'http://135.245.192.7:8000'; // Replace with your proxy URL
const proxyUrl = '';
const intervalTime = 1000; 
count = 0;

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
        return 0;
    }
}

async function main() {
  let privateKey = crypto.randomBytes(32);
  let ck = new CoinKey(new Buffer.from(privateKey, 'hex'));

  let bal = await getBalance(ck.publicAddress, proxyUrl);

  if (bal !== 0) {
      console.log("Balance > 0:!!!!!!!!", bal, privateKey.toString('hex'), ck.publicAddress);
  } else {
      //console.log("Balance 0:---------", bal, privateKey.toString('hex'), ck.publicAddress);
  }

  count++;
  if (count%1000 === 0) {
      count = 0;
      console.log("working......");
  }
}

if (process.env.NODE_ENV === 'production') {
  setInterval(main, intervalTime);
} else {
  console.log('Deployment finished');
}




