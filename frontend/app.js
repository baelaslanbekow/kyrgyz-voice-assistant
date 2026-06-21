if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
}

const $ = (id) => document.getElementById(id);

const recordBtn = $('record-btn');
const assistantText = $('assistant-text');
const chatBubble = $('chat-bubble');
const statusLabel = $('status-label');
const micHint = $('mic-hint');
const canvas = $('voice-canvas');
const ctx = canvas.getContext('2d');
const micSvg = $('mic-svg');
const stopSvg = $('stop-svg');
const premiumModal = $('premium-modal');
const closeModal = $('close-modal');
const voiceOrbWrapper = $('voice-orb-wrapper');
const historyPanel = $('history-panel');
const historyBackdrop = $('history-backdrop');
const historyList = $('history-list');
const themeBtn = $('theme-btn');

let recording = false;
let mediaRecorder;
let audioChunks = [];
let animFrame;
let idleFrame;
let idlePhase = 0;
let statusTimer;

const SUN_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
</svg>`;

const MOON_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
</svg>`;

function beep(freq = 880, dur = 80, vol = 0.15) {
    try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur / 1000);
        osc.start();
        osc.stop(ac.currentTime + dur / 1000);
    } catch {}
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function setAssistantText(text) {
    gsap.to(assistantText, {
        opacity: 0,
        duration: 0.18,
        onComplete: () => {
            assistantText.textContent = text;
            gsap.to(assistantText, { opacity: 1, duration: 0.25 });
        },
    });
}

function showStatus(text) {
    statusLabel.textContent = text;
    statusLabel.classList.add('visible');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => statusLabel.classList.remove('visible'), 3000);
}

