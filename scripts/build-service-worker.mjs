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
for (const file of assets) {
  hash.update(`${file}\0`);
  hash.update(await readFile(`dist/${file}`));
}
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
 // A navigation and every build-managed file come from the same immutable
 // pre-cache. Never replace one component with a newer network response.
 const isNavigation=event.request.mode==='navigate';
 const relative=url.pathname.slice(ROOT.pathname.length);
 if(!isNavigation&&!FILES.includes(relative))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const cached=await cache.match(isNavigation?local('index.html'):local(relative));
  if(cached)return cached;
  throw Error('Astra offline cache is incomplete; reconnect and reload.');
 })());
});
`,
);
console.log(`Offline app: ${assets.length} assets, version ${version}`);
