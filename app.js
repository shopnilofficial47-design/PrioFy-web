const API_EVENTS = 'https://ratulxadia-playz-cats-event.hf.space/api/events';
const API_STREAMS = 'https://adiaxratul-playz-link-send.hf.space/api/live-stream';

let allEvents = [];
let streamsData = {};
let currentCategory = 'All';
let currentFilter = 'All';

async function fetchData() {
    const loader = document.getElementById('loader');
    loader.style.display = 'block';
    loader.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ডেটা লোড হচ্ছে... (অনুগ্রহ করে অপেক্ষা করুন)';
    
    // আগের রেন্ডার করা কার্ডগুলো মুছে ফেলা
    document.querySelectorAll('.event-card').forEach(el => el.remove());

    try {
        const [evRes, strRes] = await Promise.all([fetch(API_EVENTS), fetch(API_STREAMS)]);
        
        if (!evRes.ok || !strRes.ok) {
            throw new Error(`API Error: Events(${evRes.status}), Streams(${strRes.status})`);
        }

        const evData = await evRes.json();
        streamsData = await strRes.json();

        // শুধুমাত্র visible ইভেন্ট প্রসেস করা (ডেটা সেফটি চেক)
        if (Array.isArray(evData)) {
            allEvents = evData.filter(item => item && item.event && item.event.visible);
        } else {
            allEvents = [];
        }
        
        // লোডার গায়েব করা
        loader.style.display = 'none';

        renderCategories();
        renderEvents();
    } catch (e) {
        // যদি API ফেইল করে তবে স্ক্রিনে এরর দেখাবে
        loader.innerHTML = `<span style="color:#db4437;"><i class="fas fa-exclamation-triangle"></i> সমস্যা হয়েছে: API সার্ভার ডাউন অথবা CORS ব্লক করছে। <br><br> ${e.message}</span>`;
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
    // কার্ডগুলো ক্লিয়ার করা, কিন্তু লোডার ডিভ রেখে দেওয়া
    Array.from(container.children).forEach(child => {
        if (child.id !== 'loader') child.remove();
    });

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
                    streamsHtml += `<a href="${s.link}" target="_blank" class="stream-btn" style="border-left-color:${s.colorHex || 'var(--accent-light-green)'}">${s.name}</a>`;
                }
            });
        }
        if(!streamsHtml) streamsHtml = '<p style="color:#db4437; font-size:12px; text-align:center;">No direct stream links available</p>';

        card.innerHTML = `
            <div class="event-header"><i class="fas fa-satellite-dish"></i> ${e.category || 'Sports'} | ${e.eventName || 'Event'}</div>
            <div class="match-info">
                <div class="team">
                    <img src="${e.teamAFlag || 'https://via.placeholder.com/45'}" alt="">
                    <span>${e.teamAName || 'Team A'}</span>
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
                    <img src="${e.teamBFlag || 'https://via.placeholder.com/45'}" alt="">
                    <span>${e.teamBName || 'Team B'}</span>
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

// টাইম ফরম্যাট এবং সেফটি লজিক
function timeFormat(timeStr) {
    if(!timeStr) return 'TBA';
    let parts = timeStr.split(':');
    let h = parseInt(parts[0]) || 12;
    let m = parts[1] || '00';
    let ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
}

// সেফ কাউন্টডাউন টাইমার
function getStatus(dateStr, timeStr) {
    try {
        if(!dateStr || !timeStr) return { state: 'finished', text: 'TBA' };
        
        const [day, month, year] = dateStr.split('/');
        const [hour, min, sec] = timeStr.split(':');
        
        const eventDate = new Date(`${year}-${month}-${day}T${hour || '00'}:${min || '00'}:${sec || '00'}`);
        if(isNaN(eventDate.getTime())) return { state: 'upcoming', text: 'Upcoming' };

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
    } catch(e) {
        return { state: 'upcoming', text: 'Upcoming' };
    }
}

// Start
document.addEventListener('DOMContentLoaded', fetchData);
