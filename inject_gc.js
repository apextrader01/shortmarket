const fs = require('fs');
let lines = fs.readFileSync('./backend/services/fyers.js', 'utf8').split('\n');

const gcCode = `
let symbolLastSeen = new Map();
let gcInterval = null;

function handlePingSubscriptions(symbols) {
    if (!Array.isArray(symbols)) return;
    
    const now = Date.now();
    const newSymbols = [];
    
    symbols.forEach(s => {
        if (!s || typeof s !== 'string' || s.endsWith('-MF')) return;
        
        symbolLastSeen.set(s, now);
        
        if (!clientSubscriptions.has(s)) {
            clientSubscriptions.add(s);
            newSymbols.push(s);
        }
    });
    
    // Subscribe to new symbols that we aren't already tracking
    if (newSymbols.length > 0) {
        newSymbols.forEach(s => {
            const fSym = toFyersSymbol(s);
            if (fSym) {
                if (!subQueue.includes(fSym)) subQueue.push(fSym);
                if (!globalFyersToRequested[fSym]) globalFyersToRequested[fSym] = [];
                if (!globalFyersToRequested[fSym].includes(s)) globalFyersToRequested[fSym].push(s);
            }
        });
        
        if (wsInstance && isFyersConnected && subQueue.length > 0) {
            processSubQueue();
        }
    }
    
    // Start GC if not running
    if (!gcInterval) {
        gcInterval = setInterval(garbageCollectSubscriptions, 10000); // Check every 10 seconds
    }
}

function garbageCollectSubscriptions() {
    if (!wsInstance || !isFyersConnected) return;
    
    const now = Date.now();
    const staleFyersSymbols = [];
    
    for (const [symbol, lastSeen] of symbolLastSeen.entries()) {
        // If a symbol hasn't been pinged in 30 seconds by ANY user, unsubscribe it
        if (now - lastSeen > 30000) {
            clientSubscriptions.delete(symbol);
            symbolLastSeen.delete(symbol);
            
            const fSym = toFyersSymbol(symbol);
            if (fSym) {
                if (globalFyersToRequested[fSym]) {
                    globalFyersToRequested[fSym] = globalFyersToRequested[fSym].filter(item => item !== symbol);
                    if (globalFyersToRequested[fSym].length === 0) {
                        delete globalFyersToRequested[fSym];
                        staleFyersSymbols.push(fSym);
                    }
                }
            }
        }
    }
    
    if (staleFyersSymbols.length > 0) {
        console.log('[GC] Unsubscribing ' + staleFyersSymbols.length + ' stale symbols from Fyers...');
        try {
            wsInstance.unsubscribe(staleFyersSymbols);
        } catch(e) {}
    }
}
`;

// Find where to inject (replace the botched removeSubscriptionBatch)
const startIndex = lines.findIndex(l => l.includes('function removeSubscriptionBatch(') || l.includes('let symbolLastSeen = new Map();'));
if (startIndex > -1) {
    let endIndex = startIndex;
    for(let i=startIndex; i<lines.length; i++) {
        // We know the old removeSubscriptionBatch ended around line 430, let's just delete until the next function
        if (i > startIndex + 5 && lines[i].includes('function ')) {
            endIndex = i - 1;
            break;
        }
        if (i === lines.length - 1) endIndex = i;
    }
    
    // Also clear out the dangling catch blocks from the previous failed replace
    while (lines[endIndex].includes('catch') || lines[endIndex].includes('}') || lines[endIndex].trim() === '') {
        if (endIndex <= startIndex) break;
        endIndex++;
        if (endIndex >= lines.length || lines[endIndex].includes('function ')) {
            endIndex--;
            break;
        }
    }
    
    lines.splice(startIndex, endIndex - startIndex + 1, gcCode);
} else {
    // If not found, insert before addSubscriptionBatch
    const addSubIdx = lines.findIndex(l => l.includes('function addSubscriptionBatch('));
    if (addSubIdx > -1) {
        lines.splice(addSubIdx, 0, gcCode);
    }
}

// Clean up any weird dangling brackets between processSubQueue and addSubscriptionBatch
const psqEnd = lines.findIndex(l => l.includes('function processSubQueue()'));
const asbStart = lines.findIndex(l => l.includes('function addSubscriptionBatch(') || l.includes('function handlePingSubscriptions(') || l.includes('let symbolLastSeen'));
if (psqEnd > -1 && asbStart > -1) {
    let insidePsq = false;
    let psqActualEnd = -1;
    for (let i = psqEnd; i < asbStart; i++) {
        if (lines[i].includes('isProcessingSubQueue = false;')) {
            psqActualEnd = i + 2;
            break;
        }
    }
    if (psqActualEnd > -1 && psqActualEnd < asbStart) {
        lines.splice(psqActualEnd, asbStart - psqActualEnd);
    }
}

// Ensure export
const exportIdx = lines.findIndex(l => l.includes('addSubscriptionBatch,'));
if (exportIdx > -1 && !lines.slice(exportIdx, exportIdx + 10).some(l => l.includes('handlePingSubscriptions'))) {
    lines.splice(exportIdx + 1, 0, '    handlePingSubscriptions,');
}

fs.writeFileSync('./backend/services/fyers.js', lines.join('\n'));
