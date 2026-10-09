// v5 — friend-site logic:
// Live = UTC time between start & end
// Servers = match link_names to stream names (1 per name)

let eventsData = [];
let streamsData = {};
let allNamedStreams = []; // flat list {name, tag, url, api}
let statusFilter = 'all';
let categoryFilter = 'all';
let hlsInstance = null;
let shakaPlayer = null;

async function loadData() {
  try {
    const [er, sr] = await Promise.all([
      fetch('https://ratulxadia-playz-cats-event.hf.space/api/events'),
      fetch('https://ratul-liv-default-rtdb.asia-southeast1.firebasedatabase.app/.json')
    ]);
    eventsData = await er.json();
    streamsData = await sr.json();
    buildNamedIndex();
    buildCats();
    render();
  } catch (e) {
    console.error(e);
    document.getElementById('events-list').innerHTML = '<div class="empty">ডাটা লোড ব্যর্থ</div>';
  }
}

function ev(item) { return item.event || item; }

function stripKey(links) {
  if (!links) return '';
  let s = String(links);
  if (s.startsWith('pro/')) s = s.slice(4);
  if (s.endsWith('.txt')) s = s.slice(0, -4);
  return s;
}

function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Build searchable index of all streams by name
function buildNamedIndex() {
  allNamedStreams = [];
  const playz = streamsData['playz-streams'] || {};
  for (const k of Object.keys(playz)) {
    for (const s of (playz[k].streams || [])) {
      if (!s.link) continue;
      allNamedStreams.push({
        name: s.name || s.linkTag || 'Stream',
        tag: s.linkTag || 'HD',
        url: s.link.split('|')[0].trim(),
        api: s.api || '',
        key: k
      });
    }
  }
  const ls = streamsData['live-streams'] || {};
  for (const id of Object.keys(ls)) {
    for (const s of ls[id]) {
      if (!s.link) continue;
      allNamedStreams.push({
        name: s.title || 'Stream',
        tag: s.type === '1' ? 'FHD' : 'HD',
        url: s.link.split('|')[0].trim(),
        api: s.api || '',
        key: 'live-' + id
      });
    }
  }
}

function findStreamByName(label) {
  const n = norm(label);
  if (!n) return null;
  // exact norm match
  let hit = allNamedStreams.find(s => norm(s.name) === n);
  if (hit) return hit;
  // includes either way
  hit = allNamedStreams.find(s => {
    const sn = norm(s.name);
    return sn.includes(n) || n.includes(sn);
  });
  return hit || null;
}

function getStreamLinks(e) {
  const list = [];
  const seen = new Set();

  const playz = streamsData['playz-streams'] || {};
  const key = stripKey(e.links);

  // 1) Exact playz key — use those streams first
  if (key && playz[key] && playz[key].streams) {
    for (const s of playz[key].streams) {
      if (!s.link) continue;
      const url = s.link.split('|')[0].trim();
      if (seen.has(url)) continue;
      seen.add(url);
      list.push({
        name: s.name || s.linkTag || 'Stream',
        tag: s.linkTag || 'HD',
        url,
        api: s.api || ''
      });
    }
  }

  // 2) For each link_name, find matching stream by name (friend method)
  const names = e.link_names || [];
  for (const ln of names) {
    const label = typeof ln === 'string' ? ln : (ln.name || '');
    const tag = typeof ln === 'object' ? (ln.tag || 'HD') : 'HD';
    if (!label) continue;
    const hit = findStreamByName(label);
    if (hit && !seen.has(hit.url)) {
      seen.add(hit.url);
      list.push({ name: label, tag: tag || hit.tag, url: hit.url, api: hit.api });
    } else if (!hit) {
      // show label without url only if we have nothing yet from key
      // skip empty to avoid clutter
    }
  }

  return list;
}

