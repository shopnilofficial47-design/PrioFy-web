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
