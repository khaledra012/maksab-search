import https from 'https';

const token = process.env.BRIGHT_DATA_API_TOKEN;
const zone = process.env.BRIGHT_DATA_SERP_ZONE || 'serp_api1';

console.log('Token exists:', !!token, 'Length:', token?.length);
console.log('Zone:', zone);

if (!token) {
  console.error('ERROR: BRIGHT_DATA_API_TOKEN not set');
  process.exit(1);
}

const body = JSON.stringify({
  zone: zone,
  url: 'https://www.google.com/search?q=instagram+restaurant+riyadh+Saudi+Arabia&num=10&hl=en',
  format: 'raw'
});

const req = https.request({
  hostname: 'api.brightdata.com',
  port: 443,
  path: '/request',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const responseBody = Buffer.concat(chunks).toString('utf-8');
    console.log('Status:', res.statusCode);
    if (res.statusCode === 200) {
      console.log('SUCCESS! Response length:', responseBody.length);
      // Count instagram.com links
      const igLinks = (responseBody.match(/instagram\.com\/([a-zA-Z0-9._]{3,30})/g) || []);
      console.log('Instagram links found:', igLinks.length);
      console.log('Sample links:', igLinks.slice(0, 5));
    } else {
      console.log('FAILED! Response:', responseBody.slice(0, 500));
    }
  });
});

req.setTimeout(30000, () => {
  req.destroy();
  console.log('TIMEOUT after 30s');
});

req.on('error', e => console.log('ERROR:', e.message));
req.write(body);
req.end();
