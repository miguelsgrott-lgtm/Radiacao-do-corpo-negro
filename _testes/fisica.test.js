'use strict';
/* Testes das funções de física. Para rodar: node --test _testes/*.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../script.js');

const perto = (valor, esperado, tolerancia, nome = '') =>
    assert.ok(Math.abs(valor - esperado) <= tolerancia, `${nome} ${valor} deveria ser ${esperado} ± ${tolerancia}`);

const G = F.geometriaPiscina();
const K = F.paraKelvin;

test('medidas e perfil da piscina do grupo', () => {
    perto(G.areaSuperficie, 1070.7, 1e-9, 'área');
    perto(G.partes.retanguloBase, 109.56, 1e-9, 'retângulo');
    perto(G.partes.blocoFundo, 59.76, 1e-9, 'bloco');
    perto(G.partes.trianguloRampa, 29.88, 1e-9, 'triângulo');
    perto(G.areaPerfil, 199.2, 1e-9, 'perfil');
    perto(G.tercos.raso + G.tercos.rampa + G.tercos.fundo, 199.2, 1e-9, 'perfil por terços');
    perto(G.volume, 4282.8, 1e-9, 'volume');
    perto(G.massa, 4282800, 1e-6, 'massa');
    perto(G.profundidadeMedia, 4, 1e-9, 'profundidade média');
});

test('energia para aquecer a piscina', () => {
    const de20a35 = F.energiaAquecimento(G.massa, 15);
    const de20a28 = F.energiaAquecimento(G.massa, 8);
    perto(de20a35, 268788528000, 1, 'Q 20→35');
    perto(F.jouleParaKWh(de20a35), 74663.5, 0.05, 'kWh 20→35');
    perto(de20a28, 143353881600, 1, 'Q 20→28');
    perto(F.jouleParaKWh(de20a28), 39820.5, 0.05, 'kWh 20→28');
});

test('lei de Wien', () => {
    perto(F.picoWien(K(20)) * 1e6, 9.88, 0.005, '20 °C');
    perto(F.picoWien(K(28)) * 1e6, 9.62, 0.005, '28 °C');
    perto(F.picoWien(K(35)) * 1e6, 9.40, 0.005, '35 °C');
    perto(F.picoWien(5772) * 1e9, 502, 0.5, 'Sol');
});

test('lei de Stefan-Boltzmann', () => {
    perto(F.stefanBoltzmann(K(20)), 418.8, 0.05, '20 °C');
    perto(F.stefanBoltzmann(K(28)), 466.4, 0.05, '28 °C');
    perto(F.stefanBoltzmann(K(35)), 511.3, 0.05, '35 °C');
});

test('perda radiativa líquida', () => {
    const umaUm = F.radiacaoLiquida(K(35), K(20), 1);
    const real = F.radiacaoLiquida(K(35), K(20), 0.95);
    perto(umaUm, 92.52, 0.005, 'ε = 1');
    perto((umaUm * G.areaSuperficie) / 1e3, 99.1, 0.05, 'ε = 1 em kW');
    perto(real, 87.89, 0.005, 'ε = 0,95');
    perto((real * G.areaSuperficie) / 1e3, 94.1, 0.05, 'ε = 0,95 em kW');
    assert.equal(F.radiacaoLiquida(300, 300, 0.95), 0);
    assert.ok(F.radiacaoLiquida(290, 300, 0.95) < 0, 'água mais fria que a vizinhança ganha energia');
    assert.ok(umaUm < F.stefanBoltzmann(K(35)) / 5, 'a perda líquida é bem menor que a emissão');
});

test('coletor e taxa de aquecimento', () => {
    perto(F.areaColetor(94100, 600, 0.6), 261, 0.5, 'coletor');
    perto(F.taxaAquecimento(500e3, G.massa), 0.1005, 0.00005, 'taxa');
    perto(F.tempoAquecimento(F.energiaAquecimento(G.massa, 15), 500e3), 149.3, 0.1, 'tempo');
    assert.equal(F.tempoAquecimento(1, 0), Infinity);
});

test('efeito fotoelétrico', () => {
    perto(F.frequenciaCorte(2.3) / 1e14, 5.56, 0.005, 'φ 2,3');
    perto(F.frequenciaCorte(4.7) / 1e14, 11.36, 0.005, 'φ 4,7');
    perto(F.frequenciaCorte(5.1) / 1e14, 12.33, 0.005, 'φ 5,1');
    perto(F.energiaCineticaMaxima(8e14, 2.3), 1.01, 0.005, 'Kmax');
    assert.equal(F.energiaCineticaMaxima(4e14, 2.3), 0);
    assert.equal(F.haEmissao(11.3e14, 4.7), false, 'abaixo do corte do cobre não há emissão');
    assert.equal(F.haEmissao(11.4e14, 4.7), true);
});

test('lei de Planck: forma, pico e integral', () => {
    for (const T of [300, 1000, 5772]) {
        const pico = F.picoWien(T);
        const noPico = F.planck(pico, T);
        assert.ok(noPico > F.planck(pico * 0.9, T) && noPico > F.planck(pico * 1.1, T), `pico em ${T} K`);
    }
    for (const T of [308.15, 5772]) {
        let soma = 0;
        const n = 20000;
        const a = Math.log(1e-8), z = Math.log(1e-2);
        const passo = (z - a) / n;
        for (let i = 0; i <= n; i++) {
            const l = Math.exp(a + i * passo);
            soma += Math.PI * F.planck(l, T) * l * passo * (i === 0 || i === n ? 0.5 : 1);
        }
        perto(soma / F.stefanBoltzmann(T), 1, 1e-4, `integral em ${T} K`);
    }
    assert.equal(F.planck(1e-9, 300), 0, 'sem estouro numérico em onda muito curta');
    perto(F.planck(1e-1, 300) / F.rayleighJeans(1e-1, 300), 1, 0.01, 'limite de onda longa');
    assert.ok(F.rayleighJeans(1e-7, 5772) > 100 * F.planck(1e-7, 5772), 'catástrofe do ultravioleta');
});

test('frações da emissão por faixa', () => {
    perto(F.fracaoAte(F.picoWien(5772), 5772), 0.25005, 0.0002, 'até o pico');
    perto(F.fracaoAte(1, 5772), 1, 1e-6, 'tudo');
    perto(F.fracaoBanda(380e-9, 750e-9, 5772), 0.44, 0.02, 'visível no Sol');
    assert.ok(F.fracaoBanda(380e-9, 750e-9, K(35)) < 1e-15, 'a água não emite no visível');
    perto(F.fracaoBanda(3e-6, 1000e-6, K(35)), 1, 0.001, 'água emite no infravermelho');
    for (const lt of [0.5e-3, 1e-3, 3e-3, 2e-2, 2e-1]) {
        let soma = 0;
        const T = 1000, n = 40000, z = Math.log(lt / T), a = Math.log(1e-9);
        const passo = (z - a) / n;
        for (let i = 0; i <= n; i++) {
            const l = Math.exp(a + i * passo);
            soma += Math.PI * F.planck(l, T) * l * passo * (i === 0 || i === n ? 0.5 : 1);
        }
        perto(F.fracaoAte(lt / T, T), soma / F.stefanBoltzmann(T), 2e-4, `λT = ${lt}`);
    }
});

test('céu claro de Swinbank', () => {
    perto(F.temperaturaCeu(K(20)), 277.7, 0.5, 'céu com ar a 20 °C');
    assert.ok(F.temperaturaCeu(K(20)) < K(20), 'céu claro é mais frio que o ar');
});

test('evaporação e convecção', () => {
    perto(F.pressaoSaturacao(20), 2339, 12, 'saturação 20 °C');
    perto(F.pressaoSaturacao(35), 5628, 25, 'saturação 35 °C');
    perto(95 * 3.15459 / 3386.39, 0.089, 0.001, 'conversão do termo constante da ASHRAE');
    perto(0.425 * 196.85 * 3.15459 / 3386.39, 0.0782, 0.0005, 'conversão do termo do vento');
    const base = { tAgua: 35, tAr: 20, umidade: 0.6, vento: 1, tVizinhanca: 20 };
    const aberta = F.fluxosSuperficie(base);
    const coberta = F.fluxosSuperficie({ ...base, capa: true });
    assert.ok(aberta.evaporacao > aberta.radiacao, 'evaporação supera a radiação neste cenário');
    perto(aberta.radiacao, 87.89, 0.005, 'radiação usa a perda líquida');
    perto(coberta.evaporacao, aberta.evaporacao * 0.1, 1e-9, 'capa corta 90% da evaporação');
    assert.ok(coberta.conveccao < aberta.conveccao && coberta.radiacao < aberta.radiacao, 'capa atua em mais de uma perda');
    assert.ok(F.fluxosSuperficie({ ...base, vento: 3 }).evaporacao > aberta.evaporacao, 'vento aumenta a evaporação');
    assert.ok(F.fluxosSuperficie({ ...base, umidade: 0.9 }).evaporacao < aberta.evaporacao, 'ar úmido reduz a evaporação');
    assert.equal(F.fluxosSuperficie({ ...base, tAgua: 10, umidade: 1 }).evaporacao, 0, 'sem evaporação negativa');
    perto(F.calorLatente(26.67), 2.438e6, 2e3, 'calor latente');
});

test('sol e capa ao longo do dia', () => {
    assert.equal(F.irradianciaNaHora(3, 600), 0);
    assert.equal(F.irradianciaNaHora(12, 600), 600);
    perto(F.irradianciaNaHora(36, 600), 600, 1e-9, 'repete a cada dia');
    assert.equal(F.capaNaAgua('sem', 2), false);
    assert.equal(F.capaNaAgua('noite', 2), true);
    assert.equal(F.capaNaAgua('noite', 12), false);
    assert.equal(F.capaNaAgua('sempre', 12), true);
});

test('balanço térmico da piscina', () => {
    const base = { dias: 3, irradianciaPico: 0, tInicial: 28, tAr: 15, umidade: 0.6, vento: 1 };
    const sem = F.simularPiscina({ ...base, capa: 'sem' });
    const com = F.simularPiscina({ ...base, capa: 'sempre' });
    assert.ok(sem.tFinal < 28, 'sem entrada de energia a água esfria');
    assert.ok(com.tFinal > sem.tFinal, 'com capa esfria menos');
    assert.ok(com.litrosPorDia < sem.litrosPorDia * 0.2, 'com capa evapora muito menos');
    assert.equal(sem.pontos.length, 73, 'um ponto por hora');
    const pequena = F.simularPiscina({ ...base, capa: 'sem', massa: G.massa / 10 });
    assert.ok(pequena.tFinal < sem.tFinal, 'menos massa muda de temperatura mais depressa');
    const aquecida = F.simularPiscina({ dias: 1, passo: 300, tInicial: 20, tAr: 20, irradianciaPico: 0, umidade: 1, vento: 0, ceu: 'ar', potenciaExtra: 500e3, tMeta: 40 });
    perto((aquecida.tFinal - 20) / 24, 0.1005, 0.006, 'taxa coerente com o balanço');
    const parada = F.simularPiscina({ dias: 2, tInicial: 27.9, tAr: 27.9, umidade: 1, vento: 0, ceu: 'ar', irradianciaPico: 0, potenciaExtra: 5e6, tMeta: 28 });
    assert.ok(parada.tFinal < 29, 'o aquecedor desliga ao atingir a meta');
});

test('coletor: superfície seletiva', () => {
    const condicao = { irradiancia: 800, tPlaca: 80, tAr: 25, tCeu: 10 };
    const preta = F.balancoPlaca({ ...condicao, absortancia: 0.93, emitancia: 0.93 });
    const seletiva = F.balancoPlaca({ ...condicao, absortancia: 0.97, emitancia: 0.09 });
    assert.ok(seletiva.radiado < preta.radiado / 5, 'emite muito menos no infravermelho');
    assert.ok(seletiva.util > preta.util, 'entrega mais calor útil');
    const estPreta = F.temperaturaEstagnacao({ ...condicao, absortancia: 0.93, emitancia: 0.93 });
    const estSeletiva = F.temperaturaEstagnacao({ ...condicao, absortancia: 0.97, emitancia: 0.09 });
    assert.ok(estSeletiva > estPreta, 'seletiva alcança temperatura maior');
    perto(F.balancoPlaca({ ...condicao, absortancia: 0.93, emitancia: 0.93, tPlaca: estPreta }).util, 0, 1e-6, 'estagnação');
});

test('coletor térmico x painel fotovoltaico', () => {
    const r = F.compararEnergia({ irradiancia: 600, area: 10, eficienciaColetor: 0.6, eficienciaPainel: 0.2, cop: 4 });
    perto(r.recebida, 6000, 1e-9);
    perto(r.calorColetor, 3600, 1e-9);
    perto(r.eletrica, 1200, 1e-9);
    perto(r.calorBomba, 4800, 1e-9);
});

test('automação: histerese', () => {
    const cfg = F.AUTOMACAO_PADRAO;
    const sensores = { tPiscina: 24, irradiancia: 600, fluxo: true, nivelOk: true };
    let e = F.novoEstadoAutomacao();
    e = F.passoAutomacao(e, { ...sensores, tColetor: 31 }, cfg);
    assert.equal(e.modo, 'desligada', 'ΔT 7 não liga');
    e = F.passoAutomacao(e, { ...sensores, tColetor: 32 }, cfg);
    assert.equal(e.modo, 'partida', 'ΔT 8 inicia a partida');
    e = F.passoAutomacao(e, { ...sensores, tColetor: 32 }, cfg);
    assert.equal(e.modo, 'ligada', 'fluxo confirma');
    e = F.passoAutomacao(e, { ...sensores, tColetor: 31 }, cfg);
    assert.equal(e.modo, 'ligada', 'ΔT 7 mantém ligada: mesma leitura, outro estado');
    e = F.passoAutomacao(e, { ...sensores, tColetor: 27.5 }, cfg);
    assert.equal(e.modo, 'ligada', 'ΔT 3,5 ainda ligada');
    e = F.passoAutomacao(e, { ...sensores, tColetor: 27 }, cfg);
    assert.equal(e.modo, 'desligada', 'ΔT 3 desliga');
});

test('automação: janela de partida e proteções', () => {
    const base = { tPiscina: 24, tColetor: 40, irradiancia: 600, nivelOk: true };
    let e = F.passoAutomacao(F.novoEstadoAutomacao(), { ...base, fluxo: false });
    assert.equal(e.modo, 'partida', 'liga mesmo sem fluxo, porque o fluxo só surge depois');
    assert.equal(F.bombaLigada(e), true);
    for (let i = 0; i < 18; i++) e = F.passoAutomacao(e, { ...base, fluxo: false });
    assert.equal(e.modo, 'partida', 'ainda dentro da janela');
    e = F.passoAutomacao(e, { ...base, fluxo: false });
    e = F.passoAutomacao(e, { ...base, fluxo: false });
    assert.equal(e.modo, 'falha', 'sem fluxo na janela vira falha');
    assert.equal(F.bombaLigada(e), false);
    e = F.passoAutomacao(e, { ...base, fluxo: true });
    assert.equal(e.modo, 'falha', 'falha exige rearme');
    e = F.passoAutomacao(e, { ...base, fluxo: true, rearmar: true });
    assert.equal(e.modo, 'desligada');
    e = F.passoAutomacao({ modo: 'ligada', tempo: 5, motivo: '' }, { ...base, fluxo: true, nivelOk: false });
    assert.equal(e.modo, 'falha', 'nível baixo bloqueia');
    e = F.passoAutomacao({ modo: 'ligada', tempo: 5, motivo: '' }, { ...base, tPiscina: 28, fluxo: true });
    assert.equal(e.modo, 'desligada', 'meta atingida');
    e = F.passoAutomacao(F.novoEstadoAutomacao(), { ...base, irradiancia: 100, fluxo: true });
    assert.equal(e.modo, 'desligada', 'pouco sol não liga');
    assert.equal(F.lembreteCapa({ irradiancia: 0, capaColocada: false, tPiscina: 26, tAr: 15 }), true);
    assert.equal(F.lembreteCapa({ irradiancia: 500, capaColocada: false, tPiscina: 26, tAr: 15 }), false);
});

test('formatação em português', () => {
    assert.equal(F.cientifico(6.33e7), '6,33 × 10⁷');
    assert.equal(F.cientifico(4.59e2), '4,59 × 10²');
    assert.equal(F.cientifico(1.5e-9, 1), '1,5 × 10⁻⁹');
    assert.equal(F.numeroBR(74663.48, 1), '74.663,5');
    assert.equal(F.comprimentoLegivel(502e-9), '502 nm');
    assert.equal(F.comprimentoLegivel(9.4e-6), '9,40 µm');
    assert.equal(F.potenciaLegivel(94104), '94,1 kW');
    assert.equal(F.potenciaLegivel(1.5e6), '1,50 MW');
    assert.equal(F.duracaoLegivel(149.3), '6,2 dias');
    assert.equal(F.duracaoLegivel(Infinity), 'não chega à meta');
});
