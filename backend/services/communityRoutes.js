const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { generalClient } = require('./redisClient');

const router = express.Router();

// Ensure upload directories exist for the 3-tier storage lifecycle
const UPLOADS_ROOT = path.join(__dirname, '../uploads/community');
const DIRS = {
  PERMANENT: path.join(UPLOADS_ROOT, 'permanent-vault'),
  RETENTION_90D: path.join(UPLOADS_ROOT, 'retention-90d'),
  RETENTION_30D: path.join(UPLOADS_ROOT, 'retention-30d')
};

Object.values(DIRS).forEach(dir => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_) {}
});

// Helper: Determine if a user qualifies for Permanent Forever photo storage
function isPermanentStorageUser(user) {
  if (!user) return false;
  if (Boolean(user.is_admin)) return true;
  const tier = String(user.subscription_tier || 'BASIC').toUpperCase().trim();
  return ['YEARLY', 'HIGHEST', 'FEATURE', 'VIP', 'MASTERCLASS', 'LIFETIME'].includes(tier);
}

function getStoragePolicyForUser(user) {
  if (isPermanentStorageUser(user)) {
    return {
      folder: 'permanent-vault',
      dirPath: DIRS.PERMANENT,
      is_permanent: true,
      retention_tier: 'PERMANENT',
      expires_at: null,
      label: '♾️ Permanent Vault (Never Deleted)'
    };
  }
  const tier = String(user?.subscription_tier || 'BASIC').toUpperCase().trim();
  if (['MONTHLY', 'PRO'].includes(tier)) {
    const exp = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    return {
      folder: 'retention-90d',
      dirPath: DIRS.RETENTION_90D,
      is_permanent: false,
      retention_tier: '90_DAYS',
      expires_at: exp,
      label: '🛡️ 90-Day Pro Retention'
    };
  }
  const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return {
    folder: 'retention-30d',
    dirPath: DIRS.RETENTION_30D,
    is_permanent: false,
    retention_tier: '30_DAYS',
    expires_at: exp,
    label: '⏱️ 30-Day Free Retention'
  };
}

// Default FrontPage-style Clubs
const DEFAULT_CLUBS = [
  // ─── EXPLORING TRADERS ───
  {
    slug: 'all-about-indices',
    name: 'All About Indices',
    category: 'EXPLORING TRADERS',
    description: 'Live NIFTY 50, BANKNIFTY, FINNIFTY, MIDCPNIFTY & SENSEX intraday setups, option chain PCR shifts, and key support/resistance levels.',
    icon: '📊',
    accent_color: '#f59e0b',
    members_count: 3
  },
  {
    slug: 'option-strategies-selling',
    name: 'Option Strategies & Selling',
    category: 'EXPLORING TRADERS',
    description: 'Bull Put Spreads, Iron Condors, Straddles, Theta decay setups, multi-leg payoff structures, and live Greek adjustments.',
    icon: '🎯',
    accent_color: '#ef4444',
    members_count: 2
  },
  {
    slug: 'intraday-stockbusters',
    name: 'Intraday Stockbusters',
    category: 'EXPLORING TRADERS',
    description: 'High-momentum NSE cash & F&O stock breakouts, VWAP pullbacks, ORB setups, and volume surge alerts.',
    icon: '⚡',
    accent_color: '#38bdf8',
    members_count: 2
  },
  {
    slug: 'commodity-central',
    name: 'Commodity Central',
    category: 'EXPLORING TRADERS',
    description: 'MCX Crude Oil, Gold, Silver & Natural Gas evening session price action, inventory data plays, and global macro levels.',
    icon: '🛢️',
    accent_color: '#10b981',
    members_count: 1
  },
  {
    slug: 'smart-investing-wealth',
    name: 'Smart Investing & Wealth Building',
    category: 'EXPLORING TRADERS',
    description: 'Long-term compounding, bluechip & midcap accumulation, portfolio rebalancing, dividend yield, and value investing frameworks.',
    icon: '📈',
    accent_color: '#06b6d4',
    members_count: 2
  },

  // ─── INVESTORS ───
  {
    slug: 'mutual-fund-investing',
    name: 'Mutual Fund Investing',
    category: 'INVESTORS',
    description: 'Direct vs Regular mutual funds, Step-Up SIP compounding, Flexi-Cap, Mid-Cap & Small-Cap long-term portfolio reviews.',
    icon: '🌱',
    accent_color: '#34d399',
    members_count: 2
  },
  {
    slug: 'fundamental-value-picks',
    name: 'Fundamental & Value Picks',
    category: 'INVESTORS',
    description: 'Quarterly earnings breakdowns, >60% Bhavcopy delivery accumulation, ROCE/ROE value picks, and multibagger thesis.',
    icon: '🏛️',
    accent_color: '#818cf8',
    members_count: 1
  },
  {
    slug: 'ipo-primary-markets',
    name: 'IPO & Primary Markets',
    category: 'INVESTORS',
    description: 'Mainboard & SME IPO Grey Market Premium (GMP), QIB/HNI/Retail subscription trends, allotment status & listing day strategies.',
    icon: '🚀',
    accent_color: '#a855f7',
    members_count: 2
  },

  // ─── LANGUAGES ───
  {
    slug: 'hindi-traders-club',
    name: 'Hindi Traders Club',
    category: 'LANGUAGES',
    description: 'हिंदी में निफ्टी, बैंकनिफ्टी, ऑप्शन ट्रेडिंग और शेयर बाजार की लाइव चर्चा और चार्ट विश्लेषण।',
    icon: '🇮🇳',
    accent_color: '#f97316',
    members_count: 2
  },
  {
    slug: 'tamil-traders-club',
    name: 'Tamil Traders Club',
    category: 'LANGUAGES',
    description: 'தமிழ் வர்த்தகர்கள் மற்றும் முதலீட்டாளர்கள் மன்றம் — நிஃப்டி, பேங்க் நிஃப்டி மற்றும் பங்குச்சந்தை விவாதம்.',
    icon: '🔥',
    accent_color: '#ec4899',
    members_count: 2
  },
  {
    slug: 'gujarati-traders-club',
    name: 'Gujarati Traders Club',
    category: 'LANGUAGES',
    description: 'ગુજરાતી ટ્રેડર્સ અને રોકાણકારો માટે ખાસ ક્લબ — નિફ્ટી, બેંકનિફ્ટી, IPO અને સ્ટોક માર્કેટ ચર્ચા.',
    icon: '💎',
    accent_color: '#eab308',
    members_count: 1
  },
  {
    slug: 'telugu-traders-club',
    name: 'Telugu Traders Club',
    category: 'LANGUAGES',
    description: 'తెలుగు ట్రేడర్స్ మరియు ఇన్వెస్టర్స్ కమ్యూనిటీ — నిఫ్టీ, బ్యాంక్ నిఫ్టీ & ఆప్షన్స్ ట్రేడింగ్ విశ్లేషణ.',
    icon: '🌟',
    accent_color: '#06b6d4',
    members_count: 1
  },
  {
    slug: 'kannada-traders-club',
    name: 'Kannada Traders Club',
    category: 'LANGUAGES',
    description: 'ಕನ್ನಡ ಟ್ರೇಡರ್ಸ್ ಕ್ಲಬ್ — ಕರ್ನಾಟಕದ ಷೇರು ಮಾರುಕಟ್ಟೆ, ನಿಫ್ಟಿ, ಬ್ಯಾಂಕ್ ನಿಫ್ಟಿ ಮತ್ತು ಇಂಟ್ರಾಡೇ ವಿಶ್ಲೇಷಣೆ.',
    icon: '⚡',
    accent_color: '#f59e0b',
    members_count: 1
  },
  {
    slug: 'malayalam-traders-club',
    name: 'Malayali Traders Club',
    category: 'LANGUAGES',
    description: 'മലയാളി ട്രേഡേഴ്സ് ക്ലബ് — കേരള ഓഹരി വിപണി, നിഫ്റ്റി & ഓപ്ഷൻസ് തത്സമയ ചർച്ച.',
    icon: '🌴',
    accent_color: '#10b981',
    members_count: 1
  },
  {
    slug: 'seven-sisters-northeast-club',
    name: '7 Sisters North East Club',
    category: 'LANGUAGES',
    description: '7 Sisters North East Traders — Assam, Meghalaya, Manipur, Mizoram, Nagaland, Tripura & Arunachal market community.',
    icon: '🌄',
    accent_color: '#8b5cf6',
    members_count: 1
  }
];

