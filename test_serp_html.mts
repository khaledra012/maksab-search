import * as http from "http";
import * as tls from "tls";
import * as fs from "fs";

const SERP_HOST = process.env.BRIGHT_DATA_SERP_HOST!;
const SERP_PORT = parseInt(process.env.BRIGHT_DATA_SERP_PORT || "22225");
const SERP_USERNAME = process.env.BRIGHT_DATA_SERP_USERNAME!;
const SERP_PASSWORD = process.env.BRIGHT_DATA_SERP_PASSWORD!;

const auth = Buffer.from(`${SERP_USERNAME}:${SERP_PASSWORD}`).toString("base64");
const targetUrl = "https://www.google.com/search?q=site:instagram.com+مطعم+الرياض+السعودية&hl=ar&gl=sa";
const parsed = new URL(targetUrl);

const html = await new Promise<string>((resolve, reject) => {
  const connectReq = http.request({
    host: SERP_HOST, port: SERP_PORT, method: "CONNECT",
    path: `${parsed.hostname}:443`,
    headers: { "Proxy-Authorization": `Basic ${auth}`, "Host": `${parsed.hostname}:443` }
  });
  connectReq.setTimeout(20000);
  connectReq.on("connect", (res, socket) => {
    if (res.statusCode !== 200) { socket.destroy(); reject(new Error(`CONNECT failed: ${res.statusCode}`)); return; }
    const tlsSocket = tls.connect({ socket, servername: parsed.hostname, rejectUnauthorized: false, checkServerIdentity: () => undefined });
    tlsSocket.on("secureConnect", () => {
      tlsSocket.write(`GET ${parsed.pathname}${parsed.search} HTTP/1.1\r\nHost: ${parsed.hostname}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\nAccept: text/html\r\nAccept-Language: ar,en;q=0.9\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n`);
      let data = "";
      tlsSocket.on("data", (chunk) => { data += chunk.toString("utf-8"); });
      tlsSocket.on("end", () => {
        const bodyStart = data.indexOf("\r\n\r\n");
        resolve(bodyStart !== -1 ? data.slice(bodyStart + 4) : data);
      });
    });
    tlsSocket.on("error", reject);
  });
  connectReq.on("error", reject);
  connectReq.end();
});

// حفظ HTML للفحص
fs.writeFileSync("/tmp/serp_response.html", html);
console.log("HTML length:", html.length);

// فحص بنية النتائج
const patterns = [
  { name: "href instagram", regex: /href="(https?:\/\/[^"]*instagram\.com[^"]*)"/g },
  { name: "cite instagram", regex: /cite="([^"]*instagram\.com[^"]*)"/g },
  { name: "data-href instagram", regex: /data-href="([^"]*instagram\.com[^"]*)"/g },
  { name: "class=r links", regex: /<a[^>]*href="(https?:\/\/[^"]*instagram[^"]*)"[^>]*>/g },
];

for (const p of patterns) {
  const matches = [...html.matchAll(p.regex)];
  console.log(`\n${p.name}: ${matches.length} matches`);
  matches.slice(0, 3).forEach(m => console.log("  ->", m[1]?.slice(0, 100)));
}

// فحص JSON-LD أو structured data
const jsonMatches = html.match(/\[{"@context"[^<]+/g);
console.log("\nJSON-LD blocks:", jsonMatches?.length || 0);

// فحص class names للنتائج
const classMatches = html.match(/class="[^"]*(?:result|tF2Cxc|yuRUbf|g |MjjYud)[^"]*"/g);
console.log("\nResult classes found:", classMatches?.slice(0, 5));
