// =============================================
// МАРЛИС AI — App Logic v3.0
// =============================================

// --- Service Worker ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => { });
    });
}

// --- DOM Refs ---
const recordBtn = document.getElementById('record-btn');
const assistantText = document.getElementById('assistant-text');
const chatBubble = document.getElementById('chat-bubble');
const statusLabel = document.getElementById('status-label');
const micHint = document.getElementById('mic-hint');
const canvas = document.getElementById('voice-canvas');
const ctx = canvas.getContext('2d');
const micSvg = document.getElementById('mic-svg');
const stopSvg = document.getElementById('stop-svg');
const premiumModal = document.getElementById('premium-modal');
const closeModal = document.getElementById('close-modal');
const voiceOrbWrapper = document.getElementById('voice-orb-wrapper');
const historyPanel = document.getElementById('history-panel');
const historyBackdrop = document.getElementById('history-backdrop');
const historyList = document.getElementById('history-list');

let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let animationId;

// --- Soft notification sounds (no external dependency) ---
function beep(freq = 880, dur = 80, type = 'sine', vol = 0.15) {
    try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur / 1000);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + dur / 1000);
    } catch (e) { }
}

// =============================================
// CLOCK
// =============================================
function updateTime() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const el = document.querySelector('.time');
    if (el) el.textContent = `${h}:${m}`;
}
updateTime();
setInterval(updateTime, 30000);

// =============================================
// THEME TOGGLE
// =============================================
const themeBtn = document.getElementById('theme-btn');
const sunIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
</svg>`;
const moonIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
</svg>`;

themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    themeBtn.innerHTML = isLight ? moonIcon : sunIcon;
    gsap.from(themeBtn, { rotationY: 90, duration: 0.4, ease: 'power2.out' });
});

// =============================================
// CLEAR HISTORY
// =============================================
document.getElementById('clear-btn').addEventListener('click', async () => {
    if (!confirm('Сүйлөшүүнү тазалоону каалайсызбы?')) return;
    try {
        await fetch('/clear_history', { method: 'POST' });
        setAssistantText('Сүйлөшүү тарыхы тазаланды.');
        historyList.innerHTML = '';
        showStatus('Тазаланды');
    } catch {
        setAssistantText('Тазалап болгон жок.');
    }
});

// =============================================
// HISTORY PANEL
// =============================================
function openHistory() {
    historyPanel.classList.add('open');
    historyBackdrop.classList.add('visible');
    fetchHistory();
}

function closeHistory() {
    historyPanel.classList.remove('open');
    historyBackdrop.classList.remove('visible');
}

document.getElementById('history-toggle-btn').addEventListener('click', openHistory);
document.getElementById('close-history').addEventListener('click', closeHistory);
historyBackdrop.addEventListener('click', closeHistory);

async function fetchHistory() {
    try {
        const res = await fetch('/history');
        const data = await res.json();
        if (!data.length) {
            historyList.innerHTML = `<p style="text-align:center;color:var(--text-muted);font-size:14px;padding:24px 0;">Тарых жок</p>`;
            return;
        }
        historyList.innerHTML = data.map(item => `
            <div class="history-entry">
                <p class="user-msg"><span>Сиз:</span> ${item.user_query}</p>
                <p class="assistant-msg">${item.assistant_response}</p>
            </div>
        `).join('');
    } catch {
        historyList.innerHTML = `<p style="text-align:center;color:var(--text-muted);font-size:14px;padding:24px 0;">Ката кетти</p>`;
    }
}

// =============================================
// PREMIUM MODAL
// =============================================
document.getElementById('premium-btn').addEventListener('click', () => {
    premiumModal.style.display = 'flex';
    gsap.fromTo(premiumModal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo('.modal-card', { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
});

closeModal.addEventListener('click', () => {
    gsap.to(premiumModal, {
        opacity: 0, duration: 0.25, onComplete: () => { premiumModal.style.display = 'none'; }
    });
});

// Plan toggle
document.querySelectorAll('.plan-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('.plan-pill').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.plan-content').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const plan = pill.dataset.plan;
        document.querySelector(`.plan-${plan}`).classList.add('active');
    });
});