let schemaInitialized = false;

async function ensureCommunitySchema() {
  if (schemaInitialized) return;
  try {
    await db.raw(`
      CREATE TABLE IF NOT EXISTS community_clubs (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'EXPLORING TRADERS',
        description TEXT,
        icon VARCHAR(30) DEFAULT '📊',
        accent_color VARCHAR(30) DEFAULT '#38bdf8',
        members_count INTEGER DEFAULT 100,
        posts_count INTEGER DEFAULT 0,
        last_posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.raw(`
      CREATE TABLE IF NOT EXISTS community_club_members (
        id SERIAL PRIMARY KEY,
        club_id INTEGER NOT NULL REFERENCES community_clubs(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_community_club_member UNIQUE (club_id, user_id)
      )
    `);
    await db.raw('CREATE INDEX IF NOT EXISTS idx_comm_club_members_user ON community_club_members(user_id)').catch(() => {});

    await db.raw(`
      CREATE TABLE IF NOT EXISTS community_follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_community_follow UNIQUE (follower_id, following_id)
      )
    `);
    await db.raw('CREATE INDEX IF NOT EXISTS idx_comm_follows_follower ON community_follows(follower_id)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_comm_follows_following ON community_follows(following_id)').catch(() => {});

    await db.raw(`
      CREATE TABLE IF NOT EXISTS community_posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        club_id INTEGER REFERENCES community_clubs(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        original_size_kb DECIMAL(10,2),
        image_size_kb DECIMAL(10,2),
        retention_tier VARCHAR(30) DEFAULT '30_DAYS',
        is_permanent BOOLEAN DEFAULT FALSE,
        image_expires_at TIMESTAMP,
        trade_setup_json JSONB,
        tags JSONB DEFAULT '[]',
        upvotes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        is_pinned BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.raw('CREATE INDEX IF NOT EXISTS idx_comm_posts_created ON community_posts(created_at DESC)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_comm_posts_club ON community_posts(club_id, created_at DESC)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_comm_posts_user ON community_posts(user_id, created_at DESC)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_comm_posts_expiry ON community_posts(is_permanent, image_expires_at)').catch(() => {});

    await db.raw(`
      CREATE TABLE IF NOT EXISTS community_votes (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_community_vote UNIQUE (post_id, user_id)
      )
    `);
    await db.raw('CREATE INDEX IF NOT EXISTS idx_comm_votes_post ON community_votes(post_id)').catch(() => {});
    await db.raw('CREATE INDEX IF NOT EXISTS idx_comm_votes_user ON community_votes(user_id)').catch(() => {});

    await db.raw(`
      CREATE TABLE IF NOT EXISTS community_comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.raw('CREATE INDEX IF NOT EXISTS idx_comm_comments_post ON community_comments(post_id, created_at ASC)').catch(() => {});

    // Seed / Sync Default Clubs
    for (const club of DEFAULT_CLUBS) {
      const existing = await db('community_clubs').where({ slug: club.slug }).first().catch(() => null);
      if (!existing) {
        await db('community_clubs')
          .insert({
            slug: club.slug,
            name: club.name,
            category: club.category,
            description: club.description,
            icon: club.icon,
            accent_color: club.accent_color,
            members_count: club.members_count || 1,
            last_posted_at: new Date()
          })
          .catch(() => {});
      } else {
        await db('community_clubs').where({ slug: club.slug }).update({
          name: club.name,
          category: club.category,
          description: club.description,
          icon: club.icon,
          accent_color: club.accent_color
        }).catch(() => {});
      }
    }

    // Reset inflated fake member counts to actual real member counts from community_club_members
    try {
      const memberCountRows = await db('community_club_members')
        .groupBy('club_id')
        .select('club_id')
        .count('id as cnt')
        .catch(() => []);
      const countMap = {};
      (memberCountRows || []).forEach(r => {
        countMap[Number(r.club_id)] = parseInt(r.cnt || 0, 10);
      });
      const allClubs = await db('community_clubs').select('id', 'members_count').catch(() => []);
      for (const c of (allClubs || [])) {
        const realCount = Math.max(1, countMap[Number(c.id)] || 1);
        if (Number(c.members_count) > 100 || countMap[Number(c.id)] !== undefined) {
          await db('community_clubs').where({ id: c.id }).update({ members_count: realCount }).catch(() => {});
        }
      }
    } catch (_) {}

    // Seed initial high-signal community posts if table is empty
    const postCountRow = await db('community_posts').count('id as cnt').first().catch(() => null);
    if (postCountRow && parseInt(postCountRow.cnt || 0, 10) === 0) {
      const firstUser = await db('users').orderBy('is_admin', 'desc').orderBy('id', 'asc').first().catch(() => null);
      if (firstUser) {
        const clubs = await db('community_clubs').select('id', 'slug');
        const clubMap = {};
        clubs.forEach(c => { clubMap[c.slug] = c.id; });

        const seedPosts = [
          {
            user_id: firstUser.id,
            club_id: clubMap['option-strategies-selling'] || null,
            content: 'Bull Put Spread deployed on #ICICIBANK for monthly expiry. Strong institutional support near 1180 zone with high Put OI buildup and rising IV rank. Defined risk setup with favorable theta decay! 📊🔥',
            is_permanent: true,
            retention_tier: 'PERMANENT',
            trade_setup_json: JSON.stringify({
              symbol: 'NSE:ICICIBANK-EQ',
              strategy: 'BULL PUT SPREAD • 28 OCT EXPIRY',
              side: 'BULLISH',
              legs: [
                { side: 'BUY', lots: '1 LOT', type: 'PE', strike: '1180', price: '26.5' },
                { side: 'SELL', lots: '1 LOT', type: 'PE', strike: '1140', price: '14.0' }
              ],
              maxProfit: '₹8,750',
              maxLoss: '₹19,250',
              lotSize: '700',
              margin: '₹42,800'
            }),
            tags: JSON.stringify(['ICICIBANK', 'NIFTY50', 'OPTIONS']),
            upvotes_count: 24,
            comments_count: 0,
            is_pinned: true,
            created_at: new Date(Date.now() - 45 * 60 * 1000)
          },
          {
            user_id: firstUser.id,
            club_id: clubMap['all-about-indices'] || null,
            content: 'Good morning traders! 🌍\n\n#NIFTY50 key levels for today’s session:\n• Immediate Support: 24,880 – 24,920\n• Major Resistance: 25,120 – 25,180\n• #BANKNIFTY holding above 51,350 VWAP zone keeps bulls in control. Watch 15-min ORB breakout with volume confirmation before initiating directional lots.',
            is_permanent: true,
            retention_tier: 'PERMANENT',
            trade_setup_json: JSON.stringify({
              symbol: 'NSE:NIFTY50-INDEX',
              strategy: 'INTRADAY INDEX LEVELS',
              side: 'BUY',
              legs: [
                { side: 'BUY', lots: '2 LOTS', type: 'CE', strike: '25000', price: '142.0' }
              ],
              entryPrice: '142.00',
              targetPrice: '195.00',
              stopLoss: '115.00',
              maxProfit: '₹7,950',
              maxLoss: '₹4,050',
              lotSize: '75',
              margin: '₹21,300'
            }),
            tags: JSON.stringify(['NIFTY50', 'BANKNIFTY']),
            upvotes_count: 19,
            comments_count: 0,
            is_pinned: false,
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000)
          },
          {
            user_id: firstUser.id,
            club_id: clubMap['intraday-stockbusters'] || null,
            content: '#RELIANCE and #TCS showing strong >62% delivery accumulation in the latest Bhavcopy screener along with multi-day consolidation breakout above 20-EMA. Keeping both on radar for intraday & swing continuation! ⚡📈',
            is_permanent: true,
            retention_tier: 'PERMANENT',
            trade_setup_json: null,
            tags: JSON.stringify(['RELIANCE', 'TCS']),
            upvotes_count: 14,
            comments_count: 0,
            is_pinned: false,
            created_at: new Date(Date.now() - 4 * 60 * 60 * 1000)
          }
        ];

        for (const sp of seedPosts) {
          await db('community_posts').insert(sp).catch(() => {});
        }
      }
    }

    schemaInitialized = true;
  } catch (err) {
    console.warn('[Community] Schema init note:', err.message);
  }
}

async function invalidateCommunityCache() {
  try {
    if (generalClient && generalClient.isReady) {
      const keys = await generalClient.keys('community:feed:*');
      if (keys && keys.length > 0) {
        await generalClient.del(keys);
      }
    }
  } catch (_) {}
}

// Helper: Extract #SYMBOL or #TAG hashtags from post text
function extractHashtags(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(/#([A-Za-z0-9_:-]{2,30})/g) || [];
  const unique = new Set();
  matches.forEach(m => {
    const clean = m.slice(1).toUpperCase().trim();
    if (clean) unique.add(clean);
  });
  return Array.from(unique).slice(0, 12);
}

// ─── 1. GET /api/community/clubs ──────────────────────────────────────────────
router.get('/clubs', authenticateToken, async (req, res) => {
  try {
    await ensureCommunitySchema();
    const userId = req.user.id;

    const [clubs, memberships, userRow, memberCounts] = await Promise.all([
      db('community_clubs').orderBy('id', 'asc'),
      db('community_club_members').where({ user_id: userId }).select('club_id'),
      db('users').where({ id: userId }).select('id', 'subscription_tier', 'is_admin').first(),
      db('community_club_members').groupBy('club_id').select('club_id').count('id as cnt').catch(() => [])
    ]);

    const countMap = {};
    (memberCounts || []).forEach(r => {
      countMap[Number(r.club_id)] = parseInt(r.cnt || 0, 10);
    });

    let joinedIds = new Set(memberships.map(m => Number(m.club_id)));

    // Auto-join the top 3 default trader clubs if user hasn't joined any yet
    if (joinedIds.size === 0 && clubs.length > 0) {
      const defaultJoin = clubs.slice(0, 3);
      for (const c of defaultJoin) {
        await db('community_club_members')
          .insert({ club_id: c.id, user_id: userId })
          .onConflict(['club_id', 'user_id'])
          .ignore()
          .catch(() => {});
        joinedIds.add(Number(c.id));
        countMap[Number(c.id)] = (countMap[Number(c.id)] || 0) + 1;
      }
    }

    const formatted = clubs.map(c => {
      const isJoined = joinedIds.has(Number(c.id));
      const realCount = countMap[Number(c.id)] !== undefined 
        ? countMap[Number(c.id)] 
        : (isJoined ? 1 : Math.max(0, Number(c.members_count || 0)));
      return {
        ...c,
        members_count: Math.min(realCount, 50), // Real organic member count
        posts_count: Number(c.posts_count || 0),
        is_joined: isJoined
      };
    });

    const storagePolicy = getStoragePolicyForUser(userRow || req.user);

    res.json({
      success: true,
      clubs: formatted,
      storage_policy: {
        is_permanent: storagePolicy.is_permanent,
        retention_tier: storagePolicy.retention_tier,
        label: storagePolicy.label
      }
    });
  } catch (err) {
    console.error('[Community] GET /clubs error:', err.message);
    res.status(500).json({ error: 'Failed to load community clubs' });
  }
});

// ─── 2. POST /api/community/clubs/:id/toggle-join ─────────────────────────────
router.post('/clubs/:id/toggle-join', authenticateToken, async (req, res) => {
  try {
    await ensureCommunitySchema();
    const clubId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    if (!clubId) return res.status(400).json({ error: 'Invalid club ID' });

    const existing = await db('community_club_members').where({ club_id: clubId, user_id: userId }).first();
    let isJoined = false;

    if (existing) {
      await db('community_club_members').where({ id: existing.id }).del();
      await db('community_clubs').where({ id: clubId }).decrement('members_count', 1).catch(() => {});
      isJoined = false;
    } else {
      await db('community_club_members').insert({ club_id: clubId, user_id: userId });
      await db('community_clubs').where({ id: clubId }).increment('members_count', 1).catch(() => {});
      isJoined = true;
    }

    const updatedClub = await db('community_clubs').where({ id: clubId }).first();
    res.json({
      success: true,
      is_joined: isJoined,
      members_count: Number(updatedClub?.members_count || 0)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update club membership' });
  }
});

// ─── 3. GET /api/community/feed ───────────────────────────────────────────────
router.get('/feed', authenticateToken, async (req, res) => {
  try {
    await ensureCommunitySchema();
    const userId = req.user.id;
    const targetPostId = req.query.post_id ? parseInt(req.query.post_id, 10) : null;
    const postIdsParam = req.query.post_ids
      ? String(req.query.post_ids).split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id) && id > 0)
      : null;
    const tab = String(req.query.tab || 'hot').toLowerCase(); // 'hot' | 'new' | 'following' | 'saved'
    const clubId = req.query.club_id ? parseInt(req.query.club_id, 10) : null;
    const tagFilter = req.query.tag ? String(req.query.tag).replace(/^#/, '').toUpperCase().trim() : '';
    const search = req.query.search ? String(req.query.search).trim() : '';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(30, Math.max(5, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;

    // Fast-path: If user requests 'saved' tab but has no saved IDs, return empty immediately
    if (tab === 'saved' && (!postIdsParam || postIdsParam.length === 0)) {
      return res.json({ success: true, posts: [], has_more: false, page: 1, total: 0 });
    }

    let query = db('community_posts as p')
      .join('users as u', 'p.user_id', 'u.id')
      .leftJoin('community_clubs as c', 'p.club_id', 'c.id')
      .select(
        'p.id',
        'p.user_id',
        'p.club_id',
        'p.content',
        'p.image_url',
        'p.original_size_kb',
        'p.image_size_kb',
        'p.retention_tier',
        'p.is_permanent',
        'p.image_expires_at',
        'p.trade_setup_json',
        'p.tags',
        'p.upvotes_count',
        'p.comments_count',
        'p.is_pinned',
        'p.created_at',
        'u.username',
        'u.client_id',
        'u.profile_picture_url',
        'u.subscription_tier',
        'u.is_admin',
        'c.name as club_name',
        'c.slug as club_slug',
        'c.icon as club_icon',
        'c.accent_color as club_color'
      );

    if (targetPostId) {
      query = query.where('p.id', targetPostId);
    } else if (postIdsParam && postIdsParam.length > 0) {
      query = query.whereIn('p.id', postIdsParam);
    }

    if (clubId) {
      query = query.where('p.club_id', clubId);
    }

    if (tab === 'following') {
      const followingRows = await db('community_follows').where({ follower_id: userId }).select('following_id');
      const followingIds = followingRows.map(r => r.following_id);
      followingIds.push(userId); // Include user's own posts in Following feed
      query = query.whereIn('p.user_id', followingIds);
    }

    if (tagFilter) {
      query = query.where(function() {
        this.whereRaw('p.content ILIKE ?', [`%#${tagFilter}%`])
          .orWhereRaw('p.content ILIKE ?', [`%${tagFilter}%`])
          .orWhereRaw('CAST(p.tags AS TEXT) ILIKE ?', [`%${tagFilter}%`])
          .orWhereRaw('CAST(p.trade_setup_json AS TEXT) ILIKE ?', [`%${tagFilter}%`]);
      });
    }

    if (search) {
      const s = `%${search}%`;
      query = query.where(function() {
        this.where('p.content', 'ilike', s)
          .orWhere('u.username', 'ilike', s)
          .orWhere('c.name', 'ilike', s)
          .orWhereRaw('CAST(p.tags AS TEXT) ILIKE ?', [s])
          .orWhereRaw('CAST(p.trade_setup_json AS TEXT) ILIKE ?', [s]);
      });
    }

    if (tab === 'hot') {
      // Hot algorithm: Pinned first, then engagement score weighted by recency
      query = query
        .orderBy('p.is_pinned', 'desc')
        .orderByRaw('(COALESCE(p.upvotes_count, 0) * 3 + COALESCE(p.comments_count, 0) * 4) DESC')
        .orderBy('p.created_at', 'desc');
    } else {
      // 'new' or 'following'
      query = query
        .orderBy('p.is_pinned', 'desc')
        .orderBy('p.created_at', 'desc');
    }

    const posts = await query.limit(limit).offset(offset);

    const postIds = posts.map(p => p.id);
    const authorIds = Array.from(new Set(posts.map(p => p.user_id)));

    const [userVotes, userFollows] = await Promise.all([
      postIds.length > 0
        ? db('community_votes').where({ user_id: userId }).whereIn('post_id', postIds).select('post_id')
        : [],
      authorIds.length > 0
        ? db('community_follows').where({ follower_id: userId }).whereIn('following_id', authorIds).select('following_id')
        : []
    ]);

    const votedSet = new Set(userVotes.map(v => Number(v.post_id)));
    const followingSet = new Set(userFollows.map(f => Number(f.following_id)));

    const formattedPosts = posts.map(p => {
      let parsedSetup = null;
      if (p.trade_setup_json) {
        try {
          parsedSetup = typeof p.trade_setup_json === 'string' ? JSON.parse(p.trade_setup_json) : p.trade_setup_json;
        } catch (_) {}
      }
      let parsedTags = [];
      if (p.tags) {
        try {
          parsedTags = typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags;
        } catch (_) {}
      }

      // Check if non-permanent image has expired
      let activeImageUrl = p.image_url;
      if (activeImageUrl && !p.is_permanent && p.image_expires_at && new Date(p.image_expires_at) < new Date()) {
        activeImageUrl = null;
      }

      return {
        id: p.id,
        user_id: p.user_id,
        username: p.username,
        client_id: p.client_id,
        profile_picture_url: p.profile_picture_url,
        subscription_tier: p.subscription_tier || 'BASIC',
        is_admin: Boolean(p.is_admin),
        club_id: p.club_id,
        club_name: p.club_name || 'All About Indices',
        club_slug: p.club_slug || 'all-about-indices',
        club_icon: p.club_icon || '📊',
        club_color: p.club_color || '#38bdf8',
        content: p.content,
        image_url: activeImageUrl,
        original_size_kb: p.original_size_kb ? Number(p.original_size_kb) : null,
        image_size_kb: p.image_size_kb ? Number(p.image_size_kb) : null,
        retention_tier: p.retention_tier || (p.is_permanent ? 'PERMANENT' : '30_DAYS'),
        is_permanent: Boolean(p.is_permanent),
        image_expires_at: p.image_expires_at,
        trade_setup: parsedSetup,
        tags: Array.isArray(parsedTags) ? parsedTags : [],
        upvotes_count: Number(p.upvotes_count || 0),
        comments_count: Number(p.comments_count || 0),
        is_pinned: Boolean(p.is_pinned),
        has_voted: votedSet.has(Number(p.id)),
        is_following: followingSet.has(Number(p.user_id)),
        created_at: p.created_at
      };
    });

    res.json({
      success: true,
      posts: formattedPosts,
      page,
      has_more: posts.length === limit
    });
  } catch (err) {
    console.error('[Community] GET /feed error:', err.message);
    res.status(500).json({ error: 'Failed to load community feed' });
  }
});

