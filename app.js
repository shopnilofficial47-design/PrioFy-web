// ======================
// Sports Stream App v2
// Match-specific streams + HLS Player
// ======================

let eventsData = [];
let streamsData = {};
let currentCategory = 'all';
let hlsInstance = null;

// --- Load Data (Live APIs) ---
async function loadData() {
  try {
    const [eventsRes, streamsRes] = await Promise.all([
      fetch('https://ratulxadia-playz-cats-event.hf.space/api/events'),
      fetch('https://ratul-liv-default-rtdb.asia-southeast1.firebasedatabase.app/.json')
    ]);

    if (!eventsRes.ok || !streamsRes.ok) {
      throw new Error('API লোড করতে সমস্যা হয়েছে');
    }

    eventsData = await eventsRes.json();
    streamsData = await streamsRes.json();

    if (streamsData.homepage_notice) {
      const notice = document.createElement('div');
      notice.style.cssText = 'background:#1a2338;border:1px solid #08c7d6;color:#08c7d6;padding:10px 16px;border-radius:10px;margin:16px 0;font-size:0.85rem;text-align:center;';
      notice.textContent = streamsData.homepage_notice.trim();
      const main = document.querySelector('main.container');
      if (main) main.insertBefore(notice, main.firstChild);
    }

    renderEvents();
    renderChannels();
  } catch (err) {
    console.error(err);
    document.getElementById('events-list').innerHTML =
      '<div class="empty">ডাটা লোড করতে সমস্যা হয়েছে। ইন্টারনেট চেক করুন।</div>';
  }
}

// --- Helpers ---
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return h12 + ':' + m + ' ' + ampm;
}

