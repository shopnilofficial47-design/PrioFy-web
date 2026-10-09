// Sports Stream v4 — follows ratulxlive logic
// Exact key → fuzzy teams → category fallback → Shaka/HLS player

let eventsData = [];
let streamsData = {};
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
    buildCats();
    render();
  } catch (e) {
    console.error(e);
    document.getElementById('events-list').innerHTML =
      '<div class="empty">ডাটা লোড ব্যর্থ</div>';
  }
}

function ev(item) { return item.event || item; }

// Same as friend's Uhe()
function stripKey(links) {
  if (!links) return '';
  let s = String(links);
  if (s.startsWith('pro/')) s = s.slice(4);
  if (s.endsWith('.txt')) s = s.slice(0, -4);
  return s;
}

function decodeKey(k) {
  try {
    const pad = '='.repeat((4 - (k.length % 4)) % 4);
    return atob(k.replace(/-/g, '+').replace(/_/g, '/') + pad);
  } catch {
    return k;
  }
}

function addLink(list, seen, name, tag, url, api) {
  if (!url) return;
  const clean = url.split('|')[0].trim();
  if (!clean || seen.has(clean)) return;
  seen.add(clean);
  list.push({ name: name || 'Stream', tag: tag || 'HD', url: clean, api: api || '' });
}

function getStreamLinks(e) {
  const list = [];
  const seen = new Set();
  const playz = streamsData['playz-streams'] || {};
  const key = stripKey(e.links);

  // 1) Exact key (friend's method)
  if (key && playz[key] && playz[key].streams) {
    playz[key].streams.forEach(s =>
      addLink(list, seen, s.name || s.linkTag, s.linkTag, s.link, s.api)
    );
  }

  // 2) Fuzzy: both team names inside decoded key
  if (list.length === 0) {
    const a = (e.teamAName || '').toLowerCase();
    const b = (e.teamBName || '').toLowerCase();
    if (a.length > 1 && b.length > 1) {
      for (const k of Object.keys(playz)) {
        const dec = decodeKey(k).toLowerCase();
        if (dec.includes(a) && dec.includes(b) && playz[k].streams) {
          playz[k].streams.forEach(s =>
            addLink(list, seen, s.name || s.linkTag, s.linkTag, s.link, s.api)
          );
          break;
        }
      }
    }
  }

  // 3) Single-team / eventName fuzzy
  if (list.length === 0) {
    const terms = [e.teamAName, e.teamBName, e.eventName]
      .filter(t => t && t.length > 3)
      .map(t => t.toLowerCase());
    for (const k of Object.keys(playz)) {
      const dec = decodeKey(k).toLowerCase();
      if (terms.some(t => dec.includes(t)) && playz[k].streams) {
        playz[k].streams.forEach(s =>
          addLink(list, seen, s.name || s.linkTag, s.linkTag, s.link, s.api)
        );
        if (list.length >= 3) break;
      }
    }
  }

  // 4) Category fallback from live-streams
  if (list.length === 0 && streamsData['live-streams']) {
    const cat = (e.category || '').toLowerCase();
    const all = Object.values(streamsData['live-streams']).flat();
    let re = /willow|sony|fancode|tnt|sky|bein|espn|dazn|fox|apple|paramount|fubo/i;
    if (cat.includes('cricket')) re = /willow|sony|fancode|sky.*cric|fox.*cric|tapmad/i;
    if (cat.includes('motor') || cat.includes('formula') || cat.includes('moto'))
      re = /sky|f1|tnt|apple|moto|spor/i;
    if (cat.includes('box') || cat.includes('wwe') || cat.includes('aew'))
      re = /wwe|aew|tnt|fox|raw|nxt/i;
    all.forEach(s => {
      if (s.link && re.test(s.title || ''))
        addLink(list, seen, s.title, s.type === '1' ? 'FHD' : 'HD', s.link, s.api);
    });
  }

  // 5) Labels only
  if (list.length === 0 && e.link_names) {
    e.link_names.forEach((ln, i) => {
      const name = typeof ln === 'string' ? ln : (ln.name || 'Link ' + (i + 1));
      const tag = typeof ln === 'object' ? (ln.tag || 'HD') : 'HD';
      list.push({ name, tag, url: null, api: '' });
    });
  }

  return list;
}

function isLive(e) {
  return e.visible === true;
}

function parseStart(e) {
  if (!e.date || !e.time) return null;
  const [d, m, y] = e.date.split('/');
  // API stores times in a US-oriented zone; treat as UTC-4 for elapsed display
  // But visible flag is authoritative for Live vs Upcoming
  return new Date(`${y}-${m}-${d}T${e.time}-04:00`);
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
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
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
    const start = parseStart(e);
    let mid = '';
    if (r.live) {
      const elapsed = start ? now - start.getTime() : 0;
      mid = `<div class="live-tag">LIVE</div><div class="time-badge">${countdown(elapsed)}</div>`;
    } else {
      mid = `<div class="upcoming-time">${fmtTime(e.time)}</div>`;
    }
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
        <span>${(e.link_names || []).length || 0} servers</span>
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

  const isM3u8 = /\.m3u8/i.test(url);
  const isMpd = /\.mpd/i.test(url);

  try {
    if (window.shaka) {
      shaka.polyfill.installAll();
      if (!shaka.Player.isBrowserSupported()) throw new Error('no shaka');
      shakaPlayer = new shaka.Player(video);
      shakaPlayer.addEventListener('error', (ev) => {
        console.error(ev.detail);
        status.textContent = 'Failed — try another link or VLC';
      });
      if (api && api.includes(':') && !api.includes('http')) {
        const parts = api.split(':');
        if (parts.length >= 2) {
          const kid = parts[0].trim();
          const key = parts[1].trim();
          shakaPlayer.configure({ drm: { clearKeys: { [kid]: key } } });
        }
      }
      await shakaPlayer.load(url);
      status.textContent = 'Playing: ' + (name || '');
      await video.play().catch(() => {});
      return;
    }
  } catch (err) {
    console.warn('Shaka failed', err);
  }

  // HLS.js fallback
  if (isM3u8 && window.Hls && Hls.isSupported()) {
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

  status.textContent = 'Opening link…';
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
    box.innerHTML = '<p style="color:var(--muted);padding:12px 0">এই ম্যাচের স্ট্রিম API-তে এখনো যোগ হয়নি</p>';
  } else {
    box.innerHTML = links.map(l => {
      if (!l.url) {
        return `<div class="stream-link" style="opacity:.5"><span class="name">${l.name}</span><span class="tag">${l.tag}</span></div>`;
      }
      return `<a class="stream-link" href="javascript:void(0)"
        data-url="${l.url.replace(/"/g, '&quot;')}"
        data-name="${(l.name || '').replace(/"/g, '&quot;')}"
        data-api="${(l.api || '').replace(/"/g, '&quot;')}"
        onclick="onLinkClick(this)">
        <span class="name">${l.name}</span>
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
