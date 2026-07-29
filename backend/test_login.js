const { TOTP } = require('totp-generator');
const https = require('https');
require('dotenv').config();

const ANGEL_ROOT = 'https://apiconnect.angelone.in';
const ANGEL_LOGIN_URL = ANGEL_ROOT + '/rest/auth/angelbroking/user/v1/loginByPassword';

async function directLogin(clientCode, pin, totp) {
    const body = JSON.stringify({ clientcode: clientCode, password: pin, totp });
    return new Promise((resolve, reject) => {
        const req = https.request(ANGEL_LOGIN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-UserType': 'USER',
                'X-SourceID': 'WEB',
                'X-PrivateKey': process.env.ANGEL_API_KEY,
                'X-ClientLocalIP': '127.0.0.1',
                'X-ClientPublicIP': '127.0.0.1',
                'X-MACAddress': '00-00-00-00-00-00',
                'Content-Length': Buffer.byteLength(body),
            },
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('Invalid JSON from Angel One login: ' + data.slice(0, 200))); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function test() {
    try {
        console.log("Generating TOTP...");
        const { otp } = await TOTP.generate(process.env.ANGEL_TOTP_SECRET);
        console.log("Generated OTP:", otp);
        console.log("Logging in with client ID:", process.env.ANGEL_CLIENT_ID);
        const res = await directLogin(process.env.ANGEL_CLIENT_ID, process.env.ANGEL_PIN, otp);
        console.log("Angel One Response:", JSON.stringify(res, null, 2));
    } catch(err) {
        console.error("Test failed:", err.message);
    }
}

test();
