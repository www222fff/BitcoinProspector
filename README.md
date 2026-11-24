# BitcoinProspector

Generate random Bitcoin private keys and check, against a **local** Bitcoin Core node,
whether any of their addresses hold a balance. Each key is expanded into three address
types (P2PKH, P2WPKH, P2TR) and a whole batch is checked in a single `scantxoutset` pass.

> **Reality check:** the keyspace is ~2^160. The odds of hitting a funded address are
> astronomically small — effectively zero. This is a learning/stress toy, not a way to
> find coins. Run it on your own node and don't do anything illegal with a key that,
> against all odds, turns up funded.

## How it works

Bitcoin Core keeps no address index by default, and this tool deliberately avoids adding
one. Instead it calls the built-in `scantxoutset` RPC, which sweeps the entire UTXO set
(the `chainstate` DB) and filters it against the descriptors you pass in.

That sweep costs the same whether you ask for 1 address or 10,000 — it is dominated by the
size of the UTXO set (minutes per call on mainnet). So the tool generates a **large batch
of keys per scan** and checks them all at once, amortizing the cost. A pruned node works
fine: pruning removes old blocks but keeps the full UTXO set.

## Requirements

- **Node.js** 18 or newer.
- A reachable **Bitcoin Core** node with JSON-RPC enabled and **fully synced**
  (`verificationprogress` ≈ 1). A pruned node is fine; no `txindex` or address index needed.

Enable RPC in `bitcoin.conf`, for example:

```ini
server=1
rpcuser=YOUR_RPC_USER
rpcpassword=YOUR_RPC_PASSWORD
# bind/allow only as tight as your setup needs; keep RPC off the public internet
```

## Setup

```bash
git clone git@github.com:www222fff/BitcoinProspector.git
cd BitcoinProspector
npm install
```

## Configuration

All configuration is through environment variables:

| Variable          | Default      | Description                                                        |
| ----------------- | ------------ | ------------------------------------------------------------------ |
| `RPC_HOST`        | `127.0.0.1`  | Bitcoin Core RPC host.                                             |
| `RPC_PORT`        | `8332`       | Bitcoin Core RPC port.                                             |
| `RPC_USER`        | *(required)* | RPC username. The tool refuses to start without it.               |
| `RPC_PASSWORD`    | *(required)* | RPC password. The tool refuses to start without it.              |
| `BATCH_KEYS`      | `3000`       | Private keys generated per scan (× 3 addresses each).             |
| `REQUEST_DELAY_MS`| `0`          | Extra delay between scans, in ms.                                  |
| `BACKOFF_MS`      | `10000`      | Wait before retrying when a scan is already in progress.          |
| `RESULT_FILE`     | `found.txt`  | Where a hit is appended (ISO time, address, balance, private key).|

CLI flags: `--debug` logs every checked address; `--count N` stops after N keys (`0` = run forever).

## Running

Copy the launcher template, fill in your RPC credentials, and run it. The real
`run-local.sh` is git-ignored so your credentials never get committed.

```bash
cp run-local.sh.example run-local.sh
# edit run-local.sh and set RPC_USER / RPC_PASSWORD
chmod +x run-local.sh
./run-local.sh
```

Or run directly:

```bash
RPC_USER=he RPC_PASSWORD=secret BATCH_KEYS=3000 npm start
```

Run it detached in the background:

```bash
nohup setsid ./run-local.sh > run.log 2>&1 < /dev/null &
tail -f run.log
```

## Output

On startup it prints the node it connected to and the batch size. Each completed scan logs
how many keys/addresses it checked and the elapsed time. Any funded address (which you will
almost certainly never see) is both logged and appended to `RESULT_FILE`.

## Performance notes

- A full `scantxoutset` on mainnet takes roughly a few minutes per call; it is bound by the
  UTXO set size and disk/CPU, not by how many addresses you pass.
- Bigger `BATCH_KEYS` means fewer scans and better throughput, at the cost of more memory.
- The first scan is slower (cold); later scans are faster once `chainstate` is in the OS
  page cache. More RAM / a larger `dbcache` helps.
- Each scan keeps the node busy for its whole duration, so expect sustained CPU on the box
  running `bitcoind`.