// Live = current UTC within [start, end]
function getTimeWindow(e) {
  if (!e.date || !e.time) return { start: null, end: null };
  const [d, m, y] = e.date.split('/');
  const start = new Date(`${y}-${m}-${d}T${e.time}Z`);
  let end = null;
  if (e.end_time) {
    const ed = e.end_date || e.date;
    const [d2, m2, y2] = ed.split('/');
    end = new Date(`${y2}-${m2}-${d2}T${e.end_time}Z`);
  } else {
    // default 4h window if no end
    end = new Date(start.getTime() + 4 * 3600 * 1000);
  }
  return { start, end };
}

function isLive(e) {
  const { start, end } = getTimeWindow(e);
  if (!start) return e.visible === true;
  const now = Date.now();
  return now >= start.getTime() && now <= end.getTime();
}

function pad(n) { return String(n).padStart(2, '0'); }
function countdown(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'} UTC`;
}

function buildCats() {
  const set = new Set();
  eventsData.forEach(i => { const c = ev(i).category; if (c) set.add(c); });
  const el = document.getElementById('cat-filters');
  el.innerHTML = '<button class="filter-btn active" data-category="all">All Sports</button>' +
    [...set].sort().map(c => `<button class="filter-btn" data-category="${c}">${c}</button>`).join('');
  el.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      el.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      categoryFilter = btn.dataset.category;
      render();
    };
  });
}

function render() {
  const now = Date.now();
  let rows = eventsData.map(item => {
    const e = ev(item);
    return { item, e, live: isLive(e) };
  });

  document.getElementById('count-all').textContent = rows.length;
  document.getElementById('count-live').textContent = rows.filter(r => r.live).length;
  document.getElementById('count-upcoming').textContent = rows.filter(r => !r.live).length;

  if (statusFilter === 'live') rows = rows.filter(r => r.live);
  if (statusFilter === 'upcoming') rows = rows.filter(r => !r.live);
  if (categoryFilter !== 'all')
    rows = rows.filter(r => (r.e.category || '').toLowerCase() === categoryFilter.toLowerCase());

  rows.sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0));
  window._list = rows;

  const box = document.getElementById('events-list');
  if (!rows.length) {
    box.innerHTML = '<div class="empty">কোনো ম্যাচ নেই</div>';
    return;
  }

  box.innerHTML = rows.map((r, idx) => {
    const e = r.e;
    const { start } = getTimeWindow(e);
    let mid = '';
    if (r.live) {
      const elapsed = start ? now - start.getTime() : 0;
      mid = `<div class="live-tag">LIVE</div><div class="time-badge">${countdown(elapsed)}</div>`;
    } else {
      mid = `<div class="upcoming-time">${fmtTime(e.time)}</div>`;
    }
    const serverCount = (e.link_names || []).length || 0;
    return `<div class="event-card ${r.live ? 'live-card' : ''}" onclick="openModal(${idx})">
      <div class="event-top">
        ${e.eventLogo ? `<img src="${e.eventLogo}" onerror="this.style.display='none'">` : ''}
        <span>${e.category || ''} | ${e.eventName || ''}</span>
      </div>
      <div class="teams-row">
        <div class="team-box">
          ${e.teamAFlag ? `<img src="${e.teamAFlag}" onerror="this.style.display='none'">` : ''}
          <span>${e.teamAName || 'TBD'}</span>
        </div>
        <div class="center-info">${mid}</div>
        <div class="team-box">
          ${e.teamBFlag ? `<img src="${e.teamBFlag}" onerror="this.style.display='none'">` : ''}
          <span>${e.teamBName || 'TBD'}</span>
        </div>
      </div>
      <div class="event-bottom">
        <span>${e.date || ''}</span>
        <span>${serverCount} servers</span>
      </div>
    </div>`;
  }).join('');
}

function stopPlayer() {
  if (hlsInstance) { try { hlsInstance.destroy(); } catch(_){} hlsInstance = null; }
  if (shakaPlayer) { try { shakaPlayer.destroy(); } catch(_){} shakaPlayer = null; }
  const v = document.getElementById('video-player');
  if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
  document.getElementById('player-wrap').classList.add('hidden');
  const st = document.getElementById('player-status');
  st.classList.remove('show');
  st.textContent = '';
}

