require('isomorphic-fetch')
const Bitcoin = require('./bitcoin'); // Import the function from bitcoin.js

const getNum = async (url) => {
  let data = await fetch(url)
  console.log(url);
  data = await data.text()
  return Number(data)
}

const balance = async (address) => {
  const url = _balanceUrl(address)
  const data = await getNum(url)
  return data
}

const _balanceUrl = (address) => (
  `${_blockchainHost()}/q/addressbalance/${address}?format=json`
)

const _blockchainHost = () => (
  'https://blockchain.info'
)

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    while (true) {
        await sleep(2000);
        const response = await new Promise((resolve) => {
            Bitcoin.createWalletAddress((res) => resolve(res));
        });

        const bal = await balance(response.address);
        console.log("balance:", bal, response);

        if (bal > 0) {
            console.log("Got Balance:", bal, response);
            return;
        }
    }
}

main().catch((error) => {
    console.error('Error:', error);
});

