const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + req.url.split('?')[0]);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(file)] || 'text/plain');
  res.end(fs.readFileSync(file));
});

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-layout-'));
  const child = spawn(process.env.CADENCE_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-pipe', '--user-data-dir=' + profile, 'about:blank'],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  let id = 0, buffer = '';
  const pending = new Map();
  child.stdio[4].on('data', data => {
    buffer += data.toString();
    let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const message = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
      if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Timeout: ' + method)); }, 15000);
    pending.set(requestId, message => { clearTimeout(timer); message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result); });
    child.stdio[3].write(JSON.stringify({ id: requestId, method, params, sessionId }) + '\0');
  });
  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await send('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/index.html' }, sessionId);
    for (let attempt = 0; attempt < 50; attempt++) {
      if (await evaluate('Boolean(document.getElementById("openAddButton") && document.body.dataset.activeTab)')) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await evaluate(`document.getElementById('openAddButton').click();
      const source = document.getElementById('sourceText'); source.value = 'A simple passage for responsive reader verification. '.repeat(30);
      source.dispatchEvent(new Event('input', {bubbles:true})); document.getElementById('saveLibraryButton').click();`);
    await evaluate('new Promise(resolve => setTimeout(resolve, 150))');
    await evaluate(`document.querySelector('.library-item').dispatchEvent(new MouseEvent('click', {bubbles:true,detail:2}));`);
    assert.equal(await evaluate('document.body.dataset.activeTab'), 'reader');
    for (const [width, height] of [[390, 844], [932, 430], [667, 375], [1440, 900]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true }, sessionId);
      await evaluate('new Promise(resolve => setTimeout(resolve, 250))');
      const geometry = await evaluate(`(() => {
        const rect = selector => {const r = document.querySelector(selector).getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
        return {stage:rect('.reader-stage'), word:rect('.reader-word'), controls:rect('.reader-progress'), overflow:document.documentElement.scrollWidth > innerWidth};
      })()`);
      assert.equal(geometry.overflow, false);
      assert.ok(geometry.word.height > 0);
      assert.equal(await evaluate('document.getElementById("backButton").textContent'), 'Prev');
      assert.equal(await evaluate(`(() => {
        const buttons = ['backButton', 'playPauseButton', 'forwardButton'].map(id => document.getElementById(id).getBoundingClientRect());
        const library = document.getElementById('tab-library').getBoundingClientRect();
        const settings = document.getElementById('tab-settings').getBoundingClientRect();
        return buttons.every(r => Math.abs(r.y - buttons[0].y) < 1) && buttons[0].right <= buttons[1].x && buttons[1].right <= buttons[2].x && library.x < 30 && library.right < settings.x;
      })()`), true, 'Horizontal transport and top-left Library');
      assert.ok(geometry.word.bottom < geometry.controls.y || geometry.word.right <= geometry.controls.x, JSON.stringify(geometry));
      await evaluate('document.getElementById("readerMenuButton").click()');
      assert.equal(await evaluate('document.getElementById("readerVisualBar").inert'), false);
      assert.equal(await evaluate(`(() => {const bar = document.getElementById('readerVisualBar'); const r = bar.getBoundingClientRect(); return r.x >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && bar.scrollWidth <= bar.clientWidth;})()`), true, 'Settings overlay must fit');
      await evaluate('document.getElementById("readerMenuButton").click()');
      const before = await evaluate('document.querySelector(".reader-word").getBoundingClientRect().y');
      await evaluate('document.getElementById("playPauseButton").click()');
      const during = await evaluate('document.querySelector(".reader-word").getBoundingClientRect().y');
      assert.ok(Math.abs(before - during) < 1, 'Playback moved text');
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 100, y: 150, button: 'left', clickCount: 1 }, sessionId);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 100, y: 150, button: 'left', clickCount: 1 }, sessionId);
      assert.equal(await evaluate('document.body.classList.contains("playing-focus")'), false);
      await evaluate('document.getElementById("tab-library").click()');
      assert.equal(await evaluate(`(() => {
        const resume = document.getElementById('tab-reader').getBoundingClientRect();
        const tools = ['librarySearch', 'libraryViewList', 'libraryMenuButton'].map(id => document.getElementById(id).getBoundingClientRect());
        const searchHit = document.elementFromPoint(tools[0].x + tools[0].width / 2, tools[0].y + tools[0].height / 2);
        return searchHit.id === 'librarySearch' && Math.abs(resume.x + resume.width / 2 - innerWidth / 2) < 1 && resume.bottom <= innerHeight && resume.y > innerHeight - 90 && tools.every(r => Math.abs(r.y + r.height / 2 - tools[0].y - tools[0].height / 2) < 2) && tools[0].right <= tools[1].x && tools[1].right < tools[2].x;
      })()`), true, 'Centered floating Resume and single-row library tools');
      if (process.env.CADENCE_EVIDENCE_DIR) {
        const capture = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
        fs.mkdirSync(process.env.CADENCE_EVIDENCE_DIR, { recursive: true });
        fs.writeFileSync(path.join(process.env.CADENCE_EVIDENCE_DIR, `library-${width}x${height}.png`), Buffer.from(capture.data, 'base64'));
      }
      await evaluate('document.getElementById("tab-reader").click()');
      if (width > height && height <= 520) {
        await evaluate('document.getElementById("tab-library").click(); document.getElementById("openAddButton").click()');
        await evaluate('new Promise(resolve => setTimeout(resolve, 200))');
        for (const source of ['Text', 'File', 'Link']) {
          await evaluate(`document.getElementById('source${source}Button').click()`);
          assert.equal(await evaluate(`(() => {
            const pane = document.querySelector('.source-pane.is-active');
            const rect = el => el.getBoundingClientRect();
            const picker = rect(document.querySelector('.source-picker'));
            const actions = rect(document.querySelector('.prepare-actions'));
            const editor = rect(pane.querySelector('textarea'));
            const clear = rect(document.getElementById('clearSourceButton'));
            const input = pane.querySelector('input');
            const reload = pane.querySelector('[data-reload-source]');
            const center = r => r.y + r.height / 2;
            return actions.bottom <= innerHeight && actions.y >= editor.bottom && editor.height > 50 && editor.y >= picker.bottom && Math.abs(center(clear) - center(picker)) < 2 && (!input || (Math.abs(center(rect(input)) - center(picker)) < 2 && Math.abs(center(rect(reload)) - center(picker)) < 2 && rect(input).width > 50)) && document.querySelector('.add-panel-card').scrollWidth <= innerWidth;
          })()`), true, source + ' landscape preparation fit');
        }
        if (process.env.CADENCE_EVIDENCE_DIR) {
          const capture = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
          fs.writeFileSync(path.join(process.env.CADENCE_EVIDENCE_DIR, `prepare-${width}x${height}.png`), Buffer.from(capture.data, 'base64'));
        }
        await evaluate('document.getElementById("cancelAddButton").click()');
        await evaluate(`document.querySelector('.library-item').dispatchEvent(new MouseEvent('click', {bubbles:true,detail:2}))`);
      }
      if (process.env.CADENCE_EVIDENCE_DIR) {
        fs.mkdirSync(process.env.CADENCE_EVIDENCE_DIR, { recursive: true });
        const capture = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
        fs.writeFileSync(path.join(process.env.CADENCE_EVIDENCE_DIR, `${width}x${height}.png`), Buffer.from(capture.data, 'base64'));
      }
      console.log(`${width}x${height}: fit, overlay, stable playback and pointer pause passed`);
    }
    await evaluate('document.getElementById("tab-library").click()');
    assert.equal(await evaluate('document.getElementById("tab-reader").hidden'), false);
    assert.equal(await evaluate('document.getElementById("panel-reader").inert'), true);
    await evaluate(`const book = document.querySelector('.library-item');
      book.dispatchEvent(new PointerEvent('pointerup', {bubbles:true,pointerType:'touch'}));
      book.dispatchEvent(new PointerEvent('pointerup', {bubbles:true,pointerType:'touch'}));`);
    assert.equal(await evaluate('document.body.dataset.activeTab'), 'reader', 'Double-tap opens book');
    await evaluate('document.getElementById("tab-library").click()');
    assert.equal(await evaluate(`(() => {const list = document.getElementById('libraryList'); return list.scrollWidth <= list.clientWidth;})()`), true);
    await evaluate('document.getElementById("tab-settings").click(); document.getElementById("themeDarkButton").click(); document.getElementById("tab-reader").click()');
    assert.equal(await evaluate('document.body.dataset.theme'), 'dark');
    assert.equal(await evaluate('document.body.dataset.activeTab'), 'reader');
    console.log('Contextual Resume and inactive-region focus isolation passed');
  } finally {
    child.kill(); server.close();
  }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
