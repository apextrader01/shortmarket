let geoip = null;
try {
  geoip = require('geoip-lite');
} catch (e) {
  // Graceful fallback if geoip-lite is not yet installed
}

let localBannedIps = new Set();
let localBannedPhones = new Set();
let localBannedUsers = new Set();

/**
 * Parse User-Agent string to extract device model, OS, and browser
 */
function parseDeviceDetails(userAgent = '') {
  const ua = userAgent || '';
  const uaLower = ua.toLowerCase();
  
  let deviceModel = 'Desktop PC';
  let osName = 'Unknown OS';
  let browserName = 'Browser';

  // OS & Device Detection
  if (uaLower.includes('windows nt 10.0') || uaLower.includes('windows nt 11.0')) {
    osName = 'Windows 11/10';
    deviceModel = 'Windows PC';
  } else if (uaLower.includes('windows')) {
    osName = 'Windows';
    deviceModel = 'Windows PC';
  } else if (uaLower.includes('macintosh') || uaLower.includes('mac os x')) {
    osName = 'macOS';
    deviceModel = 'MacBook / Mac';
  } else if (uaLower.includes('iphone')) {
    osName = 'iOS';
    deviceModel = 'Apple iPhone';
  } else if (uaLower.includes('ipad')) {
    osName = 'iPadOS';
    deviceModel = 'Apple iPad';
  } else if (uaLower.includes('android')) {
    osName = 'Android';
    deviceModel = 'Android Mobile';

    const match = ua.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      const parts = match[1].split(';').map(p => p.trim());
      for (let p of parts) {
        if (!p.toLowerCase().includes('linux') && !p.toLowerCase().includes('android') && !p.toLowerCase().includes('wv') && !p.toLowerCase().includes('mobile')) {
          const clean = p.replace(/Build\/.*/i, '').trim();
          if (clean.length > 2 && clean.length < 35) {
            deviceModel = clean;
            break;
          }
        }
      }
    }
  } else if (uaLower.includes('linux')) {
    osName = 'Linux';
    deviceModel = 'Linux Desktop';
  }

  // Browser Detection
  if (uaLower.includes('edg/')) {
    browserName = 'Microsoft Edge';
  } else if (uaLower.includes('chrome/') && !uaLower.includes('edg/')) {
    browserName = 'Google Chrome';
  } else if (uaLower.includes('safari/') && !uaLower.includes('chrome/')) {
    browserName = 'Apple Safari';
  } else if (uaLower.includes('firefox/')) {
    browserName = 'Mozilla Firefox';
  } else if (uaLower.includes('opera/') || uaLower.includes('opr/')) {
    browserName = 'Opera';
  }

  return { deviceModel, osName, browserName };
}

/**
 * Extract GeoIP location from IP
 */
function parseIpLocation(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { city: 'Local Network', state: 'Local', country: 'IN' };
  }

  if (!geoip) {
    return { city: 'India', state: '', country: 'IN' };
  }
  
  try {
    const cleanIp = ip.replace(/^::ffff:/, '').trim();
    const geo = geoip.lookup(cleanIp);
    
    if (!geo) {
      return { city: 'India', state: '', country: 'IN' };
    }

    return {
      city: geo.city || geo.region || 'India',
      state: geo.region || '',
      country: geo.country || 'IN'
    };
  } catch (e) {
    return { city: 'India', state: '', country: 'IN' };
  }
}

/**
 * Initialize and sync banned entities into Redis and memory
 */
async function syncBannedEntities(dbInstance, redisClient) {
  try {
    const db = dbInstance || require('../database/db').db;
    const bans = await db('banned_entities').select('type', 'value');
    localBannedIps.clear();
    localBannedPhones.clear();
    localBannedUsers.clear();

    const ipList = [];
    const phoneList = [];

    bans.forEach(b => {
      const type = (b.type || '').toUpperCase();
      const val = (b.value || '').trim();
      if (!val) return;

      if (type === 'IP') {
        localBannedIps.add(val);
        ipList.push(val);
      } else if (type === 'PHONE') {
        localBannedPhones.add(val);
        phoneList.push(val);
      } else if (type === 'USER') {
        localBannedUsers.add(val);
      }
    });

    if (redisClient && redisClient.isOpen) {
      if (ipList.length > 0) {
        await redisClient.del('security:banned_ips');
        await redisClient.sAdd('security:banned_ips', ipList);
      } else {
        await redisClient.del('security:banned_ips');
      }

      if (phoneList.length > 0) {
        await redisClient.del('security:banned_phones');
        await redisClient.sAdd('security:banned_phones', phoneList);
      } else {
        await redisClient.del('security:banned_phones');
      }
    }
  } catch (err) {
    console.error('Failed to sync banned entities:', err);
  }
}

/**
 * Fast check if an IP is banned
 */
async function isIpBanned(ip, redisClient) {
  if (!ip) return false;
  const cleanIp = ip.replace(/^::ffff:/, '').trim();
  
  if (localBannedIps.has(cleanIp)) return true;

  if (redisClient && redisClient.isOpen) {
    try {
      const isMember = await redisClient.sIsMember('security:banned_ips', cleanIp);
      if (isMember) return true;
    } catch (e) {
      // fallback to memory
    }
  }
  return false;
}

/**
 * Fast check if a Phone is banned
 */
async function isPhoneBanned(phone, redisClient) {
  if (!phone) return false;
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  
  if (localBannedPhones.has(cleanPhone) || localBannedPhones.has(phone)) return true;

  if (redisClient && redisClient.isOpen) {
    try {
      const isMember = await redisClient.sIsMember('security:banned_phones', cleanPhone);
      if (isMember) return true;
    } catch (e) {
      // fallback to memory
    }
  }
  return false;
}

module.exports = {
  parseDeviceDetails,
  parseIpLocation,
  syncBannedEntities,
  isIpBanned,
  isPhoneBanned
};
