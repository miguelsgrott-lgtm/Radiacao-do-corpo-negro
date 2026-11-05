/* ============================================================
   RADIAÇÃO DO CORPO NEGRO — LÓGICA E SIMULAÇÕES
   Grupo 2 · Física Moderna
   ============================================================ */

(() => {
    'use strict';

    // ===== Constantes físicas =====
    const H  = 6.62607015e-34;  // Constante de Planck (J·s)
    const C  = 2.99792458e8;    // Velocidade da luz (m/s)
    const K  = 1.380649e-23;    // Constante de Boltzmann (J/K)
    const B_WIEN = 2.897771955e-3; // Constante de Wien (m·K)
    const SIGMA  = 5.670374419e-8; // Stefan-Boltzmann (W·m⁻²·K⁻⁴)

    // ===== Utilitários =====
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    // ===== NAVEGAÇÃO =====
    const sections = $$('.section');
    const navLinks = $$('.nav-link');
    const progressBar = $('#progressBar');
    const currentSectionEl = $('#currentSection');
    const prevBtn = $('#prevBtn');
    const nextBtn = $('#nextBtn');
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

    prevBtn.addEventListener('click', () => scrollToSection(currentIdx - 1));
    nextBtn.addEventListener('click', () => scrollToSection(currentIdx + 1));
    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            scrollToSection(+link.dataset.section);
        });
    });

    $('#startBtn').addEventListener('click', () => scrollToSection(1));

    // Observer para detectar seção ativa
    const sectionObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
                const idx = +entry.target.dataset.index;
                updateNav(idx);
            }
        });
    }, { threshold: [0.4, 0.6] });
    sections.forEach(s => sectionObserver.observe(s));

    // Barra de progresso
    window.addEventListener('scroll', () => {
        const h = document.documentElement;
        const scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight);
        progressBar.style.width = (scrolled * 100) + '%';
    }, { passive: true });

    // Atalhos de teclado
    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') scrollToSection(currentIdx + 1);
        if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   scrollToSection(currentIdx - 1);
    });

    // ============================================================
    // CANVAS 1 — FUNDO DA INTRODUÇÃO (partículas térmicas)
    // ============================================================
    const introCanvas = $('#introCanvas');
    const ictx = introCanvas.getContext('2d');
    let introParticles = [];

    function resizeIntro() {
        const dpr = window.devicePixelRatio || 1;
        introCanvas.width  = introCanvas.clientWidth * dpr;
        introCanvas.height = introCanvas.clientHeight * dpr;
        ictx.scale(dpr, dpr);
    }

    function initIntroParticles() {
        introParticles = [];
        const w = introCanvas.clientWidth;
        const h = introCanvas.clientHeight;
        const n = Math.min(80, Math.floor(w * h / 15000));
        for (let i = 0; i < n; i++) {
            introParticles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                r: Math.random() * 1.5 + 0.5,
                hue: 20 + Math.random() * 30
            });
        }
    }

    function drawIntro() {
        const w = introCanvas.clientWidth;
        const h = introCanvas.clientHeight;
        ictx.clearRect(0, 0, w, h);

        // Gradiente de fundo
        const grad = ictx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h)/1.2);
        grad.addColorStop(0, 'rgba(255, 118, 38, 0.08)');
        grad.addColorStop(0.5, 'rgba(49, 140, 231, 0.04)');
        grad.addColorStop(1, 'rgba(8, 11, 18, 0)');
        ictx.fillStyle = grad;
        ictx.fillRect(0, 0, w, h);

        // Partículas
        introParticles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > w) p.vx *= -1;
            if (p.y < 0 || p.y > h) p.vy *= -1;

            ictx.beginPath();
            ictx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ictx.fillStyle = `hsla(${p.hue}, 90%, 60%, 0.6)`;
            ictx.shadowBlur = 8;
            ictx.shadowColor = `hsl(${p.hue}, 90%, 60%)`;
            ictx.fill();
            ictx.shadowBlur = 0;
        });

        // Conexões
        for (let i = 0; i < introParticles.length; i++) {
            for (let j = i + 1; j < introParticles.length; j++) {
                const a = introParticles[i];
                const b = introParticles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const d = Math.sqrt(dx*dx + dy*dy);
                if (d < 120) {
                    ictx.beginPath();
                    ictx.moveTo(a.x, a.y);
                    ictx.lineTo(b.x, b.y);
                    ictx.strokeStyle = `rgba(255, 209, 102, ${(1 - d/120) * 0.15})`;
                    ictx.lineWidth = 0.5;
                    ictx.stroke();
                }
            }
        }

        requestAnimationFrame(drawIntro);
    }

    // ============================================================
    // CANVAS 2 — CORPO NEGRO (absorção e emissão)
    // ============================================================
    const bbCanvas = $('#blackbodyCanvas');
    const bctx = bbCanvas.getContext('2d');
    let bbWaves = [];
    let bbEmitted = [];
    let bbTime = 0;

    function resizeBB() {
        const dpr = window.devicePixelRatio || 1;
        bbCanvas.width  = bbCanvas.clientWidth * dpr;
        bbCanvas.height = bbCanvas.clientHeight * dpr;
        bctx.scale(dpr, dpr);
    }

    function drawBlackbody() {
        const w = bbCanvas.clientWidth;
        const h = bbCanvas.clientHeight;
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) * 0.18;

        bctx.clearRect(0, 0, w, h);

        // Fundo sutil
        const bg = bctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h)/1.5);
        bg.addColorStop(0, 'rgba(16, 27, 45, 0.3)');
        bg.addColorStop(1, 'rgba(8, 11, 18, 0)');
        bctx.fillStyle = bg;
        bctx.fillRect(0, 0, w, h);

        // Corpo negro (esfera)
        const bodyGrad = bctx.createRadialGradient(cx - r*0.3, cy - r*0.3, 0, cx, cy, r);
        bodyGrad.addColorStop(0, '#2a2a35');
        bodyGrad.addColorStop(0.7, '#0a0a12');
        bodyGrad.addColorStop(1, '#000');
        bctx.beginPath();
        bctx.arc(cx, cy, r, 0, Math.PI * 2);
        bctx.fillStyle = bodyGrad;
        bctx.fill();
        bctx.strokeStyle = 'rgba(49, 140, 231, 0.4)';
        bctx.lineWidth = 1;
        bctx.stroke();

        // Ondas incidentes (da esquerda)
        const nWaves = 6;
        for (let i = 0; i < nWaves; i++) {
            const y = h * (0.2 + (i / (nWaves - 1)) * 0.6);
            const phase = (bbTime * 0.02 + i * 0.5) % 1;
            const startX = -20;
            const endX = cx - r - 5;

            // Desenhar onda senoidal
            bctx.beginPath();
            bctx.strokeStyle = `rgba(49, 140, 231, ${0.6 - phase * 0.3})`;
            bctx.lineWidth = 1.5;
            for (let x = startX; x < endX; x += 2) {
                const t = (x - startX) / (endX - startX);
                const yy = y + Math.sin((x * 0.08) - bbTime * 0.05 + i) * 6;
                if (x === startX) bctx.moveTo(x, yy);
                else bctx.lineTo(x, yy);
            }
            bctx.stroke();

            // Seta indicando direção
            const arrowX = endX - 20 - (phase * 40);
            if (arrowX > startX + 20) {
                bctx.beginPath();
                bctx.moveTo(arrowX, y);
                bctx.lineTo(arrowX - 8, y - 4);
                bctx.lineTo(arrowX - 8, y + 4);
                bctx.closePath();
                bctx.fillStyle = 'rgba(49, 140, 231, 0.8)';
                bctx.fill();
            }
        }

        // Label "Radiação incidente"
        bctx.fillStyle = 'rgba(49, 140, 231, 0.9)';
        bctx.font = '11px "Space Grotesk", sans-serif';
        bctx.textAlign = 'center';
        bctx.fillText('Radiação incidente', w * 0.2, 30);

        // Label "Absorção total"
        bctx.fillStyle = 'rgba(255, 118, 38, 0.9)';
        bctx.fillText('Absorção total', cx, cy + r + 25);

        // Ondas emitidas (em todas as direções)
        const nEmit = 10;
        for (let i = 0; i < nEmit; i++) {
            const angle = (i / nEmit) * Math.PI * 2;
            const phase = (bbTime * 0.03 + i * 0.3) % 1;
            const startR = r + 5;
            const endR = r + 40 + phase * 60;

            bctx.beginPath();
            bctx.strokeStyle = `rgba(255, 209, 102, ${0.7 * (1 - phase)})`;
            bctx.lineWidth = 1.5;

            for (let rr = startR; rr < endR; rr += 2) {
                const wave = Math.sin(rr * 0.3 - bbTime * 0.08) * 3;
                const px = cx + Math.cos(angle) * (rr + wave * Math.sin(angle));
                const py = cy + Math.sin(angle) * (rr + wave * Math.cos(angle));
                if (rr === startR) bctx.moveTo(px, py);
                else bctx.lineTo(px, py);
            }
            bctx.stroke();
        }

        // Label "Emissão térmica"
        bctx.fillStyle = 'rgba(255, 209, 102, 0.9)';
        bctx.fillText('Emissão térmica', w * 0.8, 30);

        // Brilho interno pulsante
        const glow = bctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        const pulse = 0.15 + Math.sin(bbTime * 0.05) * 0.05;
        glow.addColorStop(0, `rgba(255, 118, 38, ${pulse})`);
        glow.addColorStop(1, 'rgba(255, 118, 38, 0)');
        bctx.fillStyle = glow;
        bctx.beginPath();
        bctx.arc(cx, cy, r, 0, Math.PI * 2);
        bctx.fill();

        bbTime++;
        requestAnimationFrame(drawBlackbody);
    }

    // ============================================================
    // CANVAS 3 — ESPECTRO DE PLANCK (simulação interativa)
    // ============================================================
    const planckCanvas = $('#planckCanvas');
    const pctx = planckCanvas.getContext('2d');

    const tempSlider = $('#tempSlider');
    const tempValueEl = $('#tempValue');
    const wienValueEl = $('#wienValue');
    const stefanValueEl = $('#stefanValue');
    const colorSwatchDot = $('#colorSwatchDot');
    const colorNameEl = $('#colorName');
    const dynamicExplanation = $('#dynamicExplanation');

    // Lei de Planck: B(λ,T) em W·sr⁻¹·m⁻³
    function planck(lambda, T) {
        const c1 = 2 * H * C * C;
        const c2 = H * C / (lambda * K * T);
        // Evitar overflow
        if (c2 > 700) return 0;
        return c1 / (Math.pow(lambda, 5) * (Math.exp(c2) - 1));
    }

    // Converte comprimento de onda (nm) em cor RGB aproximada
    function wavelengthToRGB(nm) {
        let r = 0, g = 0, b = 0;
        if (nm >= 380 && nm < 440) {
            r = -(nm - 440) / (440 - 380);
            g = 0;
            b = 1;
        } else if (nm >= 440 && nm < 490) {
            r = 0;
            g = (nm - 440) / (490 - 440);
            b = 1;
        } else if (nm >= 490 && nm < 510) {
            r = 0;
            g = 1;
            b = -(nm - 510) / (510 - 490);
        } else if (nm >= 510 && nm < 580) {
            r = (nm - 510) / (580 - 510);
            g = 1;
            b = 0;
        } else if (nm >= 580 && nm < 645) {
            r = 1;
            g = -(nm - 645) / (645 - 580);
            b = 0;
        } else if (nm >= 645 && nm <= 780) {
            r = 1;
            g = 0;
            b = 0;
        } else if (nm < 380) {
            // UV — violeta escuro
            r = 0.4; g = 0; b = 0.6;
        } else {
            // IV — vermelho escuro
            r = 0.4; g = 0; b = 0;
        }

        // Atenuação nas bordas do visível
        let factor = 1;
        if (nm >= 380 && nm < 420) factor = 0.3 + 0.7 * (nm - 380) / (420 - 380);
        else if (nm >= 645 && nm <= 780) factor = 0.3 + 0.7 * (780 - nm) / (780 - 645);
        else if (nm < 380 || nm > 780) factor = 0.3;

        return [
            Math.round(255 * Math.pow(r * factor, 0.8)),
            Math.round(255 * Math.pow(g * factor, 0.8)),
            Math.round(255 * Math.pow(b * factor, 0.8))
        ];
    }

    // Cor aparente de um corpo negro (simplificação por temperatura)
    function blackbodyColor(T) {
        // Aproximação baseada na temperatura
        if (T < 1000) return [80, 10, 0];
        if (T < 2000) {
            const t = (T - 1000) / 1000;
            return [80 + t * 175, 10 + t * 60, 0];
        }
        if (T < 3500) {
            const t = (T - 2000) / 1500;
            return [255, 70 + t * 100, t * 30];
        }
        if (T < 5000) {
            const t = (T - 3500) / 1500;
            return [255, 170 + t * 50, 30 + t * 80];
        }
        if (T < 7000) {
            const t = (T - 5000) / 2000;
            return [255, 220 + t * 35, 110 + t * 100];
        }
        if (T < 10000) {
            const t = (T - 7000) / 3000;
            return [255 - t * 20, 255, 210 + t * 45];
        }
        return [235, 255, 255];
    }

    function colorNameFromT(T) {
        if (T < 1000) return 'infravermelho (invisível)';
        if (T < 2000) return 'vermelho incandescente';
        if (T < 3500) return 'laranja';
        if (T < 5000) return 'amarelo';
        if (T < 6000) return 'amarelo-branco';
        if (T < 7500) return 'branco';
        if (T < 10000) return 'branco-azulado';
        return 'azulado';
    }

    function formatScientific(n) {
        if (n === 0) return '0';
        const exp = Math.floor(Math.log10(Math.abs(n)));
        const mant = n / Math.pow(10, exp);
        if (exp >= 0 && exp < 4) return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
        return `${mant.toFixed(2)} × 10${superscript(exp)}`;
    }

    function superscript(n) {
        const sup = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻' };
        return String(n).split('').map(c => sup[c] || c).join('');
    }

    function drawPlanck() {
        const T = +tempSlider.value;
        const w = planckCanvas.clientWidth;
        const h = planckCanvas.clientHeight;
        const dpr = window.devicePixelRatio || 1;

        if (planckCanvas.width !== w * dpr) {
            planckCanvas.width = w * dpr;
            planckCanvas.height = h * dpr;
            pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        pctx.clearRect(0, 0, w, h);

        // Margens
        const ml = 60, mr = 20, mt = 20, mb = 50;
        const pw = w - ml - mr;
        const ph = h - mt - mb;

        // Faixa de comprimentos de onda: 100 nm a 5000 nm
        const lambdaMin = 100e-9;
        const lambdaMax = 5000e-9;

        // Calcular curva para achar o máximo
        const nSamples = 400;
        const lambdas = [];
        const values = [];
        let maxVal = 0;
        for (let i = 0; i < nSamples; i++) {
            // Escala logarítmica para melhor visualização
            const logL = Math.log10(lambdaMin) + (i / (nSamples - 1)) * (Math.log10(lambdaMax) - Math.log10(lambdaMin));
            const lambda = Math.pow(10, logL);
            const val = planck(lambda, T);
            lambdas.push(lambda);
            values.push(val);
            if (val > maxVal) maxVal = val;
        }

        // Escala Y: usar raiz quadrada para comprimir a curva (melhor visualização)
        const sqrtMax = Math.sqrt(maxVal);

        // Funções de mapeamento
        const xMap = (lambda) => {
            const logL = Math.log10(lambda);
            return ml + ((logL - Math.log10(lambdaMin)) / (Math.log10(lambdaMax) - Math.log10(lambdaMin))) * pw;
        };
        const yMap = (val) => {
            const sqrtVal = Math.sqrt(val);
            return mt + ph - (sqrtVal / sqrtMax) * ph;
        };

        // Fundo do gráfico
        pctx.fillStyle = 'rgba(8, 11, 18, 0.4)';
        pctx.fillRect(ml, mt, pw, ph);

        // Regiões do espectro (faixas verticais)
        const regions = [
            { name: 'UV',  min: 100e-9,  max: 400e-9,  color: 'rgba(155, 89, 182, 0.12)' },
            { name: 'VIS', min: 400e-9,  max: 700e-9,  color: 'rgba(255, 209, 102, 0.12)' },
            { name: 'IV',  min: 700e-9,  max: 5000e-9, color: 'rgba(192, 57, 43, 0.12)' }
        ];

        regions.forEach(reg => {
            const x1 = Math.max(ml, xMap(reg.min));
            const x2 = Math.min(ml + pw, xMap(reg.max));
            if (x2 > x1) {
                pctx.fillStyle = reg.color;
                pctx.fillRect(x1, mt, x2 - x1, ph);
            }
        });

        // Linhas de grade
        pctx.strokeStyle = 'rgba(244, 245, 247, 0.06)';
        pctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) {
            const y = mt + (ph * i / 5);
            pctx.beginPath();
            pctx.moveTo(ml, y);
            pctx.lineTo(ml + pw, y);
            pctx.stroke();
        }

        // Eixos
        pctx.strokeStyle = 'rgba(244, 245, 247, 0.3)';
        pctx.lineWidth = 1;
        pctx.beginPath();
        pctx.moveTo(ml, mt);
        pctx.lineTo(ml, mt + ph);
        pctx.lineTo(ml + pw, mt + ph);
        pctx.stroke();

        // Rótulos dos eixos
        pctx.fillStyle = 'rgba(244, 245, 247, 0.6)';
        pctx.font = '11px "Space Grotesk", sans-serif';
        pctx.textAlign = 'center';

        // Eixo X (comprimento de onda)
        const xTicks = [100, 300, 500, 700, 1000, 2000, 5000];
        xTicks.forEach(nm => {
            const x = xMap(nm * 1e-9);
            if (x >= ml && x <= ml + pw) {
                pctx.beginPath();
                pctx.moveTo(x, mt + ph);
                pctx.lineTo(x, mt + ph + 4);
                pctx.stroke();
                pctx.fillText(nm, x, mt + ph + 18);
            }
        });
        pctx.fillText('λ (nm)', ml + pw / 2, mt + ph + 38);

        // Eixo Y
        pctx.textAlign = 'right';
        pctx.fillText('Intensidade', ml - 8, mt + ph / 2);

        // Labels das regiões
        pctx.textAlign = 'center';
        pctx.font = 'bold 10px "Space Grotesk", sans-serif';
        regions.forEach(reg => {
            const xMid = xMap(Math.sqrt(reg.min * reg.max));
            if (xMid > ml + 20 && xMid < ml + pw - 20) {
                pctx.fillStyle = reg.name === 'UV' ? '#9b59b6' :
                                 reg.name === 'VIS' ? '#FFD166' : '#c0392b';
                pctx.fillText(reg.name, xMid, mt + 14);
            }
        });

        // Curva de Planck — preenchimento com gradiente de cor
        pctx.beginPath();
        pctx.moveTo(xMap(lambdas[0]), mt + ph);
        for (let i = 0; i < nSamples; i++) {
            pctx.lineTo(xMap(lambdas[i]), yMap(values[i]));
        }
        pctx.lineTo(xMap(lambdas[nSamples - 1]), mt + ph);
        pctx.closePath();

        const fillGrad = pctx.createLinearGradient(ml, 0, ml + pw, 0);
        fillGrad.addColorStop(0, 'rgba(155, 89, 182, 0.3)');
        fillGrad.addColorStop(0.15, 'rgba(49, 140, 231, 0.4)');
        fillGrad.addColorStop(0.3, 'rgba(255, 209, 102, 0.5)');
        fillGrad.addColorStop(0.5, 'rgba(255, 118, 38, 0.4)');
        fillGrad.addColorStop(1, 'rgba(192, 57, 43, 0.3)');
        pctx.fillStyle = fillGrad;
        pctx.fill();

        // Linha da curva
        pctx.beginPath();
        for (let i = 0; i < nSamples; i++) {
            const x = xMap(lambdas[i]);
            const y = yMap(values[i]);
            if (i === 0) pctx.moveTo(x, y);
            else pctx.lineTo(x, y);
        }
        pctx.strokeStyle = '#FFD166';
        pctx.lineWidth = 2;
        pctx.shadowBlur = 8;
        pctx.shadowColor = '#FFD166';
        pctx.stroke();
        pctx.shadowBlur = 0;

        // Pico de Wien
        const lambdaPeak = B_WIEN / T;
        const peakVal = planck(lambdaPeak, T);
        const xPeak = xMap(lambdaPeak);
        const yPeak = yMap(peakVal);

        // Linha vertical tracejada
        pctx.setLineDash([4, 4]);
        pctx.strokeStyle = 'rgba(244, 245, 247, 0.7)';
        pctx.lineWidth = 1;
        pctx.beginPath();
        pctx.moveTo(xPeak, mt);
        pctx.lineTo(xPeak, mt + ph);
        pctx.stroke();
        pctx.setLineDash([]);

        // Ponto do pico
        pctx.beginPath();
        pctx.arc(xPeak, yPeak, 5, 0, Math.PI * 2);
        pctx.fillStyle = '#fff';
        pctx.shadowBlur = 12;
        pctx.shadowColor = '#fff';
        pctx.fill();
        pctx.shadowBlur = 0;

        // Label do pico
        const peakNm = lambdaPeak * 1e9;
        pctx.fillStyle = '#fff';
        pctx.font = 'bold 11px "Space Grotesk", sans-serif';
        pctx.textAlign = 'center';
        const labelY = Math.max(mt + 30, yPeak - 15);
        pctx.fillText(`λmáx ≈ ${peakNm.toFixed(0)} nm`, xPeak, labelY);

        // Atualizar valores
        tempValueEl.textContent = `${T} K`;
        wienValueEl.textContent = `${peakNm.toFixed(0)} nm`;
        const power = SIGMA * Math.pow(T, 4);
        stefanValueEl.textContent = `${formatScientific(power)} W/m²`;

        const [cr, cg, cb] = blackbodyColor(T);
        colorSwatchDot.style.background = `rgb(${cr},${cg},${cb})`;
        colorSwatchDot.style.boxShadow = `0 0 12px rgb(${cr},${cg},${cb})`;
        colorNameEl.textContent = colorNameFromT(T);

        // Explicação dinâmica
        updateExplanation(T, peakNm);
    }

    function updateExplanation(T, peakNm) {
        let text = '';
        if (T < 1500) {
            text = `A ${T} K, a emissão está concentrada em comprimentos de onda longos, predominantemente no <strong>infravermelho</strong>. O objeto emite pouca luz visível — aparece como um brilho vermelho-escuro apenas se observado atentamente.`;
        } else if (T < 3000) {
            text = `A ${T} K, o pico de emissão (${peakNm.toFixed(0)} nm) ainda está próximo do infravermelho, mas uma fração significativa da radiação atinge a região <strong>vermelha/laranja</strong> do visível. É a cor típica de uma brasa ou de uma lâmpada incandescente.`;
        } else if (T < 5000) {
            text = `A ${T} K, o pico (${peakNm.toFixed(0)} nm) desloca-se para a região <strong>amarela</strong> do visível. O objeto emite com intensidade muito maior e sua cor aparente é amarela. A Lei de Stefan-Boltzmann mostra que a potência total emitida cresce rapidamente com a temperatura.`;
        } else if (T < 7000) {
            text = `A ${T} K, o pico (${peakNm.toFixed(0)} nm) está na região <strong>verde-amarela</strong> do visível — próximo ao do Sol (5.780 K, pico em ~501 nm). O objeto emite em todo o espectro visível com alta intensidade, aparecendo branco aos nossos olhos.`;
        } else if (T < 10000) {
            text = `A ${T} K, o pico (${peakNm.toFixed(0)} nm) desloca-se para comprimentos menores, entrando na região <strong>azul/ultravioleta</strong>. A intensidade total é muito alta e o objeto aparece branco-azulado. Estrelas quentes como Sirius (~9.900 K) têm espectros semelhantes.`;
        } else {
            text = `A ${T} K, o pico (${peakNm.toFixed(0)} nm) está na região do <strong>ultravioleta</strong>. A maior parte da energia é emitida em comprimentos de onda invisíveis ao olho humano, mas a intensidade total é enorme — a Lei de Stefan-Boltzmann (P/A = σT⁴) explica esse crescimento rápido.`;
        }
        dynamicExplanation.innerHTML = text;
    }

    tempSlider.addEventListener('input', drawPlanck);

    // ============================================================
    // CANVAS 4 — EFEITO FOTOVOLTAICO
    // ============================================================
    const pvCanvas = $('#pvCanvas');
    const pvctx = pvCanvas.getContext('2d');
    let pvPhotons = [];
    let pvElectrons = [];
    let pvTime = 0;

    function resizePV() {
        const dpr = window.devicePixelRatio || 1;
        pvCanvas.width  = pvCanvas.clientWidth * dpr;
        pvCanvas.height = pvCanvas.clientHeight * dpr;
        pvctx.scale(dpr, dpr);
    }

    function drawPV() {
        const w = pvCanvas.clientWidth;
        const h = pvCanvas.clientHeight;
        pvctx.clearRect(0, 0, w, h);

        // Sol (canto superior esquerdo)
        const sunX = w * 0.1;
        const sunY = h * 0.25;
        const sunR = Math.min(w, h) * 0.08;

        const sunGrad = pvctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 2);
        sunGrad.addColorStop(0, '#FFD166');
        sunGrad.addColorStop(0.5, '#FF7626');
        sunGrad.addColorStop(1, 'rgba(255, 118, 38, 0)');
        pvctx.fillStyle = sunGrad;
        pvctx.beginPath();
        pvctx.arc(sunX, sunY, sunR * 2, 0, Math.PI * 2);
        pvctx.fill();

        pvctx.beginPath();
        pvctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
        pvctx.fillStyle = '#FFD166';
        pvctx.fill();

        // Célula fotovoltaica (retângulo azul)
        const cellX = w * 0.45;
        const cellY = h * 0.35;
        const cellW = w * 0.4;
        const cellH = h * 0.45;

        // Camada N (topo, azul)
        pvctx.fillStyle = '#1a4d8f';
        pvctx.fillRect(cellX, cellY, cellW, cellH / 2);
        // Camada P (base, vermelho escuro)
        pvctx.fillStyle = '#8f1a1a';
        pvctx.fillRect(cellX, cellY + cellH / 2, cellW, cellH / 2);

        // Junção
        pvctx.strokeStyle = 'rgba(255, 209, 102, 0.6)';
        pvctx.lineWidth = 1;
        pvctx.setLineDash([3, 3]);
        pvctx.beginPath();
        pvctx.moveTo(cellX, cellY + cellH / 2);
        pvctx.lineTo(cellX + cellW, cellY + cellH / 2);
        pvctx.stroke();
        pvctx.setLineDash([]);

        // Labels das camadas
        pvctx.fillStyle = 'rgba(244, 245, 247, 0.9)';
        pvctx.font = 'bold 11px "Space Grotesk", sans-serif';
        pvctx.textAlign = 'center';
        pvctx.fillText('Camada N', cellX + cellW / 2, cellY + cellH / 4);
        pvctx.fillText('Camada P', cellX + cellW / 2, cellY + 3 * cellH / 4);

        // Campo elétrico (seta)
        pvctx.strokeStyle = 'rgba(255, 209, 102, 0.8)';
        pvctx.lineWidth = 1.5;
        const arrowY = cellY + cellH / 2;
        pvctx.beginPath();
        pvctx.moveTo(cellX + cellW / 2, arrowY - 8);
        pvctx.lineTo(cellX + cellW / 2, arrowY + 8);
        pvctx.moveTo(cellX + cellW / 2 - 4, arrowY + 4);
        pvctx.lineTo(cellX + cellW / 2, arrowY + 8);
        pvctx.lineTo(cellX + cellW / 2 + 4, arrowY + 4);
        pvctx.stroke();

        // Fótons (partículas amarelas caindo)
        if (Math.random() < 0.15) {
            pvPhotons.push({
                x: sunX + sunR + Math.random() * 30,
                y: sunY + Math.random() * 20,
                vx: 2 + Math.random() * 1.5,
                vy: 1 + Math.random() * 0.5,
                life: 1
            });
        }

        pvPhotons.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;

            // Checar colisão com célula
            if (p.x > cellX && p.x < cellX + cellW && p.y > cellY && p.y < cellY + cellH) {
                // Gerar elétron
                pvElectrons.push({
                    x: p.x,
                    y: p.y,
                    vx: 0,
                    vy: -1.5,
                    life: 1
                });
                pvPhotons.splice(i, 1);
                return;
            }

            pvctx.beginPath();
            pvctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            pvctx.fillStyle = `rgba(255, 209, 102, ${p.life})`;
            pvctx.shadowBlur = 6;
            pvctx.shadowColor = '#FFD166';
            pvctx.fill();
            pvctx.shadowBlur = 0;
        });

        // Elétrons (partículas azuis subindo)
        pvElectrons.forEach((e, i) => {
            e.x += e.vx;
            e.y += e.vy;
            e.life -= 0.01;

            if (e.y < cellY - 20 || e.life <= 0) {
                pvElectrons.splice(i, 1);
                return;
            }

            pvctx.beginPath();
            pvctx.arc(e.x, e.y, 2.5, 0, Math.PI * 2);
            pvctx.fillStyle = `rgba(49, 140, 231, ${e.life})`;
            pvctx.shadowBlur = 6;
            pvctx.shadowColor = '#318CE7';
            pvctx.fill();
            pvctx.shadowBlur = 0;
        });

        // Fios e corrente
        pvctx.strokeStyle = 'rgba(244, 245, 247, 0.4)';
        pvctx.lineWidth = 2;
        pvctx.beginPath();
        pvctx.moveTo(cellX, cellY);
        pvctx.lineTo(cellX - 20, cellY);
        pvctx.lineTo(cellX - 20, cellY + cellH);
        pvctx.lineTo(cellX, cellY + cellH);
        pvctx.stroke();

        // Lâmpada/ícone
        pvctx.beginPath();
        pvctx.arc(cellX - 20, cellY + cellH / 2, 8, 0, Math.PI * 2);
        const bulbBright = 0.5 + Math.sin(pvTime * 0.1) * 0.3;
        pvctx.fillStyle = `rgba(255, 209, 102, ${bulbBright})`;
        pvctx.shadowBlur = 10;
        pvctx.shadowColor = '#FFD166';
        pvctx.fill();
        pvctx.shadowBlur = 0;

        pvTime++;
        requestAnimationFrame(drawPV);
    }

    // ============================================================
    // CANVAS 5 — COLETOR SOLAR TÉRMICO
    // ============================================================
    const thermalCanvas = $('#thermalCanvas');
    const tctx = thermalCanvas.getContext('2d');
    let tDrops = [];
    let tRays = [];
    let tTime = 0;

    function resizeThermal() {
        const dpr = window.devicePixelRatio || 1;
        thermalCanvas.width  = thermalCanvas.clientWidth * dpr;
        thermalCanvas.height = thermalCanvas.clientHeight * dpr;
        tctx.scale(dpr, dpr);
    }

    function drawThermal() {
        const w = thermalCanvas.clientWidth;
        const h = thermalCanvas.clientHeight;
        tctx.clearRect(0, 0, w, h);

        // Sol
        const sunX = w * 0.15;
        const sunY = h * 0.2;
        const sunR = Math.min(w, h) * 0.07;

        const sunGrad = tctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 2);
        sunGrad.addColorStop(0, '#FFD166');
        sunGrad.addColorStop(0.5, '#FF7626');
        sunGrad.addColorStop(1, 'rgba(255, 118, 38, 0)');
        tctx.fillStyle = sunGrad;
        tctx.beginPath();
        tctx.arc(sunX, sunY, sunR * 2, 0, Math.PI * 2);
        tctx.fill();

        tctx.beginPath();
        tctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
        tctx.fillStyle = '#FFD166';
        tctx.fill();

        // Coletor (placa escura)
        const colX = w * 0.4;
        const colY = h * 0.55;
        const colW = w * 0.45;
        const colH = h * 0.15;

        // Moldura
        tctx.fillStyle = '#2a2a35';
        tctx.fillRect(colX - 5, colY - 5, colW + 10, colH + 10);

        // Superfície absorvedora
        const heat = 0.5 + Math.sin(tTime * 0.05) * 0.1;
        const colGrad = tctx.createLinearGradient(colX, colY, colX, colY + colH);
        colGrad.addColorStop(0, `rgba(192, 57, 43, ${heat})`);
        colGrad.addColorStop(0.5, `rgba(255, 118, 38, ${heat})`);
        colGrad.addColorStop(1, `rgba(192, 57, 43, ${heat})`);
        tctx.fillStyle = colGrad;
        tctx.fillRect(colX, colY, colW, colH);

        // Tubos internos
        tctx.strokeStyle = 'rgba(49, 140, 231, 0.5)';
        tctx.lineWidth = 3;
        for (let i = 1; i < 4; i++) {
            const y = colY + (colH * i / 4);
            tctx.beginPath();
            tctx.moveTo(colX + 10, y);
            tctx.lineTo(colX + colW - 10, y);
            tctx.stroke();
        }

        // Reservatório de água (cilindro à direita)
        const tankX = colX + colW + 10;
        const tankY = colY - 30;
        const tankW = 30;
        const tankH = colH + 60;

        tctx.fillStyle = '#3a3a45';
        tctx.fillRect(tankX, tankY, tankW, tankH);
        tctx.strokeStyle = 'rgba(244, 245, 247, 0.3)';
        tctx.lineWidth = 1;
        tctx.strokeRect(tankX, tankY, tankW, tankH);

        // Água no reservatório (nível variável com temperatura)
        const waterLevel = tankH * 0.7;
        const waterY = tankY + tankH - waterLevel;
        const waterGrad = tctx.createLinearGradient(tankX, waterY, tankX, tankY + tankH);
        waterGrad.addColorStop(0, '#e74c3c');
        waterGrad.addColorStop(1, '#c0392b');
        tctx.fillStyle = waterGrad;
        tctx.fillRect(tankX + 2, waterY, tankW - 4, waterLevel);

        // Label
        tctx.fillStyle = 'rgba(244, 245, 247, 0.7)';
        tctx.font = '10px "Space Grotesk", sans-serif';
        tctx.textAlign = 'center';
        tctx.fillText('Água quente', tankX + tankW / 2, tankY - 8);

        // Raios solares
        if (Math.random() < 0.3) {
            tRays.push({
                x: sunX + sunR,
                y: sunY + Math.random() * sunR,
                tx: colX + Math.random() * colW,
                ty: colY,
                progress: 0
            });
        }

        tRays.forEach((r, i) => {
            r.progress += 0.03;
            const cx = r.x + (r.tx - r.x) * r.progress;
            const cy = r.y + (r.ty - r.y) * r.progress;

            tctx.strokeStyle = `rgba(255, 209, 102, ${1 - r.progress})`;
            tctx.lineWidth = 1.5;
            tctx.beginPath();
            tctx.moveTo(r.x, r.y);
            tctx.lineTo(cx, cy);
            tctx.stroke();

            if (r.progress >= 1) tRays.splice(i, 1);
        });

        // Ondas de calor subindo do coletor
        if (Math.random() < 0.1) {
            tDrops.push({
                x: colX + Math.random() * colW,
                y: colY,
                vy: -0.5 - Math.random() * 0.3,
                life: 1
            });
        }

        tDrops.forEach((d, i) => {
            d.y += d.vy;
            d.life -= 0.015;
            if (d.life <= 0) {
                tDrops.splice(i, 1);
                return;
            }
            tctx.beginPath();
            tctx.arc(d.x, d.y, 2, 0, Math.PI * 2);
            tctx.fillStyle = `rgba(255, 118, 38, ${d.life * 0.6})`;
            tctx.fill();
        });

        tTime++;
        requestAnimationFrame(drawThermal);
    }

    // ============================================================
    // INICIALIZAÇÃO
    // ============================================================
    function init() {
        resizeIntro();
        initIntroParticles();
        drawIntro();

        resizeBB();
        drawBlackbody();

        // Planck — precisa de tamanho inicial
        setTimeout(() => {
            const dpr = window.devicePixelRatio || 1;
            planckCanvas.width = planckCanvas.clientWidth * dpr;
            planckCanvas.height = planckCanvas.clientHeight * dpr;
            pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            drawPlanck();
        }, 100);

        resizePV();
        drawPV();

        resizeThermal();
        drawThermal();

        updateNav(0);
        sections[0].classList.add('active');
    }

    // Redimensionamento
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            resizeIntro();
            initIntroParticles();
            resizeBB();
            resizePV();
            resizeThermal();
            const dpr = window.devicePixelRatio || 1;
            planckCanvas.width = planckCanvas.clientWidth * dpr;
            planckCanvas.height = planckCanvas.clientHeight * dpr;
            pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            drawPlanck();
        }, 150);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
