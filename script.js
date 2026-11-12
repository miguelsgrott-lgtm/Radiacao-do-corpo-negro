(() => {
    'use strict';

    const H = 6.62607015e-34, C = 2.99792458e8, K = 1.380649e-23, B_WIEN = 2.897771955e-3, SIGMA = 5.670374419e-8;
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    // ===== UTILITÁRIO ROBUSTO PARA CANVAS (RESOLVE TELA PRETA) =====
    function setupCanvas(canvasId, drawFn) {
        const canvas = $(canvasId);
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');

        function resize() {
            const rect = canvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
            drawFn();
        }

        const observer = new ResizeObserver(() => requestAnimationFrame(resize));
        observer.observe(canvas);
        
        if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', resize);
        else resize();

        return { canvas, ctx };
    }

    // ===== NAVEGAÇÃO =====
    const sections = $$('.section');
    const navLinks = $$('.nav-link');
    const progressBar = $('#progressBar');
    const currentSectionEl = $('#currentSection');
    let currentIdx = 0;

    function updateNav(idx) {
        currentIdx = idx;
        navLinks.forEach(l => l.classList.toggle('active', +l.dataset.section === idx));
        currentSectionEl.textContent = idx + 1;
        sections.forEach((s, i) => s.classList.toggle('in-view', i === idx));
    }

    function scrollToSection(idx) {
        if (idx < 0 || idx >= sections.length) return;
        sections[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    $('#prevBtn')?.addEventListener('click', () => scrollToSection(currentIdx - 1));
    $('#nextBtn')?.addEventListener('click', () => scrollToSection(currentIdx + 1));
    $('#startBtn')?.addEventListener('click', () => scrollToSection(1));
    navLinks.forEach(link => link.addEventListener('click', e => { e.preventDefault(); scrollToSection(+link.dataset.section); }));

    const sectionObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.3) updateNav(+entry.target.dataset.index);
        });
    }, { threshold: [0.3, 0.6] });
    sections.forEach(s => sectionObserver.observe(s));

    window.addEventListener('scroll', () => {
        const h = document.documentElement;
        if (progressBar) progressBar.style.width = ((h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100) + '%';
    }, { passive: true });

    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') scrollToSection(currentIdx + 1);
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') scrollToSection(currentIdx - 1);
    });

    // ===== CANVAS 1: INTRODUÇÃO =====
    let introParticles = [], ictx;
    function initIntro() {
        const setup = setupCanvas('introCanvas', drawIntro);
        if (!setup) return;
        ictx = setup.ctx;
        const w = setup.canvas.clientWidth, h = setup.canvas.clientHeight;
        introParticles = [];
        const n = Math.min(60, Math.floor(w * h / 15000));
        for (let i = 0; i < n; i++) {
            introParticles.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: Math.random() * 1.5 + 0.5, hue: 20 + Math.random() * 30 });
        }
        animateIntro();
    }
    function animateIntro() {
        if (!ictx) return;
        const canvas = ictx.canvas, w = canvas.clientWidth, h = canvas.clientHeight;
        ictx.clearRect(0, 0, w, h);
        const grad = ictx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h)/1.2);
        grad.addColorStop(0, 'rgba(255, 118, 38, 0.08)'); grad.addColorStop(1, 'rgba(8, 11, 18, 0)');
        ictx.fillStyle = grad; ictx.fillRect(0, 0, w, h);
        introParticles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1;
            ictx.beginPath(); ictx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ictx.fillStyle = `hsla(${p.hue}, 90%, 60%, 0.6)`; ictx.fill();
        });
        for (let i = 0; i < introParticles.length; i++) {
            for (let j = i + 1; j < introParticles.length; j++) {
                const a = introParticles[i], b = introParticles[j];
                const dx = a.x - b.x, dy = a.y - b.y, d = Math.sqrt(dx*dx + dy*dy);
                if (d < 100) {
                    ictx.beginPath(); ictx.moveTo(a.x, a.y); ictx.lineTo(b.x, b.y);
                    ictx.strokeStyle = `rgba(255, 209, 102, ${(1 - d/100) * 0.15})`; ictx.lineWidth = 0.5; ictx.stroke();
                }
            }
        }
        requestAnimationFrame(animateIntro);
    }

    // ===== CANVAS 2: CORPO NEGRO =====
    let bbTime = 0;
    function drawBlackbody() {
        const setup = setupCanvas('blackbodyCanvas', drawBlackbody);
        if (!setup) return;
        const ctx = setup.ctx, w = setup.canvas.clientWidth, h = setup.canvas.clientHeight;
        const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.18;
        ctx.clearRect(0, 0, w, h);
        const bodyGrad = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, 0, cx, cy, r);
        bodyGrad.addColorStop(0, '#2a2a35'); bodyGrad.addColorStop(1, '#000');
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = bodyGrad; ctx.fill();
        ctx.strokeStyle = 'rgba(49, 140, 231, 0.4)'; ctx.lineWidth = 1; ctx.stroke();

        const nWaves = 5;
        for (let i = 0; i < nWaves; i++) {
            const y = h * (0.25 + (i / (nWaves - 1)) * 0.5), phase = (bbTime * 0.02 + i * 0.5) % 1;
            const startX = -20, endX = cx - r - 5;
            ctx.beginPath(); ctx.strokeStyle = `rgba(49, 140, 231, ${0.6 - phase * 0.3})`; ctx.lineWidth = 1.5;
            for (let x = startX; x < endX; x += 2) {
                const yy = y + Math.sin((x * 0.08) - bbTime * 0.05 + i) * 6;
                x === startX ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
            }
            ctx.stroke();
        }
        ctx.fillStyle = 'rgba(49, 140, 231, 0.9)'; ctx.font = '11px "Space Grotesk", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Radiação incidente', w * 0.2, 30);
        ctx.fillStyle = 'rgba(255, 118, 38, 0.9)'; ctx.fillText('Absorção total', cx, cy + r + 25);

        const nEmit = 8;
        for (let i = 0; i < nEmit; i++) {
            const angle = (i / nEmit) * Math.PI * 2, phase = (bbTime * 0.03 + i * 0.3) % 1;
            const startR = r + 5, endR = r + 30 + phase * 50;
            ctx.beginPath(); ctx.strokeStyle = `rgba(255, 209, 102, ${0.7 * (1 - phase)})`; ctx.lineWidth = 1.5;
            for (let rr = startR; rr < endR; rr += 2) {
                const wave = Math.sin(rr * 0.3 - bbTime * 0.08) * 3;
                const px = cx + Math.cos(angle) * (rr + wave * Math.sin(angle)), py = cy + Math.sin(angle) * (rr + wave * Math.cos(angle));
                rr === startR ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255, 209, 102, 0.9)'; ctx.fillText('Emissão térmica', w * 0.8, 30);
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        glow.addColorStop(0, `rgba(255, 118, 38, ${0.15 + Math.sin(bbTime * 0.05) * 0.05})`); glow.addColorStop(1, 'rgba(255, 118, 38, 0)');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        bbTime++;
    }

    // ===== CANVAS 3: PLANCK =====
    const planckCanvas = $('#planckCanvas');
    const pctx = planckCanvas?.getContext('2d');
    const tempSlider = $('#tempSlider');

    function planck(lambda, T) {
        const c1 = 2 * H * C * C, c2 = H * C / (lambda * K * T);
        if (c2 > 700) return 0;
        return c1 / (Math.pow(lambda, 5) * (Math.exp(c2) - 1));
    }
    function blackbodyColor(T) {
        if (T < 1000) return [80, 10, 0];
        if (T < 2000) { const t = (T - 1000) / 1000; return [80 + t * 175, 10 + t * 60, 0]; }
        if (T < 3500) { const t = (T - 2000) / 1500; return [255, 70 + t * 100, t * 30]; }
        if (T < 5000) { const t = (T - 3500) / 1500; return [255, 170 + t * 50, 30 + t * 80]; }
        if (T < 7000) { const t = (T - 5000) / 2000; return [255, 220 + t * 35, 110 + t * 100]; }
        return [235, 255, 255];
    }
    function colorNameFromT(T) {
        if (T < 1000) return 'infravermelho'; if (T < 2000) return 'vermelho incandescente';
        if (T < 3500) return 'laranja'; if (T < 5000) return 'amarelo';
        if (T < 6000) return 'amarelo-branco'; if (T < 7500) return 'branco';
        return 'branco-azulado';
    }
    function formatScientific(n) {
        if (n === 0) return '0';
        const exp = Math.floor(Math.log10(Math.abs(n))), mant = n / Math.pow(10, exp);
        if (exp >= 0 && exp < 4) return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
        const sup = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-' :'⁻' };
        return `${mant.toFixed(2)} × 10${String(exp).split('').map(c => sup[c] || c).join('')}`;
    }

    function drawPlanck() {
        if (!planckCanvas || !pctx) return;
        const T = +tempSlider.value;
        const rect = planckCanvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const dpr = window.devicePixelRatio || 1;
        planckCanvas.width = rect.width * dpr; planckCanvas.height = rect.height * dpr;
        pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.scale(dpr, dpr);
        const w = rect.width, h = rect.height;
        pctx.clearRect(0, 0, w, h);

        const ml = 50, mr = 15, mt = 20, mb = 45, pw = w - ml - mr, ph = h - mt - mb;
        const lambdaMin = 100e-9, lambdaMax = 5000e-9;
        const nSamples = 300, lambdas = [], values = [];
        let maxVal = 0;
        for (let i = 0; i < nSamples; i++) {
            const logL = Math.log10(lambdaMin) + (i / (nSamples - 1)) * (Math.log10(lambdaMax) - Math.log10(lambdaMin));
            const lambda = Math.pow(10, logL), val = planck(lambda, T);
            lambdas.push(lambda); values.push(val);
            if (val > maxVal) maxVal = val;
        }
        const sqrtMax = Math.sqrt(maxVal) || 1;
        const xMap = (lambda) => ml + ((Math.log10(lambda) - Math.log10(lambdaMin)) / (Math.log10(lambdaMax) - Math.log10(lambdaMin))) * pw;
        const yMap = (val) => mt + ph - (Math.sqrt(val) / sqrtMax) * ph;

        pctx.fillStyle = 'rgba(8, 11, 18, 0.4)'; pctx.fillRect(ml, mt, pw, ph);
        const regions = [
            { name: 'UV', min: 100e-9, max: 400e-9, color: 'rgba(155, 89, 182, 0.12)' },
            { name: 'VIS', min: 400e-9, max: 700e-9, color: 'rgba(255, 209, 102, 0.12)' },
            { name: 'IV', min: 700e-9, max: 5000e-9, color: 'rgba(192, 57, 43, 0.12)' }
        ];
        regions.forEach(reg => {
            const x1 = Math.max(ml, xMap(reg.min)), x2 = Math.min(ml + pw, xMap(reg.max));
            if (x2 > x1) { pctx.fillStyle = reg.color; pctx.fillRect(x1, mt, x2 - x1, ph); }
        });

        pctx.strokeStyle = 'rgba(244, 245, 247, 0.1)'; pctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) { pctx.beginPath(); pctx.moveTo(ml, mt + (ph * i / 5)); pctx.lineTo(ml + pw, mt + (ph * i / 5)); pctx.stroke(); }
        pctx.strokeStyle = 'rgba(244, 245, 247, 0.3)';
        pctx.beginPath(); pctx.moveTo(ml, mt); pctx.lineTo(ml, mt + ph); pctx.lineTo(ml + pw, mt + ph); pctx.stroke();

        pctx.fillStyle = 'rgba(244, 245, 247, 0.6)'; pctx.font = '10px "Space Grotesk", sans-serif'; pctx.textAlign = 'center';
        [100, 500, 1000, 2000, 5000].forEach(nm => {
            const x = xMap(nm * 1e-9);
            if (x >= ml && x <= ml + pw) { pctx.beginPath(); pctx.moveTo(x, mt + ph); pctx.lineTo(x, mt + ph + 4); pctx.stroke(); pctx.fillText(nm, x, mt + ph + 16); }
        });
        pctx.fillText('λ (nm)', ml + pw / 2, mt + ph + 34);
        pctx.textAlign = 'right'; pctx.fillText('Intensidade', ml - 8, mt + ph / 2);
        pctx.textAlign = 'center'; pctx.font = 'bold 9px "Space Grotesk", sans-serif';
        regions.forEach(reg => {
            const xMid = xMap(Math.sqrt(reg.min * reg.max));
            if (xMid > ml + 15 && xMid < ml + pw - 15) {
                pctx.fillStyle = reg.name === 'UV' ? '#9b59b6' : reg.name === 'VIS' ? '#FFD166' : '#c0392b';
                pctx.fillText(reg.name, xMid, mt + 12);
            }
        });

        pctx.beginPath(); pctx.moveTo(xMap(lambdas[0]), mt + ph);
        for (let i = 0; i < nSamples; i++) pctx.lineTo(xMap(lambdas[i]), yMap(values[i]));
        pctx.lineTo(xMap(lambdas[nSamples - 1]), mt + ph); pctx.closePath();
        const fillGrad = pctx.createLinearGradient(ml, 0, ml + pw, 0);
        fillGrad.addColorStop(0, 'rgba(155, 89, 182, 0.3)'); fillGrad.addColorStop(0.3, 'rgba(255, 209, 102, 0.5)');
        fillGrad.addColorStop(0.6, 'rgba(255, 118, 38, 0.4)'); fillGrad.addColorStop(1, 'rgba(192, 57, 43, 0.3)');
        pctx.fillStyle = fillGrad; pctx.fill();

        pctx.beginPath();
        for (let i = 0; i < nSamples; i++) { const x = xMap(lambdas[i]), y = yMap(values[i]); i === 0 ? pctx.moveTo(x, y) : pctx.lineTo(x, y); }
        pctx.strokeStyle = '#FFD166'; pctx.lineWidth = 2; pctx.shadowBlur = 8; pctx.shadowColor = '#FFD166'; pctx.stroke(); pctx.shadowBlur = 0;

        const lambdaPeak = B_WIEN / T, peakVal = planck(lambdaPeak, T);
        const xPeak = xMap(lambdaPeak), yPeak = yMap(peakVal);
        pctx.setLineDash([4, 4]); pctx.strokeStyle = 'rgba(244, 245, 247, 0.7)'; pctx.lineWidth = 1;
        pctx.beginPath(); pctx.moveTo(xPeak, mt); pctx.lineTo(xPeak, mt + ph); pctx.stroke(); pctx.setLineDash([]);
        pctx.beginPath(); pctx.arc(xPeak, yPeak, 4, 0, Math.PI * 2); pctx.fillStyle = '#fff'; pctx.shadowBlur = 10; pctx.shadowColor = '#fff'; pctx.fill(); pctx.shadowBlur = 0;
        pctx.fillStyle = '#fff'; pctx.font = 'bold 10px "Space Grotesk", sans-serif';
        pctx.fillText(`λmáx ≈ ${(lambdaPeak * 1e9).toFixed(0)} nm`, xPeak, Math.max(mt + 25, yPeak - 12));

        const tempValueEl = $('#tempValue'), wienValueEl = $('#wienValue'), stefanValueEl = $('#stefanValue');
        const colorSwatchDot = $('#colorSwatchDot'), colorNameEl = $('#colorName'), dynamicExplanation = $('#dynamicExplanation');
        if (tempValueEl) tempValueEl.textContent = `${T} K`;
        if (wienValueEl) wienValueEl.textContent = `${(lambdaPeak * 1e9).toFixed(0)} nm`;
        if (stefanValueEl) stefanValueEl.textContent = `${formatScientific(SIGMA * Math.pow(T, 4))} W/m²`;
        if (colorSwatchDot) { const [cr, cg, cb] = blackbodyColor(T); colorSwatchDot.style.background = `rgb(${cr},${cg},${cb})`; colorSwatchDot.style.boxShadow = `0 0 12px rgb(${cr},${cg},${cb})`; }
        if (colorNameEl) colorNameEl.textContent = colorNameFromT(T);
        if (dynamicExplanation) {
            let text = '';
            if (T < 1500) text = `A ${T} K, a emissão está concentrada no <strong>infravermelho</strong>. O objeto emite pouca luz visível (brilho vermelho-escuro).`;
            else if (T < 3000) text = `A ${T} K, o pico (${(lambdaPeak * 1e9).toFixed(0)} nm) está próximo do infravermelho, mas uma fração atinge o <strong>visível (vermelho/laranja)</strong>. Típico de brasas ou lâmpadas incandescentes.`;
            else if (T < 5000) text = `A ${T} K, o pico (${(lambdaPeak * 1e9).toFixed(0)} nm) desloca-se para o <strong>amarelo</strong>. A intensidade é muito maior (Lei de Stefan-Boltzmann).`;
            else if (T < 7000) text = `A ${T} K, o pico (${(lambdaPeak * 1e9).toFixed(0)} nm) está no <strong>verde-amarelo</strong>, próximo ao do Sol (5.780 K, ~501 nm). O objeto parece branco aos nossos olhos.`;
            else text = `A ${T} K, o pico (${(lambdaPeak * 1e9).toFixed(0)} nm) entra na região <strong>azul/ultravioleta</strong>. A intensidade total é enorme. Estrelas quentes como Sirius (~9.900 K) têm espectros assim.`;
            dynamicExplanation.innerHTML = text;
        }
    }
    if (tempSlider) tempSlider.addEventListener('input', drawPlanck);

    // ===== CANVAS 4: FOTOVOLTAICO =====
    let pvPhotons = [], pvElectrons = [], pvTime = 0;
    function drawPV() {
        const setup = setupCanvas('pvCanvas', drawPV);
        if (!setup) return;
        const ctx = setup.ctx, w = setup.canvas.clientWidth, h = setup.canvas.clientHeight;
        ctx.clearRect(0, 0, w, h);
        const sunX = w * 0.15, sunY = h * 0.3, sunR = Math.min(w, h) * 0.08;
        const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 2);
        sunGrad.addColorStop(0, '#FFD166'); sunGrad.addColorStop(1, 'rgba(255, 118, 38, 0)');
        ctx.fillStyle = sunGrad; ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fillStyle = '#FFD166'; ctx.fill();

        const cellX = w * 0.4, cellY = h * 0.4, cellW = w * 0.45, cellH = h * 0.4;
        ctx.fillStyle = '#1a4d8f'; ctx.fillRect(cellX, cellY, cellW, cellH / 2);
        ctx.fillStyle = '#8f1a1a'; ctx.fillRect(cellX, cellY + cellH / 2, cellW, cellH / 2);
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.6)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(cellX, cellY + cellH / 2); ctx.lineTo(cellX + cellW, cellY + cellH / 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(244, 245, 247, 0.9)'; ctx.font = 'bold 10px "Space Grotesk", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Camada N', cellX + cellW / 2, cellY + cellH / 4);
        ctx.fillText('Camada P', cellX + cellW / 2, cellY + 3 * cellH / 4);

        if (Math.random() < 0.1) pvPhotons.push({ x: sunX + sunR, y: sunY + Math.random() * 20, vx: 2.5, vy: 1.5, life: 1 });
        pvPhotons.forEach((p, i) => {
            p.x += p.vx; p.y += p.vy;
            if (p.x > cellX && p.x < cellX + cellW && p.y > cellY && p.y < cellY + cellH / 2) {
                pvElectrons.push({ x: p.x, y: p.y, vx: 0, vy: -2, life: 1 }); pvPhotons.splice(i, 1); return;
            }
            ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 209, 102, ${p.life})`; ctx.fill();
        });
        pvElectrons.forEach((e, i) => {
            e.x += e.vx; e.y += e.vy; e.life -= 0.02;
            if (e.y < cellY - 20 || e.life <= 0) { pvElectrons.splice(i, 1); return; }
            ctx.beginPath(); ctx.arc(e.x, e.y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(49, 140, 231, ${e.life})`; ctx.shadowBlur = 6; ctx.shadowColor = '#318CE7'; ctx.fill(); ctx.shadowBlur = 0;
        });
        ctx.strokeStyle = 'rgba(244, 245, 247, 0.4)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cellX, cellY); ctx.lineTo(cellX - 15, cellY); ctx.lineTo(cellX - 15, cellY + cellH); ctx.lineTo(cellX, cellY + cellH); ctx.stroke();
        ctx.beginPath(); ctx.arc(cellX - 15, cellY + cellH / 2, 7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 209, 102, ${0.5 + Math.sin(pvTime * 0.1) * 0.3})`; ctx.shadowBlur = 10; ctx.shadowColor = '#FFD166'; ctx.fill(); ctx.shadowBlur = 0;
        pvTime++;
    }

    // ===== CANVAS 5: TÉRMICO =====
    let tDrops = [], tRays = [], tTime = 0;
    function drawThermal() {
        const setup = setupCanvas('thermalCanvas', drawThermal);
        if (!setup) return;
        const ctx = setup.ctx, w = setup.canvas.clientWidth, h = setup.canvas.clientHeight;
        ctx.clearRect(0, 0, w, h);
        const sunX = w * 0.15, sunY = h * 0.25, sunR = Math.min(w, h) * 0.07;
        const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 2);
        sunGrad.addColorStop(0, '#FFD166'); sunGrad.addColorStop(1, 'rgba(255, 118, 38, 0)');
        ctx.fillStyle = sunGrad; ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fillStyle = '#FFD166'; ctx.fill();

        const colX = w * 0.35, colY = h * 0.55, colW = w * 0.5, colH = h * 0.15;
        ctx.fillStyle = '#2a2a35'; ctx.fillRect(colX - 5, colY - 5, colW + 10, colH + 10);
        const heat = 0.5 + Math.sin(tTime * 0.05) * 0.1;
        const colGrad = ctx.createLinearGradient(colX, colY, colX, colY + colH);
        colGrad.addColorStop(0, `rgba(192, 57, 43, ${heat})`); colGrad.addColorStop(1, `rgba(192, 57, 43, ${heat})`);
        ctx.fillStyle = colGrad; ctx.fillRect(colX, colY, colW, colH);
        ctx.strokeStyle = 'rgba(49, 140, 231, 0.5)'; ctx.lineWidth = 3;
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(colX + 10, colY + (colH * i / 4)); ctx.lineTo(colX + colW - 10, colY + (colH * i / 4)); ctx.stroke(); }

        const tankX = colX + colW + 10, tankY = colY - 25, tankW = 25, tankH = colH + 50;
        ctx.fillStyle = '#3a3a45'; ctx.fillRect(tankX, tankY, tankW, tankH);
        ctx.strokeStyle = 'rgba(244, 245, 247, 0.3)'; ctx.lineWidth = 1; ctx.strokeRect(tankX, tankY, tankW, tankH);
        const waterLevel = tankH * 0.7;
        ctx.fillStyle = '#e74c3c'; ctx.fillRect(tankX + 2, tankY + tankH - waterLevel, tankW - 4, waterLevel);
        ctx.fillStyle = 'rgba(244, 245, 247, 0.7)'; ctx.font = '9px "Space Grotesk", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Água', tankX + tankW / 2, tankY - 8);

        if (Math.random() < 0.2) tRays.push({ x: sunX + sunR, y: sunY + Math.random() * sunR, tx: colX + Math.random() * colW, ty: colY, progress: 0 });
        tRays.forEach((r, i) => {
            r.progress += 0.04;
            ctx.strokeStyle = `rgba(255, 209, 102, ${1 - r.progress})`; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + (r.tx - r.x) * r.progress, r.y + (r.ty - r.y) * r.progress); ctx.stroke();
            if (r.progress >= 1) tRays.splice(i, 1);
        });
        if (Math.random() < 0.15) tDrops.push({ x: colX + Math.random() * colW, y: colY, vy: -0.6, life: 1 });
        tDrops.forEach((d, i) => {
            d.y += d.vy; d.life -= 0.02;
            if (d.life <= 0) { tDrops.splice(i, 1); return; }
            ctx.beginPath(); ctx.arc(d.x, d.y, 2, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 118, 38, ${d.life * 0.6})`; ctx.fill();
        });
        tTime++;
    }

    // ===== INICIALIZAÇÃO =====
    function init() {
        initIntro(); drawBlackbody(); drawPlanck(); drawPV(); drawThermal();
        updateNav(0); sections[0]?.classList.add('active');
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();