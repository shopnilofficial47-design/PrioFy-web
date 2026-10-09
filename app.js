const API_EVENTS = 'https://ratulxadia-playz-cats-event.hf.space/api/events';
const API_STREAMS = 'https://adiaxratul-playz-link-send.hf.space/api/live-stream';

let allEvents = [];
let streamsData = {};
let currentCategory = 'All';
let currentFilter = 'All';

async function fetchData() {
    document.getElementById('loader').style.display = 'block';
    try {
        const [evRes, strRes] = await Promise.all([fetch(API_EVENTS), fetch(API_STREAMS)]);
        const evData = await evRes.json();
        streamsData = await strRes.json();

        // শুধুমাত্র visible ইভেন্ট প্রসেস করা
        allEvents = evData.filter(item => item.event.visible);
        
        renderCategories();
        renderEvents();
    } catch (e) {
        document.getElementById('loader').innerHTML = 'Data load failed!';
        console.error(e);
    }
}

// ক্যাটাগরি লিস্ট এবং ব্যাজ কাউন্ট তৈরি করা
function renderCategories() {
    const catContainer = document.getElementById('categories-container');
    let cats = { 'All': allEvents.length };
    
    allEvents.forEach(item => {
        let cat = item.event.category || 'Others';
        cats[cat] = (cats[cat] || 0) + 1;
    });

    let html = `<div class="cat-item ${currentCategory === 'All' ? 'active' : ''}" onclick="setCategory('All')">
                    <div class="cat-icon-wrap"><i class="fas fa-globe"></i></div>
                    <span class="cat-badge">${cats['All']}</span>
                    <span class="cat-name">All</span>
                </div>`;
    
    Object.keys(cats).forEach(c => {
        if (c !== 'All') {
            html += `<div class="cat-item ${currentCategory === c ? 'active' : ''}" onclick="setCategory('${c}')">
                        <div class="cat-icon-wrap"><i class="fas fa-trophy"></i></div>
                        <span class="cat-badge">${cats[c]}</span>
                        <span class="cat-name">${c}</span>
                    </div>`;
        }
    });
    catContainer.innerHTML = html;
}

function setCategory(cat) {
    currentCategory = cat;
    renderCategories();
    renderEvents();
}

// ফিল্টার সেট করা (Live / Upcoming)
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.innerText.replace('✓ ', '').trim();
        renderEvents();
    });
});

// ইভেন্ট কার্ডগুলো রেন্ডার করা
function renderEvents() {
    const container = document.getElementById('events-container');
    container.innerHTML = '';

    let filtered = allEvents;
    if (currentCategory !== 'All') {
        filtered = filtered.filter(item => item.event.category === currentCategory);
    }

    filtered.forEach(item => {
        const e = item.event;
        const timeStatus = getStatus(e.date, e.time);
        
        // Live/Upcoming Filter logic
        if (currentFilter === 'Live' && timeStatus.state !== 'live') return;
        if (currentFilter === 'Upcoming' && timeStatus.state !== 'upcoming') return;

        // ID এক্সট্র্যাক্ট করা "pro/ID.txt" থেকে
        const match = (e.links || '').match(/pro\/(.*?)\.txt/);
        const streamId = match ? match[1] : null;
        const stData = streamId ? streamsData[streamId] : null;

        const card = document.createElement('div');
        card.className = 'event-card';
        card.onclick = () => toggleStreams(card); // কার্ডে ক্লিক করলে স্ট্রিম ওপেন হবে

        let streamsHtml = '';
        if (stData && stData.streams) {
            stData.streams.forEach(s => {
                if (s.link) {
                    streamsHtml += `<a href="${s.link}" target="_blank" class="stream-btn">${s.name}</a>`;
                }
            });
        }
        if(!streamsHtml) streamsHtml = '<p style="color:#d32f2f; font-size:12px; text-align:center;">No direct stream links available</p>';

        card.innerHTML = `
            <div class="event-header"><i class="fas fa-satellite-dish"></i> ${e.category} | ${e.eventName}</div>
            <div class="match-info">
                <div class="team">
                    <img src="${e.teamAFlag}" alt="">
                    <span>${e.teamAName}</span>
                </div>
                <div class="status-box">
                    ${timeStatus.state === 'live' 
                        ? `<div class="status-badge badge-live">🔴 LIVE</div>` 
                        : `<div class="status-time">${timeFormat(e.time)}</div>
                           <div class="status-date">${e.date}</div>
                           <div class="status-badge badge-upcoming">${timeStatus.text}</div>`
                    }
                </div>
                <div class="team">
                    <img src="${e.teamBFlag}" alt="">
                    <span>${e.teamBName}</span>
                </div>
            </div>
            <div class="streams-box">${streamsHtml}</div>
        `;
        container.appendChild(card);
    });
}

function toggleStreams(card) {
    const box = card.querySelector('.streams-box');
    box.style.display = box.style.display === 'block' ? 'none' : 'block';
}

// টাইম ফরম্যাট এবং কাউন্টডাউন লজিক
function timeFormat(timeStr) {
    let [h, m] = timeStr.split(':');
    let ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
}

function getStatus(dateStr, timeStr) {
    const [day, month, year] = dateStr.split('/');
    const [hour, min, sec] = timeStr.split(':');
    const eventDate = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
    const now = new Date();
    const diffMs = eventDate - now;
    
    // ইভেন্ট টাইম পার হয়ে গেলে এবং ৩ ঘণ্টার মধ্যে হলে Live দেখাবে
    if (diffMs <= 0 && diffMs > -10800000) return { state: 'live', text: 'Live' };
    
    if (diffMs > 0) {
        const totalMins = Math.floor(diffMs / 60000);
        if (totalMins < 60) return { state: 'upcoming', text: `${totalMins}m left` };
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        return { state: 'upcoming', text: `${h}h ${m}m left` };
    }
    return { state: 'finished', text: 'Finished' };
}

// Start
document.addEventListener('DOMContentLoaded', fetchData);