async function playStream(url, name, api) {
  const video = document.getElementById('video-player');
  const wrap = document.getElementById('player-wrap');
  const status = document.getElementById('player-status');
  stopPlayer();
  wrap.classList.remove('hidden');
  status.textContent = 'Loading… ' + (name || '');
  status.classList.add('show');

  try {
    if (window.shaka) {
      shaka.polyfill.installAll();
      shakaPlayer = new shaka.Player(video);
      shakaPlayer.addEventListener('error', (ev) => {
        console.error(ev.detail);
        status.textContent = 'Failed — try another link or VLC';
      });
      if (api && api.includes(':') && api.length < 80 && !api.includes('http')) {
        const [kid, key] = api.split(':');
        if (kid && key) {
          shakaPlayer.configure({ drm: { clearKeys: { [kid.trim()]: key.trim() } } });
        }
      }
      await shakaPlayer.load(url);
      status.textContent = 'Playing: ' + (name || '');
      await video.play().catch(() => {});
      return;
    }
  } catch (err) {
    console.warn('Shaka error', err);
  }

  if (/\.m3u8/i.test(url) && window.Hls && Hls.isSupported()) {
    hlsInstance = new Hls({ enableWorker: true });
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      status.textContent = 'Playing: ' + (name || '');
      video.play().catch(() => {});
    });
    hlsInstance.on(Hls.Events.ERROR, (_, d) => {
      if (d.fatal) status.textContent = 'Failed — open in VLC';
    });
    return;
  }

  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.onloadedmetadata = () => {
      status.textContent = 'Playing: ' + (name || '');
      video.play().catch(() => {});
    };
    return;
  }

  status.textContent = 'Opening externally…';
  window.open(url, '_blank');
}

function openModal(idx) {
  const rows = window._list || [];
  const r = rows[idx];
  if (!r) return;
  const e = r.e;
  document.getElementById('modal-title').textContent =
    `${e.teamAName || ''} vs ${e.teamBName || ''}`.trim() || e.eventName || 'Match';
  stopPlayer();

  const links = getStreamLinks(e);
  const box = document.getElementById('modal-links');
  if (!links.length) {
    box.innerHTML = '<p style="color:var(--muted);padding:12px 0">এই ম্যাচের সার্ভার লিংক এখনো যোগ হয়নি</p>';
  } else {
    box.innerHTML = '<div style="font-size:0.8rem;color:var(--muted);margin-bottom:8px">Available Servers (' + links.length + ')</div>' +
      links.map(l => {
        return `<a class="stream-link" href="javascript:void(0)"
          data-url="${l.url.replace(/"/g, '&quot;')}"
          data-name="${(l.name || '').replace(/"/g, '&quot;')}"
          data-api="${(l.api || '').replace(/"/g, '&quot;')}"
          onclick="onLinkClick(this)">
          <span class="name">▶ ${l.name}</span>
          <span class="tag">${l.tag}</span>
        </a>`;
      }).join('');
  }
  document.getElementById('stream-modal').classList.remove('hidden');
}

function onLinkClick(el) {
  document.querySelectorAll('.stream-link').forEach(a => a.classList.remove('active'));
  el.classList.add('active');
  playStream(el.dataset.url, el.dataset.name, el.dataset.api);
}

function closeModal() {
  stopPlayer();
  document.getElementById('stream-modal').classList.add('hidden');
}

document.querySelectorAll('.status-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    statusFilter = btn.dataset.status;
    render();
  };
});
document.getElementById('modal-close').onclick = closeModal;
document.getElementById('stream-modal').onclick = e => {
  if (e.target.id === 'stream-modal') closeModal();
};
setInterval(() => render(), 30000);
loadData();
