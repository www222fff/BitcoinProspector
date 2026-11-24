require("isomorphic-fetch");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const tinysecp = require("tiny-secp256k1");
const { ECPairFactory } = require("ecpair");
const bitcoin = require("bitcoinjs-lib");

bitcoin.initEccLib(tinysecp);

const NETWORK = bitcoin.networks.bitcoin;
const ECPair = ECPairFactory(tinysecp);

const RESULT_FILE = process.env.RESULT_FILE || path.join(__dirname, "found.txt");
const REQUEST_DELAY_MS = parseInt(process.env.REQUEST_DELAY_MS || "0", 10);
const BACKOFF_MS = parseInt(process.env.BACKOFF_MS || "10000", 10);

// Local bitcoind JSON-RPC. scantxoutset scans the whole UTXO set per call (~minutes),
// so each scan batches many keys at once to amortise the cost.
const RPC_HOST = process.env.RPC_HOST || "127.0.0.1";
const RPC_PORT = parseInt(process.env.RPC_PORT || "8332", 10);
const RPC_USER = process.env.RPC_USER || "";
const RPC_PASSWORD = process.env.RPC_PASSWORD || "";
const RPC_URL = `http://${RPC_HOST}:${RPC_PORT}/`;
const RPC_AUTH = "Basic " + Buffer.from(`${RPC_USER}:${RPC_PASSWORD}`).toString("base64");
// Private keys generated per scan; each key yields 3 addresses (P2PKH/P2WPKH/P2TR).
const BATCH_KEYS = parseInt(process.env.BATCH_KEYS || "3000", 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function saveResult(line) {
    try {
        fs.appendFileSync(RESULT_FILE, line + "\n");
        console.log("saved to", RESULT_FILE);
    } catch (e) {
        console.error("failed to write result file:", e);
    }
}

async function rpcCall(method, params) {
    const response = await fetch(RPC_URL, {
        method: "POST",
        headers: { "content-type": "text/plain", authorization: RPC_AUTH },
        body: JSON.stringify({ jsonrpc: "1.0", id: "checkbtc", method, params }),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    const data = await response.json();
    if (data.error) {
        throw new Error(`RPC ${method}: ${JSON.stringify(data.error)}`);
    }
    return data.result;
}

// Check many addresses in one local scantxoutset call against the UTXO set.
// returns { ok, rateLimited, data } where data maps address -> { n_tx, final_balance (sats) }.
// Only funded (UTXO-bearing) addresses appear; a positive balance is all the scan needs.
async function getBalances(addresses) {
    // Map each address to its scriptPubKey hex so scan outputs can be matched back.
    const scriptToAddr = new Map();
    const descriptors = [];
    for (const address of addresses) {
        try {
            const scriptHex = bitcoin.address.toOutputScript(address, NETWORK).toString("hex");
            scriptToAddr.set(scriptHex, address);
            descriptors.push({ desc: `addr(${address})` });
        } catch (e) {
            // skip malformed address
        }
    }

    try {
        const result = await rpcCall("scantxoutset", ["start", descriptors]);
        if (!result || result.success !== true) {
            return { ok: false, rateLimited: false, data: null };
        }
        const data = {};
        for (const utxo of result.unspents || []) {
            const address = scriptToAddr.get(utxo.scriptPubKey);
            if (!address) continue;
            const sats = Math.round((utxo.amount || 0) * 1e8);
            if (!data[address]) data[address] = { n_tx: 0, final_balance: 0 };
            data[address].n_tx += 1;
            data[address].final_balance += sats;
        }
        return { ok: true, rateLimited: false, data };
    } catch (error) {
        const message = error.message || String(error);
        // Another scan is still running: wait and let the caller retry.
        if (/Scan already in progress/i.test(message)) {
            return { ok: false, rateLimited: true, data: null };
        }
        console.error("Error checking balances:", message);
        return { ok: false, rateLimited: false, data: null };
    }
}

function parseArgs() {
    const args = process.argv.slice(2);
    let count = 0; // 0 = run indefinitely
    let debug = false;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--debug") debug = true;
        if (args[i] === "--count" && args[i + 1]) {
            const val = parseInt(args[i + 1], 10);
            if (!isNaN(val)) count = val;
        }
    }
    return { debug, maxCount: count };
}

// Generate one random private key and its three standard addresses.
function makeCandidate() {
    const privateKey = crypto.randomBytes(32);
    const keyPair = ECPair.fromPrivateKey(privateKey, { network: NETWORK });
    const xOnlyPubKey = Buffer.from(keyPair.publicKey.slice(1, 33));
    const addrs = {
        P2PKH: bitcoin.payments.p2pkh({ pubkey: Buffer.from(keyPair.publicKey), network: NETWORK }).address,
        P2WPKH: bitcoin.payments.p2wpkh({ pubkey: Buffer.from(keyPair.publicKey), network: NETWORK }).address,
        P2TR: bitcoin.payments.p2tr({ internalPubkey: xOnlyPubKey, network: NETWORK }).address,
    };
    return { privateKey, addrs };
}

async function main() {
    const { debug, maxCount } = parseArgs();
    const host = process.env.HOSTNAME || require("os").hostname();
    if (!RPC_USER || !RPC_PASSWORD) {
        console.error("RPC_USER / RPC_PASSWORD not set; refusing to start.");
        process.exit(1);
    }

    const info = await rpcCall("getblockchaininfo", []).catch((e) => {
        console.error("cannot reach local bitcoind:", e.message || e);
        process.exit(1);
    });
    console.log(
        `start on host: ${host} (api=local bitcoind ${RPC_HOST}:${RPC_PORT} scantxoutset, ` +
        `batch=${BATCH_KEYS} keys/scan, chain=${info.chain} height=${info.blocks} pruned=${info.pruned})`
    );

    let totalChecked = 0;
    while (true) {
        // Build one batch of candidates and scan all their addresses in a single pass.
        const batch = [];
        const addrList = [];
        for (let i = 0; i < BATCH_KEYS; i++) {
            const candidate = makeCandidate();
            batch.push(candidate);
            addrList.push(...Object.values(candidate.addrs));
        }

        const startedAt = Date.now();
        let res = await getBalances(addrList);
        while (res.rateLimited) {
            console.warn(`scan busy, backing off ${BACKOFF_MS}ms`);
            await sleep(BACKOFF_MS);
            res = await getBalances(addrList);
        }
        const scanSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

        if (res.ok && res.data) {
            for (const { privateKey, addrs } of batch) {
                for (const [type, address] of Object.entries(addrs)) {
                    const hit = res.data[address];
                    const nTx = hit ? hit.n_tx : 0;
                    const bal = hit ? hit.final_balance : 0;
                    if (nTx > 0 || bal > 0) {
                        const pk = privateKey.toString("hex");
                        console.log("HIT private key:", pk);
                        saveResult(`${new Date().toISOString()} host=${host} type=${type} address=${address} n_tx=${nTx} balance=${bal} privkey=${pk}`);
                    } else if (debug) {
                        console.log(`No balance for ${type} address:`, address);
                    }
                }
            }
            totalChecked += batch.length;
            console.log(`${host} scanned batch of ${batch.length} keys (${addrList.length} addrs) in ${scanSeconds}s; total keys checked: ${totalChecked}`);
        } else {
            console.warn(`batch scan failed after ${scanSeconds}s, retrying`);
        }

        if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);

        if (maxCount > 0 && totalChecked >= maxCount) {
            console.log(`${host} reached ${totalChecked} keys, exiting`);
            break;
        }
    }
}

if (require.main === module) {
    main();
} else {
    module.exports = { getBalances, rpcCall };
}