// ─── 4. POST /api/community/upload-image (Ultra-Compressed ~40KB WebP Vault) ─
router.post('/upload-image', authenticateToken, async (req, res) => {
  try {
    await ensureCommunitySchema();
    const { image_base64, original_size_kb } = req.body || {};
    if (!image_base64 || typeof image_base64 !== 'string') {
      return res.status(400).json({ error: 'Compressed WebP image data is required' });
    }

    const base64Clean = image_base64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    // Adaptive size ceiling (Browser adaptive compressor targets <= 42 KB WebP, allow up to 500 KB)
    const sizeKb = Math.round((buffer.length / 1024) * 100) / 100;
    if (buffer.length > 500 * 1024) {
      return res.status(413).json({
        error: `Image payload (${sizeKb} KB) exceeds the 500 KB upload limit. Please select or compress the image.`
      });
    }

    const userRow = await db('users')
      .where({ id: req.user.id })
      .select('id', 'username', 'subscription_tier', 'is_admin')
      .first();

    const policy = getStoragePolicyForUser(userRow || req.user);
    const filename = `skx_${req.user.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webp`;
    const fullPath = path.join(policy.dirPath, filename);

    await fs.promises.writeFile(fullPath, buffer);

    const imageUrl = `/uploads/community/${policy.folder}/${filename}`;

    res.json({
      success: true,
      image_url: imageUrl,
      size_kb: sizeKb,
      original_size_kb: original_size_kb ? Number(original_size_kb) : sizeKb,
      is_permanent: policy.is_permanent,
      retention_tier: policy.retention_tier,
      expires_at: policy.expires_at,
      policy_label: policy.label
    });
  } catch (err) {
    console.error('[Community] POST /upload-image error:', err.message);
    res.status(500).json({ error: 'Failed to store compressed WebP image' });
  }
});

