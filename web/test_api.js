const https = require('https');

const data = JSON.stringify({
    device_token: "cmlboxnd80003z1bvb5e1tfr5",
    playing_playlist_id: "cmlbp2vc5000fs5blpfa6btsk"
});

const options = {
    hostname: 'signage-repo-dc5s.vercel.app',
    port: 443,
    path: '/api/device/sync',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('BODY: ' + body);
        try {
            const json = JSON.parse(body);
            console.log('_debug_version:', json._debug_version);
        } catch (e) {
            console.log('Could not parse JSON');
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
