// Sports Stream v3 - Live/Upcoming + correct match streams + player
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
    buildCategoryFilters();
    renderEvents();
  } catch (e) {
    console.error(e);
    document.getElementById('events-list').innerHTML = '<div class="empty">ডাটা লোড ব্যর্থ। আবার চেষ্টা করুন।</div>';
  }
}

function getEvent(item) { return item.event || item; }

function isLive(e) {
  return e.visible === true;
}

function parseEventTime(e) {
  // date: "09/10/2026", time: "14:00:00"
  if (!e.date || !e.time) return null;
  const [d, m, y] = e.date.split('/');
  return new Date(`${y}-${m}-${d}T${e.time}`);
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':');
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

// Extract key from links field (same as friend's site)
function extractKey(linksField) {
  if (!linksField || typeof linksField !== 'string') return '';
  let s = linksField;
  if (s.startsWith('pro/')) s = s.substring(4);
  if (s.endsWith('.txt')) s = s.substring(0, s.length - 4);
  return s;
}

function getStreamLinks(e) {
  const links = [];
  const seen = new Set();
  const add = (name, tag, url, api) => {
    if (!url) return;
    const clean = url.split('|')[0].trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    links.push({ name: name || 'Stream', tag: tag || 'HD', url: clean, api: api || '' });
  };

  const playz = streamsData['playz-streams'] || {};
  const key = extractKey(e.links);

  // 1. Exact key match
  if (key && playz[key] && Array.isArray(playz[key].streams)) {
    playz[key].streams.forEach(s => add(s.name || s.linkTag, s.linkTag, s.link, s.api));
  }

  // 2. Fuzzy: search key/decoded for team names
  if (links.length === 0) {
    const terms = [e.teamAName, e.teamBName, e.eventName].filter(Boolean).map(t => t.toLowerCase());
    Object.keys(playz).forEach(k => {
      let dec = k.toLowerCase();
      try { dec = atob(k.replace(/-/g,'+').replace(/_/g,'/')).toLowerCase(); } catch(_){}
      if (terms.some(t => t.length > 2 && (dec.includes(t) || k.toLowerCase().includes(t)))) {
        (playz[k].streams || []).forEach(s => add(s.name || s.linkTag, s.linkTag, s.link, s.api));
      }
    });
  }

  // 3. link_names as labels if nothing found
  if (links.length === 0 && e.link_names) {
    e.link_names.forEach((ln, i) => {
      const name = typeof ln === 'string' ? ln : (ln.name || 'Link ' + (i+1));
      const tag = typeof ln === 'object' ? (ln.tag || 'HD') : 'HD';
      links.push({ name, tag, url: null, api: '' });
    });
  }

  return links;
}

