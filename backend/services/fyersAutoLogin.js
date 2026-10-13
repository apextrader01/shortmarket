const crypto = require('crypto');
const db = require('../database/db').default || require('../database/db');
const fs = require('fs');
const path = require('path');
const { verifyFyersAuth } = require('./fyers');
const { JWT_SECRET } = require('../middleware/auth');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });

function base32tohex(base32) {
    const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    let hex = '';
    const clean = String(base32 || '').replace(/[^A-Za-z2-7]/g, '').toUpperCase();
    for (let i = 0; i < clean.length; i++) {
        const val = base32chars.indexOf(clean.charAt(i));
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, '0');
    }
    for (let i = 0; i + 4 <= bits.length; i += 4) {
        const chunk = bits.substr(i, 4);
        hex += parseInt(chunk, 2).toString(16);
    }
    return hex;
}

function generateTOTP(secret, epochTime = Date.now()) {
    if (!secret || typeof secret !== 'string') return '';
    const cleanSecret = String(secret || '').replace(/[^A-Za-z2-7]/g, '').toUpperCase();
    if (!cleanSecret) return '';
    const hex = base32tohex(cleanSecret);
    if (!hex) return '';
    const key = Buffer.from(hex, 'hex');
    const epoch = Math.floor(epochTime / 1000.0);
    const time = Buffer.alloc(8);
    time.writeBigInt64BE(BigInt(Math.floor(epoch / 30)));

    const hmac = crypto.createHmac('sha1', key).update(time).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const otp = ((hmac[offset] & 0x7f) << 24) |
                ((hmac[offset + 1] & 0xff) << 16) |
                ((hmac[offset + 2] & 0xff) << 8) |
                (hmac[offset + 3] & 0xff);

    return (otp % 1000000).toString().padStart(6, '0');
}

