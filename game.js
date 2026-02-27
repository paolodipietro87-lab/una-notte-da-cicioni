/**
 * NOTTE DA LEONI AI - Logic Engine
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');
const scoreVal = document.getElementById('score-val');
const ebbrezzaBar = document.getElementById('ebbrezza-bar');
const finalScore = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const jumpBtn = document.getElementById('jump-btn');
const mobileControls = document.getElementById('mobile-controls');

// Game Settings
const CONFIG = {
    gravity: 0.6,
    jumpForce: -14,
    baseScrollSpeed: 4,
    scrollSpeed: 4,
    itemSpawnRate: 1500,
    obstacleSpawnRate: 2500,
    width: 800,
    height: 450,
    difficultyScale: 0.002 // Incremento velocità per ogni punto
};

// Assets
const ASSETS = {
    player: new Image(),
    items: new Image(),
    background: new Image(),
    bouncer: new Image()
};
ASSETS.player.src = 'assets/player.png';
ASSETS.items.src = 'assets/items.png';
ASSETS.background.src = 'assets/background.png';
ASSETS.bouncer.src = 'assets/bouncer.png';

// Set to true to use pixel art assets, will fallback to procedural if images fail
const USE_IMAGES = true;

// Selective asset usage (disable if assets are still placeholders/broken)
const ASSET_FLAGS = {
    player: false,     // Set to false to use high-quality procedural character
    items: false,      // Set to false to use glowing procedural items
    background: true,  // Keep background image (as the user likes it)
    bouncer: false     // Set to false to use cyberpunk procedural bouncer
};

// Debug Asset Loading
Object.keys(ASSETS).forEach(key => {
    ASSETS[key].onload = () => console.log(`Asset ${key} loaded: ${ASSETS[key].naturalWidth}x${ASSETS[key].naturalHeight}`);
    ASSETS[key].onerror = () => console.error(`Asset ${key} failed to load from ${ASSETS[key].src}`);
});

// State
let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER
let score = 0;
let ebbrezza = 0;
let highScore = localStorage.getItem('cicioni_highScore') || 0;
let gameLoopId;
let lastTime = 0;
let nextItemSpawn = 0;
let nextObstacleSpawn = 0;
let isKaraoke = false;
let karaokeTime = 0;
let isClarity = false;
let clarityTime = 0;
let hasShield = false;
let comboCount = 0;
let lastCollectTime = 0;
let comboTimeout = 2000; // 2 secondi per concatenare
let canDoubleJump = false;

// Entities
let player;
let items = [];
let obstacles = [];
let particles = [];
let screenShake = 0;

// Item types
const ITEM_TYPES = [
    { name: 'Birra', ebbrezza: 5, score: 10, color: '#fdd835', emoji: '🍺' },
    { name: 'Spritz', ebbrezza: 15, score: 30, color: '#ff5722', emoji: '🍹' },
    { name: 'Gin Tonic', ebbrezza: 25, score: 50, color: '#e1f5fe', emoji: '🍸' },
    { name: 'Whiskey', ebbrezza: 40, score: 80, color: '#795548', emoji: '🥃' },
    { name: 'Pizza', ebbrezza: -25, score: 5, color: '#ffeb3b', emoji: '🍕' },
    { name: 'Panino', ebbrezza: -35, score: 10, color: '#ffcc80', emoji: '🥪' },
    { name: 'Pasta', ebbrezza: -45, score: 15, color: '#fff59d', emoji: '🍝' },
    { name: 'Kebab', ebbrezza: -50, score: 5, color: '#8d6e63', emoji: '🌯' },
    { name: 'Acqua', ebbrezza: -15, score: 0, color: '#2196f3', emoji: '💧' },
    { name: 'Caffè', ebbrezza: -10, score: 20, color: '#3e2723', emoji: '☕', isClarity: true },
    { name: 'Occhiali', ebbrezza: 0, score: 50, color: '#000', emoji: '😎', isShield: true },
    { name: 'DJ', ebbrezza: 0, score: 100, isPowerUp: true, emoji: '🎧' }
];

const ACHIEVEMENTS = [
    { id: 'survivor', name: 'Sopravvissuto', desc: 'Raggiungi 500 punti', icon: '🏃', goal: 500 },
    { id: 'king', name: 'Re della Serata', desc: 'Raggiungi 1000 punti', icon: '👑', goal: 1000 },
    { id: 'drinker', name: 'Guglielmo Tell', desc: 'Grado ebbrezza > 80%', icon: '🥴', goal: 80, type: 'ebbrezza' },
    { id: 'combo', name: 'Inarrestabile', desc: 'Combo x10 raggiunta', icon: '🔥', goal: 10, type: 'combo' }
];

class Player {
    constructor() {
        this.width = 50;
        this.height = 70;
        this.x = 100;
        this.y = CONFIG.height - this.height - 20;
        this.dy = 0;
        this.isJumping = false;
        this.rotation = 0;
    }

    update() {
        // Apply gravity
        this.dy += CONFIG.gravity;
        this.y += this.dy;

        // Ground collision
        if (this.y > CONFIG.height - this.height - 20) {
            this.y = CONFIG.height - this.height - 20;
            this.dy = 0;
            this.isJumping = false;
            canDoubleJump = ebbrezza < 60; // Abilita double jump all'atterraggio se lucidi
        }

        // Wobble when drunk
        if (ebbrezza > 50) {
            this.rotation = Math.sin(Date.now() / 200) * (ebbrezza / 100) * 0.2;
        } else {
            this.rotation = 0;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);

        // Player Sprite logic
        let frameX = 0;
        if (isKaraoke) frameX = 2;
        else if (ebbrezza > 70) frameX = 1;
        else if (this.isJumping) frameX = 3;

        // Draw image if available and has valid dimensions
        if (USE_IMAGES && ASSET_FLAGS.player && ASSETS.player.complete && ASSETS.player.naturalWidth >= 64) {
            ctx.drawImage(
                ASSETS.player,
                frameX * 64, 0, 64, 64,
                -this.width / 2, -this.height / 2, this.width, this.height
            );
        } else {
            // High-quality procedural fallback (Hat/Crown logic moved inside)
            this.drawProcedural(isKaraoke, ebbrezza, score);
        }

        // Shield Visual
        if (hasShield) {
            ctx.save();
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00f3ff';
            ctx.beginPath();
            ctx.arc(0, 0, 45, 0, Math.PI * 2);
            ctx.stroke();

            // Hexagonal pattern hint
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const x = Math.cos(angle) * 40;
                const y = Math.sin(angle) * 40;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    }

    drawPartyHat(bounce) {
        ctx.save();
        ctx.translate(-2, -45 - bounce); // Positioned strictly on top of the head
        ctx.fillStyle = '#ff00ff';
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(12, 0);
        ctx.lineTo(0, -25);
        ctx.closePath();
        ctx.fill();

        // Stripes
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-7, -15); ctx.lineTo(7, -15);
        ctx.moveTo(-4, -25); ctx.lineTo(4, -25);
        ctx.stroke();

        // Pom-pom
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(0, -35, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawCrown(bounce) {
        ctx.save();
        ctx.translate(-2, -45 - bounce); // Positioned strictly on top of the head
        ctx.fillStyle = '#ffd700'; // Gold
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffd700';
        const top = -12;
        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.lineTo(-18, top);
        ctx.lineTo(-9, top + 6);
        ctx.lineTo(0, top);
        ctx.lineTo(9, top + 6);
        ctx.lineTo(18, top);
        ctx.lineTo(18, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    drawProcedural(isKaraoke, ebbrezza, score) {
        ctx.save();
        const time = performance.now();
        const walkCycle = Math.sin(time / 150); // -1 to 1
        const bounce = Math.abs(Math.sin(time / 150)) * 5;

        // Draw Party Hat/Crown FIRST so they follow the bounce but are layered properly
        if (score >= 1000) this.drawCrown(bounce);
        else if (score >= 500) this.drawPartyHat(bounce);

        // --- 1. T-REX (The Mount) ---
        const rexColor = '#2e7d32'; // Green
        const rexDarkColor = '#1b5e20';
        const rexBellyColor = '#cddc39'; // Yellowish green

        // T-Rex Body (Large oval)
        ctx.fillStyle = rexColor;
        ctx.beginPath();
        ctx.ellipse(0, 15 - bounce, 25, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        // T-Rex Neck & Head
        ctx.save();
        ctx.translate(15, 5 - bounce);
        ctx.rotate(-0.3 + Math.sin(time / 200) * 0.1);
        // Neck
        ctx.fillRect(0, -10, 12, 15);
        // Head
        ctx.beginPath();
        ctx.roundRect(0, -22, 22, 14, 4);
        ctx.fill();
        // Teeth (White)
        ctx.fillStyle = 'white';
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(5 + i * 4, -8);
            ctx.lineTo(7 + i * 4, -4);
            ctx.lineTo(9 + i * 4, -8);
            ctx.fill();
        }
        // Eye
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(15, -16, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // T-Rex Legs (The "Real" legs of the costume)
        ctx.fillStyle = rexColor;
        // Back leg
        const bLeg = Math.sin(time / 150) * 10;
        ctx.fillRect(-15, 25 - bounce, 12, 20 + bLeg);
        // Front leg
        const fLeg = Math.cos(time / 150) * 10;
        ctx.fillRect(3, 25 - bounce, 12, 20 + fLeg);

        // T-Rex Tail
        ctx.beginPath();
        ctx.moveTo(-20, 10 - bounce);
        ctx.quadraticCurveTo(-45, 0 - bounce, -35, 25 - bounce);
        ctx.lineTo(-20, 20 - bounce);
        ctx.fill();

        // --- 2. THE MAN (Riding on top) ---
        // Torso (Dark Blue Cardigan)
        ctx.fillStyle = '#1a237e';
        ctx.beginPath();
        ctx.roundRect(-12, -25 - bounce, 20, 22, 5);
        ctx.fill();

        // Shirt Collar (Light Blue/White visible under cardigan)
        ctx.fillStyle = '#bbdefb'; // Light Blue
        ctx.beginPath();
        ctx.moveTo(-5, -25 - bounce);
        ctx.lineTo(2, -21 - bounce);
        ctx.lineTo(8, -25 - bounce);
        ctx.lineTo(4, -25 - bounce);
        ctx.lineTo(-2, -23 - bounce);
        ctx.closePath();
        ctx.fill();

        // Fake Blue Legs (Hanging)
        ctx.fillStyle = '#3f51b5';
        ctx.save();
        ctx.translate(-5, -10 - bounce);
        ctx.rotate(0.5);
        ctx.fillRect(0, 0, 10, 20);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 18, 12, 6);
        ctx.restore();

        // Head
        ctx.fillStyle = '#ffdbac';
        ctx.beginPath();
        ctx.arc(-2, -35 - bounce, 10, 0, Math.PI * 2);
        ctx.fill();

        // --- FACE DETAILS (Faithful to photo) ---
        const hairColor = '#3e2723'; // Dark brown
        const greyColor = '#b0bec5'; // Silver/Grey

        // Hair (Salt & Pepper)
        ctx.fillStyle = hairColor;
        ctx.beginPath();
        ctx.ellipse(-2, -40 - bounce, 11, 7, 0, Math.PI, 0);
        ctx.fill();

        // Hair highlights (Grey streaks)
        ctx.strokeStyle = greyColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(-10 + i * 4, -42 - bounce);
            ctx.lineTo(-8 + i * 4, -45 - bounce);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;

        // Eyebrows
        ctx.fillStyle = '#222';
        ctx.fillRect(-7, -39 - bounce, 4, 1.5);
        ctx.fillRect(0, -39 - bounce, 4, 1.5);

        // Eyes
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(-5, -36 - bounce, 1.2, 0, Math.PI * 2);
        ctx.arc(1, -36 - bounce, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Goatee (Detailed mustache + chin beard)
        ctx.fillStyle = hairColor;
        // Mustache
        ctx.fillRect(-6, -32 - bounce, 8, 1.5);
        // Chin beard
        ctx.beginPath();
        ctx.arc(-2, -29 - bounce, 4, 0, Math.PI);
        ctx.fill();

        // Beard highlights (Grey streaks on chin)
        ctx.strokeStyle = greyColor;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(-4, -29 - bounce);
        ctx.lineTo(-4, -26 - bounce);
        ctx.moveTo(-1, -29 - bounce);
        ctx.lineTo(-1, -25 - bounce);
        ctx.moveTo(2, -29 - bounce);
        ctx.lineTo(2, -27 - bounce);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Arms (Holding leash)
        ctx.strokeStyle = '#ffdbac';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, -18 - bounce);
        ctx.lineTo(10, -12 - bounce);
        ctx.stroke();

        // Leash (The strap)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(10, -12 - bounce);
        ctx.lineTo(20, -5 - bounce);
        ctx.stroke();

        ctx.restore();
    }

    roundRect(x, y, w, h, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    jump() {
        if (!this.isJumping) {
            this.dy = CONFIG.jumpForce;
            this.isJumping = true;
        } else if (canDoubleJump) {
            this.dy = CONFIG.jumpForce * 0.8;
            canDoubleJump = false;
            playSound('jump'); // Play again for double jump
        }
    }
}

class Item {
    constructor() {
        const typeIdx = Math.floor(Math.random() * ITEM_TYPES.length);
        this.type = ITEM_TYPES[typeIdx];
        this.width = 30;
        this.height = 30;
        this.x = CONFIG.width + 50;
        this.y = Math.random() * 120 + 280; // Guaranteed reachable: between 280 and 400
    }

    update() {
        this.x -= CONFIG.scrollSpeed + (ebbrezza / 20);
    }

    draw() {
        const idx = ITEM_TYPES.findIndex(t => t.name === this.type.name);
        ctx.save();
        // Draw image if available
        if (USE_IMAGES && ASSET_FLAGS.items && ASSETS.items.complete && ASSETS.items.naturalWidth >= (idx + 1) * 32) {
            ctx.drawImage(
                ASSETS.items,
                idx * 32, 0, 32, 32,
                this.x, this.y, this.width, this.height
            );
        } else {
            this.drawProcedural(ctx);
        }
        ctx.restore();
    }

    drawProcedural(ctx) {
        ctx.save();
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        // Outer Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.type.color || '#fff';

        // Glass/Container Body
        const grad = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y + this.height);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.1)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        if (this.type.name.includes('Pizza') || this.type.name.includes('Kebab')) {
            // Triangular/Rectangular food
            ctx.rect(this.x, this.y, this.width, this.height);
        } else {
            // Circular drinks
            ctx.arc(centerX, centerY, 16, 0, Math.PI * 2);
        }
        ctx.fill();

        ctx.strokeStyle = this.type.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Liquid / Content Fill
        ctx.fillStyle = this.type.color;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(centerX, centerY + 4, 10, 0, Math.PI, false);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Emoji representation
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type.emoji, centerX, centerY - 2);

        ctx.restore();
    }
}

class Obstacle {
    constructor() {
        this.width = 40;
        this.height = 80;
        this.x = CONFIG.width + 50;
        this.y = CONFIG.height - this.height - 20;
    }

    update() {
        this.x -= CONFIG.scrollSpeed + (ebbrezza / 20);
    }

    draw() {
        // Redesigned Bouncer: Priority to Image, high-quality procedural fallback
        ctx.save();

        if (USE_IMAGES && ASSET_FLAGS.bouncer && ASSETS.bouncer.complete && ASSETS.bouncer.naturalWidth >= 32) {
            ctx.drawImage(
                ASSETS.bouncer,
                0, 0, ASSETS.bouncer.naturalWidth, ASSETS.bouncer.naturalHeight,
                this.x, this.y, this.width, this.height
            );
        } else {
            // Imposing Procedural Bouncer (Cyberpunk Style)
            const centerX = this.x + this.width / 2;
            const bodyColor = '#0a0a0c';
            const neonColor = '#ff003c';

            ctx.shadowBlur = 15;
            ctx.shadowColor = neonColor;
            ctx.fillStyle = bodyColor;

            // Shoulders
            ctx.beginPath();
            ctx.moveTo(this.x - 10, this.y + 10);
            ctx.lineTo(this.x + this.width + 10, this.y + 10);
            ctx.lineTo(this.x + this.width, this.y + 60);
            ctx.lineTo(this.x, this.y + 60);
            ctx.closePath();
            ctx.fill();

            // Legs
            ctx.fillRect(this.x - 2, this.y + 60, 14, 25);
            ctx.fillRect(this.x + this.width - 12, this.y + 60, 14, 25);

            // Head
            ctx.fillRect(this.x + 5, this.y - 12, 30, 25);

            // Visor
            ctx.fillStyle = neonColor;
            ctx.shadowBlur = 10;
            ctx.fillRect(this.x + 5, this.y - 2, 30, 4);

            // Arms
            ctx.strokeStyle = '#050505';
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(this.x - 5, this.y + 25);
            ctx.lineTo(this.x + this.width + 5, this.y + 35);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(this.x + this.width + 5, this.y + 25);
            ctx.lineTo(this.x - 5, this.y + 35);
            ctx.stroke();
        }

        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 2;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.vy += 0.2; // Gravity for particles
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Sound System (Synthesized)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    // Distorsione basata su ebbrezza
    let distortion = 0;
    if (ebbrezza > 50 && !isClarity) {
        distortion = (ebbrezza - 50) / 50; // 0 to 1
    }

    const now = audioCtx.currentTime;
    const freqMod = 1 - (distortion * 0.4); // Rallenta/abbassa pitch se ubriaco

    // LowPass Filter for smoother "drunken" audio
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isClarity ? 20000 : 20000 - (ebbrezza * 180), now);
    filter.Q.setValueAtTime(1, now);

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    switch (type) {
        case 'jump':
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(150 * freqMod, now);
            oscillator.frequency.exponentialRampToValueAtTime(400 * freqMod, now + 0.1);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            oscillator.start(now);
            oscillator.stop(now + 0.1);
            break;
        case 'collect':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(500 * freqMod, now);
            oscillator.frequency.exponentialRampToValueAtTime(800 * freqMod, now + 0.1);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            oscillator.start(now);
            oscillator.stop(now + 0.1);
            break;
        case 'powerup':
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(200, now);
            oscillator.frequency.linearRampToValueAtTime(800, now + 0.5);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0.01, now + 0.5);
            oscillator.start(now);
            oscillator.stop(now + 0.5);
            break;
        case 'gameover':
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(200 * freqMod, now);
            oscillator.frequency.linearRampToValueAtTime(50 * freqMod, now + 1);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.linearRampToValueAtTime(0.01, now + 1);
            oscillator.start(now);
            oscillator.stop(now + 1);
            break;
    }
}

// BGM System
let bgmOsc;
let bgmGain;
let bgmLoopId;

function startBGM() {
    if (bgmOsc) stopBGM();

    bgmGain = audioCtx.createGain();
    bgmGain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    bgmGain.connect(audioCtx.destination);

    playNote(0);
}

function stopBGM() {
    if (bgmOsc) {
        bgmOsc.stop();
        bgmOsc = null;
    }
    clearTimeout(bgmLoopId);
}

const melody = [220, 220, 293, 220, 329, 220, 293, 196]; // Bass-driven rhythmic loop
function playNote(index) {
    if (gameState !== 'PLAYING') return;

    const now = audioCtx.currentTime;
    const freqMod = 1 - (Math.max(0, ebbrezza - 50) / 100);

    bgmOsc = audioCtx.createOscillator();
    bgmOsc.type = 'square'; // More arcade-like
    bgmOsc.frequency.setValueAtTime(melody[index % melody.length] * freqMod, now);

    const noteGain = audioCtx.createGain();
    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(0.03, now + 0.02); // Slightly quieter square wave
    noteGain.gain.linearRampToValueAtTime(0, now + 0.15); // Snappier notes

    bgmOsc.connect(noteGain);
    noteGain.connect(bgmGain);

    bgmOsc.start(now);
    bgmOsc.stop(now + 0.2);

    // More rhythmic progression (Arcade feel: 1/8 notes)
    const rhythm = [200, 200, 400, 200, 200, 400]; // Alternating fast/slow
    const nextNoteTime = (isKaraoke ? rhythm[index % rhythm.length] / 2 : rhythm[index % rhythm.length]);
    bgmLoopId = setTimeout(() => playNote(index + 1), nextNoteTime);
}

// Procedural "Voice" Synthesis (Robot-like but fun)
function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    utterance.pitch = ebbrezza > 70 ? 0.5 : 1.2; // Più profonda se ubriaco
    utterance.rate = ebbrezza > 70 ? 0.6 : 1.1; // Più lenta se ubriaco
    utterance.volume = 0.5;
    window.speechSynthesis.speak(utterance);
}

function collectItem(item) {
    const now = performance.now();

    // Combo Logic
    if (now - lastCollectTime < comboTimeout) {
        comboCount++;
    } else {
        comboCount = 1;
    }
    lastCollectTime = now;

    // Point multiplier based on combo
    const multiplier = Math.min(5, 1 + Math.floor(comboCount / 3));
    score += item.type.score * multiplier;
    ebbrezza += item.type.ebbrezza;

    // Spawn Particles
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(item.x + item.width / 2, item.y + item.height / 2, item.type.color));
    }

    // Screen Shake
    if (item.type.isPowerUp || item.type.isShield || item.type.isClarity) {
        screenShake = 15;
    } else {
        screenShake = 5;
    }

    if (item.type.isPowerUp) {
        isKaraoke = true;
        karaokeTime = now + 5000;
        ebbrezza /= 2;
        playSound('powerup');
        speak("Karaoke!");
    } else if (item.type.isClarity) {
        isClarity = true;
        clarityTime = now + 8000;
        playSound('powerup');
        speak("Caffè!");
    } else if (item.type.isShield) {
        hasShield = true;
        playSound('powerup');
        speak("Occhiali!");
    } else {
        playSound('collect');
        if (Math.random() > 0.8) speak(item.type.name);
    }

    ebbrezza = Math.max(0, ebbrezza);

    // Multiplier High Score / Fire Effect
    if (comboCount > 10) {
        screenShake = 20;
        speak("ESAGERATO!");
    }
}

function endGame() {
    if (gameState === 'GAMEOVER') return;
    console.log("Game ending...");
    gameState = 'GAMEOVER';
    screenShake = 30; // Big impact

    if (gameLoopId) cancelAnimationFrame(gameLoopId);

    // Play sound and speak safely
    try {
        playSound('gameover');
        speak("Game Over!");
    } catch (e) {
        console.error("Audio error in endGame:", e);
    }

    // High Score tracking
    if (score > highScore) {
        highScore = score;
        try {
            localStorage.setItem('cicioni_highScore', highScore);
            checkAchievements();
        } catch (e) {
            console.warn("Storage error:", e);
        }
    }

    // Update UI Elements
    if (finalScore) finalScore.innerText = score;

    const finalRecordEl = document.getElementById('final-record');
    if (finalRecordEl) finalRecordEl.innerText = highScore;

    const finalEbbrezzaEl = document.getElementById('final-ebbrezza');
    if (finalEbbrezzaEl) finalEbbrezzaEl.innerText = Math.round(ebbrezza) + '%';

    // Transition Screens
    if (hud) hud.classList.add('hidden');
    if (mobileControls) mobileControls.classList.add('hidden');

    if (gameOverScreen) {
        gameOverScreen.classList.remove('hidden');
        gameOverScreen.style.display = 'flex'; // Force visibility
    }

    // Reset visual effects
    document.body.style.setProperty('--blur-amount', '0px');
    document.body.style.setProperty('--vignette-opacity', '0');
    canvas.classList.remove('drunken-blur');
    canvas.classList.remove('chromatic-aberration');

    stopBGM();
    console.log("Game Over screen should be visible now.");
}

function resizeCanvas() {
    // Maintain aspect ratio
    const ratio = CONFIG.width / CONFIG.height;
    let w = window.innerWidth;
    let h = window.innerHeight;

    if (w / h > ratio) {
        w = h * ratio;
    } else {
        h = w / ratio;
    }

    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = CONFIG.width;
    canvas.height = CONFIG.height;
}

function renderAchievementsPreview() {
    const container = document.getElementById('achievements-preview');
    if (!container) return;

    const stored = localStorage.getItem('cicioni_achievements');
    const unlocked = stored ? JSON.parse(stored) : {};

    container.innerHTML = ACHIEVEMENTS.map(ach => `
        <div class="achievement-badge ${unlocked[ach.id] ? 'unlocked' : ''}" title="${ach.name}: ${ach.desc}">
            ${ach.icon}
        </div>
    `).join('');
}

function startGame() {
    gameState = 'PLAYING';
    score = 0;
    ebbrezza = 0;
    items = [];
    obstacles = [];
    particles = [];
    screenShake = 0;
    player = new Player();
    comboCount = 0;
    isClarity = false;
    hasShield = false;
    CONFIG.scrollSpeed = CONFIG.baseScrollSpeed;

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    mobileControls.classList.remove('hidden');

    lastTime = performance.now();
    startBGM();
    gameLoop(lastTime);
}

function gameLoop(timestamp) {
    if (gameState !== 'PLAYING') return;

    const dt = timestamp - lastTime;
    lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply Screen Shake
    ctx.save();
    if (screenShake > 0) {
        const sx = (Math.random() - 0.5) * screenShake;
        const sy = (Math.random() - 0.5) * screenShake;
        ctx.translate(sx, sy);
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }

    // Render Background
    drawBackground();

    // Advanced Drunken Wobble
    if (ebbrezza > 40 && !isClarity) {
        const swayX = Math.sin(timestamp / 500) * (ebbrezza / 5);
        const swayY = Math.cos(timestamp / 700) * (ebbrezza / 10);
        ctx.translate(swayX, swayY);
    }

    // Difficulty Scaling
    CONFIG.scrollSpeed = CONFIG.baseScrollSpeed + (score * CONFIG.difficultyScale);

    // Spawn Logic
    if (timestamp > nextItemSpawn) {
        items.push(new Item());
        nextItemSpawn = timestamp + (CONFIG.itemSpawnRate / (1 + ebbrezza / 100 + score / 2000));
    }
    if (timestamp > nextObstacleSpawn) {
        obstacles.push(new Obstacle());
        nextObstacleSpawn = timestamp + (CONFIG.obstacleSpawnRate / (1 + ebbrezza / 100));
    }

    // Player
    player.update();
    player.draw();

    // High Speed/Combo Trail Particles
    if (CONFIG.scrollSpeed > 8 || comboCount > 5) {
        const color = comboCount > 10 ? '#ff003c' : '#00f3ff';
        particles.push(new Particle(player.x, player.y + player.height / 2 + Math.random() * 20, color));
    }

    // Items
    for (let i = items.length - 1; i >= 0; i--) {
        items[i].update();
        items[i].draw();

        // Collision
        if (checkCollision(player, items[i])) {
            collectItem(items[i]);
            items.splice(i, 1);
            continue;
        }

        if (items[i].x < -50) items.splice(i, 1);
    }

    // Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].update();
        obstacles[i].draw();

        if (checkCollision(player, obstacles[i]) && !isKaraoke) {
            if (hasShield) {
                hasShield = false;
                obstacles.splice(i, 1);
                playSound('powerup'); // Reuse for shield break
            } else {
                endGame();
            }
        }

        if (obstacles[i].x < -50) obstacles.splice(i, 1);
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // UI Updates
    updateUI();

    // Power-up Timeouts
    if (isKaraoke && timestamp > karaokeTime) isKaraoke = false;
    if (isClarity && timestamp > clarityTime) isClarity = false;

    if (ebbrezza >= 100) {
        endGame();
    }

    checkAchievements();

    gameLoopId = requestAnimationFrame(gameLoop);
    ctx.restore();
}

function drawBackground() {
    const now = performance.now();

    // 1. Deep Background (Sky)
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    // 2. Far Parallax (Distant City)
    const farScrollX = (now / 40) % CONFIG.width;
    ctx.save();
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 5; i++) {
        const x = (i * 200 - farScrollX + CONFIG.width) % (CONFIG.width * 2) - CONFIG.width;
        ctx.fillStyle = '#111';
        ctx.fillRect(x, 150, 100, 300);
        ctx.fillStyle = i % 2 === 0 ? '#ffeb3b' : '#2196f3';
        ctx.globalAlpha = 0.05;
        ctx.fillRect(x + 20, 200, 10, 10);
        ctx.fillRect(x + 60, 250, 10, 10);
        ctx.globalAlpha = 0.3;
    }
    ctx.restore();

    // 3. Main Background (PUB Interior Asset) - Highest Priority
    const scrollX = (now / 10) % CONFIG.width;
    if (USE_IMAGES && ASSETS.background.complete && ASSETS.background.naturalWidth > 0) {
        const sH = Math.min(ASSETS.background.naturalHeight, ASSETS.background.naturalWidth * (CONFIG.height / CONFIG.width));
        ctx.drawImage(ASSETS.background, 0, 0, ASSETS.background.naturalWidth, sH, -scrollX, 0, CONFIG.width, CONFIG.height);
        ctx.drawImage(ASSETS.background, 0, 0, ASSETS.background.naturalWidth, sH, CONFIG.width - scrollX, 0, CONFIG.width, CONFIG.height);
    } else {
        // Fallback procedural pub interior
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

        // Neon Decor Patterns (Interactive)
        ctx.strokeStyle = '#ff00ff';
        ctx.globalAlpha = 0.1;
        for (let i = 0; i < CONFIG.width; i += 80) {
            const phase = Math.sin(now / 1000 + i) * 10;
            ctx.strokeRect(i - (scrollX % 80), 20 + phase, 60, CONFIG.height - 100);
        }
        ctx.globalAlpha = 1.0;

        // Floor
        ctx.fillStyle = '#1a1a1f';
        ctx.fillRect(0, CONFIG.height - 20, CONFIG.width, 20);
    }

    // 4. Foreground Accents (Parallax Layer)
    // Removed blue vertical bar pillars as requested

    // Ground line - Removed blue line as requested
}

function checkCollision(p, obj) {
    return p.x < obj.x + obj.width &&
        p.x + p.width > obj.x &&
        p.y < obj.y + obj.height &&
        p.y + p.height > obj.y;
}

function updateUI() {
    scoreVal.innerText = score;
    const recordValEl = document.getElementById('record-val');
    if (recordValEl) recordValEl.innerText = highScore;
    ebbrezzaBar.style.width = ebbrezza + '%';

    // Combo UI (Simple for now)
    const comboEl = document.getElementById('combo-info');
    if (comboEl) {
        if (comboCount > 1) {
            comboEl.innerText = `COMBO X${comboCount}`;
            comboEl.classList.remove('hidden');
        } else {
            comboEl.classList.add('hidden');
        }
    }

    // Visual effects based on ebbrezza
    let blurAmount = (ebbrezza / 20).toFixed(1);
    let vignetteOpacity = Math.max(0, (ebbrezza - 30) / 100);
    if (isClarity) {
        blurAmount = 0;
        vignetteOpacity = 0;
    }

    document.body.style.setProperty('--blur-amount', blurAmount + 'px');
    document.body.style.setProperty('--vignette-opacity', vignetteOpacity);

    if (ebbrezza > 40 && !isClarity) {
        canvas.classList.add('drunken-blur');
        if (ebbrezza > 70) canvas.classList.add('chromatic-aberration');
        else canvas.classList.remove('chromatic-aberration');
    } else {
        canvas.classList.remove('drunken-blur');
        canvas.classList.remove('chromatic-aberration');
    }
}

function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    startBtn.addEventListener('click', () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        startGame();
    });
    restartBtn.addEventListener('click', () => {
        startGame();
    });

    // PC Controls
    window.addEventListener('keydown', (e) => {
        if ((e.code === 'Space' || e.code === 'ArrowUp') && gameState === 'PLAYING') {
            player.jump();
            playSound('jump');
        }
    });

    // Mobile Controls
    jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState === 'PLAYING') {
            player.jump();
            playSound('jump');
        }
    });
}

// Start
init();
renderAchievementsPreview();

function checkAchievements() {
    try {
        const stored = localStorage.getItem('cicioni_achievements');
        const achievements = stored ? JSON.parse(stored) : {};
        let newUnlock = false;

        ACHIEVEMENTS.forEach(ach => {
            if (achievements[ach.id]) return;

            let condition = false;
            if (!ach.type && score >= ach.goal) condition = true;
            if (ach.type === 'ebbrezza' && ebbrezza >= ach.goal) condition = true;
            if (ach.type === 'combo' && comboCount >= ach.goal) condition = true;

            if (condition) {
                achievements[ach.id] = true;
                newUnlock = true;
                speak(`Sbloccato: ${ach.name}`);

                // Show in Game Over if applicable
                const goAchContainer = document.getElementById('game-over-achievements');
                if (goAchContainer) {
                    const item = document.createElement('div');
                    item.className = 'achievement-item';
                    item.innerHTML = `<strong>${ach.icon} ${ach.name}</strong>: ${ach.desc}`;
                    goAchContainer.appendChild(item);
                }
            }
        });

        if (newUnlock) {
            localStorage.setItem('cicioni_achievements', JSON.stringify(achievements));
            renderAchievementsPreview();
        }
    } catch (e) {
        console.warn("Achievement processing failed:", e);
    }
}
