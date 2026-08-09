const { createClient } = require('redis');

async function test() {
    const client = createClient();
    await client.connect();
    
    const luaScript = `
        local results = {}
        
        -- Buy Limit (Execute if LTP <= Target) -> Score >= LTP
        local buy_limits = redis.call('ZRANGEBYSCORE', KEYS[1], ARGV[1], '+inf')
        if #buy_limits > 0 then
            redis.call('ZREMRANGEBYSCORE', KEYS[1], ARGV[1], '+inf')
            for i=1, #buy_limits do table.insert(results, buy_limits[i]) end
        end
        
        -- Sell Limit (Execute if LTP >= Target) -> Score <= LTP
        local sell_limits = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', ARGV[1])
        if #sell_limits > 0 then
            redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[1])
            for i=1, #sell_limits do table.insert(results, sell_limits[i]) end
        end
        
        -- GTE Triggers (Execute if LTP >= Trigger) -> Score <= LTP
        local gte_triggers = redis.call('ZRANGEBYSCORE', KEYS[3], '-inf', ARGV[1])
        if #gte_triggers > 0 then
            redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', ARGV[1])
            for i=1, #gte_triggers do table.insert(results, gte_triggers[i]) end
        end
        
        -- LTE Triggers (Execute if LTP <= Trigger) -> Score >= LTP
        local lte_triggers = redis.call('ZRANGEBYSCORE', KEYS[4], ARGV[1], '+inf')
        if #lte_triggers > 0 then
            redis.call('ZREMRANGEBYSCORE', KEYS[4], ARGV[1], '+inf')
            for i=1, #lte_triggers do table.insert(results, lte_triggers[i]) end
        end
        
        return results
    `;
    
    try {
        console.log("Loading script...");
        const sha = await client.scriptLoad(luaScript);
        console.log("Script loaded successfully, syntax is valid! SHA: " + sha);
    } catch(err) {
        console.error("Syntax Error: ", err);
    }
    
    process.exit(0);
}

test();
