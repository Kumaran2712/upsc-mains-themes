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

try {
  await command('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true},session);
  await navigate('/stage-0/');
  assert(await evalJS("document.querySelector('#s0-subjects').getBoundingClientRect().top<1100"));
  assert(await evalJS("[...document.querySelectorAll('.tabbar a')].some(a=>a.textContent.includes('Learn'))"));
  await navigate('/themes/');
  await evalJS("document.querySelector('[name=q]').value='zzzz-no-theme';document.querySelector('[name=q]').dispatchEvent(new Event('input', {bubbles:true}))");
  assert.equal(await evalJS("document.querySelectorAll('#theme-list li:not([hidden])').length"),0);
  await evalJS("document.querySelector('[name=q]').value='';document.querySelector('[name=q]').dispatchEvent(new Event('input', {bubbles:true}))");
  assert.equal(await evalJS("document.querySelectorAll('#theme-list li:not([hidden])').length"),175);
  await navigate('/search/');
  await evalJS("document.querySelector('#query').value='IR';document.querySelector('#search-form').requestSubmit()");
  await wait("document.querySelector('#status').textContent.includes('results for')");
  assert(await evalJS("document.querySelectorAll('#results a[href*=\"stage-0\"]').length>0"));
  await evalJS("document.querySelector('#query').value='sovereignty';document.querySelector('#search-form').requestSubmit()");
  await wait("document.querySelector('#status').textContent.includes('sovereignty')");
  assert(await evalJS("document.querySelector('#results a[href*=\"polity/sovereignty\"]')!==null"));
  await navigate('/maps/lab/');
  assert.equal(await evalJS("getComputedStyle(document.querySelector('#work')).display"),'none');
  await command('Network.setBlockedURLs',{urls:['*://*/maps/base/*']},session);
  await click('[data-id="free-india"]');
  await wait("document.querySelector('#base-slot').textContent.includes('could not load')");
  await command('Network.setBlockedURLs',{urls:[]},session);
  await click('[data-id="free-india"]');
  await wait("!!document.querySelector('#base-slot svg')");
  await navigate('/daily/');
  await wait("document.querySelectorAll('.pqi .opt').length>0");
  await click('.pqi .opt');
  assert.equal(await evalJS("document.querySelector('.pqi .opt').getAttribute('aria-pressed')"),'true');
  await click('#pcheck'); await navigate('/daily/');
  await wait("document.querySelectorAll('.pqi .opt').length>0");
  assert.equal(await evalJS("document.querySelector('#pscore').hidden"),false);
  assert.equal(await evalJS("document.querySelector('.pqi .opt').disabled"),true);
  for(const path of ['/learn/','/questions/','/themes/','/search/','/stage-0/','/maps/lab/']) for(const width of [320,390,768]) {
    await assertLayout(path,width,844);
  }
  assert.deepEqual(exceptions,[]);
  console.log('PASS: quiz submission survives reload; semantic selection; lab hidden/retry states; theme filters; IR/concept search; subject visibility; 18 responsive layouts; no runtime exceptions.');
} finally { for(const context of contexts) await command('Target.disposeBrowserContext',{browserContextId:context.browserContextId}); socket.close(); }
