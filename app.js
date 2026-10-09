const API_EVENTS = 'https://ratulxadia-playz-cats-event.hf.space/api/events';
const API_STREAMS = 'https://adiaxratul-playz-link-send.hf.space/api/live-stream';

let eventsData = [];
let streamsData = {};
let activeCat = 'All';
let activeFilter = 'All';

// স্মার্ট এবং সেফ API ফেচিং (HTML আসলে ক্র্যাশ করবে না)
async function fetchSafeJSON(url) {
    try {
        const response = await fetch(url);
        const textData = await response.text(); 
        
        // চেক করবে এটা আসলেই JSON কি না (Hugging Face ঘুমিয়ে থাকলে HTML আসে)
        if (textData.trim().startsWith('<')) {
            throw new Error('সার্ভার স্লিপ মোডে আছে বা HTML রিটার্ন করছে।');
        }
        return JSON.parse(textData);
    } catch (error) {
        console.warn("Direct fetch failed, trying proxy for:", url);
        // প্রক্সি দিয়ে ট্রাই করবে
        const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
        const proxyResponse = await fetch(proxyUrl);
        const proxyText = await proxyResponse.text();
        
        if (proxyText.trim().startsWith('<')) {
            throw new Error('প্রক্সিতেও HTML রিটার্ন করছে। Hugging Face সার্ভার রিস্টার্ট হচ্ছে।');
        }
        return JSON.parse(proxyText);
    }
}

async function initApp() {
    const container = document.getElementById('events-container');
    
    try {
        // ১. ডেটা ফেচিং
        const [evData, stData] = await Promise.all([
            fetchSafeJSON(API_EVENTS),
            fetchSafeJSON(API_STREAMS)
        ]);

        // ২. ডেটা স্টোর
        eventsData = Array.isArray(evData) ? evData.filter(i => i.event && i.event.visible) : [];
        streamsData = stData || {};

        // ৩. UI রেন্ডার
        renderCategories();
        renderCards();

    } catch (err) {
        // ক্র্যাশ না করে স্ক্রিনে মেসেজ দেখাবে
        container.innerHTML = `
            <div style="text-align:center; color:#e74c3c; padding:30px 15px; background:#141a1f; border:1px solid #e74c3c; border-radius:10px; margin-top:20px;">
                <i class="fas fa-exclamation-triangle fa-2x"></i>
                <h3 style="margin:10px 0;">সার্ভার রিস্টার্ট হচ্ছে...</h3>
                <p style="font-size:12px; color:#88929e;">Hugging Face সার্ভার ঘুমিয়ে আছে। দয়া করে ১ মিনিট অপেক্ষা করে নিচের বাটনে ক্লিক করুন।</p>
                <button onclick="location.reload()" style="margin-top:15px; padding:8px 20px; background:#e74c3c; color:#fff; border:none; border-radius:5px; cursor:pointer;">রিলোড করুন</button>
            </div>
        `;
    }
}

// ক্যাটাগরি এবং ফিল্টার লজিক
function renderCategories() {
    let catCount = { 'All': eventsData.length };
    eventsData.forEach(item => {
        let c = item.event.category || 'Others';
        catCount[c] = (catCount[c] || 0) + 1;
    });

    const icons = { 'Cricket': 'fa-cricket', 'Football': 'fa-futbol', 'WWE': 'fa-khanda', 'Racing': 'fa-flag-checkered', 'Baseball': 'fa-baseball', 'Basketball': 'fa-basketball' };
    
    let html = `<div class="cat-box ${activeCat === 'All' ? 'active' : ''}" onclick="setCat('All')">
                    <div class="badge">${catCount['All']}</div>
                    <div class="cat-icon"><i class="fas fa-globe"></i></div>
                    <div class="cat-name">All</div>
                </div>`;
    
    Object.keys(catCount).forEach(key => {
        if(key !== 'All') {
            html += `<div class="cat-box ${activeCat === key ? 'active' : ''}" onclick="setCat('${key}')">
                        <div class="badge">${catCount[key]}</div>
                        <div class="cat-icon"><i class="fas ${icons[key] || 'fa-trophy'}"></i></div>
                        <div class="cat-name">${key}</div>
                    </div>`;
        }
    });
    const catContainer = document.getElementById('cat-container');
    if(catContainer) catContainer.innerHTML = html;
}

function setCat(cat) { activeCat = cat; renderCategories(); renderCards(); }

function setFilter(type, btn) {
    activeFilter = type;
    document.querySelectorAll('.filter-btn').forEach(b => { b.classList.remove('active'); b.innerText = b.innerText.replace('✓ ', ''); });
    btn.classList.add('active'); btn.innerText = '✓ ' + type;
    renderCards();
}

