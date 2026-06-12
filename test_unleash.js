const axios = require('axios');
const https = require('https');

async function testUnleash(port, csrf) {
    const url = `https://127.0.0.1:${port}/exa.language_server_pb.LanguageServerService/GetUnleashData`;
    const payload = {
        metadata: {
            api_key: '00000000-0000-0000-0000-000000000000',
            extension_name: 'vscode',
            extension_version: '1.1.0',
            ide_name: 'visual_studio_code',
            ide_version: '1.75.0',
            session_id: '00000000-0000-0000-0000-000000000000'
        }
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
            console.error("Failed:", e.response ? e.response.status : e.message);
        }
    }
}

testUnleash(49546, 'aa9edada-db01-452f-91aa-0d10fe453098');
