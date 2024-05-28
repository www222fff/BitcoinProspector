require('isomorphic-fetch')
const Bitcoin = require('./bitcoin'); // Import the function from bitcoin.js

const getNum = async (url) => {
  let data = await fetch(url)  
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

function logToPage(message) {
    const logContainer = document.getElementById('logs');
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.textContent = message;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

async function main() {
  console.log("working--------------");
  logToPage("working--------------");
  const response = await new Promise((resolve) => {
    Bitcoin.createWalletAddress((res) => resolve(res));
  });

  const bal = await balance(response.address);
  if (bal > 0) {
     console.log("Got Balance:", bal, response);
     return;
  }
  setTimeout(main, 2000);
}

export { main };

