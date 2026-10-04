#!/usr/bin/env node
/**
 * SkandX VM Environment & API Key Security Inspector
 * Run on your VM from the project root:
 *   node backend/scripts/check_env_security.js
 *   node backend/scripts/check_env_security.js --show-values   (to see full unmasked values)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const showFull = process.argv.includes('--show-values') || process.argv.includes('--unmasked');
const rootDir = path.resolve(__dirname, '../..');
const backendDir = path.resolve(__dirname, '..');
const frontendDir = path.resolve(rootDir, 'frontend');

function maskValue(key, val) {
  if (!val) return '(empty)';
  const str = String(val).trim();
  if (!str) return '(empty)';
  if (showFull) return str;
  // Non-sensitive keys can be shown in full
  if (/^(PORT|NODE_ENV|FIREBASE_PROJECT_ID|VITE_FIREBASE_PROJECT_ID|VITE_FIREBASE_AUTH_DOMAIN|RAZORPAY_PLAN_ID)/i.test(key)) {
    return str;
  }
  if (str.length <= 8) return str.slice(0, 2) + '••••';
  return `${str.slice(0, 4)}••••${str.slice(-4)} (${str.length} chars)`;
}

function parseEnvFile(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const k = line.slice(0, eqIdx).trim();
    const v = line.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    vars[k] = v;
  }
  return vars;
}

console.log('\n========================================================================');
console.log('🔐 SKANDX VM ENVIRONMENT, API KEYS & SECRETS AUDIT');
console.log('========================================================================');

try {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
  const commit = execSync('git rev-parse --short HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
  console.log(`📂 Directory : ${rootDir}`);
  console.log(`🌿 Git Branch: ${branch} (commit: ${commit})`);
} catch (_) {
  console.log(`📂 Directory : ${rootDir}`);
}

// 1. Check backend/.env
console.log('\n------------------------------------------------------------------------');
console.log('1️⃣  BACKEND ENVIRONMENT FILE (backend/.env)');
console.log('------------------------------------------------------------------------');
const backendEnvPath = path.join(backendDir, '.env');
const backendVars = parseEnvFile(backendEnvPath);

const expectedBackendKeys = [
  'PORT',
  'NODE_ENV',
  'DATABASE_URL',
  'JWT_SECRET',
  'GEMINI_API_KEY',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_API_KEY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_PLAN_ID_MONTHLY',
  'RAZORPAY_PLAN_ID_YEARLY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'FYERS_APP_ID',
  'FYERS_SECRET_ID'
];

if (!backendVars) {
  console.log('❌ backend/.env DOES NOT EXIST in this folder!');
} else {
  const allKeys = Array.from(new Set([...expectedBackendKeys, ...Object.keys(backendVars)]));
  for (const key of allKeys) {
    const val = backendVars[key];
    const isPlaceholder = val && /your_real_|replace_with_|placeholder/i.test(val);
    if (val && !isPlaceholder) {
      console.log(`  ✅ ${key.padEnd(26)} = ${maskValue(key, val)}`);
    } else if (isPlaceholder) {
      console.log(`  ⚠️  ${key.padEnd(26)} = [PLACEHOLDER: ${val}]`);
    } else {
      console.log(`  ⚪ ${key.padEnd(26)} = (not set in backend/.env)`);
    }
  }
}

// 2. Check frontend/.env and frontend/.env.production
console.log('\n------------------------------------------------------------------------');
console.log('2️⃣  FRONTEND ENVIRONMENT FILES (frontend/.env & .env.production)');
console.log('------------------------------------------------------------------------');
for (const fname of ['.env', '.env.production', '.env.local']) {
  const fpath = path.join(frontendDir, fname);
  const fvars = parseEnvFile(fpath);
  if (!fvars) {
    console.log(`  ⚪ frontend/${fname}: Not present`);
  } else {
    console.log(`  📄 frontend/${fname}:`);
    for (const [k, v] of Object.entries(fvars)) {
      console.log(`     ✅ ${k.padEnd(28)} = ${maskValue(k, v)}`);
    }
  }
}

// 3. Check Secret Config Files on Disk (backend/config & .jwt_secret)
console.log('\n------------------------------------------------------------------------');
console.log('3️⃣  LOCAL SECRET CONFIG FILES (Excluded from GitHub)');
console.log('------------------------------------------------------------------------');
const secretFiles = [
  { label: 'JWT Fallback Secret', file: path.join(backendDir, '.jwt_secret') },
  { label: 'Firebase Admin Service Account', file: path.join(backendDir, 'config/firebase-service-account.json') },
  { label: 'Web Push VAPID Keys', file: path.join(backendDir, 'config/vapid.json') },
  { label: 'Gemini Key File (Optional)', file: path.join(backendDir, 'config/gemini.key') }
];

for (const item of secretFiles) {
  if (fs.existsSync(item.file)) {
    const stat = fs.statSync(item.file);
    console.log(`  ✅ ${item.label.padEnd(32)} : PRESENT (${stat.size} bytes)`);
  } else {
    console.log(`  ⚪ ${item.label.padEnd(32)} : Not present on disk`);
  }
}

// 4. Check Database system_settings (Fyers / Market / Gemini keys stored in DB)
(async () => {
  console.log('\n------------------------------------------------------------------------');
  console.log('4️⃣  DATABASE STORED CREDENTIALS & SETTINGS (system_settings table)');
  console.log('------------------------------------------------------------------------');
  try {
    require('dotenv').config({ path: backendEnvPath, quiet: true });
    if (!process.env.DATABASE_URL) {
      console.log('  ⚪ DATABASE_URL not set in backend/.env — skipping DB query.');
    } else {
      const db = require('../database/db');
      const rows = await db('system_settings').select('key', 'value').orderBy('key', 'asc');
      if (!rows || rows.length === 0) {
        console.log('  ⚪ No rows found in system_settings table.');
      } else {
        for (const r of rows) {
          const isSecret = /secret|token|pin|totp|key|password/i.test(r.key);
          const display = isSecret ? maskValue(r.key, r.value) : String(r.value || '').slice(0, 60);
          console.log(`  ✅ ${String(r.key).padEnd(28)} = ${display}`);
        }
      }
    }
  } catch (err) {
    console.log(`  ⚠️  Could not query database system_settings: ${err.message}`);
  }

  console.log('\n========================================================================');
  console.log('💡 TIP: Run with --show-values to see full unmasked values:');
  console.log('   node backend/scripts/check_env_security.js --show-values');
  console.log('========================================================================\n');
  process.exit(0);
})();
