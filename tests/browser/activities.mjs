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

const name = 'activities_' + Date.now().toString(36), password = 'cross-device-test-password';
async function signIn(mode) {
  await wait("!document.querySelector('[data-account-open]').disabled");
  await click('[data-account-open]'); await click('[data-auth-mode="'+mode+'"]');
  await evalJS(`document.querySelector('[data-account-form] [name=username]').value=${JSON.stringify(name)}; document.querySelector('[data-account-form] [name=password]').value=${JSON.stringify(password)}; document.querySelector('[data-account-form]').requestSubmit()`);
  await wait(`document.querySelector('[data-account-label]').textContent.includes(${JSON.stringify(name)})`);
  await click('[data-account-close]'); await wait("window.__activityScope==='account'");
}
try {
  await navigate('/themes/');
  const path = await evalJS("document.querySelector('#theme-list li[data-name] a').pathname");
  await evalJS("localStorage.setItem('upscthemes-done','[1,2]')");
  await navigate(path); await signIn('signup');
  const themeId = await evalJS("Number(document.querySelector('.rm-mark').dataset.n)");
  assert.equal(await evalJS("document.querySelector('.rm-mark').getAttribute('aria-pressed')"),'false');
  await click('.rm-mark'); await wait("document.querySelector('[data-activity-status]').textContent==='Saved to your account.'");
  assert.equal(await evalJS("localStorage.getItem('upscthemes-done')"),'[1,2]');
  const device1 = session, second = await newPage(); contexts.push(second); session = second.sessionId;
  await navigate(path); await signIn('login');
  assert.equal(await evalJS("document.querySelector('.rm-mark').getAttribute('aria-pressed')"),'true');
  await click('.rm-mark'); await wait("document.querySelector('[data-activity-status]').textContent==='Saved to your account.'");
  await click('[data-account-logout]'); await wait("window.__activityScope==='guest'");
  assert.equal(await evalJS("document.querySelector('.rm-mark').getAttribute('aria-pressed')"),'false');
  session = device1; await navigate(path); await wait("window.__activityScope==='account'");
  assert.equal(await evalJS("document.querySelector('.rm-mark').getAttribute('aria-pressed')"),'false');
  await command('Network.setBlockedURLs',{urls:['*://*/api/activity/roadmap']},session);
  await click('.rm-mark'); await wait("!document.querySelector('[data-activity-retry]').hidden");
  assert(await evalJS("document.querySelector('[data-activity-status]').textContent.includes('not saved')"));
  await command('Network.setBlockedURLs',{urls:[]},session); await click('[data-activity-retry]');
  await wait("document.querySelector('[data-activity-status]').textContent==='Saved to your account.'");
  await navigate('/daily/'); await wait("window.__activityScope==='account' && document.querySelector('.pqi .opt')");
  await click('.pqi .opt'); await click('#pcheck'); await wait("document.querySelector('[data-activity-status]').textContent==='Saved to your account.'");
  await navigate('/maps/lab/'); await wait("window.__activityScope==='account'"); await click('[data-id="free-india"]');
  await wait("!!document.querySelector('#base-slot svg')"); await click('#b-reveal'); await click('#check input'); await click('#b-save');
  await wait("document.querySelector('[data-activity-status]').textContent==='Saved to your account.'");
  await navigate('/maps/lab/'); await wait("window.__activityScope==='account'");
  assert(await evalJS("document.querySelector('[data-best=\"free-india\"]').textContent.includes('1/5')"));
  await navigate('/maps/india-outline/'); await wait("window.__activityScope==='account'");
  await click('#q-start');
  for (let i = 1; i <= 10; i++) {
    const prompt = await evalJS("document.querySelector('#q-ask').textContent");
    const wanted = prompt.match(/^Tap: (.+) \(\d+\/10\)$/)?.[1]; assert(wanted, prompt);
    // Two rapid activations must count as one answer, including from a keyboard.
    await evalJS(`{ const state = document.querySelector('#m0 .st[data-name='+CSS.escape(${JSON.stringify(wanted)})+']'); state.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); state.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); }`);
    await wait(i === 10 ? "document.querySelector('#q-ask').textContent.startsWith('Done:')" : `document.querySelector('#q-ask').textContent.endsWith('(${i+1}/10)')`);
  }
  assert(await evalJS("document.querySelector('#q-ask').textContent.includes('10 of 10')"));
  await wait("document.querySelector('[data-activity-status]').textContent==='Saved to your account.'");
  assert.equal(await evalJS("localStorage.getItem('upscthemes-quiz-india-states')"),null);
  session = second.sessionId; await navigate('/daily/'); await signIn('login'); await wait("document.querySelector('.pqi .opt')");
  assert.equal(await evalJS("document.querySelector('#pscore').hidden"),false);
  await navigate('/maps/india-outline/'); await wait("window.__activityScope==='account'");
  assert.equal(await evalJS("document.querySelector('#q-best').textContent"),'Best: 10/10');
  await click('[data-account-logout]'); await wait("window.__activityScope==='guest'");
  assert.equal(await evalJS("document.querySelector('#q-best').textContent"),'');
  await evalJS("localStorage.setItem('upscthemes-quiz-chokepoints','3')");
  await navigate('/maps/india-outline/'); await signIn('login');
  await click('[data-activity-import]'); await click('[data-activity-import-confirm]');
  await wait("document.querySelector('[data-activity-status]').textContent.includes('Guest work imported')");
  await navigate('/maps/neighbourhood-and-sea-routes/'); await wait("window.__activityScope==='account'");
  assert.equal(await evalJS("document.querySelector('#q-best').textContent"),'Best: 3/8');
  assert.equal(await evalJS("localStorage.getItem('upscthemes-quiz-chokepoints')"),'3');
  assert.deepEqual(exceptions,[]);
  console.log('PASS: cross-device roadmap/daily/sketch/quiz persistence, keyboard quiz with rapid-tap protection, explicit guest import, guest/account isolation, failed-save retry and no runtime exceptions.');
} finally { for(const context of contexts) await command('Target.disposeBrowserContext',{browserContextId:context.browserContextId}); socket.close(); }
