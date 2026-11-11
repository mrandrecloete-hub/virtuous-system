const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();
const svg=fs.readFileSync('/home/user/virtuous-system/brand/logo-mark-icon.svg','utf8').replace('width="1280" height="560"','width="100%" height="100%" style="overflow:visible"');
async function icon(out,size,pct){
  const p=await b.newPage({viewport:{width:size,height:size}});
  await p.setContent(`<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:radial-gradient(circle at 50% 30%,#12379c,#061a5c 60%,#030c33)"><div style="width:${pct}%;">${svg}</div></body>`);
  await p.waitForTimeout(300);await p.screenshot({path:out});await p.close()}
const R='/home/user/virtuous-system/';
await icon(R+'icon-512.png',512,90);await icon(R+'icon.png',512,90);await icon(R+'icon-192.png',192,90);await icon(R+'icon-maskable-512.png',512,66);
await b.close()})();