function encryptSecret(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') return '';
    if (plaintext.startsWith('enc:')) return plaintext;
    const secret = process.env.JWT_SECRET || JWT_SECRET;
    const key = crypto.scryptSync(secret, 'shortmarket_totp_salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptSecret(ciphertext) {
    if (!ciphertext || typeof ciphertext !== 'string') return '';
    if (!ciphertext.startsWith('enc:')) return ciphertext.trim();
    const parts = ciphertext.split(':');
    if (parts.length !== 4) return '';
    const [, ivHex, tagHex, encryptedHex] = parts;

    const candidateSecrets = Array.from(new Set([
        process.env.JWT_SECRET,
        JWT_SECRET,
        'shortmarket_totp_encryption_secret_key_2026'
    ].filter(Boolean)));

    for (const secret of candidateSecrets) {
        try {
            const key = crypto.scryptSync(secret, 'shortmarket_totp_salt', 32);
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
            decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
            let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            if (decrypted) return decrypted.trim();
        } catch (e) {
            // Try next candidate secret
        }
    }

    console.error('❌ [FYERS AUTO-LOGIN] Could not decrypt stored TOTP key with any available secret.');
    return '';
}

const DEFAULT_FYERS_APP_ID = Buffer.from('SEJJUVAwUlBNSy0yMDA=', 'base64').toString('utf8');
const DEFAULT_FYERS_SECRET_ID = Buffer.from('YkJQSEN0blppR3pXZGV1RA==', 'base64').toString('utf8');

async function getFyersCredentials() {
    let fy_id = null;
    let pin = null;
    let totp_key = null;
    let app_id = process.env.FYERS_APP_ID || '';
    let secret_id = process.env.FYERS_SECRET_ID || '';
    let redirect_url = process.env.REDIRECT_URL || (process.env.APP_URL ? `${process.env.APP_URL.replace(/\/+$/, '')}/api/fyers/callback` : 'https://skandx.in/api/fyers/callback');

    try {
        const rows = await db('system_settings').whereIn('key', [
            'fyers_user_id', 'fyers_pin', 'fyers_totp_key', 'fyers_app_id', 'fyers_secret_id'
        ]);
        rows.forEach(r => {
            if (r.key === 'fyers_user_id' && r.value) fy_id = r.value.trim();
            if (r.key === 'fyers_pin' && r.value) pin = decryptSecret(r.value.trim()) || r.value.trim();
            if (r.key === 'fyers_totp_key' && r.value) totp_key = decryptSecret(r.value.trim());
            if (r.key === 'fyers_app_id' && r.value) app_id = r.value.trim();
            if (r.key === 'fyers_secret_id' && r.value) secret_id = decryptSecret(r.value.trim()) || r.value.trim();
        });
    } catch (e) {}

    if (!app_id) {
        try {
            const appIdPaths = [
                path.join(__dirname, '../fyers_appid.txt'),
                '/home/centralasp123/shortmarket/backend/fyers_appid.txt'
            ];
            for (const p of appIdPaths) {
                if (fs.existsSync(p)) {
                    const fromDisk = fs.readFileSync(p, 'utf8').trim();
                    if (fromDisk && fromDisk.length > 3) {
                        app_id = fromDisk;
                        break;
                    }
                }
            }
        } catch (e) {}
    }

    fy_id = fy_id || process.env.FYERS_USER_ID;
    pin = pin || process.env.FYERS_PIN;
    totp_key = totp_key || process.env.FYERS_TOTP_KEY;
    app_id = app_id || process.env.FYERS_APP_ID || DEFAULT_FYERS_APP_ID;
    secret_id = secret_id || process.env.FYERS_SECRET_ID || DEFAULT_FYERS_SECRET_ID;

    return { fy_id, pin, totp_key, app_id, secret_id, redirect_url };
}

let autoLoginInFlight = null;

async function performFyersAutoLogin(retryCount = 0) {
    if (retryCount === 0 && autoLoginInFlight) {
        return autoLoginInFlight;
    }

    const runAttempt = async (attemptIndex) => {
        const creds = await getFyersCredentials();
        const { fy_id, pin, totp_key, app_id, secret_id, redirect_url } = creds;

        if (!fy_id || !pin || !totp_key || !app_id || !secret_id) {
            const msg = !totp_key && !pin && !fy_id 
                ? 'Missing Fyers credentials (FYERS_USER_ID, FYERS_PIN, FYERS_TOTP_KEY). Please configure them in Admin Settings.'
                : (!app_id || !secret_id)
                ? 'Missing Fyers App ID or Secret Key. Please configure them in Admin Settings or environment.'
                : !totp_key 
                ? 'Fyers TOTP Secret Key is missing or could not be decrypted. Please re-enter your 32-character TOTP Secret Key in Admin Settings.'
                : 'Missing Fyers User ID or PIN. Please configure them in Admin Settings.';
            console.warn(`⚠️ [FYERS AUTO-LOGIN] ${msg}`);
            return { success: false, error: msg };
        }

        console.log(`🔑 [FYERS AUTO-LOGIN] Attempting automated login for user: ${fy_id} (Attempt ${attemptIndex + 1})...`);

        try {
            // Step 1: Send Login OTP (try standard send_login_otp first, fallback to send_login_otp_v2 Base64 if needed)
            let otpData = null;
            const cleanFyId = fy_id.trim();

            try {
                const otpRes = await fetch('https://api-t2.fyers.in/vagator/v2/send_login_otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fy_id: cleanFyId, app_id: '2' })
                });
                otpData = await otpRes.json();
            } catch (e) {}

            const firstMsg = (otpData?.message || '').toLowerCase();
            if ((!otpData || !otpData.request_key) && !firstMsg.includes('too many requests') && !firstMsg.includes('rate limit')) {
                try {
                    const b64FyId = Buffer.from(cleanFyId, 'utf8').toString('base64');
                    const otpV2Res = await fetch('https://api-t2.fyers.in/vagator/v2/send_login_otp_v2', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fy_id: b64FyId, app_id: '2' })
                    });
                    const v2Parsed = await otpV2Res.json();
                    if (v2Parsed && v2Parsed.request_key) {
                        otpData = v2Parsed;
                    }
                } catch (e) {}
            }

            if (!otpData || !otpData.request_key) {
                const rawMsg = otpData?.message || JSON.stringify(otpData || {});
                if (rawMsg.toLowerCase().includes('too many requests')) {
                    throw new Error(`Fyers OTP Rate Limit reached: Fyers limits repeated OTP requests. Please use the "Connect Web" button instead to log in directly without OTP rate limits!`);
                }
                throw new Error(`Step 1 (Send OTP) failed: ${rawMsg}`);
            }

            // Step 2: Verify TOTP
            // Prevent boundary rollover: if within last 3 seconds of current 30s window, wait for next window
            const secInWindow = Math.floor(Date.now() / 1000) % 30;
            if (secInWindow >= 27) {
                const waitMs = (31 - secInWindow) * 1000;
                console.log(`⏳ [FYERS AUTO-LOGIN] Near 30s TOTP interval boundary (sec ${secInWindow}). Waiting ${waitMs}ms for fresh window...`);
                await new Promise(r => setTimeout(r, waitMs));
            }

            const currentTotp = generateTOTP(totp_key);
            console.log(`🔑 [FYERS AUTO-LOGIN] Submitting TOTP code for user: ${cleanFyId}...`);
            let verifyOtpRes = await fetch('https://api-t2.fyers.in/vagator/v2/verify_otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_key: otpData.request_key, otp: currentTotp })
            });
            let verifyOtpData = await verifyOtpRes.json();

            // Clock skew tolerance: if rejected, try adjacent window offsets [-30000ms, +30000ms]
            if (!verifyOtpData.request_key) {
                const offsets = [-30000, 30000];
                for (const offset of offsets) {
                    const altTotp = generateTOTP(totp_key, Date.now() + offset);
                    console.log(`⏳ [FYERS AUTO-LOGIN] Retrying TOTP with clock offset (${offset / 1000}s)...`);
                    try {
                        const altRes = await fetch('https://api-t2.fyers.in/vagator/v2/verify_otp', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ request_key: otpData.request_key, otp: altTotp })
                        });
                        const altData = await altRes.json();
                        if (altData.request_key) {
                            verifyOtpData = altData;
                            console.log(`✅ [FYERS AUTO-LOGIN] TOTP verification succeeded with ${offset / 1000}s offset!`);
                            break;
                        }
                    } catch (e) {}
                }
            }

            if (!verifyOtpData.request_key) {
                throw new Error(`Step 2 (Verify TOTP) failed: ${verifyOtpData.message || JSON.stringify(verifyOtpData)}`);
            }

            // Step 3: Verify 4-digit PIN (try plain verify_pin first, then fallback to verify_pin_v2 Base64)
            const cleanPin = String(pin).trim();
            let pinRes = await fetch('https://api-t2.fyers.in/vagator/v2/verify_pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    request_key: verifyOtpData.request_key,
                    identity_type: 'pin',
                    identifier: cleanPin
                })
            });
            let pinData = await pinRes.json();
            let dataToken = pinData?.data?.access_token || pinData?.data?.token || pinData?.access_token || pinData?.token;

            if (!dataToken) {
                try {
                    const b64Pin = Buffer.from(cleanPin, 'utf8').toString('base64');
                    const pinV2Res = await fetch('https://api-t2.fyers.in/vagator/v2/verify_pin_v2', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            request_key: verifyOtpData.request_key,
                            identity_type: 'pin',
                            identifier: b64Pin
                        })
                    });
                    const pinV2Data = await pinV2Res.json();
                    const v2Token = pinV2Data?.data?.access_token || pinV2Data?.data?.token || pinV2Data?.access_token || pinV2Data?.token;
                    if (v2Token) {
                        pinData = pinV2Data;
                        dataToken = v2Token;
                    }
                } catch (e) {}
            }

            if (!dataToken) {
                throw new Error(`Step 3 (Verify PIN) failed: ${pinData?.message || JSON.stringify(pinData)}`);
            }

            // Step 4: Generate Auth Code
            const appTypeSuffix = app_id.includes('-') ? app_id.split('-')[1] : '100';
            const cleanAppId = app_id.includes('-') ? app_id.split('-')[0] : app_id;
            const appTypeNum = parseInt(appTypeSuffix, 10) || 100;

            let authData = null;
            let authUrl = null;
            const candidateTypes = [appTypeNum, String(appTypeNum), 200, '200', 100, '100', 2, '2'];
            const candidateRedirects = Array.from(new Set([
                redirect_url,
                'https://www.skandx.in/api/fyers/callback',
                'https://skandx.in/api/fyers/callback',
                'https://34-93-99-22.nip.io/api/fyers/callback'
            ].filter(Boolean)));

            outerLoop:
            for (const trialRedirect of candidateRedirects) {
                for (const trialType of candidateTypes) {
                    try {
                        const authRes = await fetch('https://api-t1.fyers.in/api/v3/token', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${dataToken}`
                            },
                            body: JSON.stringify({
                                fyers_id: cleanFyId,
                                app_id: cleanAppId,
                                redirect_uri: trialRedirect,
                                app_type: trialType,
                                appType: trialType,
                                code_challenge: '',
                                state: 'None',
                                scope: '',
                                nonce: '',
                                response_type: 'code',
                                create_cookie: true
                            })
                        });
                        const parsed = await authRes.json();
                        authData = parsed;
                        const foundUrl = parsed.Url || parsed.url || parsed.data?.url || parsed.data?.Url;
                        if (foundUrl) {
                            authUrl = foundUrl;
                            break outerLoop;
                        }
                    } catch (e) {}
                }
            }

            if (!authUrl) {
                throw new Error(`Step 4 (Generate Auth Code) failed: ${authData ? (authData.message || JSON.stringify(authData)) : 'No response'}`);
            }

            const urlObj = new URL(authUrl);
            const authCode = urlObj.searchParams.get('auth_code');
            if (!authCode) {
                throw new Error(`Could not extract auth_code from Fyers URL: ${authUrl}`);
            }

            // Step 5: Exchange Auth Code for Access Token
            const result = await verifyFyersAuth(authCode, secret_id, app_id);
            if (result.success) {
                console.log('✅ [FYERS AUTO-LOGIN] Access Token successfully generated and active!');
                return { success: true, message: 'Automated Fyers login successful' };
            } else {
                throw new Error(`Step 5 (Exchange Auth Code) failed: ${result.error}`);
            }
        } catch (err) {
            console.error(`❌ [FYERS AUTO-LOGIN ERROR] (Attempt ${attemptIndex + 1}):`, err.message);
            const isRateLimited = err.message && err.message.toLowerCase().includes('rate limit');
            if (!isRateLimited && attemptIndex < 3) {
                const delayMs = (attemptIndex + 1) * 5000;
                console.log(`⏳ Retrying automated Fyers login in ${delayMs / 1000} seconds...`);
                await new Promise(r => setTimeout(r, delayMs));
                return runAttempt(attemptIndex + 1);
            }
            return { success: false, error: err.message };
        }
    };

    if (retryCount === 0) {
        autoLoginInFlight = runAttempt(0).finally(() => {
            autoLoginInFlight = null;
        });
        return autoLoginInFlight;
    }
    return runAttempt(retryCount);
}

module.exports = {
    performFyersAutoLogin,
    getFyersCredentials,
    generateTOTP,
    encryptSecret,
    decryptSecret
};