function extractKeyFromLinks(linksField) {
  if (!linksField || typeof linksField !== 'string') return null;
  return linksField.replace(/^pro\//, '').replace(/\.txt$/, '').trim() || null;
}

function getStreamLinks(event) {
  const links = [];
  const seen = new Set();

  function add(name, tag, url) {
    if (!url) return;
    let clean = url.split('|')[0].trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    links.push({ name: name || 'Stream', tag: tag || 'HD', url: clean });
  }

  // 1. Primary: event.links key → playz-streams
  const key = extractKeyFromLinks(event.links);
  const playz = streamsData['playz-streams'] || {};

  if (key && playz[key] && playz[key].streams) {
    playz[key].streams.forEach(function(s) {
      add(s.name || s.linkTag || 'Stream', s.linkTag || 'HD', s.link);
    });
  }

  // 2. Fuzzy match by team / event name
  if (links.length === 0) {
    const terms = [event.teamAName || '', event.teamBName || '', event.eventName || '']
      .filter(function(t) { return t && t.length > 2; })
      .map(function(t) { return t.toLowerCase(); });

    Object.keys(playz).forEach(function(k) {
      var decoded = '';
      try {
        decoded = atob(k.replace(/-/g, '+').replace(/_/g, '/')).toLowerCase();
      } catch (e) {
        decoded = k.toLowerCase();
      }
      var matched = terms.some(function(t) {
        return decoded.indexOf(t) !== -1 || k.toLowerCase().indexOf(t) !== -1;
      });
      if (matched && playz[k].streams) {
        playz[k].streams.forEach(function(s) {
          add(s.name || s.linkTag || 'Stream', s.linkTag || 'HD', s.link);
        });
      }
    });
  }

  // 3. live-streams fallback by category
  if (links.length === 0 && streamsData['live-streams']) {
    var cat = (event.category || '').toLowerCase();
    var allLive = Object.values(streamsData['live-streams']).flat();
    var prefer = /willow|sony|fancode|sky|tnt|espn|bein|dazn|fox|apple|fubo/i;
    if (cat.indexOf('cricket') !== -1) prefer = /willow|sony|fancode|sky.*cric|fox.*cric/i;
    if (cat.indexOf('motor') !== -1 || cat.indexOf('formula') !== -1) prefer = /sky|f1|tnt|apple|spor/i;

    allLive.forEach(function(s) {
      if (s.link && prefer.test(s.title || '')) {
        add(s.title, s.type === '1' ? 'FHD' : 'HD', s.link);
      }
    });
  }

  // 4. Labels only
  if (links.length === 0 && event.link_names) {
    event.link_names.forEach(function(ln, i) {
      var name = typeof ln === 'string' ? ln : (ln.name || 'Link ' + (i + 1));
      var tag = typeof ln === 'object' ? (ln.tag || 'HD') : 'HD';
      links.push({ name: name, tag: tag, url: null });
    });
  }

  return links;
}

// --- HLS Player ---
function stopPlayer() {
  var video = document.getElementById('video-player');
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  document.getElementById('player-wrap').classList.add('hidden');
  var status = document.getElementById('player-status');
  status.classList.remove('show');
  status.textContent = '';
}

function playStream(url, name) {
  var video = document.getElementById('video-player');
  var wrap = document.getElementById('player-wrap');
  var status = document.getElementById('player-status');

  stopPlayer();
  wrap.classList.remove('hidden');
  status.textContent = 'লোড হচ্ছে: ' + (name || '');
  status.classList.add('show');

  var isM3u8 = url.indexOf('.m3u8') !== -1;

  if (isM3u8 && window.Hls && Hls.isSupported()) {
    hlsInstance = new Hls({ enableWorker: true, maxBufferLength: 30 });
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
      status.textContent = 'চলছে: ' + (name || '');
      video.play().catch(function() {});
    });
    hlsInstance.on(Hls.Events.ERROR, function(e, data) {
      if (data.fatal) {
        status.textContent = 'প্লেয়ারে সমস্যা। VLC / MX Player এ লিংক খুলুন।';
        console.error('HLS error', data);
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.addEventListener('loadedmetadata', function() {
      status.textContent = 'চলছে: ' + (name || '');
      video.play().catch(function() {});
    }, { once: true });
  } else {
    status.textContent = 'নতুন ট্যাবে খোলা হচ্ছে...';
    window.open(url, '_blank');
  }
}

// --- Render Events ---
function renderEvents() {
  var container = document.getElementById('events-list');
  var filtered = eventsData;

  if (currentCategory !== 'all') {
    filtered = eventsData.filter(function(e) {
      var cat = (e.event && e.event.category || e.category || '').toLowerCase();
      return cat === currentCategory.toLowerCase();
    });
  }

  filtered = filtered.slice().sort(function(a, b) {
    var va = (a.event && a.event.visible != null ? a.event.visible : a.visible) === true;
    var vb = (b.event && b.event.visible != null ? b.event.visible : b.visible) === true;
    return (vb ? 1 : 0) - (va ? 1 : 0);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty">এই ক্যাটাগরিতে কোনো ম্যাচ নেই</div>';
    return;
  }

  container.innerHTML = filtered.map(function(item, idx) {
    var e = item.event || item;
    var live = e.visible === true;
    var teamA = e.teamAName || 'Team A';
    var teamB = e.teamBName || 'Team B';
    var flagA = e.teamAFlag || '';
    var flagB = e.teamBFlag || '';
    var logo = e.eventLogo || '';
    var name = e.eventName || 'Match';
    var category = e.category || '';
    var time = formatTime(e.time);
    var date = e.date || '';
    var linkCount = (e.link_names || []).length || '?';

    return '<div class="event-card ' + (live ? 'live' : '') + '" data-idx="' + idx + '" onclick="openStreamModal(' + idx + ')">' +
      '<div class="event-header">' +
        (logo ? '<img class="event-logo" src="' + logo + '" alt="" onerror="this.style.display=\'none\'">' : '') +
        '<span class="event-name">' + name + '</span>' +
        '<span class="event-category">' + category + '</span>' +
      '</div>' +
      '<div class="teams">' +
        '<div class="team">' +
          (flagA ? '<img class="team-flag" src="' + flagA + '" alt="' + teamA + '" onerror="this.style.display=\'none\'">' : '') +
          '<span class="team-name">' + teamA + '</span>' +
        '</div>' +
        '<span class="vs">VS</span>' +
        '<div class="team">' +
          (flagB ? '<img class="team-flag" src="' + flagB + '" alt="' + teamB + '" onerror="this.style.display=\'none\'">' : '') +
          '<span class="team-name">' + teamB + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="event-meta">' +
        '<span>' + date + ' • ' + time + '</span>' +
        '<span>' + (live ? '<span class="live-badge">LIVE</span> ' : '') +
        '<span class="links-count">' + linkCount + ' লিংক</span></span>' +
      '</div>' +
    '</div>';
  }).join('');
}

// --- Render Channels ---
function renderChannels() {
  var container = document.getElementById('channels-list');
  var channels = streamsData['sports-channels'] || {};
  var list = Object.entries(channels);

  if (list.length === 0) {
    container.innerHTML = '<div class="empty">কোনো চ্যানেল পাওয়া যায়নি</div>';
    return;
  }

  container.innerHTML = list.map(function(pair) {
    var key = pair[0], ch = pair[1];
    return '<div class="channel-card" onclick="openChannel(\'' + encodeURIComponent(ch.link || '') + '\', \'' + (ch.name || key).replace(/'/g, "\\'") + '\')">' +
      (ch.logo ? '<img class="channel-logo" src="' + ch.logo + '" alt="" onerror="this.style.display=\'none\'">' : '<div class="channel-logo" style="display:flex;align-items:center;justify-content:center;font-size:1.4rem">📺</div>') +
      '<div class="channel-info"><h3>' + (ch.name || key) + '</h3><p>স্পোর্টস চ্যানেল</p></div>' +
    '</div>';
  }).join('');
}

// --- Modal ---
function openStreamModal(idx) {
  var filtered = eventsData;
  if (currentCategory !== 'all') {
    filtered = eventsData.filter(function(e) {
      var cat = (e.event && e.event.category || e.category || '').toLowerCase();
      return cat === currentCategory.toLowerCase();
    });
  }
  filtered = filtered.slice().sort(function(a, b) {
    var va = (a.event && a.event.visible != null ? a.event.visible : a.visible) === true;
    var vb = (b.event && b.event.visible != null ? b.event.visible : b.visible) === true;
    return (vb ? 1 : 0) - (va ? 1 : 0);
  });

  var item = filtered[idx];
  if (!item) return;

  var e = item.event || item;
  var title = ((e.teamAName || '') + ' vs ' + (e.teamBName || '')).trim() || e.eventName || 'Match';
  document.getElementById('modal-title').textContent = title;

  stopPlayer();

  var links = getStreamLinks(e);
  var linksContainer = document.getElementById('modal-links');

  if (links.length === 0) {
    linksContainer.innerHTML = '<p style="color:var(--text-muted)">এই ম্যাচের জন্য স্ট্রিম লিংক পাওয়া যায়নি</p>';
  } else {
    linksContainer.innerHTML = links.map(function(l) {
      if (l.url) {
        return '<a class="stream-link" href="javascript:void(0)" data-url="' + l.url.replace(/"/g, '&quot;') + '" data-name="' + (l.name || '').replace(/"/g, '&quot;') + '" onclick="onLinkClick(this)">' +
          '<span class="name">' + l.name + '</span><span class="tag">' + l.tag + '</span></a>';
      }
      return '<div class="stream-link" style="opacity:0.6;cursor:default;"><span class="name">' + l.name + '</span><span class="tag">' + l.tag + '</span></div>';
    }).join('');
  }

  document.getElementById('stream-modal').classList.remove('hidden');
}

function onLinkClick(el) {
  var url = el.getAttribute('data-url');
  var name = el.getAttribute('data-name');
  document.querySelectorAll('.stream-link').forEach(function(a) { a.classList.remove('active'); });
  el.classList.add('active');
  playStream(url, name);
}

function openChannel(url, name) {
  document.getElementById('modal-title').textContent = name;
  stopPlayer();
  var decoded = decodeURIComponent(url);
  document.getElementById('modal-links').innerHTML =
    '<a class="stream-link active" href="javascript:void(0)" data-url="' + decoded + '" data-name="' + name + '" onclick="onLinkClick(this)">' +
    '<span class="name">Watch Live</span><span class="tag">LIVE</span></a>';
  document.getElementById('stream-modal').classList.remove('hidden');
  playStream(decoded, name);
}

function closeModal() {
  stopPlayer();
  document.getElementById('stream-modal').classList.add('hidden');
}

// --- Listeners ---
document.querySelectorAll('.nav-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    var tab = btn.dataset.tab;
    document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
    document.getElementById(tab + '-tab').classList.add('active');
  });
});

document.querySelectorAll('.filter-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentCategory = btn.dataset.category;
    renderEvents();
  });
});

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('stream-modal').addEventListener('click', function(e) {
  if (e.target.id === 'stream-modal') closeModal();
});

loadData();
