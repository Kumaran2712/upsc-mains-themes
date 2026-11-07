import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const origin = process.env.BROWSER_TEST_ORIGIN || 'http://127.0.0.1:8787';
const version = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const socket = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let nextId = 0;
const pending = new Map();
const exceptions = [];
socket.addEventListener('message', ({data}) => {
  const msg = JSON.parse(data);
  if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails.text + ': ' + (msg.params.exceptionDetails.exception?.description || ''));
  if (msg.id && pending.has(msg.id)) {
    const {resolve,reject,timer} = pending.get(msg.id); pending.delete(msg.id); clearTimeout(timer);
    if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
  }
});
function command(method, params = {}, sessionId) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Timeout: ' + method)); }, 15000);
    pending.set(id, {resolve,reject,timer}); socket.send(JSON.stringify({id,method,params,...(sessionId ? {sessionId} : {})}));
  });
}
async function newPage() {
  const {browserContextId} = await command('Target.createBrowserContext');
  const {targetId} = await command('Target.createTarget',{url:'about:blank',browserContextId});
  const {sessionId} = await command('Target.attachToTarget',{targetId,flatten:true});
  await command('Runtime.enable',{},sessionId); await command('Page.enable',{},sessionId);
  await command('Network.enable',{},sessionId);
  await command('Network.setBlockedURLs',{urls:['https://fonts.googleapis.com/*','https://fonts.gstatic.com/*']},sessionId);
  return {sessionId,browserContextId};
}
const contexts = [];
const page = await newPage(); contexts.push(page);
let session = page.sessionId;
const evalJS = async (expression) => {
  const r = await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},session);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
const wait = async (expression, message = expression) => {
  for (let i=0;i<120;i++) { if (await evalJS(expression)) return; await new Promise((r) => setTimeout(r,100)); }
  throw new Error('Wait failed: ' + message);
};
async function navigate(path) {
  await command('Page.navigate',{url:origin+path},session);
  await wait(`location.pathname===${JSON.stringify(path)} && document.readyState==='complete'`);
  await evalJS('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
}
async function click(selector) { await evalJS(`document.querySelector(${JSON.stringify(selector)}).click()`); }
async function screenshot(name) {
  const {data} = await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},session);
  await fs.writeFile(join(tmpdir(), name + '.png'),Buffer.from(data,'base64'));
}
async function assertLayout(path,width,height) {
  await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600},session);
  await navigate(path);
  assert(await evalJS('document.documentElement.scrollWidth<=innerWidth+1'), 'Horizontal overflow: '+path+' at '+width);
}

