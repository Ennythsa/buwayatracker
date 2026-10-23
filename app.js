/* Buwaya Tracker – reads CONFIG.dataFile (same file the C program uses) */
const $ = id => document.getElementById(id);
let DATA = [], picked = new Set(), shown = [];

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const items = s => (s || '').split(CONFIG.listSeparator).map(x => x.trim()).filter(Boolean);

function parse(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  const head = lines.shift().split(CONFIG.delimiter).map(h => h.trim());
  return lines.map(l => {
    const p = l.split(CONFIG.delimiter), o = {};
    head.forEach((h, i) => o[h] = (p[i] || '').trim());
    return o;
  });
}

function setup() {
  document.title = CONFIG.siteName + " – Know your candidates";
  $('brandName').textContent = CONFIG.siteName;
  $('repoLink').href = CONFIG.repoUrl;
  $('dlApp').href = CONFIG.appDownloadUrl;
  $('dlData').href = CONFIG.dataFile;
  $('updated').textContent = "Data status: " + CONFIG.lastUpdated;
  $('disclaimer').textContent = CONFIG.disclaimer;
}

function fillSelect(id, key) {
  [...new Set(DATA.map(d => d[key]))].sort().forEach(v => $(id).add(new Option(v, v)));
}

function render() {
  const q = $('q').value.toLowerCase().trim(), p = $('party').value, o = $('office').value;
  shown = DATA.filter(d => (!p || d.party === p) && (!o || d.office === o) &&
    (!q || [d.name, d.party, d.office, d.platform, d.track_record].join(' ').toLowerCase().includes(q)));
  $('count').textContent = shown.length + " of " + DATA.length + " candidates";
  $('empty').hidden = shown.length > 0;
  $('grid').innerHTML = shown.map(d => `
    <article class="card">
      <span class="chip">${esc(d.office)}</span>
      <h3>${esc(d.name)}</h3>
      <p class="meta">${esc(d.party)}</p>
      <div class="row">
        <button class="btn alt" data-view="${esc(d.id)}">View profile</button>
        <label class="pick"><input type="checkbox" data-pick="${esc(d.id)}" ${picked.has(d.id) ? 'checked' : ''}> Compare</label>
      </div>
    </article>`).join('');
}

const block = (title, text) => `<h4>${title}</h4><ul>${items(text).map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
const profile = d => `<div><h3>${esc(d.name)}</h3><p class="meta">${esc(d.party)} · ${esc(d.office)}</p>
  ${block('Platform', d.platform)}${block('Recent track record', d.track_record)}
  ${d.sources ? `<h4>Source</h4><p class="small"><a href="${esc(d.sources)}" target="_blank" rel="noopener">${esc(d.sources)}</a></p>` : ''}</div>`;

let current = [];
function openDialog(list, title) {
  current = list;
  $('dTitle').textContent = title;
  $('dBody').innerHTML = `<div class="cmp" style="--n:${list.length}">${list.map(profile).join('')}</div>`;
  $('dlg').showModal();
}

function summaryText(list) {
  const line = '='.repeat(60);
  return CONFIG.siteName.toUpperCase() + " SUMMARY\n" + CONFIG.disclaimer + "\n" + line + "\n\n" +
    list.map(d => `Name: ${d.name}\nParty: ${d.party}\nOffice: ${d.office}\nPlatform:\n` +
      items(d.platform).map(i => '  - ' + i).join('\n') + "\nRecent track record:\n" +
      items(d.track_record).map(i => '  - ' + i).join('\n') + (d.sources ? "\nSource: " + d.sources : '') +
      "\n\n" + line + "\n\n").join('');
}

function updateTray() {
  $('tray').hidden = picked.size === 0;
  $('trayText').textContent = picked.size + " selected (choose 2 to compare)";
  $('cmpBtn').disabled = picked.size < 2;
}

document.addEventListener('click', e => {
  const v = e.target.dataset.view;
  if (v) { const d = DATA.find(x => x.id === v); openDialog([d], d.name); }
});
document.addEventListener('change', e => {
  const id = e.target.dataset.pick;
  if (!id) return;
  if (e.target.checked) {
    if (picked.size >= 2) { e.target.checked = false; return; }
    picked.add(id);
  } else picked.delete(id);
  updateTray();
});
$('cmpBtn').onclick = () => openDialog(DATA.filter(d => picked.has(d.id)), 'Side-by-side comparison');
$('clrSel').onclick = () => { picked.clear(); updateTray(); render(); };
$('dClose').onclick = () => $('dlg').close();
$('dPrint').onclick = () => window.print();
$('dExport').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([summaryText(current)], { type: 'text/plain' }));
  a.download = 'buwaya_summary.txt'; a.click(); URL.revokeObjectURL(a.href);
};
['q', 'party', 'office'].forEach(id => $(id).addEventListener('input', render));
$('reset').onclick = () => { $('q').value = ''; $('party').value = ''; $('office').value = ''; render(); };

setup();
fetch(CONFIG.dataFile).then(r => { if (!r.ok) throw 0; return r.text(); }).then(t => {
  DATA = parse(t); fillSelect('party', 'party'); fillSelect('office', 'office'); render();
}).catch(() => {
  $('loadError').hidden = false;
  $('loadError').textContent = "Could not load " + CONFIG.dataFile + ". If you opened index.html by double-clicking, run it through GitHub Pages or a local server.";
});
