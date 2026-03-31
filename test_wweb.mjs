import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import QRCode from 'qrcode';

console.log('Creating client...');
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '/tmp/wwebjs_test' }),
  puppeteer: {
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
  },
});

client.on('qr', async (qr) => {
  console.log('QR received! Length:', qr.length);
  const dataUrl = await QRCode.toDataURL(qr, { width: 200 });
  console.log('QR DataURL length:', dataUrl.length);
  console.log('SUCCESS: QR generated correctly');
  await client.destroy();
  process.exit(0);
});

client.on('ready', () => {
  console.log('Already logged in!');
  client.destroy();
  process.exit(0);
});

client.on('auth_failure', (msg) => {
  console.error('Auth failure:', msg);
  process.exit(1);
});

console.log('Initializing...');
client.initialize().catch(e => {
  console.error('Init error:', e.message);
  process.exit(1);
});

// timeout بعد 60 ثانية
setTimeout(() => {
  console.error('TIMEOUT: No QR received in 60s');
  process.exit(1);
}, 60000);
