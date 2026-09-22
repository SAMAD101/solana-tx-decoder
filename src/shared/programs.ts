export const KNOWN_PROGRAMS: Record<string, string> = {
  "11111111111111111111111111111111": "System Program",
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "SPL Token",
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: "Token-2022",
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: "Associated Token Account",
  ComputeBudget111111111111111111111111111111: "Compute Budget",
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: "Memo",
  Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo: "Memo (v1)",
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: "Jupiter v6",
  DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH: "DFlow Aggregator v4",
  Stake11111111111111111111111111111111111111: "Stake Program",
  Vote111111111111111111111111111111111111111: "Vote Program",
  AddressLookupTab1e1111111111111111111111111: "Address Lookup Table",
  BPFLoaderUpgradeab1e11111111111111111111111: "BPF Upgradeable Loader",
  Ed25519SigVerify111111111111111111111111111: "Ed25519 SigVerify",
  KeccakSecp256k11111111111111111111111111111: "Secp256k1 SigVerify",
  metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s: "Metaplex Token Metadata",
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: "Orca Whirlpool",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium AMM v4",
  CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK: "Raydium CLMM",
  LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo: "Meteora DLMM",
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": "Pump.fun",
  pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA: "Pump.fun AMM",
  pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ: "Pump.fun Fees",
  PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY: "Phoenix",
  SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf: "Squads v4",
  SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu: "Squads v3",
  SMPLKTQhrgo22hFCVq2VGX1KAktTWjeizkhrdB1eauK: "Squads v3 Program Manager",
};

export const KNOWN_MINTS: Record<string, string> = {
  // SOL, stablecoins
  So11111111111111111111111111111111111111112: "Wrapped SOL",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo": "PYUSD",

  // Liquid staked SOL
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: "JitoSOL",
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: "mSOL",
  jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v: "JupSOL",
  "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm": "INF (Sanctum Infinity)",

  // Wrapped BTC / ETH
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh": "WBTC (Wormhole)",
  cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij: "cbBTC (Coinbase Wrapped BTC)",
  "6DNSN2BJsaPFdFFc1zP37kkeNe4Usc1Sqkzr9C9vPWcU": "tBTC",
  zBTCug3er3tLyffELcvDNrKkCymbPWysGcWihESYfLg: "zBTC",
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": "WETH (Wormhole)",

  // Protocol tokens
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "JUP (Jupiter)",
  METvsvVRapdj9cFLzq4Tr43xK4tAjQfwX76z3n6mWQL: "MET (Meteora)",
  jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL: "JTO (Jito)",
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": "RAY (Raydium)",
  HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3: "PYTH (Pyth Network)",
  orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE: "ORCA (Orca)",
  "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ": "W (Wormhole)",
  DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7: "DRIFT (Drift)",
  KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS: "KMNO (Kamino)",
  rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof: "RENDER",
  hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux: "HNT (Helium)",

  // Memecoins
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "BONK",
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: "WIF (dogwifhat)",
  "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN": "TRUMP",
  "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr": "POPCAT",
  MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5: "MEW",
};