// ─── 5. POST /api/community/posts ─────────────────────────────────────────────
router.post('/posts', authenticateToken, async (req, res) => {
  try {
    await ensureCommunitySchema();
    const {
      club_id,
      content,
      image_url,
      original_size_kb,
      image_size_kb,
      trade_setup
    } = req.body || {};

    const cleanContent = String(content || '').trim();
    if (!cleanContent && !image_url && !trade_setup) {
      return res.status(400).json({ error: 'Post content, chart screenshot, or trade setup is required.' });
    }
    if (cleanContent.length > 3000) {
      return res.status(400).json({ error: 'Post content cannot exceed 3,000 characters.' });
    }

    const userRow = await db('users')
      .where({ id: req.user.id })
      .select('id', 'username', 'client_id', 'profile_picture_url', 'subscription_tier', 'is_admin')
      .first();

    if (!userRow) return res.status(404).json({ error: 'User not found' });

    const policy = getStoragePolicyForUser(userRow);
    const tags = extractHashtags(cleanContent);
    if (trade_setup && trade_setup.symbol) {
      const cleanSym = String(trade_setup.symbol).replace(/^(NSE:|BSE:|MCX:)/i, '').replace(/-(EQ|INDEX|FUT)$/i, '').toUpperCase();
      if (cleanSym && !tags.includes(cleanSym)) tags.unshift(cleanSym);
    }

    let resolvedClubId = club_id ? parseInt(club_id, 10) : null;
    if (!resolvedClubId) {
      const defaultClub = await db('community_clubs').where({ slug: 'all-about-indices' }).first();
      if (defaultClub) resolvedClubId = defaultClub.id;
    }

    // Validate image_url is strictly from our community uploads folder
    let safeImageUrl = null;
    if (image_url && typeof image_url === 'string' && image_url.startsWith('/uploads/community/')) {
      safeImageUrl = image_url.trim();
    }

    const [inserted] = await db('community_posts')
      .insert({
        user_id: userRow.id,
        club_id: resolvedClubId,
        content: cleanContent,
        image_url: safeImageUrl,
        original_size_kb: original_size_kb ? Number(original_size_kb) : null,
        image_size_kb: image_size_kb ? Number(image_size_kb) : null,
        retention_tier: safeImageUrl ? policy.retention_tier : null,
        is_permanent: safeImageUrl ? policy.is_permanent : true,
        image_expires_at: safeImageUrl ? policy.expires_at : null,
        trade_setup_json: trade_setup ? JSON.stringify(trade_setup) : null,
        tags: JSON.stringify(tags),
        upvotes_count: 1, // Self-upvote on creation
        comments_count: 0,
        is_pinned: false,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    if (inserted && inserted.id) {
      await db('community_votes')
        .insert({ post_id: inserted.id, user_id: userRow.id })
        .onConflict(['post_id', 'user_id'])
        .ignore()
        .catch(() => {});
    }

    if (resolvedClubId) {
      await db('community_clubs')
        .where({ id: resolvedClubId })
        .update({
          posts_count: db.raw('COALESCE(posts_count, 0) + 1'),
          last_posted_at: new Date()
        })
        .catch(() => {});
    }

    await invalidateCommunityCache();

    const clubInfo = resolvedClubId ? await db('community_clubs').where({ id: resolvedClubId }).first() : null;

    res.json({
      success: true,
      post: {
        id: inserted.id,
        user_id: userRow.id,
        username: userRow.username,
        client_id: userRow.client_id,
        profile_picture_url: userRow.profile_picture_url,
        subscription_tier: userRow.subscription_tier || 'BASIC',
        is_admin: Boolean(userRow.is_admin),
        club_id: resolvedClubId,
        club_name: clubInfo?.name || 'All About Indices',
        club_slug: clubInfo?.slug || 'all-about-indices',
        club_icon: clubInfo?.icon || '📊',
        club_color: clubInfo?.accent_color || '#38bdf8',
        content: inserted.content,
        image_url: inserted.image_url,
        original_size_kb: inserted.original_size_kb ? Number(inserted.original_size_kb) : null,
        image_size_kb: inserted.image_size_kb ? Number(inserted.image_size_kb) : null,
        retention_tier: inserted.retention_tier,
        is_permanent: Boolean(inserted.is_permanent),
        image_expires_at: inserted.image_expires_at,
        trade_setup: trade_setup || null,
        tags,
        upvotes_count: 1,
        comments_count: 0,
        is_pinned: false,
        has_voted: true,
        is_following: false,
        created_at: inserted.created_at
      }
    });
  } catch (err) {
    console.error('[Community] POST /posts error:', err.message);
    res.status(500).json({ error: 'Failed to publish post' });
  }
});

// ─── 6. POST /api/community/posts/:id/vote ────────────────────────────────────
router.post('/posts/:id/vote', authenticateToken, async (req, res) => {
  try {
    await ensureCommunitySchema();
    const postId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    if (!postId) return res.status(400).json({ error: 'Invalid post ID' });

    const existing = await db('community_votes').where({ post_id: postId, user_id: userId }).first();
    let hasVoted = false;

    if (existing) {
      await db('community_votes').where({ id: existing.id }).del();
      await db('community_posts')
        .where({ id: postId })
        .update({ upvotes_count: db.raw('GREATEST(0, COALESCE(upvotes_count, 1) - 1)') });
      hasVoted = false;
    } else {
      await db('community_votes').insert({ post_id: postId, user_id: userId });
      await db('community_posts')
        .where({ id: postId })
        .update({ upvotes_count: db.raw('COALESCE(upvotes_count, 0) + 1') });
      hasVoted = true;
    }

    const updated = await db('community_posts').where({ id: postId }).select('upvotes_count').first();
    res.json({
      success: true,
      has_voted: hasVoted,
      upvotes_count: Number(updated?.upvotes_count || 0)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to vote on post' });
  }
});

// ─── 7. GET & POST /api/community/posts/:id/comments ──────────────────────────
router.get('/posts/:id/comments', authenticateToken, async (req, res) => {
  try {
    await ensureCommunitySchema();
    const postId = parseInt(req.params.id, 10);
    if (!postId) return res.status(400).json({ error: 'Invalid post ID' });

    const comments = await db('community_comments as c')
      .join('users as u', 'c.user_id', 'u.id')
      .where('c.post_id', postId)
      .select(
        'c.id',
        'c.post_id',
        'c.user_id',
        'c.content',
        'c.created_at',
        'u.username',
        'u.profile_picture_url',
        'u.subscription_tier',
        'u.is_admin'
      )
      .orderBy('c.created_at', 'asc')
      .limit(100);

    res.json({ success: true, comments });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

router.post('/posts/:id/comments', authenticateToken, async (req, res) => {
  try {
    await ensureCommunitySchema();
    const postId = parseInt(req.params.id, 10);
    const content = String(req.body?.content || '').trim();
    if (!postId || !content) return res.status(400).json({ error: 'Comment cannot be empty' });
    if (content.length > 1000) return res.status(400).json({ error: 'Comment too long (max 1000 chars)' });

    const [inserted] = await db('community_comments')
      .insert({
        post_id: postId,
        user_id: req.user.id,
        content,
        created_at: new Date()
      })
      .returning('*');

    await db('community_posts')
      .where({ id: postId })
      .update({ comments_count: db.raw('COALESCE(comments_count, 0) + 1') });

    const userRow = await db('users')
      .where({ id: req.user.id })
      .select('username', 'profile_picture_url', 'subscription_tier', 'is_admin')
      .first();

    res.json({
      success: true,
      comment: {
        id: inserted.id,
        post_id: postId,
        user_id: req.user.id,
        content: inserted.content,
        created_at: inserted.created_at,
        username: userRow?.username || req.user.username,
        profile_picture_url: userRow?.profile_picture_url || null,
        subscription_tier: userRow?.subscription_tier || 'BASIC',
        is_admin: Boolean(userRow?.is_admin)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// ─── 8. POST /api/community/users/:id/toggle-follow ───────────────────────────
router.post('/users/:id/toggle-follow', authenticateToken, async (req, res) => {
  try {
    await ensureCommunitySchema();
    const targetUserId = parseInt(req.params.id, 10);
    const followerId = req.user.id;
    if (!targetUserId || targetUserId === followerId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const existing = await db('community_follows')
      .where({ follower_id: followerId, following_id: targetUserId })
      .first();

    let isFollowing = false;
    if (existing) {
      await db('community_follows').where({ id: existing.id }).del();
      isFollowing = false;
    } else {
      await db('community_follows').insert({ follower_id: followerId, following_id: targetUserId });
      isFollowing = true;
    }

    res.json({ success: true, is_following: isFollowing });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update follow status' });
  }
});

// ─── 9. DELETE /api/community/posts/:id & PIN (Owner or Admin) ───────────────
router.delete('/posts/:id', authenticateToken, async (req, res) => {
  try {
    await ensureCommunitySchema();
    const postId = parseInt(req.params.id, 10);
    const post = await db('community_posts').where({ id: postId }).first();
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const caller = await db('users').where({ id: req.user.id }).select('id', 'is_admin').first();
    if (post.user_id !== req.user.id && !caller?.is_admin) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    // Delete associated image file if user explicitly deletes the post
    if (post.image_url && post.image_url.startsWith('/uploads/community/')) {
      const rel = post.image_url.replace('/uploads/community/', '');
      const fullPath = path.join(UPLOADS_ROOT, rel);
      fs.promises.unlink(fullPath).catch(() => {});
    }

    await db('community_posts').where({ id: postId }).del();
    await invalidateCommunityCache();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

router.post('/posts/:id/pin', authenticateToken, async (req, res) => {
  try {
    await ensureCommunitySchema();
    const caller = await db('users').where({ id: req.user.id }).select('id', 'is_admin').first();
    if (!caller?.is_admin) {
      return res.status(403).json({ error: 'Admin privileges required to pin posts' });
    }
    const postId = parseInt(req.params.id, 10);
    const post = await db('community_posts').where({ id: postId }).first();
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const nextPinned = !post.is_pinned;
    await db('community_posts').where({ id: postId }).update({ is_pinned: nextPinned });
    await invalidateCommunityCache();

    res.json({ success: true, is_pinned: nextPinned });
  } catch (err) {
    res.status(500).json({ error: 'Failed to pin post' });
  }
});

// ─── 10. Background Tiered Storage Cleanup Sweeper (Preserves Yearly/Lifetime/Admin Forever!) ───
async function sweepExpiredCommunityImages() {
  try {
    await ensureCommunitySchema();
    const now = new Date();

    // Only select posts where is_permanent = FALSE and image_expires_at < NOW()
    // NEVER touch Yearly, Lifetime, VIP, Masterclass, or Admin posts!
    const expiredPosts = await db('community_posts as p')
      .join('users as u', 'p.user_id', 'u.id')
      .where('p.is_permanent', false)
      .whereNotNull('p.image_url')
      .whereNotNull('p.image_expires_at')
      .where('p.image_expires_at', '<', now)
      .select(
        'p.id',
        'p.image_url',
        'p.user_id',
        'u.subscription_tier',
        'u.is_admin'
      )
      .limit(200);

    let purgedCount = 0;
    for (const post of expiredPosts) {
      // Double safety guard: if user upgraded to Yearly / Lifetime / VIP / Admin after posting, promote to Permanent Vault!
      if (isPermanentStorageUser(post)) {
        await db('community_posts')
          .where({ id: post.id })
          .update({ is_permanent: true, retention_tier: 'PERMANENT', image_expires_at: null });
        continue;
      }

      // Never delete anything inside permanent-vault
      if (post.image_url && !post.image_url.includes('permanent-vault') && post.image_url.startsWith('/uploads/community/')) {
        const rel = post.image_url.replace('/uploads/community/', '');
        const filePath = path.join(UPLOADS_ROOT, rel);
        await fs.promises.unlink(filePath).catch(() => {});
      }

      await db('community_posts')
        .where({ id: post.id })
        .update({ image_url: null });
      purgedCount++;
    }

    if (purgedCount > 0) {
      console.log(`🧹 [Community Storage Sweeper] Purged ${purgedCount} expired 30d/90d images (All Yearly/Lifetime/Admin images permanently preserved).`);
    }
  } catch (err) {
    console.warn('[Community Storage Sweeper] Error:', err.message);
  }
}

// Run cleanup every 6 hours
setInterval(sweepExpiredCommunityImages, 6 * 60 * 60 * 1000).unref();
setTimeout(sweepExpiredCommunityImages, 45000).unref();

module.exports = {
  communityRouter: router,
  ensureCommunitySchema,
  UPLOADS_ROOT
};
