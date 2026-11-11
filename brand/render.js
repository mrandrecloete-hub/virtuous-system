const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();
async function shot(svg,out,w,h,scale,bg){
  const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:scale});
  await p.setContent(`<html><body style="margin:0;background:${bg||'transparent'}">${fs.readFileSync(svg,'utf8').replace('width="1400" height="1080"','width="'+w+'" height="'+h+'"')}</body></html>`);
  await p.waitForTimeout(400);await p.screenshot({path:out,omitBackground:!bg});await p.close()}
await shot('logo-v2.svg','logo-v2.png',1400,1080,1);
// preview on navy
const p=await b.newPage({viewport:{width:900,height:760}});
await p.setContent(`<body style="margin:0;background:linear-gradient(180deg,#071a52,#040d2b);display:grid;place-items:center;height:100vh"><img src="data:image/png;base64,${fs.readFileSync('logo-v2.png').toString('base64')}" style="width:760px"></body>`);
await p.waitForTimeout(300);await p.screenshot({path:'preview-navy.png'});
await b.close()})();
