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
  await wait(`location.pathname===${JSON.stringify(path)} && document.readyState==='complete' && !!document.querySelector('.s0')`);
  await evalJS('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
}
async function click(selector) { await evalJS(`document.querySelector(${JSON.stringify(selector)}).click()`); }
async function send(text) {
  await evalJS(`document.querySelector('#s0-message-input').value=${JSON.stringify(text)}; document.querySelector('#s0-message-form').requestSubmit()`);
  await wait(`document.querySelector('#s0-messages').getAttribute('aria-busy')==='false'`);
  return evalJS(`document.querySelector('#s0-messages article:last-child p').textContent`);
}
async function screenshot(name) {
  const {data} = await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},session);
  await fs.writeFile(join(tmpdir(), name + '.png'),Buffer.from(data,'base64'));
}
async function assertLayout(path,width,height) {
  await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600},session);
  await navigate(path);
  assert(await evalJS('document.documentElement.scrollWidth<=innerWidth+1'), 'Horizontal overflow: '+path+' at '+width);
}
const username = 'browser_' + Date.now().toString(36);
const password = 'browser-private-password-123';
async function signIn(name, mode='login') {
  await click('[data-account-open]');
  await click(`[data-auth-mode="${mode}"]`);
  await evalJS(`document.querySelector('[data-account-form] [name="username"]').value=${JSON.stringify(name)};document.querySelector('[data-account-form] [name="password"]').value=${JSON.stringify(password)};document.querySelector('[data-account-form]').requestSubmit()`);
  await wait(`document.querySelector('[data-account-label]').textContent.includes(${JSON.stringify(name)})`);
  if(mode==='signup') {
    await wait(`!document.querySelector('[data-recovery-result]').hidden`);
    assert.equal((await evalJS(`document.querySelector('[data-recovery-code]').value`)).length,43);
  }
  await click('[data-account-close]');
  await wait(`document.querySelector('[data-recovery-code]').value===''`);
}
async function liveReady() { await wait(`document.querySelector('#s0-live-input') && !document.querySelector('#s0-live-input').disabled`); }
async function sendLive(text) {
  await evalJS(`document.querySelector('#s0-live-input').value=${JSON.stringify(text)};document.querySelector('[data-live-form]').requestSubmit()`);
  await wait(`document.querySelector('#s0-live-messages').getAttribute('aria-busy')==='false' && document.querySelectorAll('#s0-live-messages article').length>=2`);
}
async function answerCheck(text,index) {
  await evalJS(`document.querySelector('[data-live-answer]').value=${JSON.stringify(text)};document.querySelector('[data-live-answer-form]').requestSubmit()`);
  await wait(`document.querySelectorAll('[data-live-check-history] li').length===${index+1} && !document.querySelector('[data-live-check-submit]').disabled`);
}
try {
  await command('Emulation.setDeviceMetricsOverride',{width:1360,height:1000,deviceScaleFactor:1,mobile:false},session);
  await navigate('/stage-0/');
  await wait(`!document.querySelector('[data-account-open]').disabled`);
  await evalJS(`localStorage.setItem('upscthemes-stage0-prototype-v1',JSON.stringify({version:1,entries:{'polity/sovereignty':{status:'Understood',updated:1,messages:[{role:'tutor',text:'old fake progress'}]}}}));localStorage.setItem('upscthemes-done','[1,2]')`);
  await navigate('/stage-0/');
  await wait(`!document.querySelector('[data-account-open]').disabled`);
  assert.equal(await evalJS(`document.getElementById('s0-understood').textContent`),'0');
  await signIn(username,'signup');
  assert.equal(await evalJS(`localStorage.getItem('upscthemes-done')`),'[1,2]');
  assert.equal(await evalJS(`Object.keys(localStorage).filter(k=>k.includes('token')||k.includes('session')).length`),0);
  assert.equal(await evalJS(`document.cookie.includes('stage0_session')`),false);
  console.log('PASS: account creation, one-time recovery display, HttpOnly session, no browser-token storage or prototype progress import');

  await navigate('/stage-0/polity/sovereignty/'); await liveReady();
  await sendLive('<img src=x onerror="window.xssTest=true">');
  await wait(`document.querySelector('#s0-live-messages').textContent.includes('தமிழ்')`);
  assert.equal(await evalJS(`!!window.xssTest||!!document.querySelector('#s0-live-messages img')`),false);
  assert.equal(await evalJS(`document.querySelectorAll('#s0-live-messages article').length`),2);
  await navigate('/stage-0/polity/sovereignty/'); await liveReady();
  assert.equal(await evalJS(`document.querySelectorAll('#s0-live-messages article').length`),2);
  console.log('PASS: real HTTP adapter streaming with UTF-8 text, safe text rendering and restored server conversation');

  await click('[data-live-open-check]');
  await wait(`!document.querySelector('[data-live-check]').hidden && document.querySelector('[data-live-check-question]').textContent.includes('1 of 3')`);
  await evalJS(`document.querySelector('[data-live-answer]').value='My saved draft about governing authority.';document.querySelector('[data-live-answer]').dispatchEvent(new Event('input'))`);
  await wait(`document.querySelector('[data-live-check-message]').textContent==='Draft saved to your account.'`);
  await navigate('/stage-0/polity/sovereignty/'); await liveReady(); await click('[data-live-open-check]');
  assert.equal(await evalJS(`document.querySelector('[data-live-answer]').value`),'My saved draft about governing authority.');
  await answerCheck('Independent reasoning about the central meaning.',0);
  assert.equal(await evalJS(`document.querySelector('#s0-current-status').textContent`),'Exploring');
  assert.match(await evalJS(`document.querySelector('[data-live-check-question]').textContent`),/2 of 3/);
  await answerCheck('Independent reasoning distinguishing the two ideas.',1);
  assert.equal(await evalJS(`document.querySelector('#s0-current-status').textContent`),'Exploring');
  await answerCheck('Independent application with a reason for the new situation.',2);
  assert.equal(await evalJS(`document.querySelector('#s0-current-status').textContent`),'Understood');
  assert.equal(await evalJS(`document.querySelector('[data-live-answer-form]').hidden`),true);
  await click('[data-live-revisit]');
  await wait(`document.querySelector('[data-live-revisit]').textContent.includes('Saved')`);
  assert.equal(await evalJS(`document.querySelector('#s0-current-status').dataset.status`),'Understood');
  await screenshot('stage0-live-check-desktop');
  console.log('PASS: one question at a time, server draft restoration, three evidence steps and independent revisit reminder');

  await navigate('/stage-0/');
  await wait(`document.getElementById('s0-understood').textContent==='1' && document.getElementById('s0-revisit').textContent==='1'`);
  assert.match(await evalJS(`document.getElementById('s0-continue').pathname`),/sovereignty/);
  await navigate('/stage-0/polity/');
  await wait(`document.querySelector('[data-concept-status="polity/sovereignty"]').textContent.includes('Understood')`);
  await evalJS(`{const f=document.querySelector('#s0-status-filter');f.value='Revisit';f.dispatchEvent(new Event('change'));}`);
  assert.equal(await evalJS(`document.querySelectorAll('[data-concept-item]:not([hidden])').length`),1);
  await evalJS(`{const f=document.querySelector('#s0-status-filter');f.value='Understood';f.dispatchEvent(new Event('change'));}`);
  assert.equal(await evalJS(`document.querySelectorAll('[data-concept-item]:not([hidden])').length`),1);
  console.log('PASS: account dashboard, recent conversation and subject filters retain understood and saved states');

  await navigate('/stage-0/polity/sovereignty/'); await liveReady();
  await evalJS(`document.querySelector('#s0-live-input').value='slow-reply';document.querySelector('[data-live-form]').requestSubmit()`);
  await wait(`!document.querySelector('[data-live-stop]').hidden && document.querySelector('#s0-live-messages').getAttribute('aria-busy')==='true'`);
  await click('[data-live-stop]');
  await wait(`document.querySelector('#s0-live-messages').getAttribute('aria-busy')==='false'`);
  await click('[data-live-refresh]'); await liveReady();
  assert.equal(await evalJS(`document.querySelectorAll('#s0-live-messages article').length`),2);
  await click('[data-account-logout]');
  await wait(`document.querySelector('[data-account-label]').textContent.includes('Sign in') && document.querySelector('#s0-live-input').disabled`);
  assert.equal(await evalJS(`document.querySelector('#s0-live-messages').textContent.includes('தமிழ்')`),false);
  assert.equal(await evalJS(`document.querySelector('[data-live-answer]').value`),'');
  await signIn(username+'_two','signup'); await liveReady();
  assert.equal(await evalJS(`document.querySelector('#s0-live-messages').textContent.includes('தமிழ்')`),false);
  assert.equal(await evalJS(`document.querySelector('#s0-current-status').textContent`),'Not started');
  await click('[data-account-logout]');
  await wait(`!document.querySelector('[data-account-open]').hidden`);
  await signIn(username); await liveReady();
  assert.equal(await evalJS(`document.querySelectorAll('#s0-live-messages article').length`),2);
  console.log('PASS: stop discards incomplete replies; logout clears private views; accounts restore only their own conversations');

  await navigate('/stage-0/geography/erosion/');
  await wait(`document.querySelector('[data-account-label]').textContent.includes(${JSON.stringify(username)}) && !document.querySelector('[data-live-revisit]').disabled`);
  assert.equal(await evalJS(`!!document.querySelector('[data-live-form]')`),false);
  await click('[data-live-revisit]');
  await wait(`document.querySelector('[data-live-revisit]').textContent.includes('Saved')`);
  assert(await evalJS(`document.querySelector('[data-tutor-prompt] textarea').value.includes('Erosion in Geography')`));
  console.log('PASS: catalogue-only concepts remain free, portable and bookmarkable without a live lesson');

  for(const width of [1360,390,320]) {
    await assertLayout('/stage-0/',width,width===1360?1000:844);
    await screenshot('stage0-live-dashboard-'+width);
    await assertLayout('/stage-0/polity/sovereignty/',width,width===1360?1000:844); await liveReady();
    await screenshot('stage0-live-concept-'+width);
  }
  await click('[data-account-logout]');
  await wait(`!document.querySelector('[data-account-open]').hidden`);
  await click('[data-account-open]');
  assert(await evalJS(`document.documentElement.scrollWidth<=innerWidth+1`));
  await screenshot('stage0-live-signin-mobile');
  await click('[data-account-close]');
  assert.equal(exceptions.length,0,exceptions.join('\n'));
  console.log('PASS: desktop, 390px and 320px live layouts and account dialog, no runtime exceptions');
  console.log('ALL LIVE BROWSER CHECKS PASSED (LOCAL PROVIDER FIXTURE; NO REAL MODEL ACCURACY CLAIM)');
} finally {
  for (const c of contexts) await command('Target.disposeBrowserContext',{browserContextId:c.browserContextId}).catch(()=>{});
  socket.close();
}