// Magnetic Buttons (Desktop only)
if (window.innerWidth > 768) {
    const magButtons = document.querySelectorAll('.glass-btn, .ios-button');
    magButtons.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            gsap.to(btn, { x: x * 0.3, y: y * 0.3, duration: 0.3 });
        });
        btn.addEventListener('mouseleave', () => {
            gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.3)" });
        });
    });
}

// Premium GSAP Initial Animations
const tl = gsap.timeline();
tl.from(".topbar", { duration: 1, y: -20, opacity: 0, ease: "power3.out" })
    .from(".voice-orb-wrapper", { duration: 1.5, scale: 0.8, opacity: 0, ease: "elastic.out(1, 0.5)" }, "-=0.6")
    .from(".message-bubble", { duration: 1, y: 30, opacity: 0, ease: "power3.out" }, "-=1.2")
    .from(".bottom-dock", { duration: 1, y: 30, opacity: 0, ease: "power3.out" }, "-=0.8");

gsap.to(".orb", { duration: 20, x: "random(-50, 50)", y: "random(-50, 50)", repeat: -1, yoyo: true, ease: "sine.inOut" });

// Button Press Feedback for Mobile
const allButtons = document.querySelectorAll('button');
allButtons.forEach(btn => {
    btn.addEventListener('touchstart', () => gsap.to(btn, { scale: 0.95, duration: 0.1 }));
    btn.addEventListener('touchend', () => gsap.to(btn, { scale: 1, duration: 0.3, ease: "elastic.out(1, 0.5)" }));
});

premiumModal.addEventListener('click', (e) => {
    if (e.target === premiumModal) closeModal.click();
});

// =============================================
// CANVAS VISUALIZER
// =============================================
function resizeCanvas() {
    const size = voiceOrbWrapper.querySelector('.orb-core').offsetWidth;
    canvas.width = size;
    canvas.height = size;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let idleAnimId;
let idlePhase = 0;

function drawIdle() {
    idleAnimId = requestAnimationFrame(drawIdle);
    idlePhase += 0.015;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = canvas.width * 0.28;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();

    for (let i = 0; i <= 360; i++) {
        const rad = (i * Math.PI) / 180;
        const noise = Math.sin(i * 0.05 + idlePhase) * 4 + Math.cos(i * 0.03 - idlePhase * 0.7) * 3;
        const rx = cx + (r + noise) * Math.cos(rad);
        const ry = cy + (r + noise) * Math.sin(rad);
        if (i === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    const grad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.3);
    grad.addColorStop(0, 'rgba(251, 191, 36, 0.4)'); /* Gold core */
    grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)'; /* Gold ring */
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

drawIdle();

function drawActive(stream) {
    cancelAnimationFrame(idleAnimId);
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 512;
    const bufLen = analyser.frequencyBinCount;
    const dataArr = new Uint8Array(bufLen);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const baseR = canvas.width * 0.28;

    function draw() {
        animationId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArr);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Outer glow wave
        ctx.beginPath();
        for (let i = 0; i <= 360; i++) {
            const rad = (i * Math.PI) / 180;
            const index = Math.floor((i / 360) * bufLen);
            const amp = (dataArr[index] / 255) * (canvas.width * 0.12);
            const r = baseR + amp;
            const rx = cx + r * Math.cos(rad);
            const ry = cy + r * Math.sin(rad);
            if (i === 0) ctx.moveTo(rx, ry);
            else ctx.lineTo(rx, ry);
        }
        ctx.closePath();

        const grad = ctx.createRadialGradient(cx, cy, baseR * 0.5, cx, cy, baseR * 1.5);
        grad.addColorStop(0, 'rgba(217, 119, 6, 0.6)'); /* Deep Amber */
        grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.3)'); /* Gold/Amber */
        grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    draw();
}

// =============================================
// RECORDING
// =============================================
recordBtn.addEventListener('click', () => isRecording ? stopRecording() : startRecording());

async function startRecording() {
    isRecording = true;
    beep(880, 60, 'sine', 0.1);

    recordBtn.classList.add('recording');
    voiceOrbWrapper.classList.add('recording');
    micSvg.classList.add('hidden');
    stopSvg.classList.remove('hidden');
    micHint.textContent = 'Токтотуу үчүн басыңыз';
    setAssistantText('Угуп жатам...');
    showStatus('Жазылуу жүрүп жатат');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = () => handleAudio(new Blob(audioChunks, { type: 'audio/webm' }));
        mediaRecorder.start();
        drawActive(stream);
    } catch {
        setAssistantText('Микрофонго уруксат жок.');
        stopRecording();
    }
}

