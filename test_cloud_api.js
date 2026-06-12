const axios = require('axios');
const fs = require('fs');

async function testCloudApi() {
    const creds = JSON.parse(fs.readFileSync('c:/Users/ricar/.gemini/oauth_creds.json', 'utf8'));
    const token = creds.access_token;
    
    const endpoints = [
        'https://cloudcode-pa.googleapis.com/exa.language_server_pb.LanguageServerService/GetUserStatus',
        'https://cloudcode-pa.googleapis.com/v1/userStatus',
        'https://cloudcode-pa.googleapis.com/v1/exa.language_server_pb.LanguageServerService/GetUserStatus'
    ];

    const payload = {
        metadata: { ideName: 'vscode', extensionName: 'vscode', ideVersion: '1.75.0', locale: 'en' }
    };

    for (const url of endpoints) {
        try {
            console.log(`Trying ${url}...`);
            const res = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 3000
            });
            console.log("Success! Data:", JSON.stringify(res.data, null, 2));
            return;
        } catch (e) {
            console.error(`Failed ${url}:`, e.response ? e.response.status : e.message);
        }
    }
}

testCloudApi();
