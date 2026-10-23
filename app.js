/* Buwaya Tracker – reads the same CSV the C program uses */
const $ = id => document.getElementById(id);
let DATA = [], picked = new Set(), shown = [], current = [], lang = 'en';
const T = k => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;
const esc = s => String(s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const items = s => (s || '').split(CONFIG.listSeparator).map(x => x.trim()).filter(Boolean);
const parseCSV = t => { const L = t.replace(/\r/g,'').split('\n').filter(l => l.trim()), H = L.shift().split(CONFIG.delimiter);
  return L.map(l => { const p = l.split(CONFIG.delimiter), o = {}; H.forEach((h,i) => o[h.trim()] = (p[i]||'').trim()); return o; }); };
const hue = s => [...s].reduce((a,c) => a + c.charCodeAt(0), 0) % 360;
const initials = n => n.replace(/["“”]/g,'').split(/\s+/).filter(w => /^[A-Z]/.test(w)).map(w => w[0]).slice(0,2).join('');
const parties = () => [...new Set(DATA.map(d => d.party))].sort();

function applyLang() {
  document.documentElement.lang = lang === 'ceb' ? 'ceb' : lang;
  document.querySelectorAll('[data-i]').forEach(e => e.textContent = T(e.dataset.i));
  document.querySelectorAll('[data-ph]').forEach(e => e.placeholder = T(e.dataset.ph));
  $('statusTxt').textContent = CONFIG.dataStatus;
  fill('party', 'allP', 'party'); fill('office', 'allO', 'office'); render(); updateTray();
}
function fill(id, allKey, key) {
  const el = $(id), v = el.value; el.innerHTML = '';
  el.add(new Option(T(allKey), ''));
  [...new Set(DATA.map(d => d[key]))].sort().forEach(x => el.add(new Option(x, x)));
  el.value = v;
}
function render() {
  const q = $('q').value.toLowerCase().trim(), p = $('party').value, o = $('office').value;
  shown = DATA.filter(d => (!p || d.party === p) && (!o || d.office === o) && (!q || Object.values(d).join(' ').toLowerCase().includes(q)));
  $('count').textContent = `${shown.length} ${T('of')} ${DATA.length} ${T('cands')}`;
  $('empty').hidden = shown.length > 0 || !DATA.length;
  $('grid').innerHTML = shown.map(d => `<article class="card"><div class="who"><div class="av" style="background:hsl(${hue(d.party)} 45% 32%)" aria-hidden="true">${esc(initials(d.name))}</div>
    <div><h3>${esc(d.name)}</h3><p class="meta">${esc(d.party)}</p></div></div><span class="chip">${esc(d.office)}</span>
    <div class="row"><button class="btn alt" data-view="${esc(d.id)}">${T('view')}</button>
    <label class="pick"><input type="checkbox" data-pick="${esc(d.id)}" ${picked.has(d.id)?'checked':''}> ${T('cmp')}</label></div></article>`).join('');
}
const block = (t, s) => items(s).length ? `<h4>${t}</h4><ul>${items(s).map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '';
const profile = d => `<div><h3>${esc(d.name)}</h3><p class="meta">${esc(d.party)} · ${esc(d.office)}</p>
  ${block(T('plat'), d.platform)}${block(T('track'), d.track_record)}${block(T('bills'), d.bills_authored)}
  ${d.recent_developments ? block(`${T('news')} (${T('asof')} ${esc(d.news_as_of)})`, d.recent_developments) : ''}
  ${d.sources ? `<h4>${T('src')}</h4><p class="small"><a href="${esc(d.sources)}" target="_blank" rel="noopener">${esc(d.sources)}</a></p>` : ''}</div>`;
function openDialog(list, title) {
  current = list; $('dTitle').textContent = title;
  $('dBody').innerHTML = `<div class="cmp" style="--n:${list.length}">${list.map(profile).join('')}</div>`; $('dlg').showModal();
}
window.openProfile = id => { const d = DATA.find(x => x.id === id); if (d) openDialog([d], d.name); };
function summaryText(list) {
  const ln = '='.repeat(60), b = a => items(a).map(i => '  - ' + i).join('\n');
  return `${CONFIG.siteName.toUpperCase()} SUMMARY\n${CONFIG.disclaimer}\n${ln}\n\n` + list.map(d =>
    `Name: ${d.name}\nParty: ${d.party}\nOffice: ${d.office}\nPlatform:\n${b(d.platform)}\nTrack record:\n${b(d.track_record)}\nBills authored:\n${b(d.bills_authored)}\n` +
    (d.recent_developments ? `Recent developments (as of ${d.news_as_of}):\n${b(d.recent_developments)}\n` : '') + `Source: ${d.sources}\n\n${ln}\n\n`).join('');
}
function updateTray() { $('tray').hidden = !picked.size; $('trayN').textContent = picked.size; $('cmpBtn').disabled = picked.size < 2; }

document.addEventListener('click', e => { if (e.target.dataset.view) openProfile(e.target.dataset.view); });
document.addEventListener('change', e => {
  const id = e.target.dataset.pick; if (!id) return;
  if (e.target.checked) { if (picked.size >= 2) { e.target.checked = false; return; } picked.add(id); } else picked.delete(id);
  updateTray();
});
$('cmpBtn').onclick = () => openDialog(DATA.filter(d => picked.has(d.id)), T('cmpT'));
$('clrSel').onclick = () => { picked.clear(); updateTray(); render(); };
$('dClose').onclick = () => $('dlg').close(); $('dPrint').onclick = () => window.print();
$('dExport').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([summaryText(current)], {type:'text/plain'}));
  a.download = 'buwaya_summary.txt'; a.click(); URL.revokeObjectURL(a.href); };
['q','party','office'].forEach(id => $(id).addEventListener('input', render));
$('reset').onclick = () => { $('q').value = ''; $('party').value = ''; $('office').value = ''; render(); };
$('lang').onchange = e => { lang = e.target.value; try { localStorage.setItem('bt_lang', lang); } catch(_){} applyLang(); };

document.title = CONFIG.siteName; $('brandName').textContent = CONFIG.siteName; $('repoLink').href = CONFIG.repoUrl;
$('dlApp').href = CONFIG.appDownloadUrl; $('dlData').href = CONFIG.dataFile; $('disclaimer').textContent = CONFIG.disclaimer;
try { lang = localStorage.getItem('bt_lang') || ((navigator.language||'').startsWith('fil') ? 'fil' : 'en'); } catch(_){}
$('lang').value = lang; applyLang();
fetch(CONFIG.dataFile).then(r => { if (!r.ok) throw 0; return r.text(); }).then(t => { DATA = parseCSV(t); applyLang(); })
  .catch(() => { $('loadError').hidden = false; $('loadError').textContent = `Could not load ${CONFIG.dataFile}. Run the site through GitHub Pages or a local server, not by double-clicking index.html.`; });
