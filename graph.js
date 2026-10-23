/* Dynasty network: force-directed graph on <canvas>. Data: dynasty_nodes.csv + dynasty_links.csv */
(async () => {
  const cv = $('graph'), ctx = cv.getContext('2d'), tip = $('tip');
  let N = [], E = [], fam = [], W = 800, H = 500, drag = null, hover = null, dpr = 1;
  try {
    const [a, b] = await Promise.all([fetch(CONFIG.nodesFile).then(r => r.text()), fetch(CONFIG.linksFile).then(r => r.text())]);
    N = parseCSV(a); const map = Object.fromEntries(N.map(n => [n.key, n]));
    E = parseCSV(b).map(l => ({ a: map[l.from], b: map[l.to], rel: l.relation })).filter(l => l.a && l.b);
  } catch (_) { return; }
  fam = [...new Set(N.map(n => n.family))];
  const col = f => `hsl(${(fam.indexOf(f) * 360 / fam.length + 15) % 360} 60% 45%)`;
  $('legend').innerHTML = fam.map(f => `<span><i style="background:${col(f)}"></i>${esc(f)}</span>`).join('');
  const deg = {}; E.forEach(l => { deg[l.a.key] = (deg[l.a.key]||0)+1; deg[l.b.key] = (deg[l.b.key]||0)+1; });
  N.forEach((n, i) => { const k = fam.indexOf(n.family), ang = k / fam.length * 6.28; n.x = W/2 + Math.cos(ang) * 150 + (Math.random()-.5)*60; n.y = H/2 + Math.sin(ang) * 150 + (Math.random()-.5)*60; n.vx = n.vy = 0; n.r = 6 + Math.min(deg[n.key]||0, 6) * 1.3; });
  const resize = () => { dpr = devicePixelRatio || 1; const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W*dpr; cv.height = H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); };
  resize(); addEventListener('resize', resize);
  const dark = () => matchMedia('(prefers-color-scheme:dark)').matches;
  function step() {
    for (const n of N) for (const m of N) if (n !== m) { let dx = n.x-m.x, dy = n.y-m.y, d2 = dx*dx+dy*dy+.01, f = 2600/d2, d = Math.sqrt(d2); n.vx += dx/d*f; n.vy += dy/d*f; }
    for (const l of E) { const dx = l.b.x-l.a.x, dy = l.b.y-l.a.y, d = Math.hypot(dx,dy)||1, f = (d-70)*.02; l.a.vx += dx/d*f; l.a.vy += dy/d*f; l.b.vx -= dx/d*f; l.b.vy -= dy/d*f; }
    for (const n of N) { n.vx += (W/2-n.x)*.004; n.vy += (H/2-n.y)*.006; if (n !== drag) { n.x += n.vx; n.y += n.vy; } n.vx *= .82; n.vy *= .82; n.x = Math.max(n.r, Math.min(W-n.r, n.x)); n.y = Math.max(n.r, Math.min(H-n.r, n.y)); }
  }
  const linked = n => hover && (n === hover || E.some(l => (l.a === hover && l.b === n) || (l.b === hover && l.a === n)));
  function draw() {
    step(); ctx.clearRect(0,0,W,H); const ink = dark() ? '#e8f0e9' : '#10231c';
    for (const l of E) { const on = hover && (l.a === hover || l.b === hover); ctx.globalAlpha = hover && !on ? .1 : .5; ctx.strokeStyle = ink; ctx.lineWidth = on ? 2 : 1; ctx.beginPath(); ctx.moveTo(l.a.x,l.a.y); ctx.lineTo(l.b.x,l.b.y); ctx.stroke(); }
    ctx.font = '500 12px Bricolage Grotesque, system-ui, sans-serif'; ctx.textAlign = 'center';
    for (const n of N) { ctx.globalAlpha = hover && !linked(n) ? .2 : 1; ctx.fillStyle = col(n.family); ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,6.28); ctx.fill();
      if (n.candidate_id) { ctx.lineWidth = 3; ctx.strokeStyle = '#f5c518'; ctx.stroke(); }
      if (!hover || linked(n)) { ctx.fillStyle = ink; ctx.fillText(n.name, n.x, n.y + n.r + 13); } }
    ctx.globalAlpha = 1; requestAnimationFrame(draw);
  }
  const at = e => { const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; return [x, y, N.find(n => Math.hypot(n.x-x, n.y-y) < n.r + 6)]; };
  cv.addEventListener('pointerdown', e => { const [x,y,n] = at(e); if (n) { drag = n; hover = n; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; n.moved = false; } });
  cv.addEventListener('pointermove', e => { const [x,y,n] = at(e); if (drag) { drag.x = x; drag.y = y; drag.moved = true; } else hover = n || null;
    const h = drag || hover; if (h) { const rel = E.filter(l => l.a === h || l.b === h).map(l => `${esc(l.a === h ? l.b.name : l.a.name)}: ${esc(l.a === h ? l.rel : l.rel)}`).slice(0,5).join('<br>');
      tip.innerHTML = `<b>${esc(h.name)}</b><br>${esc(h.office)}<br>${rel}`; tip.style.left = Math.min(x+14, W-230) + 'px'; tip.style.top = (y+14) + 'px'; tip.hidden = false; } else tip.hidden = true; });
  cv.addEventListener('pointerup', () => { if (drag && !drag.moved && drag.candidate_id) openProfile(drag.candidate_id); drag = null; cv.style.cursor = 'grab'; });
  cv.addEventListener('pointerleave', () => { if (!drag) { hover = null; tip.hidden = true; } });
  draw();
})();