// মূল কার্ড রেন্ডার (JSON স্ট্রাকচার অনুযায়ী নিখুঁত ম্যাপিং)
function renderCards() {
    let html = '';
    const container = document.getElementById('events-container');
    
    eventsData.forEach(item => {
        const ev = item.event;
        if(activeCat !== 'All' && ev.category !== activeCat) return;

        let timeState = 'upcoming', timeText = 'Upcoming', timeShow = ev.time || 'TBA';
        try {
            let d = (ev.date||'').split('/'), t = (ev.time||'').split(':');
            if(d.length===3 && t.length>=2) {
                let diff = new Date(`${d[2]}-${d[1]}-${d[0]}T${t[0]}:${t[1]}:00`) - new Date();
                if(diff <= 0 && diff > -10800000) { timeState = 'live'; timeText = '🔴 LIVE'; }
                else if(diff > 0) { timeText = Math.floor(diff/60000) < 60 ? `${Math.floor(diff/60000)}m left` : `${Math.floor(diff/3600000)}h left`; }
                else { timeState = 'finished'; timeText = 'Finished'; }
                
                let h = parseInt(t[0]);
                timeShow = `${h%12 || 12}:${t[1]} ${h>=12?'PM':'AM'}`;
            }
        } catch(e){}

        if(activeFilter === 'Live' && timeState !== 'live') return;
        if(activeFilter === 'Upcoming' && timeState !== 'upcoming') return;

        // আপনার JSON স্ট্রাকচার থেকে ID বের করা: (যেমন: "pro/VDIw...NjU.txt" -> "VDIw...NjU")
        let extractedId = '';
        if(ev.links && ev.links.includes('pro/')) {
            extractedId = ev.links.split('pro/')[1].replace('.txt', '').trim();
        }

        let streamsHtml = '';
        // Streams Object থেকে ওই ID দিয়ে স্ট্রিমগুলো বের করা
        if(extractedId && streamsData[extractedId] && streamsData[extractedId].streams) {
            streamsData[extractedId].streams.forEach(s => {
                if(s.link && s.link !== 'https://no.link') {
                    let cleanUrl = s.link.split('|')[0].trim();
                    streamsHtml += `<div class="stream-link" onclick="openPlayer('${cleanUrl}', '${s.name}', event)">${s.name}</div>`;
                }
            });
        }
        
        if(!streamsHtml) streamsHtml = '<div style="width:100%;text-align:center;color:#e74c3c;font-size:12px;">কোনো স্ট্রিম লিংক নেই</div>';

        html += `
            <div class="card" onclick="this.querySelector('.streams').style.display = this.querySelector('.streams').style.display === 'flex' ? 'none' : 'flex'">
                <div class="card-title"><i class="fas fa-satellite-dish"></i> ${ev.category || 'Sports'} | ${ev.eventName}</div>
                <div class="match-row">
                    <div class="team">
                        <img src="${ev.teamAFlag}" onerror="this.src='https://via.placeholder.com/45'">
                        <div class="team-name">${ev.teamAName}</div>
                    </div>
                    <div class="status">
                        ${timeState === 'live' 
                            ? `<div class="status-btn status-live">${timeText}</div>` 
                            : `<div class="time">${timeShow}</div>
                               <div class="date">${ev.date}</div>
                               <div class="status-btn">${timeText}</div>`
                        }
                    </div>
                    <div class="team">
                        <img src="${ev.teamBFlag}" onerror="this.src='https://via.placeholder.com/45'">
                        <div class="team-name">${ev.teamBName}</div>
                    </div>
                </div>
                <div class="streams">${streamsHtml}</div>
            </div>
        `;
    });

    container.innerHTML = html || '<div style="text-align:center;color:#88929e;padding:20px;">কোনো ম্যাচ পাওয়া যায়নি</div>';
}

// ভিডিও প্লেয়ার (HLS & DASH)
function openPlayer(url, name, e) {
    if(e) e.stopPropagation();
    const modal = document.getElementById('player-modal');
    if(!modal) { window.open(url, '_blank'); return; }
    
    document.getElementById('player-title').innerText = name;
    document.getElementById('player-error').style.display = 'none';
    modal.style.display = 'flex';
    
    const video = document.getElementById('video-element');
    video.src = '';

    try {
        if(url.includes('.mpd') && typeof dashjs !== 'undefined') {
            dashjs.MediaPlayer().create().initialize(video, url, true);
        } else if(url.includes('.m3u8') && typeof Hls !== 'undefined') {
            if(Hls.isSupported()) {
                let hls = new Hls(); hls.loadSource(url); hls.attachMedia(video);
            } else if(video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = url;
            }
        } else {
            video.src = url;
        }
    } catch(err) {
        document.getElementById('player-error').style.display = 'block';
        document.getElementById('player-error').innerText = "ভিডিও প্লে করতে সমস্যা হচ্ছে।";
    }
}

function closePlayer() {
    document.getElementById('player-modal').style.display = 'none';
    const video = document.getElementById('video-element');
    if(video) video.pause();
}

// অ্যাপ চালু করা
initApp();