function buildCategoryFilters() {
  const cats = new Set();
  eventsData.forEach(item => {
    const c = getEvent(item).category;
    if (c) cats.add(c);
  });
  const el = document.getElementById('cat-filters');
  let html = '<button class="filter-btn active" data-category="all">All Sports</button>';
  [...cats].sort().forEach(c => {
    html += `<button class="filter-btn" data-category="${c}">${c}</button>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      categoryFilter = btn.dataset.category;
      renderEvents();
    });
  });
}

function renderEvents() {
  const now = Date.now();
  let liveCount = 0, upCount = 0;

  let list = eventsData.map(item => {
    const e = getEvent(item);
    const live = isLive(e);
    if (live) liveCount++; else upCount++;
    return { raw: item, e, live };
  });

  document.getElementById('count-all').textContent = list.length;
  document.getElementById('count-live').textContent = liveCount;
  document.getElementById('count-upcoming').textContent = upCount;

  if (statusFilter === 'live') list = list.filter(x => x.live);
  if (statusFilter === 'upcoming') list = list.filter(x => !x.live);

  if (categoryFilter !== 'all') {
    list = list.filter(x => (x.e.category || '').toLowerCase() === categoryFilter.toLowerCase());
  }

  // Live first
  list.sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0));

  const container = document.getElementById('events-list');
  if (!list.length) {
    container.innerHTML = '<div class="empty">কোনো ম্যাচ নেই</div>';
    return;
  }

  container.innerHTML = list.map((x, idx) => {
    const e = x.e;
    const start = parseEventTime(e);
    let center = '';
    if (x.live) {
      const elapsed = start ? now - start.getTime() : 0;
      center = `<div class="live-tag">LIVE</div><div class="time-badge">${formatCountdown(elapsed)}</div>`;
    } else {
      center = `<div class="upcoming-time">${formatTime(e.time)}</div>`;
    }

    return `
      <div class="event-card ${x.live ? 'live-card' : ''}" onclick="openModal(${idx})">
        <div class="event-top">
          ${e.eventLogo ? `<img src="${e.eventLogo}" onerror="this.style.display='none'">` : ''}
          <span>${e.category || ''} | ${e.eventName || ''}</span>
        </div>
        <div class="teams-row">
          <div class="team-box">
            ${e.teamAFlag ? `<img src="${e.teamAFlag}" onerror="this.style.display='none'">` : ''}
            <span>${e.teamAName || 'TBD'}</span>
          </div>
          <div class="center-info">${center}</div>
          <div class="team-box">
            ${e.teamBFlag ? `<img src="${e.teamBFlag}" onerror="this.style.display='none'">` : ''}
            <span>${e.teamBName || 'TBD'}</span>
          </div>
        </div>
        <div class="event-bottom">
          <span>${e.date || ''}</span>
          <span>${(e.link_names || []).length || 0} servers</span>
        </div>
      </div>
    `;
  }).join('');

  // store current list for modal
  window._currentList = list;
}

function stopPlayer() {
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  if (shakaPlayer) { shakaPlayer.destroy(); shakaPlayer = null; }
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
  status.textContent = 'Loading: ' + (name || '');
  status.classList.add('show');

  const isM3u8 = url.includes('.m3u8');
  const isMpd = url.includes('.mpd');

  try {
    // Prefer Shaka for DASH/MPD and general
    if (window.shaka && (isMpd || isM3u8)) {
      shaka.polyfill.installAll();
      shakaPlayer = new shaka.Player(video);
      shakaPlayer.addEventListener('error', (ev) => {
        status.textContent = 'Player error. Try VLC or another link.';
        console.error(ev.detail);
      });
      // Basic clearKey if api looks like kid:key
      if (api && api.includes(':')) {
        const [kid, key] = api.split(':');
        shakaPlayer.configure({
          drm: {
            clearKeys: { [kid]: key }
          }
        });
      }
      await shakaPlayer.load(url);
      status.textContent = 'Playing: ' + (name || '');
      video.play().catch(() => {});
      return;
    }

    // Fallback HLS.js
    if (isM3u8 && window.Hls && Hls.isSupported()) {
      hlsInstance = new Hls();
      hlsInstance.loadSource(url);
      hlsInstance.attachMedia(video);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        status.textContent = 'Playing: ' + (name || '');
        video.play().catch(() => {});
      });
      hlsInstance.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) status.textContent = 'Failed. Open in VLC.';
      });
      return;
    }

    // Safari native
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        status.textContent = 'Playing: ' + (name || '');
        video.play().catch(() => {});
      }, { once: true });
      return;
    }

    status.textContent = 'Opening externally...';
    window.open(url, '_blank');
  } catch (err) {
    status.textContent = 'Error. Try another link or VLC.';
    console.error(err);
  }
}

function openModal(idx) {
  const list = window._currentList || [];
  const x = list[idx];
  if (!x) return;
  const e = x.e;
  document.getElementById('modal-title').textContent =
    `${e.teamAName || ''} vs ${e.teamBName || ''}`.trim() || e.eventName || 'Match';

  stopPlayer();
  const links = getStreamLinks(e);
  const box = document.getElementById('modal-links');

  if (!links.length) {
    box.innerHTML = '<p style="color:var(--muted)">এই ম্যাচের লিংক পাওয়া যায়নি</p>';
  } else {
    box.innerHTML = links.map(l => {
      if (!l.url) {
        return `<div class="stream-link" style="opacity:.5"><span class="name">${l.name}</span><span class="tag">${l.tag}</span></div>`;
      }
      return `<a class="stream-link" href="javascript:void(0)"
        data-url="${l.url.replace(/"/g,'&quot;')}"
        data-name="${(l.name||'').replace(/"/g,'&quot;')}"
        data-api="${(l.api||'').replace(/"/g,'&quot;')}"
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

// Listeners
document.querySelectorAll('.status-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    statusFilter = btn.dataset.status;
    renderEvents();
  });
});
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('stream-modal').addEventListener('click', e => {
  if (e.target.id === 'stream-modal') closeModal();
});

// Refresh countdown every 30s
setInterval(() => { if (statusFilter === 'live' || statusFilter === 'all') renderEvents(); }, 30000);

loadData();
