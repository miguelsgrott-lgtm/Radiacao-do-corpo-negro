/* ============================================================
   PROJETO INTEGRADOR CEP - LÓGICA PRINCIPAL
   Módulos: Acessibilidade, Navegação, Simuladores (Planck, Fotoelétrico, Térmico, Automação)
   ============================================================ */

(() => {
    'use strict';

    // ===== 1. ACESSIBILIDADE (WCAG 2.2) =====
    const a11yPanel = document.getElementById('a11yPanel');
    const a11yToggle = document.getElementById('a11yToggle');
    const a11yControls = document.getElementById('a11yControls');

    a11yToggle.addEventListener('click', () => {
        const isExpanded = a11yToggle.getAttribute('aria-expanded') === 'true';
        a11yToggle.setAttribute('aria-expanded', !isExpanded);
        a11yControls.hidden = isExpanded;
    });

    function toggleA11y(feature) {
        document.body.classList.toggle(feature === 'contrast' ? 'high-contrast' : 
                                       feature === 'fontSize' ? 'large-text' : 
                                       feature === 'dyslexic' ? 'dyslexic-font' : 'reduce-motion');
        localStorage.setItem('a11y_' + feature, document.body.classList.contains(feature === 'contrast' ? 'high-contrast' : feature === 'fontSize' ? 'large-text' : feature === 'dyslexic' ? 'dyslexic-font' : 'reduce-motion'));
    }

    function resetA11y() {
        document.body.classList.remove('high-contrast', 'large-text', 'dyslexic-font', 'reduce-motion');
        ['contrast', 'fontSize', 'dyslexic', 'motion'].forEach(f => localStorage.removeItem('a11y_' + f));
    }

    // Restaurar preferências
    ['contrast', 'fontSize', 'dyslexic', 'motion'].forEach(f => {
        if (localStorage.getItem('a11y_' + f) === 'true') {
            document.body.classList.add(f === 'contrast' ? 'high-contrast' : f === 'fontSize' ? 'large-text' : f === 'dyslexic' ? 'dyslexic-font' : 'reduce-motion');
        }
    });

    // ===== 2. NAVEGAÇÃO =====
    const sections = document.querySelectorAll('.section');
    const navLinks = document.querySelectorAll('.nav-link');
    const progressBar = document.getElementById('progressBar');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinksContainer = document.getElementById('navLinks');

    mobileMenuBtn.addEventListener('click', () => {
        const isExpanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true';
        mobileMenuBtn.setAttribute('aria-expanded', !isExpanded);
        navLinksContainer.style.display = isExpanded ? 'none' : 'flex';
        navLinksContainer.style.flexDirection = 'column';
        navLinksContainer.style.position = 'absolute';
        navLinksContainer.style.top = '60px';
        navLinksContainer.style.right = '10px';
        navLinksContainer.style.background = 'var(--deep-blue)';
        navLinksContainer.style.padding = '20px';
        navLinksContainer.style.borderRadius = '12px';
        navLinksContainer.style.border = '1px solid var(--turquoise)';
    });

    // Fechar menu ao clicar em link (mobile)
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 1024) {
                navLinksContainer.style.display = 'none';
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
            }
        });
    });

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
                const idx = entry.target.dataset.index;
                navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === `#${entry.target.id}`));
            }
        });
    }, { threshold: [0.3, 0.6] });
    sections.forEach(s => observer.observe(s));

    window.addEventListener('scroll', () => {
        const h = document.documentElement;
        progressBar.style.width = ((h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100) + '%';
    }, { passive: true });

    // ===== 3. UTILITÁRIO CANVAS ROBUSTO (ResizeObserver) =====
    function setupCanvas(canvasId, drawFn) {
        const canvas = document.getElementById(canvasId);
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
        const obs = new ResizeObserver(() => requestAnimationFrame(resize));
        obs.observe(canvas);
        if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', resize);
        else resize();
        return { canvas, ctx };
    }

    // ===== 4. SIMULADOR 1: LEI DE PLANCK (Adaptado) =====
    const H = 6.626e-34, C = 2.998e8, K = 1.381e-23, B_WIEN = 2.898e-3, SIGMA = 5.67e-8;
    const bbSlider = document.getElementById('bbTempSlider');
    
    function planck(lambda, T) {
        const c1 = 2 * H * C * C, c2 = H * C / (lambda * K * T);
        if (c2 > 700) return 0;
        return c1 / (Math.pow(lambda, 5) * (Math.exp(c2) - 1));
    }

    function drawPlanck() {
        const setup = setupCanvas('planckCanvas', drawPlanck);
        if (!setup) return;
        const ctx = setup.ctx, w = setup.canvas.clientWidth, h = setup.canvas.clientHeight;
        const T = +bbSlider.value;
        document.getElementById('bbTempVal').textContent = T;

        ctx.clearRect(0, 0, w, h);
        const ml = 50, mr = 15, mt = 20, mb = 40, pw = w - ml - mr, ph = h - mt - mb;
        const nSamples = 200, lambdas = [], values = [];
        let maxVal = 0;
        
        for (let i = 0; i < nSamples; i++) {
            const lambda = 100e-9 + (i / (nSamples - 1)) * (3000e-9);
            const val = planck(lambda, T);
            lambdas.push(lambda); values.push(val);
            if (val > maxVal) maxVal = val;
        }

        const sqrtMax = Math.sqrt(maxVal) || 1;
        const xMap = (l) => ml + ((l - 100e-9) / (2900e-9)) * pw;
        const yMap = (v) => mt + ph - (Math.sqrt(v) / sqrtMax) * ph;

        // Fundo e eixos
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(ml, mt, pw, ph);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(ml, mt); ctx.lineTo(ml, mt+ph); ctx.lineTo(ml+pw, mt+ph); ctx.stroke();

        // Curva
        ctx.beginPath();
        for (let i = 0; i < nSamples; i++) {
            const x = xMap(lambdas[i]), y = yMap(values[i]);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#FFD166'; ctx.lineWidth = 2; ctx.stroke();

        // Pico
        const lambdaPeak = B_WIEN / T;
        const xPeak = xMap(lambdaPeak), yPeak = yMap(planck(lambdaPeak, T));
        ctx.setLineDash([4, 4]); ctx.strokeStyle = 'white'; ctx.beginPath(); ctx.moveTo(xPeak, mt); ctx.lineTo(xPeak, mt+ph); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(xPeak, yPeak, 4, 0, Math.PI*2); ctx.fillStyle = 'white'; ctx.fill();

        document.getElementById('wienResult').textContent = (lambdaPeak * 1e9).toFixed(0);
        document.getElementById('stefanResult').textContent = (SIGMA * Math.pow(T, 4)).toExponential(2);
    }
    if (bbSlider) bbSlider.addEventListener('input', drawPlanck);

    // ===== 5. SIMULADOR 2: EFEITO FOTOELÉTRICO =====
    const peFreq = document.getElementById('peFreqSlider');
    const peInt = document.getElementById('peIntSlider');
    const peMat = document.getElementById('peMaterial');
    let pePhotons = [], peElectrons = [], peTime = 0;

    function drawPE() {
        const setup = setupCanvas('peCanvas', drawPE);
        if (!setup) return;
        const ctx = setup.ctx, w = setup.canvas.clientWidth, h = setup.canvas.clientHeight;
        ctx.clearRect(0, 0, w, h);

        const freq = +peFreq.value, int = +peInt.value, phi = +peMat.value;
        document.getElementById('peFreqVal').textContent = freq.toFixed(1);
        document.getElementById('peIntVal').textContent = int;

        // Placa metálica
        ctx.fillStyle = '#4a5568'; ctx.fillRect(0, h * 0.6, w, h * 0.4);
        ctx.fillStyle = '#2d3748'; ctx.fillRect(0, h * 0.6, w, 10); // Superfície

        // Fótons (círculos amarelos caindo)
        if (Math.random() < (int / 100) * 0.2) {
            pePhotons.push({ x: Math.random() * w, y: 0, vy: 2 + Math.random() });
        }

        pePhotons.forEach((p, i) => {
            p.y += p.vy;
            ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fillStyle = '#FFD166'; ctx.fill();
            
            // Colisão com a placa
            if (p.y >= h * 0.6) {
                // Verificar se energia (proporcional à freq) > função trabalho
                // Escala arbitrária: freq 8.0 ~ 3.3 eV. phi = 4.7 eV precisa de freq ~ 11.4
                const thresholdFreq = phi * 2.4; 
                if (freq >= thresholdFreq) {
                    peElectrons.push({ x: p.x, y: h * 0.6, vy: -3 - Math.random() * 2, vx: (Math.random() - 0.5) * 2, life: 1 });
                }
                pePhotons.splice(i, 1);
            }
        });

        // Elétrons ejetados
        peElectrons.forEach((e, i) => {
            e.x += e.vx; e.y += e.vy; e.life -= 0.02;
            if (e.life <= 0 || e.y < 0) { peElectrons.splice(i, 1); return; }
            ctx.beginPath(); ctx.arc(e.x, e.y, 3, 0, Math.PI*2); ctx.fillStyle = `rgba(87, 197, 182, ${e.life})`; ctx.fill();
        });

        // Status
        const thresholdFreq = phi * 2.4;
        const statusEl = document.getElementById('peResults');
        if (freq >= thresholdFreq) {
            statusEl.innerHTML = `Status: <strong style="color:#57C5B6">Emissão Ocorrendo!</strong> (f > f_corte). Energia cinética aumenta com a frequência, não com a intensidade.`;
        } else {
            statusEl.innerHTML = `Status: <strong style="color:#c0392b">Sem Emissão.</strong> Frequência (${freq}) abaixo do corte (~${thresholdFreq.toFixed(1)}). Aumentar a intensidade não ejetará elétrons.`;
        }
        peTime++;
    }
    if (peFreq) { peFreq.addEventListener('input', drawPE); peInt.addEventListener('input', drawPE); peMat.addEventListener('change', drawPE); }

    // ===== 6. SIMULADOR 3: BALANÇO TÉRMICO DA PISCINA =====
    const runSimBtn = document.getElementById('runSimBtn');
    if (runSimBtn) {
        runSimBtn.addEventListener('click', () => {
            const vol = +document.getElementById('simVol').value; // Litros
            const tInit = +document.getElementById('simTInit').value;
            const pow = +document.getElementById('simPow').value; // W/m2
            const area = +document.getElementById('simArea').value; // m2
            const hasCover = document.getElementById('simCover').checked;

            document.getElementById('simVolVal').textContent = vol;
            document.getElementById('simTInitVal').textContent = tInit;
            document.getElementById('simPowVal').textContent = pow;
            document.getElementById('simAreaVal').textContent = area;

            // Modelo simplificado: Q_gain = pow * area * 0.6 (eficiência) * tempo
            // Q_loss = U * A_pool * (T_water - T_amb) * tempo. 
            // Simplificação: perda base de 0.5°C/h sem capa, 0.2°C/h com capa (evaporação dominada).
            
            const mass = vol; // 1L = 1kg
            const c_water = 4184; // J/kg°C
            const pGain = pow * area * 0.6; // Watts (J/s)
            const pGainPerHour = pGain * 3600; // J/h
            
            const lossRatePerHour = hasCover ? 0.2 : 0.6; // °C/h de perda base
            // Perda em Joules/h = mass * c * lossRate
            const pLossPerHour = mass * c_water * lossRatePerHour;

            let currentT = tInit;
            const labels = [], dataT = [];
            
            for (let h = 0; h <= 24; h++) {
                labels.push(h + 'h');
                dataT.push(currentT.toFixed(1));
                
                // Ganho solar (apenas das 8h às 18h)
                let qGain = 0;
                if (h >= 8 && h <= 18) qGain = pGainPerHour;
                
                // Perda térmica (constante, mas proporcional à diferença, simplificada aqui como taxa fixa ajustada)
                let qLoss = pLossPerHour;
                
                // Variação líquida
                let deltaQ = qGain - qLoss;
                let deltaT = deltaQ / (mass * c_water);
                currentT += deltaT;
            }

            // Desenhar gráfico simples no canvas
            const setup = setupCanvas('thermalSimCanvas', () => {});
            if (setup) {
                const ctx = setup.ctx, w = setup.canvas.clientWidth, h = setup.canvas.clientHeight;
                ctx.clearRect(0, 0, w, h);
                const ml = 40, mr = 20, mt = 20, mb = 40, pw = w - ml - mr, ph = h - mt - mb;
                
                const minT = Math.floor(Math.min(...dataT) - 1);
                const maxT = Math.ceil(Math.max(...dataT) + 1);
                
                ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(ml, mt); ctx.lineTo(ml, mt+ph); ctx.lineTo(ml+pw, mt+ph); ctx.stroke();
                
                ctx.beginPath(); ctx.strokeStyle = '#57C5B6'; ctx.lineWidth = 3;
                dataT.forEach((t, i) => {
                    const x = ml + (i / (dataT.length - 1)) * pw;
                    const y = mt + ph - ((t - minT) / (maxT - minT)) * ph;
                    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                    
                    // Rótulos de hora
                    if (i % 4 === 0) {
                        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
                        ctx.fillText(labels[i], x, mt + ph + 15);
                    }
                });
                ctx.stroke();

                const finalT = dataT[dataT.length - 1];
                document.getElementById('thermalSimResults').innerHTML = 
                    `Temperatura Final Estimada: <strong>${finalT} °C</strong> | Variação: <strong>${(finalT - tInit).toFixed(1)} °C</strong><br>
                    <small>A capa térmica reduziu as perdas por evaporação/convecção, resultando em maior ganho líquido.</small>`;
            }
        });
    }

    // ===== 7. SIMULADOR 4: DASHBOARD DE AUTOMAÇÃO =====
    const dashTPool = document.getElementById('dashTPool');
    const dashTCol = document.getElementById('dashTCol');
    const dashIrr = document.getElementById('dashIrr');
    const dashFlow = document.getElementById('dashFlow');

    function updateDash() {
        const tPool = +dashTPool.value;
        const tCol = +dashTCol.value;
        const irr = +dashIrr.value;
        const flow = dashFlow.checked;

        document.getElementById('valTPool').textContent = tPool.toFixed(1) + ' °C';
        document.getElementById('valTCol').textContent = tCol.toFixed(1) + ' °C';
        document.getElementById('valIrr').textContent = irr + ' W/m²';
        document.getElementById('valFlow').textContent = flow ? 'Ativo' : 'Sem Fluxo';
        document.getElementById('valFlow').className = flow ? 'status-on' : 'status-off';

        // Lógica de Histerese
        const pumpEl = document.getElementById('pumpIndicator');
        const logicEl = document.getElementById('dashLogicText');
        
        const deltaT = tCol - tPool;
        let shouldPump = false;
        let reason = "";

        if (!flow) {
            reason = "Bomba bloqueada: Sensor de fluxo inativo (proteção contra superaquecimento do coletor).";
        } else if (irr < 200) {
            reason = "Bomba desligada: Irradiância solar insuficiente (< 200 W/m²).";
        } else if (deltaT < 5) {
            reason = `Bomba desligada: Diferença de temperatura insuficiente (${deltaT.toFixed(1)}°C < 5°C). O coletor não está ganhando calor útil.`;
        } else if (tPool >= 30) {
            reason = "Bomba desligada: Temperatura da piscina já atingiu o limite superior de conforto (30°C).";
        } else {
            shouldPump = true;
            reason = "Bomba LIGADA: Condições ideais (Fluxo OK, Irradiância OK, ΔT > 5°C e T_piscina < 30°C).";
        }

        if (shouldPump) {
            pumpEl.textContent = "BOMBA: LIGADA";
            pumpEl.className = "pump-indicator on";
        } else {
            pumpEl.textContent = "BOMBA: DESLIGADA";
            pumpEl.className = "pump-indicator";
        }
        logicEl.textContent = reason;
    }

    if (dashTPool) {
        [dashTPool, dashTCol, dashIrr, dashFlow].forEach(el => el.addEventListener('input', updateDash));
        updateDash();
    }

    // ===== 8. INTERATIVIDADE: DIAGRAMA DA PISCINA =====
    const compInfo = document.getElementById('componentInfo');
    const poolData = {
        coletor: "<strong>Coletor Solar Térmico:</strong> Superfície escura de alta absortividade absorve a radiação solar (visível e IV). A energia radiante é convertida em energia térmica, aquecendo a água que circula em seu interior. Não é um corpo negro perfeito, mas busca aproximar-se dessa idealização.",
        bomba: "<strong>Bomba de Circulação:</strong> Força o movimento da água (convecção forçada) da piscina, através do coletor (onde ganha calor) e de volta à piscina. Consome energia elétrica, que pode ser suprida por painéis fotovoltaicos.",
        sensores: "<strong>Sensores (IoT):</strong> Termômetros (DS18B20) medem T da água e do coletor. Sensor de fluxo garante a circulação. O microcontrolador processa esses dados para ligar/desligar a bomba automaticamente, otimizando a eficiência.",
        piscina: "<strong>Piscina (Corpo Emissor):</strong> A água, a ~25-30°C, emite radiação predominantemente no infravermelho longo (Lei de Wien). Perde calor também por evaporação (mudança de fase, que consome muita energia) e convecção com o ar.",
        capa: "<strong>Capa Térmica:</strong> Barreira física que reduz drasticamente a evaporação (principal causa de perda de calor) e a convecção. Age como isolante, conservando a energia térmica adquirida durante o dia."
    };

    document.querySelectorAll('.pool-component').forEach(comp => {
        comp.addEventListener('click', () => {
            const key = comp.dataset.info;
            compInfo.innerHTML = poolData[key];
            compInfo.style.borderColor = 'var(--turquoise)';
        });
        // Acessibilidade por teclado
        comp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                comp.click();
            }
        });
    });

    // ===== 9. INTERATIVIDADE: ESPECTRO ELETROMAGNÉTICO =====
    const specData = {
        radio: "<strong>Ondas de Rádio:</strong> Maiores comprimentos de onda (m a km). Usadas em comunicação. Não aquecem a piscina.",
        micro: "<strong>Micro-ondas:</strong> Usadas em radares e fornos (ressonância de moléculas de água). Não são o mecanismo principal do aquecimento solar.",
        ir: "<strong>Infravermelho (IV):</strong> Comprimentos de onda entre 700 nm e 1 mm. É a principal forma de transferência de calor por radiação. Essencial para o aquecimento solar térmico e é a faixa que a piscina emite ao perder calor.",
        vis: "<strong>Visível:</strong> 400 nm a 700 nm. Faixa que enxergamos. O Sol emite seu pico aqui. Os coletores solares absorvem fortemente esta faixa para converter em calor.",
        uv: "<strong>Ultravioleta (UV):</strong> Alta energia. Pode degradar materiais da piscina (cloro, plástico). A camada de ozônio filtra a maior parte.",
        "raio-x": "<strong>Raios-X:</strong> Alta energia, usados em medicina. Não relevantes para o balanço térmico da piscina.",
        gama: "<strong>Raios Gama:</strong> Radiação nuclear de altíssima energia. Não presentes na radiação solar que chega à superfície."
    };

    document.querySelectorAll('.spec-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.spec-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
            btn.setAttribute('aria-pressed', 'true');
            document.getElementById('spectrumInfo').innerHTML = specData[btn.dataset.region];
        });
    });

    // ===== INICIALIZAÇÃO =====
    function init() {
        drawPlanck();
        drawPE();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();