function stopRecording() {
    isRecording = false;
    beep(660, 60, 'sine', 0.08);

    recordBtn.classList.remove('recording');
    voiceOrbWrapper.classList.remove('recording');
    micSvg.classList.remove('hidden');
    stopSvg.classList.add('hidden');
    micHint.textContent = 'Басып сүйлөңүз';

    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    cancelAnimationFrame(animationId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawIdle();
}

// =============================================
// HANDLE AUDIO → API
// =============================================
async function handleAudio(blob) {
    showStatus('Иштетилүүдө...');
    setAssistantText('Ойлонуп жатам...');
    const formData = new FormData();
    formData.append('audio', blob);

    try {
        const trRes = await fetch('/transcribe', { method: 'POST', body: formData });
        const trData = await trRes.json();
        if (!trData.text) {
            setAssistantText('Сизди укпадым. Кайра сүйлөңүзчү.');
            showStatus('Угуп болгон жок');
            return;
        }

        const chatRes = await fetch(`/chat?query=${encodeURIComponent(trData.text)}`, { method: 'POST' });

        if (chatRes.status === 403) {
            premiumModal.style.display = 'flex';
            gsap.fromTo(premiumModal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
            gsap.fromTo('.modal-card', { y: 60 }, { y: 0, duration: 0.5, ease: 'power3.out' });
            setAssistantText('Бүгүнкү лимит бүттү.');
            showStatus('Лимит бүттү');
            return;
        }

        const chatData = await chatRes.json();
        beep(1100, 50, 'sine', 0.07);

        // Premium chat bubble animation
        gsap.to(chatBubble, {
            scale: 0.95, y: 10, duration: 0.15, ease: "power1.inOut", onComplete: () => {
                assistantText.innerText = chatData.response;
                gsap.to(chatBubble, { scale: 1, y: 0, duration: 0.7, ease: "elastic.out(1, 0.4)" });
            }
        });
    } catch {
        setAssistantText('Байланыш ката кетти. Кайра аракет кылыңыз.');
        showStatus('Ката кетти');
    }
}

// =============================================
// HELPERS
// =============================================
function setAssistantText(text) {
    gsap.to(assistantText, {
        opacity: 0, duration: 0.18,
        onComplete: () => {
            assistantText.textContent = text;
            gsap.to(assistantText, { opacity: 1, duration: 0.25 });
        }
    });
}

let statusTimeout;
function showStatus(text) {
    statusLabel.textContent = text;
    statusLabel.classList.add('visible');
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => statusLabel.classList.remove('visible'), 3000);
}

// =============================================
// ENTRY ANIMATIONS
// =============================================
gsap.from('.topbar', { y: -20, opacity: 0, duration: 0.7, ease: 'power3.out' });
gsap.from('.voice-orb-wrapper', { scale: 0.8, opacity: 0, duration: 0.9, ease: 'back.out(1.4)', delay: 0.15 });
gsap.from('.message-bubble', { y: 30, opacity: 0, duration: 0.7, ease: 'power3.out', delay: 0.25 });
gsap.from('.bottom-dock', { y: 30, opacity: 0, duration: 0.7, ease: 'power3.out', delay: 0.35 });
