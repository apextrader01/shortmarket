const crypto = require('crypto');
const db = require('../database/db').default || require('../database/db');
const fs = require('fs');
const path = require('path');
const { verifyFyersAuth } = require('./fyers');
require('dotenv').config();

function base32tohex(base32) {
    const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    let hex = '';
    const clean = base32.replace(/[\s=]+/g, '').toUpperCase();
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
    const key = Buffer.from(base32tohex(secret), 'hex');
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
    if (!plaintext) return '';
    const secret = process.env.JWT_SECRET || 'shortmarket_totp_encryption_secret_key_2026';
    const key = crypto.scryptSync(secret, 'shortmarket_totp_salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptSecret(ciphertext) {
    if (!ciphertext || !ciphertext.startsWith('enc:')) return ciphertext;
    try {
        const secret = process.env.JWT_SECRET || 'shortmarket_totp_encryption_secret_key_2026';
        const key = crypto.scryptSync(secret, 'shortmarket_totp_salt', 32);
        const parts = ciphertext.split(':');
        if (parts.length !== 4) return ciphertext;
        const [, ivHex, tagHex, encryptedHex] = parts;
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        return ciphertext;
    }
}

async function getFyersCredentials() {
    let fy_id = null;
    let pin = null;
    let totp_key = null;
    let app_id = process.env.FYERS_APP_ID || 'HBIQP0RPMK-200';
    let secret_id = process.env.FYERS_SECRET_ID || 'bBPHCtnZiGzWdeuD';
    let redirect_url = process.env.REDIRECT_URL || (process.env.APP_URL ? `${process.env.APP_URL.replace(/\/+$/, '')}/api/fyers/callback` : 'https://skandx.in/api/fyers/callback');

    try {
        const rows = await db('system_settings').whereIn('key', [
            'fyers_user_id', 'fyers_pin', 'fyers_totp_key', 'fyers_app_id', 'fyers_secret_id'
        ]);
        rows.forEach(r => {
            if (r.key === 'fyers_user_id' && r.value) fy_id = r.value.trim();
            if (r.key === 'fyers_pin' && r.value) pin = r.value.trim();
            if (r.key === 'fyers_totp_key' && r.value) totp_key = decryptSecret(r.value.trim());
            if (r.key === 'fyers_app_id' && r.value) app_id = r.value.trim();
            if (r.key === 'fyers_secret_id' && r.value) secret_id = r.value.trim();
        });
    } catch (e) {}

    fy_id = fy_id || process.env.FYERS_USER_ID;
    pin = pin || process.env.FYERS_PIN;
    totp_key = totp_key || process.env.FYERS_TOTP_KEY;
    app_id = app_id || process.env.FYERS_APP_ID || 'HBIQP0RPMK-200';
    secret_id = secret_id || process.env.FYERS_SECRET_ID || 'bBPHCtnZiGzWdeuD';

    return { fy_id, pin, totp_key, app_id, secret_id, redirect_url };
}

async function performFyersAutoLogin(retryCount = 0) {
    const creds = await getFyersCredentials();
    const { fy_id, pin, totp_key, app_id, secret_id, redirect_url } = creds;

    if (!fy_id || !pin || !totp_key) {
        const msg = 'Missing Fyers credentials (FYERS_USER_ID, FYERS_PIN, FYERS_TOTP_KEY). Please configure them in Admin Settings.';
        console.warn(`⚠️ [FYERS AUTO-LOGIN] ${msg}`);
        return { success: false, error: msg };
    }

    console.log(`🔑 [FYERS AUTO-LOGIN] Attempting automated login for user: ${fy_id}...`);

    try {
        // Step 1: Send Login OTP (app_id "2" represents Web/API OTP)
        const otpRes = await fetch('https://api-t2.fyers.in/vagator/v2/send_login_otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fy_id: fy_id.trim(), app_id: '2' })
        });
        const otpData = await otpRes.json();
        if (!otpData.request_key) {
            const rawMsg = otpData.message || JSON.stringify(otpData);
            if (rawMsg.toLowerCase().includes('too many requests')) {
                throw new Error(`Fyers OTP Rate Limit reached: Fyers limits repeated OTP requests. Please use the "Connect Web" button instead to log in directly without OTP rate limits!`);
            }
            throw new Error(`Step 1 (Send OTP) failed: ${rawMsg}`);
        }

        // Step 2: Verify TOTP
        const currentTotp = generateTOTP(totp_key);
        const verifyOtpRes = await fetch('https://api-t2.fyers.in/vagator/v2/verify_otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request_key: otpData.request_key, otp: currentTotp })
        });
        const verifyOtpData = await verifyOtpRes.json();
        if (!verifyOtpData.request_key) {
            throw new Error(`Step 2 (Verify TOTP) failed: ${verifyOtpData.message || JSON.stringify(verifyOtpData)}`);
        }

        // Step 3: Verify 4-digit PIN
        const pinRes = await fetch('https://api-t2.fyers.in/vagator/v2/verify_pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                request_key: verifyOtpData.request_key,
                identity_type: 'pin',
                identifier: String(pin).trim()
            })
        });
        const pinData = await pinRes.json();
        const dataToken = pinData?.data?.access_token || pinData?.data?.token || pinData?.access_token || pinData?.token;
        if (!dataToken) {
            throw new Error(`Step 3 (Verify PIN) failed: ${pinData.message || JSON.stringify(pinData)}`);
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
                            fyers_id: fy_id.trim(),
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
        console.error(`❌ [FYERS AUTO-LOGIN ERROR] (Attempt ${retryCount + 1}):`, err.message);
        if (retryCount < 2) {
            console.log('⏳ Retrying automated Fyers login in 5 seconds...');
            await new Promise(r => setTimeout(r, 5000));
            return performFyersAutoLogin(retryCount + 1);
        }
        return { success: false, error: err.message };
    }
}

module.exports = {
    performFyersAutoLogin,
    getFyersCredentials,
    generateTOTP,
    encryptSecret,
    decryptSecret
};
