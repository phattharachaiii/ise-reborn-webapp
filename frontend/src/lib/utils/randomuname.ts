export function genUsername() {
    const adj = ['brisk', 'mellow', 'clever', 'swift', 'bright', 'calm', 'cosy', 'eager', 'lively', 'nifty'];
    const noun = ['tiger', 'panda', 'otter', 'falcon', 'koala', 'whale', 'lynx', 'gecko', 'fox', 'monkey'];
    const id = Math.floor(100 + Math.random() * 900);
    const a = adj[Math.floor(Math.random() * adj.length)];
    const n = noun[Math.floor(Math.random() * noun.length)];
    return `${a}-${n}${id}`;
}
