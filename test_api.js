const axios = require('axios');
const https = require('https');

async function testPort(port, csrf) {
    const url = `https://127.0.0.1:${port}/exa.language_server_pb.LanguageServerService/GetUserStatus`;
    const payload = {
        metadata: { ideName: 'vscode', extensionName: 'vscode', ideVersion: '1.75.0', locale: 'en' }
    };
    
    const agent = new https.Agent({ rejectUnauthorized: false });
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'x-codeium-csrf-token': csrf,
            'Authorization': `Basic ${csrf}`,
            'Connection': 'close'
        },
        httpsAgent: agent,
        timeout: 3000
    };

    try {
        console.log(`Trying ${url} with HTTPS...`);
        const res = await axios.post(url, payload, config);
        console.log("Success! Data:", JSON.stringify(res.data, null, 2));
    } catch (e) {
        if (e.code === 'EPROTO' || e.response?.status === 403) {
            console.log(`HTTPS failed (${e.message}), trying HTTP...`);
            const httpUrl = url.replace('https://', 'http://');
            try {
                const res2 = await axios.post(httpUrl, payload, { ...config, httpsAgent: undefined });
                console.log("Success! Data:", JSON.stringify(res2.data, null, 2));
            } catch(e2) {
                console.error("HTTP failed:", e2.message);
            }
        } else {
            console.error("Failed:", e.message);
        }
    }
}

// PID 14744 token: aa9edada-db01-452f-91aa-0d10fe453098
// PID 2568 token: 9d2d5f49-0bb6-4905-856d-60f6d3ca2589

testPort(49546, 'aa9edada-db01-452f-91aa-0d10fe453098');
testPort(49547, 'aa9edada-db01-452f-91aa-0d10fe453098');
testPort(59161, '9d2d5f49-0bb6-4905-856d-60f6d3ca2589');
testPort(59162, '9d2d5f49-0bb6-4905-856d-60f6d3ca2589');
testPort(59176, '9d2d5f49-0bb6-4905-856d-60f6d3ca2589');
