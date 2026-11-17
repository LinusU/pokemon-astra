import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";

// A new cache name is tied to the actual build, so updates cannot strand users
// on old JavaScript or a different native ABI. All assets are local and ROM-free.
async function files(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory())
      result.push(...(await files(`${dir}/${entry.name}`, `${relative}/`)));
    else if (entry.name !== "sw.js") result.push(relative);
  }
  return result.sort();
}
const assets = await files("dist");
if (assets.some((p) => /\.(?:gb|gbc|sav|srm)$/i.test(p)))
  throw Error("Private cartridge/save data found in build output");
const hash = createHash("sha256");
for (const file of assets) hash.update(await readFile(`dist/${file}`));
const version = hash.digest("hex").slice(0, 16);
await writeFile(
  "dist/sw.js",
  `const CACHE='pokemon-astra-${version}';
const ROOT=new URL('./',self.location.href);
const FILES=${JSON.stringify(assets)};
const local=p=>new URL(p,ROOT).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await cache.addAll(FILES.map(local));
 const shell=await cache.match(local('index.html'));
 if(shell)await cache.put(ROOT.href,shell);
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 await Promise.all((await caches.keys()).filter(k=>(k.startsWith('pokemon-astra-')||k==='astra-v1'||k==='astra-v2')&&k!==CACHE).map(k=>caches.delete(k)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname)||/\\.(?:gb|gbc|sav|srm)$/i.test(url.pathname))return;
 if(event.request.mode==='navigate'){
  event.respondWith((async()=>{
   try{const response=await fetch(event.request);if(response.ok){const cache=await caches.open(CACHE);await cache.put(ROOT.href,response.clone());}return response;}
   catch{const cached=await (await caches.open(CACHE)).match(ROOT.href);if(cached)return cached;throw Error('Astra needs one successful online visit.');}
  })());return;
 }
 // Content-hashed bundles are immutable. Other assets, particularly the WASM
 // bridge, stay fresh online and remain available offline.
 const hashed=/\\/assets\\/[^/]+-[a-zA-Z0-9_-]+\\.(?:js|css)$/.test(url.pathname);
 event.respondWith((async()=>{
  const cached=await (await caches.open(CACHE)).match(event.request);
  if(hashed&&cached)return cached;
  try{const response=await fetch(event.request);if(response.ok){const cache=await caches.open(CACHE);await cache.put(event.request,response.clone());}return response;}
  catch(error){if(cached)return cached;throw error;}
 })());
});
`,
);
console.log(`Offline app: ${assets.length} assets, version ${version}`);