function showPremiumModal() {
    premiumModal.style.display = 'flex';
    gsap.fromTo(premiumModal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo('.modal-card', { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
}

function hidePremiumModal() {
    gsap.to(premiumModal, {
        opacity: 0,
        duration: 0.25,
        onComplete: () => { premiumModal.style.display = 'none'; },
    });
}

function updateTime() {
    const now = new Date();
    const el = document.querySelector('.time');
    if (el) {
        el.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
}

function resizeCanvas() {
    const size = voiceOrbWrapper.querySelector('.orb-core').offsetWidth;
    canvas.width = size;
    canvas.height = size;
}

function drawIdle() {
    idleFrame = requestAnimationFrame(drawIdle);
    idlePhase += 0.015;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = canvas.width * 0.28;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();

    for (let i = 0; i <= 360; i++) {
        const rad = (i * Math.PI) / 180;
        const noise = Math.sin(i * 0.05 + idlePhase) * 4 + Math.cos(i * 0.03 - idlePhase * 0.7) * 3;
        const x = cx + (r + noise) * Math.cos(rad);
        const y = cy + (r + noise) * Math.sin(rad);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

function drawActive(stream) {
    cancelAnimationFrame(idleFrame);

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    analyser.fftSize = 512;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const baseR = canvas.width * 0.28;

    function frame() {
        animFrame = requestAnimationFrame(frame);
        analyser.getByteFrequencyData(data);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();

        for (let i = 0; i <= 360; i++) {
            const rad = (i * Math.PI) / 180;
            const idx = Math.floor((i / 360) * data.length);
            const amp = (data[idx] / 255) * (canvas.width * 0.12);
            const x = cx + (baseR + amp) * Math.cos(rad);
            const y = cy + (baseR + amp) * Math.sin(rad);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.closePath();
        const grad = ctx.createRadialGradient(cx, cy, baseR * 0.5, cx, cy, baseR * 1.5);
        grad.addColorStop(0, 'rgba(217, 119, 6, 0.6)');
        grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.3)');
        grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    frame();
}

async function startRecording() {
    recording = true;
    beep(880, 60, 0.1);

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
    recording = false;
    beep(660, 60, 0.08);

    recordBtn.classList.remove('recording');
    voiceOrbWrapper.classList.remove('recording');
    micSvg.classList.remove('hidden');
    stopSvg.classList.add('hidden');
    micHint.textContent = 'Басып сүйлөңүз';

    if (mediaRecorder?.state !== 'inactive') mediaRecorder.stop();
    cancelAnimationFrame(animFrame);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawIdle();
}

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
            showPremiumModal();
            setAssistantText('Бүгүнкү лимит бүттү.');
            showStatus('Лимит бүттү');
            return;
        }

        const chatData = await chatRes.json();
        beep(1100, 50, 0.07);

        gsap.to(chatBubble, {
            scale: 0.95,
            y: 10,
            duration: 0.15,
            ease: 'power1.inOut',
            onComplete: () => {
                assistantText.textContent = chatData.response;
                gsap.to(chatBubble, { scale: 1, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
            },
        });
    } catch {
        setAssistantText('Байланыш ката кетти. Кайра аракет кылыңыз.');
        showStatus('Ката кетти');
    }
}

function openHistory() {
    historyPanel.classList.add('open');
    historyBackdrop.classList.add('visible');
    fetchHistory();
}

function closeHistory() {
    historyPanel.classList.remove('open');
    historyBackdrop.classList.remove('visible');
}

async function fetchHistory() {
    const empty = `<p style="text-align:center;color:var(--text-muted);font-size:14px;padding:24px 0;">Тарых жок</p>`;
    const error = `<p style="text-align:center;color:var(--text-muted);font-size:14px;padding:24px 0;">Ката кетти</p>`;

    try {
        const res = await fetch('/history');
        const data = await res.json();

        if (!data.length) {
            historyList.innerHTML = empty;
            return;
        }

        historyList.innerHTML = data.map((item) => `
            <div class="history-entry">
                <p class="user-msg"><span>Сиз:</span> ${escapeHtml(item.user_query)}</p>
                <p class="assistant-msg">${escapeHtml(item.assistant_response)}</p>
            </div>
        `).join('');
    } catch {
        historyList.innerHTML = error;
    }
}

updateTime();
setInterval(updateTime, 30000);
resizeCanvas();
drawIdle();
window.addEventListener('resize', resizeCanvas);

recordBtn.addEventListener('click', () => (recording ? stopRecording() : startRecording()));

themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const light = document.body.classList.contains('light-mode');
    themeBtn.innerHTML = light ? MOON_ICON : SUN_ICON;
});

$('clear-btn').addEventListener('click', async () => {
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

$('history-toggle-btn').addEventListener('click', openHistory);
$('close-history').addEventListener('click', closeHistory);
historyBackdrop.addEventListener('click', closeHistory);

$('premium-btn').addEventListener('click', showPremiumModal);
closeModal.addEventListener('click', hidePremiumModal);
premiumModal.addEventListener('click', (e) => {
    if (e.target === premiumModal) hidePremiumModal();
});

document.querySelectorAll('.plan-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('.plan-pill').forEach((p) => p.classList.remove('active'));
        document.querySelectorAll('.plan-content').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        document.querySelector(`.plan-${pill.dataset.plan}`).classList.add('active');
    });
});

gsap.timeline()
    .from('.topbar', { y: -20, opacity: 0, duration: 0.7, ease: 'power3.out' })
    .from('.voice-orb-wrapper', { scale: 0.8, opacity: 0, duration: 0.9, ease: 'back.out(1.4)' }, '-=0.5')
    .from('.message-bubble', { y: 30, opacity: 0, duration: 0.7, ease: 'power3.out' }, '-=0.6')
    .from('.bottom-dock', { y: 30, opacity: 0, duration: 0.7, ease: 'power3.out' }, '-=0.5');

gsap.to('.orb', { x: 'random(-50, 50)', y: 'random(-50, 50)', duration: 20, repeat: -1, yoyo: true, ease: 'sine.inOut' });