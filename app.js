// ======================
// Sports Stream App
// ======================

let eventsData = [];
let streamsData = {};
let currentCategory = 'all';

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

    // Show homepage notice if available
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
      `<div class="empty">ডাটা লোড করতে সমস্যা হয়েছে। ইন্টারনেট চেক করুন।</div>`;
  }
}

// --- Helpers ---
function isLive(event) {
  // Simple check: if visible and date is today (09/10/2026 based on data)
  return event.visible === true;
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  // time is like "14:00:00"
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function getStreamLinks(event) {
  const links = [];
  const seen = new Set();

  // Helper to add unique links
  function addLink(name, tag, url) {
    if (!url || seen.has(url)) return;
    seen.add(url);
    // Clean url (remove extra headers after |)
    let cleanUrl = url.split('|')[0].trim();
    links.push({ name: name || 'Stream', tag: tag || 'HD', url: cleanUrl });
  }

  // 1. Try to match by event name / teams in the big streams object
  if (streamsData && typeof streamsData === 'object') {
    const searchTerms = [
      (event.teamAName || '').toLowerCase(),
      (event.teamBName || '').toLowerCase(),
      (event.eventName || '').toLowerCase()
    ].filter(Boolean);

    Object.keys(streamsData).forEach(key => {
      if (key === 'live-streams' || key === 'sports-channels' || key === 'homepage_notice') return;
      const entry = streamsData[key];
      if (!entry || !entry.streams) return;

      // Check if key or name matches
      const keyLower = key.toLowerCase();
      const matched = searchTerms.some(term => term.length > 2 && keyLower.includes(term));
      if (matched || searchTerms.length === 0) {
        (entry.streams || []).forEach(s => {
          if (s.link) addLink(s.name || s.linkTag || 'Stream', s.linkTag || 'HD', s.link);
        });
      }
    });
  }

  // 2. From live-streams (popular ones)
  if (streamsData['live-streams']) {
    const allLive = Object.values(streamsData['live-streams']).flat();
    // Prefer high quality
    allLive.forEach(s => {
      if (s.link && (s.title || '').toLowerCase().match(/willow|fancode|sony|tnt|sky|bein|dazn|espn|fox/)) {
        addLink(s.title, s.type === '1' ? 'FHD' : 'HD', s.link);
      }
    });
    // Add a few more if still few links
    if (links.length < 3) {
      allLive.slice(0, 6).forEach(s => {
        if (s.link) addLink(s.title || 'Live', s.type === '1' ? 'AQ' : 'HD', s.link);
      });
    }
  }

  // 3. Sports channels as backup
  if (links.length < 2 && streamsData['sports-channels']) {
    Object.values(streamsData['sports-channels']).forEach(ch => {
      if (ch.link) addLink(ch.name || 'Channel', 'LIVE', ch.link);
    });
  }

  // 4. If still empty, show link_names as info (no url)
  if (links.length === 0 && event.link_names) {
    event.link_names.forEach((ln, idx) => {
      const name = typeof ln === 'string' ? ln : (ln.name || `Link ${idx + 1}`);
      const tag = typeof ln === 'object' ? (ln.tag || 'HD') : 'HD';
      links.push({ name, tag, url: null });
    });
  }

  return links;
}

// --- Render Events ---
function renderEvents() {
  const container = document.getElementById('events-list');
  let filtered = eventsData;

  if (currentCategory !== 'all') {
    filtered = eventsData.filter(e => {
      const cat = (e.event?.category || e.category || '').toLowerCase();
      return cat === currentCategory.toLowerCase();
    });
  }

  // Prefer visible ones first
  filtered = [...filtered].sort((a, b) => {
    const va = a.event?.visible ?? a.visible ?? false;
    const vb = b.event?.visible ?? b.visible ?? false;
    return (vb === true ? 1 : 0) - (va === true ? 1 : 0);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty">এই ক্যাটাগরিতে কোনো ম্যাচ নেই</div>`;
    return;
  }

  container.innerHTML = filtered.map((item, idx) => {
    const e = item.event || item;
    const live = e.visible === true;
    const teamA = e.teamAName || 'Team A';
    const teamB = e.teamBName || 'Team B';
    const flagA = e.teamAFlag || '';
    const flagB = e.teamBFlag || '';
    const logo = e.eventLogo || '';
    const name = e.eventName || 'Match';
    const category = e.category || '';
    const time = formatTime(e.time);
    const date = e.date || '';
    const linkCount = (e.link_names || []).length || 1;

    return `
      <div class="event-card ${live ? 'live' : ''}" data-idx="${idx}" onclick="openStreamModal(${idx})">
        <div class="event-header">
          ${logo ? `<img class="event-logo" src="${logo}" alt="" onerror="this.style.display='none'">` : ''}
          <span class="event-name">${name}</span>
          <span class="event-category">${category}</span>
        </div>
        <div class="teams">
          <div class="team">
            ${flagA ? `<img class="team-flag" src="${flagA}" alt="${teamA}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%23141b2d%22 width=%2240%22 height=%2240%22/><text x=%2220%22 y=%2226%22 text-anchor=%22middle%22 fill=%22%238b9bb4%22 font-size=%2214%22>${teamA.slice(0,2)}</text></svg>'">` : ''}
            <span class="team-name">${teamA}</span>
          </div>
          <span class="vs">VS</span>
          <div class="team">
            ${flagB ? `<img class="team-flag" src="${flagB}" alt="${teamB}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%23141b2d%22 width=%2240%22 height=%2240%22/><text x=%2220%22 y=%2226%22 text-anchor=%22middle%22 fill=%22%238b9bb4%22 font-size=%2214%22>${teamB.slice(0,2)}</text></svg>'">` : ''}
            <span class="team-name">${teamB}</span>
          </div>
        </div>
        <div class="event-meta">
          <span>${date} • ${time}</span>
          <span>
            ${live ? '<span class="live-badge">LIVE</span> ' : ''}
            <span class="links-count">${linkCount} লিংক</span>
          </span>
        </div>
      </div>
    `;
  }).join('');
}

// --- Render Channels ---
function renderChannels() {
  const container = document.getElementById('channels-list');
  const channels = streamsData['sports-channels'] || {};

  const list = Object.entries(channels);

  if (list.length === 0) {
    container.innerHTML = `<div class="empty">কোনো চ্যানেল পাওয়া যায়নি</div>`;
    return;
  }

  container.innerHTML = list.map(([key, ch]) => {
    return `
      <div class="channel-card" onclick="openChannel('${encodeURIComponent(ch.link || '')}', '${(ch.name || key).replace(/'/g, "\\'")}')">
        ${ch.logo ? `<img class="channel-logo" src="${ch.logo}" alt="" onerror="this.style.display='none'">` : '<div class="channel-logo" style="display:flex;align-items:center;justify-content:center;font-size:1.4rem">📺</div>'}
        <div class="channel-info">
          <h3>${ch.name || key}</h3>
          <p>স্পোর্টস চ্যানেল</p>
        </div>
      </div>
    `;
  }).join('');
}

// --- Modal ---
function openStreamModal(idx) {
  let filtered = eventsData;
  if (currentCategory !== 'all') {
    filtered = eventsData.filter(e => {
      const cat = (e.event?.category || e.category || '').toLowerCase();
      return cat === currentCategory.toLowerCase();
    });
  }
  filtered = [...filtered].sort((a, b) => {
    const va = a.event?.visible ?? a.visible ?? false;
    const vb = b.event?.visible ?? b.visible ?? false;
    return (vb === true ? 1 : 0) - (va === true ? 1 : 0);
  });

  const item = filtered[idx];
  if (!item) return;

  const e = item.event || item;
  const title = `${e.teamAName || ''} vs ${e.teamBName || ''}`.trim() || e.eventName || 'Match';
  document.getElementById('modal-title').textContent = title;

  const links = getStreamLinks(e);
  const linksContainer = document.getElementById('modal-links');

  if (links.length === 0) {
    linksContainer.innerHTML = `<p style="color:var(--text-muted)">কোনো স্ট্রিম লিংক পাওয়া যায়নি</p>`;
  } else {
    linksContainer.innerHTML = links.map(l => {
      if (l.url) {
        return `
          <a class="stream-link" href="${l.url}" target="_blank" rel="noopener">
            <span class="name">${l.name}</span>
            <span class="tag">${l.tag}</span>
          </a>
        `;
      } else {
        return `
          <div class="stream-link" style="opacity:0.7;cursor:default;">
            <span class="name">${l.name}</span>
            <span class="tag">${l.tag}</span>
          </div>
        `;
      }
    }).join('');
  }

  document.getElementById('stream-modal').classList.remove('hidden');
}

function openChannel(url, name) {
  document.getElementById('modal-title').textContent = name;
  document.getElementById('modal-links').innerHTML = `
    <a class="stream-link" href="${decodeURIComponent(url)}" target="_blank" rel="noopener">
      <span class="name">Watch Live</span>
      <span class="tag">LIVE</span>
    </a>
  `;
  document.getElementById('stream-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('stream-modal').classList.add('hidden');
}

// --- Event Listeners ---
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(`${tab}-tab`).classList.add('active');
  });
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.dataset.category;
    renderEvents();
  });
});

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('stream-modal').addEventListener('click', (e) => {
  if (e.target.id === 'stream-modal') closeModal();
});

// Init
loadData();