const username = 'workspace_' + Date.now().toString(36), password = 'workspace-browser-test-password';
async function account(mode, name) {
  await wait("!document.querySelector('[data-account-open]').disabled");
  await click('[data-account-open]'); await click('[data-auth-mode="'+mode+'"]');
  await evalJS(`document.querySelector('[data-account-form] [name=username]').value=${JSON.stringify(name)}; document.querySelector('[data-account-form] [name=password]').value=${JSON.stringify(password)}; document.querySelector('[data-account-form]').requestSubmit()`);
  await wait(`document.querySelector('[data-account-label]').textContent.includes(${JSON.stringify(name)})`);
  await click('[data-account-close]');
}
try {
  await command('Emulation.setDeviceMetricsOverride',{width:1360,height:1000,deviceScaleFactor:1,mobile:false},session);
  await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]},session);
  await navigate('/');
  assert.equal(await evalJS('document.documentElement.dataset.theme'),'dark','Follows the system before a preference is chosen');
  await click('[data-theme-toggle]');
  assert.equal(await evalJS('document.documentElement.dataset.theme'),'light');
  await navigate('/syllabus/');
  assert.equal(await evalJS('document.documentElement.dataset.theme'),'light','Explicit light theme overrides a dark system across routes');
  assert.equal(await evalJS("getComputedStyle(document.body).backgroundColor"),'rgb(250, 250, 249)');
  await click('[data-theme-toggle]');
  await navigate('/sources/');
  assert.equal(await evalJS('document.documentElement.dataset.theme'),'dark');
  assert.equal(await evalJS("getComputedStyle(document.body).backgroundColor"),'rgb(18, 18, 16)');
  assert.equal(await evalJS("document.querySelector('[data-theme-toggle]').getAttribute('aria-pressed')"),'true');
  await navigate('/');
  for (const path of ['/syllabus/','/sources/']) {
    assert(await evalJS(`[...document.querySelectorAll('.home-reference a')].some(a=>a.pathname===${JSON.stringify(path)} && a.getBoundingClientRect().top < innerHeight)`),'Reference link visible on home: '+path);
    assert(await evalJS(`[...document.querySelectorAll('.workspace-sidebar a')].some(a=>a.pathname===${JSON.stringify(path)})`));
  }
  for (const theme of ['light','dark']) {
    await evalJS(`localStorage.setItem('upscthemes-theme',${JSON.stringify(theme)})`);
    for (const width of [1360,768,390,320]) {
      for (const path of ['/','/syllabus/','/sources/','/stage-0/','/stage-0/international-relations/multilateral-relations/','/questions/']) {
        await assertLayout(path,width,width===1360?1000:844);
        assert.equal(await evalJS('document.documentElement.dataset.theme'),theme);
        if (path==='/') assert(await evalJS("[...document.querySelectorAll('.home-reference a')].every(a=>a.getBoundingClientRect().bottom<innerHeight-56)"),'Home reference links visible above mobile tabs');
        assert.equal(await evalJS("document.querySelectorAll('[data-account-dialog]').length"),1,'One account dialog per page');
        if (width>760) assert(await evalJS("document.querySelector('main').getBoundingClientRect().left >= document.querySelector('.workspace-sidebar').getBoundingClientRect().right"),'Sidebar does not overlap content');
        if (path==='/' && [1360,390].includes(width)) await screenshot('workspace-home-'+theme+'-'+width);
        if (path.includes('multilateral') && width===1360) await screenshot('workspace-lesson-'+theme+'-'+width);
      }
    }
  }
  await navigate('/');
  await command('Page.bringToFront',{},session);
  await command('Emulation.setFocusEmulationEnabled',{enabled:true},session);
  await evalJS("document.querySelector('.mobile-menu').focus()");
  assert(await evalJS("document.activeElement===document.querySelector('.mobile-menu')"));
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'},session);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},session);
  await wait("document.querySelector('#workspace-menu').open");
  assert(await evalJS("document.querySelector('#workspace-menu').contains(document.activeElement)"),'Focus enters navigation dialog');
  assert(await evalJS("[...document.querySelectorAll('#workspace-menu a')].filter(a=>['/sources/','/syllabus/'].includes(a.pathname)).every(a=>a.getBoundingClientRect().height>=44)"));
  await screenshot('workspace-mobile-navigation');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},session);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},session);
  await wait("!document.querySelector('#workspace-menu').open");
  assert(await evalJS("document.activeElement===document.querySelector('.mobile-menu')"),'Escape restores focus to the opener');
  await click('.mobile-menu');
  await command('Emulation.setDeviceMetricsOverride',{width:1360,height:1000,deviceScaleFactor:1,mobile:false},session);
  await wait("!document.querySelector('#workspace-menu').open");
  await navigate('/daily/');
  await wait("window.__activityScope==='guest' && document.querySelector('.pqi .opt')");
  if (await evalJS("!document.querySelector('#pscore').hidden")) await click('#pretry');
  await click('.pqi .opt'); await click('#pcheck');
  const correct = await evalJS("[...document.querySelectorAll('.pqi')].map(li=>li.querySelector('.opt.ok').dataset.k)");
  await click('#pretry');
  await evalJS(`{ const questions = document.querySelectorAll('.pqi'), correct = ${JSON.stringify(correct)}; questions[0].querySelector('[data-k="'+correct[0]+'"]').click(); [...questions[1].querySelectorAll('.opt')].find(b=>b.dataset.k!==correct[1]).click(); }`);
  await click('#pcheck');
  assert(await evalJS("!!document.querySelector('.opt.no b') && !!document.querySelector('.opt.ok b')"));
  for (const theme of ['light','dark']) {
    if (await evalJS('document.documentElement.dataset.theme')!==theme) await click('[data-theme-toggle]');
    const contrasts = await evalJS(`(() => {
      function luminance(value) { const rgb=value.match(/\\d+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}); return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]; }
      return [...document.querySelectorAll('.opt.ok b,.opt.no b')].map(el=>{const s=getComputedStyle(el),a=luminance(s.color),b=luminance(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)});
    })()`);
    assert(contrasts.every(ratio=>ratio>=4.5),'Practice answer labels need 4.5:1 contrast in '+theme+': '+contrasts);
  }
  console.log('PASS: real correct/incorrect practice feedback meets 4.5:1 text contrast in both themes');
  await command('Emulation.setScriptExecutionDisabled',{value:true},session);
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},session);
  await command('Page.navigate',{url:origin+'/'},session);
  await wait("location.pathname==='/' && document.readyState==='complete'");
  assert(await evalJS("getComputedStyle(document.querySelector('.workspace-no-script')).display!=='none'"));
  assert(await evalJS("getComputedStyle(document.querySelector('.mobile-menu')).display==='none'"));
  assert.equal(await evalJS("document.querySelectorAll('.workspace-no-script nav a').length"),8);
  await command('Emulation.setScriptExecutionDisabled',{value:false},session);
  console.log('PASS: no-JavaScript mobile navigation preserves all study destinations');
  console.log('PASS: 48 layouts, persistent system/explicit light and dark themes, visible reference links, native keyboard navigation and breakpoint recovery');
  if (!process.env.UI_PUBLIC_ONLY) {
    await navigate('/stage-0/international-relations/multilateral-relations/'); await account('signup',username);
    await wait("!document.querySelector('#s0-live-input').disabled");
    await evalJS("document.querySelector('#s0-live-input').value='Explain multilateral relations'; document.querySelector('[data-live-form]').requestSubmit()");
    await wait("document.querySelector('#s0-live-messages').getAttribute('aria-busy')==='false' && document.querySelectorAll('#s0-live-messages article').length===2");
    await navigate('/');
    await wait("document.querySelector('[data-home-resume]').textContent.includes('Multilateral Relations')");
    assert.equal(await evalJS("document.querySelector('[data-home-recent]').hidden"),false);
    await click('[data-account-logout]');
    await wait("document.querySelector('[data-home-recent]').hidden");
    assert(!await evalJS("document.querySelector('.home-learning').textContent.includes('Multilateral Relations')"),'Private resume cleared immediately on sign-out');
    await account('login',username);
    await wait("document.querySelector('[data-home-resume]').textContent.includes('Multilateral Relations')");
    await command('Network.setBlockedURLs',{urls:['*://*/api/progress']},session);
    await navigate('/'); await wait("!document.querySelector('[data-home-progress-retry]').hidden");
    assert.equal(await evalJS("document.querySelector('[data-home-recent]').hidden"),true);
    await command('Network.setBlockedURLs',{urls:[]},session); await click('[data-home-progress-retry]');
    await wait("document.querySelector('[data-home-resume]').textContent.includes('Multilateral Relations')");
    await click('[data-account-logout]'); await account('signup',username+'_b');
    await wait("document.querySelector('[data-home-progress-status]').textContent.includes('first conversation')");
    assert.equal(await evalJS("document.querySelector('[data-home-recent]').hidden"),true,'New account does not inherit previous learner progress');
    assert(await evalJS("document.querySelector('[data-home-resume]').textContent.includes('Sovereignty')"));
    console.log('PASS: real account resume, sign-out clearing, second-account isolation, failed-progress recovery (local model fixture only)');
  }
  assert.equal(exceptions.length,0,exceptions.join('\n'));
} finally {
  for (const c of contexts) await command('Target.disposeBrowserContext',{browserContextId:c.browserContextId}).catch(()=>{});
  socket.close();
}
