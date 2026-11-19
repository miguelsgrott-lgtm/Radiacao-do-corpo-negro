/* ============================================================
   PROJETO INTEGRADOR CEP: SOL, ÁGUA E TECNOLOGIA

   Este arquivo é usado pelas três páginas do site.
   Parte 1: física em funções puras, testadas com
            node --test _testes/*.test.js
   Parte 2: interface. Cada recurso só inicia se existir na página.
   ============================================================ */

(function (raiz, criar) {
    const api = criar();
    if (typeof module === 'object' && module.exports) module.exports = api;
    raiz.CEPFisica = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    /* ---------- Constantes (CODATA 2018, valores exatos ou recomendados) ---------- */
    const CONSTANTES = Object.freeze({
        h: 6.62607015e-34,          // J·s
        hEV: 4.135667696e-15,       // eV·s
        c: 299792458,               // m/s
        k: 1.380649e-23,            // J/K
        sigma: 5.670374419e-8,      // W/(m²·K⁴)
        b: 2.897771955e-3,          // m·K
        cargaEletron: 1.602176634e-19, // C
        massaEletron: 9.1093837015e-31, // kg
        zeroCelsius: 273.15,        // K
        calorEspecificoAgua: 4184,  // J/(kg·°C), valor usado pelo grupo
        densidadeAgua: 1000,        // kg/m³, valor usado pelo grupo
        pressaoAtmosferica: 101325, // Pa
        temperaturaSol: 5772        // K, valor nominal IAU 2015
    });

    const { h, hEV, c, k, sigma, b, zeroCelsius } = CONSTANTES;
    const C2 = (h * c) / k; // segunda constante de radiação, m·K

    /* Medidas do projeto do grupo: piscina quase olímpica do CEP. */
    const PISCINA = Object.freeze({ comprimento: 49.8, largura: 21.5, rasa: 2.2, funda: 5.8 });

    const paraKelvin = (celsius) => celsius + zeroCelsius;
    const paraCelsius = (kelvin) => kelvin - zeroCelsius;
    const limitar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

    /* ---------- Geometria e energia da piscina ---------- */
    function geometriaPiscina(p = PISCINA) {
        const terco = p.comprimento / 3;
        const salto = p.funda - p.rasa;
        const partes = {
            retanguloBase: p.comprimento * p.rasa,
            blocoFundo: terco * salto,
            trianguloRampa: (terco * salto) / 2
        };
        const tercos = {
            raso: terco * p.rasa,
            rampa: terco * ((p.rasa + p.funda) / 2),
            fundo: terco * p.funda
        };
        const areaPerfil = partes.retanguloBase + partes.blocoFundo + partes.trianguloRampa;
        const volume = areaPerfil * p.largura;
        return {
            terco,
            salto,
            partes,
            tercos,
            areaPerfil,
            volume,
            massa: volume * CONSTANTES.densidadeAgua,
            areaSuperficie: p.comprimento * p.largura,
            profundidadeMedia: areaPerfil / p.comprimento
        };
    }

    const energiaAquecimento = (massa, variacao, calorEspecifico = CONSTANTES.calorEspecificoAgua) =>
        massa * calorEspecifico * variacao;
    const jouleParaKWh = (joule) => joule / 3.6e6;
    const taxaAquecimento = (potencia, massa, calorEspecifico = CONSTANTES.calorEspecificoAgua) =>
        (potencia * 3600) / (massa * calorEspecifico);
    const tempoAquecimento = (energia, potencia) => (potencia > 0 ? energia / potencia / 3600 : Infinity);
    const areaColetor = (potencia, irradiancia, eficiencia) => potencia / (irradiancia * eficiencia);

    /* ---------- Radiação térmica (temperaturas em kelvin) ---------- */
    function planck(comprimento, temperatura) {
        const x = C2 / (comprimento * temperatura);
        if (x > 700) return 0;
        return (2 * h * c * c) / (Math.pow(comprimento, 5) * Math.expm1(x));
    }
    const rayleighJeans = (comprimento, temperatura) =>
        (2 * c * k * temperatura) / Math.pow(comprimento, 4);
    /* Potência emitida por m² e por µm de comprimento de onda. */
    const exitanciaEspectral = (comprimento, temperatura) => Math.PI * planck(comprimento, temperatura) * 1e-6;
    const exitanciaRayleighJeans = (comprimento, temperatura) =>
        Math.PI * rayleighJeans(comprimento, temperatura) * 1e-6;
    const picoWien = (temperatura) => b / temperatura;
    const stefanBoltzmann = (temperatura) => sigma * Math.pow(temperatura, 4);
    const emissaoSuperficie = (temperatura, emissividade = 1) => emissividade * stefanBoltzmann(temperatura);
    const radiacaoLiquida = (temperatura, vizinhanca, emissividade = 1) =>
        emissividade * sigma * (Math.pow(temperatura, 4) - Math.pow(vizinhanca, 4));

    /* Fração da emissão total abaixo de um comprimento de onda. */
    function fracaoAte(comprimento, temperatura) {
        const x = C2 / (comprimento * temperatura);
        const fator = 15 / Math.pow(Math.PI, 4);
        if (x >= 1) {
            let soma = 0;
            for (let n = 1; n <= 200; n++) {
                const termo = (Math.exp(-n * x) / n) *
                    (x * x * x + (3 * x * x) / n + (6 * x) / (n * n) + 6 / (n * n * n));
                soma += termo;
                if (termo < 1e-14) break;
            }
            return limitar(fator * soma, 0, 1);
        }
        const x3 = x * x * x;
        const integral = x3 * (1 / 3 - x / 8 + (x * x) / 60 - Math.pow(x, 4) / 5040 +
            Math.pow(x, 6) / 272160 - Math.pow(x, 8) / 13305600);
        return limitar(1 - fator * integral, 0, 1);
    }
    const fracaoBanda = (inicio, fim, temperatura) => fracaoAte(fim, temperatura) - fracaoAte(inicio, temperatura);

    /* Céu claro, a partir da radiação de onda longa de Swinbank (1963): L = 5,31e-13 · T⁶. */
    const temperaturaCeu = (temperaturaAr) =>
        Math.pow((5.31e-13 * Math.pow(temperaturaAr, 6)) / sigma, 0.25);

    /* ---------- Ondas e efeito fotoelétrico ---------- */
    const frequenciaDaOnda = (comprimento) => c / comprimento;
    const comprimentoDaOnda = (frequencia) => c / frequencia;
    const energiaFoton = (frequencia) => hEV * frequencia;
    const frequenciaCorte = (funcaoTrabalho) => funcaoTrabalho / hEV;
    const comprimentoCorte = (funcaoTrabalho) => c / frequenciaCorte(funcaoTrabalho);
    const energiaCineticaMaxima = (frequencia, funcaoTrabalho) =>
        Math.max(0, energiaFoton(frequencia) - funcaoTrabalho);
    const haEmissao = (frequencia, funcaoTrabalho) => energiaFoton(frequencia) >= funcaoTrabalho;
    const velocidadeEletron = (energiaEV) =>
        Math.sqrt((2 * energiaEV * CONSTANTES.cargaEletron) / CONSTANTES.massaEletron);

    /* ---------- Perdas na superfície da água ---------- */
    /* Pressão de saturação sobre água líquida, fórmula de Magnus (Guia OMM n.º 8). */
    const pressaoSaturacao = (celsius) => 611.2 * Math.exp((17.62 * celsius) / (243.12 + celsius));
    /* Coeficiente da correlação ASHRAE em unidades do SI: W/(m²·Pa), vento em m/s. */
    const coeficienteVento = (vento) => 0.089 + 0.0782 * vento;
    /* Razão de Bowen: constante psicrométrica em Pa/K. */
    const constanteBowen = (pressao = CONSTANTES.pressaoAtmosferica) => 6.1e-4 * pressao;
    /* Calor latente de vaporização da água, J/kg (aproximação linear). */
    const calorLatente = (celsius) => 2501000 - 2361 * celsius;

    const USO_PISCINA = Object.freeze({
        parada: 0.74, // Smith et al.: água parada evapora 74% do valor da equação
        emUso: 1.26   // Smith et al.: 15 a 20 banhistas por 1.000 ft², 26% acima da equação
    });

    function fluxosSuperficie({
        tAgua, tAr, umidade, vento, tVizinhanca, emissividade = 0.95,
        fatorUso = USO_PISCINA.parada, capa = false,
        reducaoEvaporacao = 0.9, resistenciaCapa = 0.1
    }) {
        const coeficiente = coeficienteVento(vento) * fatorUso;
        const pressaoAgua = pressaoSaturacao(tAgua);
        const pressaoAr = umidade * pressaoSaturacao(tAr);
        const tAguaK = paraKelvin(tAgua);
        const tVizK = paraKelvin(tVizinhanca);

        let evaporacao = Math.max(0, coeficiente * (pressaoAgua - pressaoAr));
        let conveccao = constanteBowen() * coeficiente * (tAgua - tAr);
        let radiacao = radiacaoLiquida(tAguaK, tVizK, emissividade);

        if (capa) {
            /* Hipótese simples: a capa bloqueia o vapor e soma uma resistência térmica em série. */
            const tMedia = (tAguaK + tVizK) / 2;
            const hRadiacao = 4 * emissividade * sigma * Math.pow(tMedia, 3);
            const hConveccao = constanteBowen() * coeficiente;
            const fator = 1 / (1 + resistenciaCapa * (hRadiacao + hConveccao));
            evaporacao *= 1 - reducaoEvaporacao;
            conveccao *= fator;
            radiacao *= fator;
        }
        return { evaporacao, conveccao, radiacao, total: evaporacao + conveccao + radiacao };
    }

    const litrosEvaporadosPorDia = (fluxoEvaporacao, area, celsius) =>
        ((fluxoEvaporacao * area) / calorLatente(celsius)) * 86400;

    /* Sol ao longo do dia: meia senoide entre 6 h e 18 h. */
    function irradianciaNaHora(horaDoDia, pico) {
        const hora = ((horaDoDia % 24) + 24) % 24;
        if (hora <= 6 || hora >= 18) return 0;
        return pico * Math.sin((Math.PI * (hora - 6)) / 12);
    }

    function capaNaAgua(modo, horaDoDia) {
        if (modo === 'sempre') return true;
        if (modo !== 'noite') return false;
        const hora = ((horaDoDia % 24) + 24) % 24;
        return hora < 8 || hora >= 18;
    }

    /* Balanço de potência: m·c·dT/dt = P_entrada − P_radiação − P_evaporação − P_convecção. */
    function simularPiscina(parametros) {
        const g = geometriaPiscina();
        const p = Object.assign({
            massa: g.massa, area: g.areaSuperficie, tInicial: 20, tAr: 20, umidade: 0.7, vento: 1,
            ceu: 'claro', emissividade: 0.95, irradianciaPico: 600, absorcaoSolar: 0.8,
            areaColetor: 0, eficienciaColetor: 0.6, potenciaExtra: 0, tMeta: 28, dias: 7,
            capa: 'sem', fatorUso: USO_PISCINA.parada, reducaoEvaporacao: 0.9,
            resistenciaCapa: 0.1, transmissaoCapa: 0.85, passo: 600
        }, parametros);

        const capacidade = p.massa * CONSTANTES.calorEspecificoAgua;
        const tVizinhanca = p.ceu === 'claro' ? paraCelsius(temperaturaCeu(paraKelvin(p.tAr))) : p.tAr;
        const total = Math.round((p.dias * 86400) / p.passo);
        const pontos = [];
        const somas = { entrada: 0, radiacao: 0, evaporacao: 0, conveccao: 0, litros: 0 };
        let temperatura = p.tInicial;

        for (let i = 0; i <= total; i++) {
            const horas = (i * p.passo) / 3600;
            const coberta = capaNaAgua(p.capa, horas);
            const sol = irradianciaNaHora(horas, p.irradianciaPico);
            const fluxos = fluxosSuperficie({
                tAgua: temperatura, tAr: p.tAr, umidade: p.umidade, vento: p.vento, tVizinhanca,
                emissividade: p.emissividade, fatorUso: p.fatorUso, capa: coberta,
                reducaoEvaporacao: p.reducaoEvaporacao, resistenciaCapa: p.resistenciaCapa
            });
            const solDireto = p.absorcaoSolar * p.area * sol * (coberta ? p.transmissaoCapa : 1);
            const aquecedorAtivo = temperatura < p.tMeta;
            const entrada = solDireto + (aquecedorAtivo ? p.areaColetor * p.eficienciaColetor * sol + p.potenciaExtra : 0);
            const potencias = {
                entrada,
                radiacao: fluxos.radiacao * p.area,
                evaporacao: fluxos.evaporacao * p.area,
                conveccao: fluxos.conveccao * p.area
            };
            if (i % Math.round(3600 / p.passo) === 0) pontos.push({ horas, temperatura, ...potencias });
            if (i === total) break;

            somas.entrada += potencias.entrada;
            somas.radiacao += potencias.radiacao;
            somas.evaporacao += potencias.evaporacao;
            somas.conveccao += potencias.conveccao;
            somas.litros += (fluxos.evaporacao * p.area * p.passo) / calorLatente(temperatura);

            const saldo = potencias.entrada - potencias.radiacao - potencias.evaporacao - potencias.conveccao;
            temperatura += (saldo * p.passo) / capacidade;
        }

        const media = (valor) => valor / total;
        return {
            pontos,
            tFinal: temperatura,
            tVizinhanca,
            medias: {
                entrada: media(somas.entrada),
                radiacao: media(somas.radiacao),
                evaporacao: media(somas.evaporacao),
                conveccao: media(somas.conveccao)
            },
            litrosPorDia: somas.litros / p.dias
        };
    }

    /* ---------- Coletor solar: placa preta comum x superfície seletiva ---------- */
    function balancoPlaca({ absortancia, emitancia, irradiancia, tPlaca, tAr, tCeu, conveccao = 10 }) {
        const absorvido = absortancia * irradiancia;
        const radiado = radiacaoLiquida(paraKelvin(tPlaca), paraKelvin(tCeu), emitancia);
        const convectado = conveccao * (tPlaca - tAr);
        const util = absorvido - radiado - convectado;
        return { absorvido, radiado, convectado, util, eficiencia: irradiancia > 0 ? util / irradiancia : 0 };
    }

    function temperaturaEstagnacao(placa) {
        let baixo = placa.tAr - 60;
        let alto = 600;
        for (let i = 0; i < 80; i++) {
            const meio = (baixo + alto) / 2;
            if (balancoPlaca({ ...placa, tPlaca: meio }).util > 0) baixo = meio;
            else alto = meio;
        }
        return (baixo + alto) / 2;
    }

    /* ---------- Coletor térmico x painel fotovoltaico ---------- */
    function compararEnergia({ irradiancia, area, eficienciaColetor, eficienciaPainel, cop }) {
        const recebida = irradiancia * area;
        const eletrica = recebida * eficienciaPainel;
        return {
            recebida,
            calorColetor: recebida * eficienciaColetor,
            eletrica,
            calorResistencia: eletrica,
            calorBomba: eletrica * cop
        };
    }

    /* ---------- Automação: máquina de estados da bomba (proposta do grupo) ---------- */
    const AUTOMACAO_PADRAO = Object.freeze({
        deltaLiga: 8, deltaDesliga: 3, irradianciaMinima: 200,
        tMeta: 28, histereseMeta: 0.5, janelaPartida: 20
    });

    const novoEstadoAutomacao = () => ({ modo: 'desligada', tempo: 0, motivo: 'Aguardando as condições de partida.' });
    const bombaLigada = (estado) => estado.modo === 'partida' || estado.modo === 'ligada';

    function passoAutomacao(estado, sensores, configuracao = AUTOMACAO_PADRAO, intervalo = 1) {
        const cfg = Object.assign({}, AUTOMACAO_PADRAO, configuracao);
        const { tPiscina, tColetor, irradiancia, fluxo, nivelOk, rearmar = false } = sensores;
        const delta = tColetor - tPiscina;
        const muda = (modo, motivo) => ({ modo, tempo: 0, motivo });
        const segue = (motivo = estado.motivo) => ({ modo: estado.modo, tempo: estado.tempo + intervalo, motivo });

        if (!nivelOk) {
            return estado.modo === 'falha'
                ? segue()
                : muda('falha', 'Nível baixo: bomba bloqueada para não funcionar a seco.');
        }

        switch (estado.modo) {
            case 'falha':
                return rearmar
                    ? muda('desligada', 'Alarme rearmado. Aguardando as condições de partida.')
                    : segue();
            case 'partida':
                if (fluxo) return muda('ligada', 'Fluxo confirmado dentro da janela de partida.');
                if (estado.tempo + intervalo >= cfg.janelaPartida) {
                    return muda('falha', `Sem fluxo em ${cfg.janelaPartida} s: bomba desligada por segurança.`);
                }
                return segue('Bomba em partida, esperando o fluxo aparecer.');
            case 'ligada':
                if (!fluxo) return muda('falha', 'O fluxo sumiu com a bomba ligada: bomba desligada por segurança.');
                if (tPiscina >= cfg.tMeta) return muda('desligada', `A água atingiu a meta de ${cfg.tMeta} °C.`);
                if (delta <= cfg.deltaDesliga) {
                    return muda('desligada', `A diferença caiu para ${delta.toFixed(1).replace('.', ',')} °C, no limite de desligar.`);
                }
                return segue('Bomba ligada: a água ganha calor no coletor.');
            default: {
                if (tPiscina >= cfg.tMeta - cfg.histereseMeta) return segue(`Água perto da meta de ${cfg.tMeta} °C.`);
                if (irradiancia < cfg.irradianciaMinima) return segue('Pouco sol para aquecer o coletor.');
                if (delta >= cfg.deltaLiga) return muda('partida', 'Diferença suficiente: bomba em partida.');
                return segue(`Diferença abaixo de ${cfg.deltaLiga} °C: continua desligada.`);
            }
        }
    }

    const lembreteCapa = ({ irradiancia, capaColocada, tPiscina, tAr }) =>
        !capaColocada && irradiancia < 50 && tPiscina > tAr;

    /* ---------- Formatação em português do Brasil ---------- */
    function numeroBR(valor, casas = 0) {
        if (!Number.isFinite(valor)) return '—';
        return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
    }

    const SOBRESCRITOS = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

    function cientifico(valor, casas = 2) {
        if (!Number.isFinite(valor)) return '—';
        if (valor === 0) return numeroBR(0, casas);
        const [mantissa, expoente] = valor.toExponential(casas).split('e');
        const potencia = String(Number(expoente)).split('').map((d) => SOBRESCRITOS[d]).join('');
        return `${numeroBR(Number(mantissa), casas)} × 10${potencia}`;
    }

    function comprimentoLegivel(metros) {
        const escalas = [[1e3, 'km'], [1, 'm'], [1e-2, 'cm'], [1e-3, 'mm'], [1e-6, 'µm'], [1e-9, 'nm'], [1e-12, 'pm']];
        const [fator, unidade] = escalas.find(([f]) => metros >= f) || escalas[escalas.length - 1];
        const valor = metros / fator;
        return `${numeroBR(valor, valor >= 100 ? 0 : valor >= 10 ? 1 : 2)} ${unidade}`;
    }

    function potenciaLegivel(watts) {
        const abs = Math.abs(watts);
        if (abs >= 1e6) return `${numeroBR(watts / 1e6, 2)} MW`;
        if (abs >= 1e3) return `${numeroBR(watts / 1e3, 1)} kW`;
        return `${numeroBR(watts, 0)} W`;
    }

    function duracaoLegivel(horas) {
        if (!Number.isFinite(horas)) return 'não chega à meta';
        if (horas < 48) return `${numeroBR(horas, 1)} horas`;
        return `${numeroBR(horas / 24, 1)} dias`;
    }

    return {
        CONSTANTES, PISCINA, USO_PISCINA, AUTOMACAO_PADRAO,
        paraKelvin, paraCelsius, limitar,
        geometriaPiscina, energiaAquecimento, jouleParaKWh, taxaAquecimento, tempoAquecimento, areaColetor,
        planck, rayleighJeans, exitanciaEspectral, exitanciaRayleighJeans, picoWien, stefanBoltzmann,
        emissaoSuperficie, radiacaoLiquida, fracaoAte, fracaoBanda, temperaturaCeu,
        frequenciaDaOnda, comprimentoDaOnda, energiaFoton, frequenciaCorte, comprimentoCorte,
        energiaCineticaMaxima, haEmissao, velocidadeEletron,
        pressaoSaturacao, coeficienteVento, constanteBowen, calorLatente, fluxosSuperficie,
        litrosEvaporadosPorDia, irradianciaNaHora, capaNaAgua, simularPiscina,
        balancoPlaca, temperaturaEstagnacao, compararEnergia,
        novoEstadoAutomacao, bombaLigada, passoAutomacao, lembreteCapa,
        numeroBR, cientifico, comprimentoLegivel, potenciaLegivel, duracaoLegivel
    };
});

/* ============================================================
   PARTE 2: INTERFACE
   ============================================================ */
if (typeof document !== 'undefined') {
(function () {
    'use strict';

    const F = globalThis.CEPFisica;
    const { numeroBR: num, cientifico, comprimentoLegivel, potenciaLegivel, duracaoLegivel, paraKelvin } = F;
    const raiz = document.documentElement;
    const porId = (id) => document.getElementById(id);
    const todos = (seletor, base = document) => Array.from(base.querySelectorAll(seletor));
    const valor = (id) => Number(porId(id).value);

    /* Executa cada recurso isoladamente: um problema em um não derruba os outros. */
    function iniciar(funcao) {
        try { funcao(); } catch (erro) { console.error(`Falha ao iniciar ${funcao.name}:`, erro); }
    }

    /* ---------- Preferências de leitura ---------- */
    const CHAVE_PREFERENCIAS = 'cep-preferencias';
    const PADRAO_PREFERENCIAS = { tamanho: '100', linhas: 'normal', letras: 'normal', contraste: '', dislexia: '', movimento: '' };
    let preferencias = Object.assign({}, PADRAO_PREFERENCIAS);
    const movimentoSistema = window.matchMedia('(prefers-reduced-motion: reduce)');
    const movimentoPermitido = () => !movimentoSistema.matches && preferencias.movimento !== 'reduzido';

    function lerPreferencias() {
        try { Object.assign(preferencias, JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS) || '{}')); }
        catch (erro) { /* navegador sem armazenamento: vale o padrão */ }
    }

    function salvarPreferencias() {
        const diferentes = {};
        Object.keys(PADRAO_PREFERENCIAS).forEach((chave) => {
            if (preferencias[chave] !== PADRAO_PREFERENCIAS[chave]) diferentes[chave] = preferencias[chave];
        });
        try { localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(diferentes)); }
        catch (erro) { /* a preferência vale apenas nesta visita */ }
    }

    function aplicarPreferencias() {
        Object.keys(PADRAO_PREFERENCIAS).forEach((chave) => {
            const atributo = `data-${chave}`;
            if (preferencias[chave] !== PADRAO_PREFERENCIAS[chave]) raiz.setAttribute(atributo, preferencias[chave]);
            else raiz.removeAttribute(atributo);
        });
        todos('[data-preferencia-grupo] input').forEach((campo) => {
            campo.checked = preferencias[campo.name.replace('pref-', '')] === campo.value;
        });
        todos('[data-preferencia]').forEach((botao) => {
            botao.setAttribute('aria-pressed', String(preferencias[botao.dataset.preferencia] === botao.dataset.valor));
        });
        lerTema();
        document.dispatchEvent(new CustomEvent('cep:preferencias'));
    }

    function anunciarGlobal(texto) {
        const area = porId('anuncioGlobal');
        if (!area) return;
        area.textContent = '';
        window.setTimeout(() => { area.textContent = texto; }, 60);
    }

    function iniciarPreferencias() {
        lerPreferencias();
        aplicarPreferencias();
        const NOMES_OPCAO = { normal: 'normal', amplo: 'amplo', maximo: 'máximo' };

        todos('[data-preferencia-grupo] input').forEach((campo) => {
            campo.addEventListener('change', () => {
                const chave = campo.name.replace('pref-', '');
                preferencias[chave] = campo.value;
                aplicarPreferencias();
                salvarPreferencias();
                const rotulo = campo.closest('fieldset').querySelector('legend').textContent;
                anunciarGlobal(`${rotulo}: ${chave === 'tamanho' ? `${campo.value}%` : NOMES_OPCAO[campo.value]}.`);
            });
        });
        todos('[data-preferencia]').forEach((botao) => {
            botao.addEventListener('click', () => {
                const chave = botao.dataset.preferencia;
                const ligar = preferencias[chave] !== botao.dataset.valor;
                preferencias[chave] = ligar ? botao.dataset.valor : '';
                aplicarPreferencias();
                salvarPreferencias();
                anunciarGlobal(`${botao.dataset.nome}: ${ligar ? 'ligado' : 'desligado'}.`);
            });
        });
        const restaurar = porId('restaurarPreferencias');
        if (restaurar) {
            restaurar.addEventListener('click', () => {
                preferencias = Object.assign({}, PADRAO_PREFERENCIAS);
                aplicarPreferencias();
                salvarPreferencias();
                anunciarGlobal('Ajustes de leitura restaurados para o padrão.');
            });
        }
        const vlibras = porId('abrirVlibras');
        if (vlibras) {
            vlibras.addEventListener('click', () => {
                const botao = window.VLibrasWidget && window.VLibrasWidget.initBtn;
                if (botao) { botao.click(); botao.focus(); }
                else anunciarGlobal('O VLibras ainda não carregou. Verifique a conexão e tente de novo.');
            });
        }
        movimentoSistema.addEventListener('change', () => document.dispatchEvent(new CustomEvent('cep:preferencias')));
    }

    /* ---------- Cabeçalho, menu e painel ---------- */
    function iniciarCabecalho() {
        const cabecalho = document.querySelector('.cabecalho');
        const botaoMenu = porId('botaoMenu');
        const botaoPainel = porId('botaoAcessibilidade');
        const painel = porId('painelAcessibilidade');
        if (!cabecalho || !botaoMenu || !botaoPainel || !painel) return;

        const menuAberto = () => cabecalho.dataset.menu === 'aberto';
        function definirMenu(aberto, devolverFoco = false) {
            cabecalho.dataset.menu = aberto ? 'aberto' : 'fechado';
            botaoMenu.setAttribute('aria-expanded', String(aberto));
            botaoMenu.textContent = aberto ? 'Fechar menu' : 'Menu';
            if (devolverFoco) botaoMenu.focus();
        }
        function definirPainel(aberto, devolverFoco = false) {
            painel.hidden = !aberto;
            botaoPainel.setAttribute('aria-expanded', String(aberto));
            if (devolverFoco) botaoPainel.focus();
        }

        botaoMenu.addEventListener('click', () => { definirPainel(false); definirMenu(!menuAberto()); });
        botaoPainel.addEventListener('click', () => { definirMenu(false); definirPainel(painel.hidden); });
        todos('.menu a').forEach((link) => link.addEventListener('click', () => definirMenu(false)));

        document.addEventListener('keydown', (evento) => {
            if (evento.key !== 'Escape') return;
            if (!painel.hidden) definirPainel(false, true);
            else if (menuAberto()) definirMenu(false, true);
        });
        document.addEventListener('click', (evento) => {
            if (!painel.hidden && !evento.target.closest('.acessibilidade')) definirPainel(false);
            if (menuAberto() && !evento.target.closest('.cabecalho')) definirMenu(false);
        });
        painel.addEventListener('focusout', (evento) => {
            const destino = evento.relatedTarget;
            if (destino && !destino.closest('.acessibilidade')) definirPainel(false);
        });
    }

    function iniciarProgresso() {
        const barra = porId('barraProgresso');
        if (!barra) return;
        let pendente = false;
        const atualizar = () => {
            pendente = false;
            const total = raiz.scrollHeight - raiz.clientHeight;
            barra.style.transform = `scaleX(${total > 0 ? F.limitar(raiz.scrollTop / total, 0, 1) : 0})`;
        };
        window.addEventListener('scroll', () => {
            if (!pendente) { pendente = true; requestAnimationFrame(atualizar); }
        }, { passive: true });
        atualizar();
    }

    /* Na página inicial, indica no menu a seção que está sendo lida. */
    function iniciarSecaoAtual() {
        if (document.body.dataset.pagina !== 'inicio') return;
        const links = new Map(todos('.menu a[href^="index.html#"]').map((a) => [a.hash.slice(1), a]));
        const secoes = todos('main section[id]').filter((secao) => links.has(secao.id) || secao.id === 'inicio');
        if (!secoes.length) return;
        const observador = new IntersectionObserver((entradas) => {
            entradas.forEach((entrada) => {
                if (!entrada.isIntersecting) return;
                links.forEach((link) => link.removeAttribute('aria-current'));
                const atual = links.get(entrada.target.id);
                if (atual) atual.setAttribute('aria-current', 'location');
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        secoes.forEach((secao) => observador.observe(secao));
    }

    /* Links antigos, de quando tudo ficava em uma página só. */
    function iniciarAncorasAntigas() {
        if (document.body.dataset.pagina !== 'inicio') return;
        const destinos = {
            '#radiacao': 'corpo-negro.html',
            '#piscina': 'piscina-cep.html',
            '#simuladores': 'piscina-cep.html#simulador-termico'
        };
        const conferir = () => { if (destinos[location.hash]) location.replace(destinos[location.hash]); };
        window.addEventListener('hashchange', conferir);
        conferir();
    }

    /* ---------- Tema dos gráficos: lido do CSS para acompanhar o alto contraste ---------- */
    let tema = {};
    function lerTema() {
        const estilo = getComputedStyle(raiz);
        const ler = (nome) => estilo.getPropertyValue(nome).trim();
        tema = {
            fundo: ler('--grafico-fundo'), grade: ler('--grafico-grade'), eixo: ler('--grafico-eixo'),
            texto: ler('--grafico-texto'), sol: ler('--serie-sol'), agua: ler('--serie-agua'),
            destaque: ler('--serie-destaque'), apoio: ler('--serie-apoio'), ceu: ler('--cena-ceu'),
            aguaCena: ler('--cena-agua'), aguaClara: ler('--cena-agua-clara'), solCena: ler('--cena-sol'),
            solClaro: ler('--cena-sol-claro'), traco: ler('--cena-traco'),
            familia: ler('--fonte-texto') || 'sans-serif', rem: parseFloat(estilo.fontSize) || 16,
            altoContraste: raiz.getAttribute('data-contraste') === 'alto'
        };
    }

    /* ---------- Canvas: cada um é configurado uma única vez ---------- */
    const telas = new Map();

    function prepararCanvas(canvas, desenhar) {
        if (telas.has(canvas)) {
            const existente = telas.get(canvas);
            existente.desenhar = desenhar;
            return existente;
        }
        const tela = { canvas, ctx: canvas.getContext('2d'), desenhar, largura: 0, altura: 0, cursorX: null };
        telas.set(canvas, tela);
        const ajustar = () => {
            const caixa = canvas.getBoundingClientRect();
            if (!caixa.width || !caixa.height) return;
            const escala = Math.min(window.devicePixelRatio || 1, 2);
            const largura = Math.round(caixa.width * escala);
            const altura = Math.round(caixa.height * escala);
            if (largura === canvas.width && altura === canvas.height && tela.largura) return;
            canvas.width = largura;
            canvas.height = altura;
            tela.ctx.setTransform(escala, 0, 0, escala, 0, 0);
            tela.largura = caixa.width;
            tela.altura = caixa.height;
            tela.desenhar(tela);
        };
        new ResizeObserver(() => requestAnimationFrame(ajustar)).observe(canvas);
        ajustar();
        return tela;
    }

    const redesenhar = (tela) => { if (tela && tela.largura) tela.desenhar(tela); };

    function seguirCursor(tela) {
        tela.canvas.addEventListener('pointermove', (evento) => {
            tela.cursorX = evento.clientX - tela.canvas.getBoundingClientRect().left;
            redesenhar(tela);
        });
        tela.canvas.addEventListener('pointerleave', () => { tela.cursorX = null; redesenhar(tela); });
    }

    /* Animações: pausam fora da tela, em aba oculta, por botão e com movimento reduzido. */
    function criarAnimacao(tela, quadro, botao) {
        let escolha = null; // null segue a preferência; 'pausar' ou 'reproduzir' é decisão de quem lê
        let visivel = false, rodando = false, pedido = 0, anterior = 0, tempo = 0, acumulado = 0;
        const QUADRO = 1 / 30;

        const deveRodar = () => visivel && !document.hidden &&
            (escolha === 'reproduzir' || (escolha === null && movimentoPermitido()));
        const querRodar = () => escolha === 'reproduzir' || (escolha === null && movimentoPermitido());

        function laco(agora) {
            if (!rodando) return;
            const passo = Math.min(0.1, (agora - anterior) / 1000);
            anterior = agora;
            acumulado += passo;
            if (acumulado >= QUADRO) {
                tempo += acumulado;
                quadro(tela, tempo, acumulado);
                acumulado = 0;
            }
            pedido = requestAnimationFrame(laco);
        }
        function atualizar() {
            const rodar = deveRodar();
            if (rodar && !rodando) {
                rodando = true;
                anterior = performance.now();
                pedido = requestAnimationFrame(laco);
            } else if (!rodar && rodando) {
                rodando = false;
                cancelAnimationFrame(pedido);
            }
            if (botao) botao.textContent = querRodar() ? 'Pausar animação' : 'Reproduzir animação';
            if (!rodando) quadro(tela, tempo, 0);
        }

        tela.desenhar = () => quadro(tela, tempo, 0);
        if (botao) {
            botao.addEventListener('click', () => {
                escolha = querRodar() ? 'pausar' : 'reproduzir';
                atualizar();
            });
        }
        new IntersectionObserver((entradas) => {
            visivel = entradas[entradas.length - 1].isIntersecting;
            atualizar();
        }, { threshold: 0.05 }).observe(tela.canvas);
        document.addEventListener('visibilitychange', atualizar);
        document.addEventListener('cep:preferencias', atualizar);
        atualizar();
        return { redesenhar: () => { if (!rodando) quadro(tela, tempo, 0); }, rodando: () => rodando };
    }

    /* ---------- Ajudas para desenhar ---------- */
    function escreverCanvas(ctx, texto, x, y, opcoes = {}) {
        const { cor = tema.texto, tamanho = 0.8125, peso = 400, alinhar = 'left', base = 'alphabetic', fundo = null, max } = opcoes;
        ctx.font = `${peso} ${Math.round(tamanho * tema.rem)}px ${tema.familia}`;
        ctx.textAlign = alinhar;
        ctx.textBaseline = base;
        if (fundo) {
            const largura = Math.min(ctx.measureText(texto).width, max || Infinity);
            const altura = tamanho * tema.rem * 1.25;
            const inicio = alinhar === 'right' ? x - largura : alinhar === 'center' ? x - largura / 2 : x;
            ctx.fillStyle = fundo;
            ctx.fillRect(inicio - 3, y - altura * 0.85, largura + 6, altura);
        }
        ctx.fillStyle = cor;
        if (max) ctx.fillText(texto, x, y, max); else ctx.fillText(texto, x, y);
    }

    function legendaCanvas(ctx, itens, xDireita, y) {
        let x = xDireita;
        [...itens].reverse().forEach((item) => {
            ctx.font = `400 ${Math.round(0.8125 * tema.rem)}px ${tema.familia}`;
            x -= ctx.measureText(item.rotulo).width;
            escreverCanvas(ctx, item.rotulo, x, y, { fundo: tema.fundo });
            x -= tema.rem * 1.6;
            linha(ctx, x, y - tema.rem * 0.25, x + tema.rem * 1.25, y - tema.rem * 0.25, item.cor, 2.5, item.tracos || []);
            x -= tema.rem * 0.9;
        });
    }

    /* Título e legenda no alto do gráfico; devolve onde a área de desenho pode começar. */
    function cabecalhoGrafico(ctx, largura, titulo, itens = []) {
        const rem = tema.rem, y = rem * 1.1;
        ctx.font = `400 ${Math.round(0.8125 * rem)}px ${tema.familia}`;
        const larguraTitulo = ctx.measureText(titulo).width;
        const larguraLegenda = itens.reduce((soma, item) => soma + ctx.measureText(item.rotulo).width + rem * 2.5, 0);
        const cabe = !itens.length || rem + larguraTitulo + larguraLegenda + rem <= largura;
        escreverCanvas(ctx, titulo, rem * 0.5, y, { max: largura - rem });
        if (itens.length) legendaCanvas(ctx, itens, largura - rem * 0.5, cabe ? y : y + rem * 1.3);
        return cabe ? rem * 2 : rem * 3.3;
    }

    const escalaLinear = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
    function escalaLog(d0, d1, r0, r1) {
        const a = Math.log10(d0), b = Math.log10(d1);
        return (v) => r0 + ((Math.log10(v) - a) / (b - a)) * (r1 - r0);
    }
    const SOBRESCRITO = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
    const potenciaDeDez = (e) => `10${String(e).split('').map((c) => SOBRESCRITO[c]).join('')}`;

    function linha(ctx, x0, y0, x1, y1, cor, largura = 1, tracos = []) {
        ctx.save();
        ctx.strokeStyle = cor;
        ctx.lineWidth = largura;
        ctx.setLineDash(tracos);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.restore();
    }

    function limparTela(tela, cor = tema.fundo) {
        tela.ctx.fillStyle = cor;
        tela.ctx.fillRect(0, 0, tela.largura, tela.altura);
    }

    /* Curva y = f(x) com x em escala log; interrompe onde não há valor visível. */
    function tracarCurva(ctx, area, escalaX, escalaY, xMin, xMax, funcao, cor, largura = 2, tracos = []) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(area.x, area.y, area.l, area.a);
        ctx.clip();
        ctx.strokeStyle = cor;
        ctx.lineWidth = largura;
        ctx.lineJoin = 'round';
        ctx.setLineDash(tracos);
        ctx.beginPath();
        let aberto = false;
        const passos = 320;
        for (let i = 0; i <= passos; i++) {
            const x = xMin * Math.pow(xMax / xMin, i / passos);
            const y = funcao(x);
            if (!(y > 0) || !Number.isFinite(y)) { aberto = false; continue; }
            const px = escalaX(x), py = escalaY(y);
            if (aberto) ctx.lineTo(px, py); else ctx.moveTo(px, py);
            aberto = true;
        }
        ctx.stroke();
        ctx.restore();
    }

    function marcador(ctx, x, y, cor, raio = 5) {
        ctx.fillStyle = tema.fundo;
        ctx.beginPath(); ctx.arc(x, y, raio + 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = cor;
        ctx.beginPath(); ctx.arc(x, y, raio, 0, Math.PI * 2); ctx.fill();
    }

    /* ---------- Ajudas para formulários dos simuladores ---------- */
    function saida(idCampo, texto) {
        const campo = porId(idCampo);
        const destino = porId(`${idCampo}Saida`);
        if (destino) destino.textContent = texto;
        if (campo && campo.type === 'range') campo.setAttribute('aria-valuetext', texto);
    }

    const definirTexto = (id, texto) => { const alvo = porId(id); if (alvo) alvo.textContent = texto; };

    /* Texto anunciado sem interromper a leitura enquanto o controle é arrastado. */
    const esperas = new WeakMap();
    function anunciar(elemento, texto) {
        if (!elemento) return;
        clearTimeout(esperas.get(elemento));
        esperas.set(elemento, setTimeout(() => {
            if (elemento.textContent !== texto) elemento.textContent = texto;
        }, 450));
    }

    function ligarFormulario(formulario, atualizar) {
        formulario.addEventListener('submit', (evento) => evento.preventDefault());
        formulario.addEventListener('input', atualizar);
        formulario.addEventListener('change', atualizar);
        formulario.addEventListener('reset', () => setTimeout(atualizar, 0));
        document.addEventListener('cep:preferencias', atualizar);
    }

    /* Barras de comparação feitas em HTML: o valor sempre aparece em texto. */
    function desenharBarras(alvo, grupos) {
        const maximo = Math.max(1e-9, ...grupos.flatMap((g) => g.linhas.map((l) => Math.abs(l.valor))));
        const fragmento = document.createDocumentFragment();
        grupos.forEach((grupo) => {
            const bloco = document.createElement('div');
            bloco.className = 'barras__grupo';
            if (grupo.titulo) {
                const titulo = document.createElement('p');
                titulo.className = 'barras__titulo';
                titulo.textContent = grupo.titulo;
                bloco.append(titulo);
            }
            grupo.linhas.forEach((item) => {
                const barra = document.createElement('div');
                barra.className = 'barra';
                if (item.tom) barra.dataset.tom = item.tom;
                const rotulo = document.createElement('span');
                rotulo.textContent = item.rotulo;
                const quantia = document.createElement('span');
                quantia.className = 'barra__valor';
                quantia.textContent = item.texto;
                const trilho = document.createElement('span');
                trilho.className = 'barra__trilho';
                const cheio = document.createElement('span');
                cheio.className = 'barra__preenchido';
                cheio.style.width = `${Math.max(0, (Math.abs(item.valor) / maximo) * 100)}%`;
                trilho.append(cheio);
                barra.append(rotulo, quantia, trilho);
                bloco.append(barra);
            });
            fragmento.append(bloco);
        });
        alvo.replaceChildren(fragmento);
    }

    /* ---------- Cenas das capas ---------- */
    function ondaEntre(ctx, x0, y0, x1, y1, comprimento, amplitude, fase, cor, largura = 1.5) {
        const dx = x1 - x0, dy = y1 - y0, total = Math.hypot(dx, dy);
        if (!total) return;
        const ux = dx / total, uy = dy / total;
        ctx.strokeStyle = cor;
        ctx.lineWidth = largura;
        ctx.beginPath();
        for (let s = 0; s <= total; s += Math.max(1, comprimento / 12)) {
            const d = Math.sin((s / comprimento) * Math.PI * 2 - fase) * amplitude;
            const x = x0 + ux * s - uy * d, y = y0 + uy * s + ux * d;
            if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    function superficieAgua(ctx, largura, altura, nivel, t, cor, corLinha) {
        ctx.fillStyle = cor;
        ctx.beginPath();
        ctx.moveTo(0, altura);
        for (let x = 0; x <= largura; x += 8) ctx.lineTo(x, nivel + Math.sin(x / 46 + t * 1.2) * 3);
        ctx.lineTo(largura, altura);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = corLinha;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= largura; x += 8) {
            const y = nivel + Math.sin(x / 46 + t * 1.2) * 3;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    /* A onda que desce é curta e a que sobe é longa: a razão entre elas está em escala. */
    function cenaInicio(tela, t) {
        const { ctx, largura: w, altura: h } = tela;
        limparTela(tela, tema.ceu);
        const raio = Math.min(w * 0.13, h * 0.24);
        const solX = w - Math.max(raio * 1.4, w * 0.14), solY = raio * 1.15;
        const nivel = h * 0.72;
        ctx.fillStyle = tema.solCena;
        ctx.beginPath(); ctx.arc(solX, solY, raio, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = tema.solClaro;
        ctx.beginPath(); ctx.arc(solX, solY, raio * 0.62, 0, Math.PI * 2); ctx.fill();

        const curta = 9, longa = curta * (F.picoWien(paraKelvin(28)) / F.picoWien(5772));
        const quantidade = Math.max(3, Math.round(w / 220));
        for (let i = 0; i < quantidade; i++) {
            const destino = w * (0.36 + (0.6 * i) / Math.max(1, quantidade - 1));
            const angulo = Math.atan2(nivel - solY, destino - solX);
            ondaEntre(ctx, solX + Math.cos(angulo) * raio * 1.08, solY + Math.sin(angulo) * raio * 1.08, destino, nivel, curta, 2.5, t * 7, tema.solClaro, 1.4);
        }
        const emissores = Math.max(2, Math.round(w / 300));
        for (let i = 0; i < emissores; i++) {
            const x = w * (0.08 + (0.42 * i) / Math.max(1, emissores - 1 || 1));
            ondaEntre(ctx, x, nivel, x + 18, h * 0.08, longa, 9, t * 2.2 + i, tema.aguaClara, 2);
        }
        superficieAgua(ctx, w, h, nivel, t, tema.aguaCena, tema.aguaClara);
    }

    function corDaTemperatura(T) {
        const canais = [610e-9, 550e-9, 465e-9].map((l) => F.planck(l, T));
        const maior = Math.max(...canais);
        return `rgb(${canais.map((c) => Math.round(255 * Math.pow(c / maior, 0.45))).join(',')})`;
    }

    function cenaCorpoNegro(tela, t) {
        const { ctx, largura: w, altura: h } = tela;
        limparTela(tela, tema.ceu);
        const T = 3400 + 2372 * Math.cos(t * 0.35);
        const reserva = tema.rem * 4.2; // espaço do botão de pausa
        const lado = Math.min(h - reserva - tema.rem, w * 0.42);
        const x = Math.max(tema.rem, w * 0.07), y = tema.rem * 0.75;
        ctx.fillStyle = tema.fundo;
        ctx.fillRect(x, y, lado, lado);
        ctx.strokeStyle = tema.traco;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, lado, lado);
        const furo = lado * 0.18, furoY = y + lado * 0.41;
        ctx.fillStyle = tema.altoContraste ? tema.traco : corDaTemperatura(T);
        ctx.fillRect(x + lado - 3, furoY, 6, furo);
        if (!tema.altoContraste) {
            ctx.globalAlpha = 0.2 + 0.65 * F.limitar((T - 1000) / 5000, 0, 1);
            ctx.fillRect(x + 2, y + 2, lado - 4, lado - 4);
            ctx.globalAlpha = 1;
        }

        const area = { x: x + lado + w * 0.05, y: tema.rem * 2.4, l: w - (x + lado + w * 0.05) - Math.max(tema.rem, w * 0.05), a: h - tema.rem * 3.4 };
        const ex = escalaLog(0.1, 5, area.x, area.x + area.l);
        const pico = F.exitanciaEspectral(F.picoWien(5772), 5772);
        const ey = escalaLinear(0, pico * 1.05, area.y + area.a, area.y);
        linha(ctx, area.x, area.y + area.a, area.x + area.l, area.y + area.a, tema.eixo);
        tracarCurva(ctx, area, ex, ey, 0.1, 5, (l) => F.exitanciaEspectral(l * 1e-6, T), tema.solClaro, 3);
        escreverCanvas(ctx, `${num(T, 0)} K`, area.x, tema.rem * 1.7, { cor: tema.traco, tamanho: 1.25, peso: 700 });
    }

    function cenaPiscina(tela, t) {
        const { ctx, largura: w, altura: h } = tela;
        limparTela(tela, tema.ceu);
        const nivel = h * 0.42;
        const fundoRaso = nivel + (h - nivel) * 0.36, fundoFundo = h - tema.rem * 0.5;
        ctx.fillStyle = tema.solCena;
        ctx.beginPath(); ctx.arc(w * 0.12, h * 0.17, Math.min(w * 0.06, h * 0.12), 0, Math.PI * 2); ctx.fill();
        superficieAgua(ctx, w, h, nivel, t, tema.aguaCena, tema.aguaClara);
        ctx.fillStyle = tema.fundo;
        ctx.beginPath();
        ctx.moveTo(0, h); ctx.lineTo(0, fundoRaso); ctx.lineTo(w / 3, fundoRaso);
        ctx.lineTo((2 * w) / 3, fundoFundo); ctx.lineTo(w, fundoFundo); ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
        if (tema.altoContraste) { ctx.strokeStyle = tema.traco; ctx.lineWidth = 2; ctx.stroke(); }
        const colunas = Math.max(4, Math.round(w / 150));
        for (let i = 0; i < colunas; i++) {
            const x = w * (0.26 + (0.7 * i) / colunas);
            const ciclo = (t * 0.35 + i * 0.37) % 1;
            const base = nivel - 6 - ciclo * nivel * 0.55;
            ondaEntre(ctx, x, base, x, base - tema.rem * 1.6, tema.rem * 0.8, 2.5, t * 3, tema.traco, 1.5);
        }
        ondaEntre(ctx, w * 0.34, nivel, w * 0.36, 8, 160, 9, t * 2.2, tema.aguaClara, 2);
        ondaEntre(ctx, w * 0.78, nivel, w * 0.76, 8, 160, 9, t * 2.2 + 1, tema.aguaClara, 2);
    }

    function iniciarCena() {
        const canvas = porId('cenaCapa');
        if (!canvas) return;
        const cenas = { inicio: cenaInicio, 'corpo-negro': cenaCorpoNegro, piscina: cenaPiscina };
        const cena = cenas[canvas.dataset.cena] || cenaInicio;
        const tela = prepararCanvas(canvas, () => {});
        criarAnimacao(tela, (alvo, tempo) => { if (alvo.largura) cena(alvo, tempo); }, porId('pausarCena'));
    }

    /* ---------- Espectro eletromagnético ---------- */
    const REGIOES = [
        { id: 'gama', nome: 'Raios gama', ate: 1e-11, centro: -11.5, texto: 'radiação de altíssima energia, ligada a processos nucleares. Não fazem parte da radiação solar que chega à superfície.' },
        { id: 'raio-x', nome: 'Raios X', ate: 1e-8, centro: -9.5, texto: 'alta energia, usados em medicina. Não são relevantes para o balanço térmico da piscina.' },
        { id: 'uv', nome: 'Ultravioleta', ate: 4e-7, centro: -7, texto: 'alta energia por fóton. Pode degradar materiais da piscina, como plásticos, e consumir o cloro. A camada de ozônio filtra a maior parte.' },
        { id: 'vis', nome: 'Visível', ate: 7e-7, centro: -6.26, texto: 'de cerca de 400 nm a 700 nm, a faixa que enxergamos. É onde fica o pico de emissão do Sol. Os coletores solares absorvem fortemente esta faixa e a convertem em calor.' },
        { id: 'ir', nome: 'Infravermelho', ate: 1e-3, centro: -5, texto: 'de 700 nm a 1 mm. Parte da energia solar chega nesta faixa, e é nela que corpos à temperatura ambiente mais emitem. É por ela que a piscina perde calor por radiação.' },
        { id: 'micro', nome: 'Micro-ondas', ate: 1, centro: -1.5, texto: 'de cerca de 1 mm a 1 m. Usadas em radares, comunicação e fornos. No forno, o campo faz moléculas polares, como as de água, girarem e dissiparem energia. Não são o mecanismo do aquecimento solar.' },
        { id: 'radio', nome: 'Rádio', ate: Infinity, centro: 1, texto: 'os maiores comprimentos de onda, de cerca de 1 m a quilômetros. Usadas em comunicação. Não aquecem a piscina de forma relevante.' }
    ];
    const regiaoDe = (comprimento) => REGIOES.find((r) => comprimento < r.ate);

    function iniciarEspectro() {
        const formulario = porId('simEspectro');
        if (!formulario) return;
        const controle = porId('espectroComprimento');
        const botoes = todos('[data-regiao]', formulario);
        const COR_VISIVEL = ['#8B5CF6', '#3B82F6', '#22C55E', '#FACC15', '#F97316', '#EF4444'];

        function quadro(tela, tempo) {
            if (!tela.largura) return;
            const { ctx, largura: w, altura: h } = tela;
            limparTela(tela);
            const expoente = Number(controle.value);
            const margem = tema.rem;
            const faixaY = tema.rem * 1.7, faixaA = tema.rem * 1.25;
            const ex = escalaLinear(-12, 3, margem, w - margem);
            let inicio = -12;
            REGIOES.forEach((r, i) => {
                const fim = r.ate === Infinity ? 3 : Math.log10(r.ate);
                const x0 = ex(inicio), x1 = ex(fim);
                ctx.fillStyle = i % 2 ? tema.grade : tema.eixo;
                ctx.globalAlpha = i % 2 ? 1 : 0.35;
                ctx.fillRect(x0, faixaY, x1 - x0, faixaA);
                ctx.globalAlpha = 1;
                if (r.id === 'vis') {
                    COR_VISIVEL.forEach((c, k) => {
                        ctx.fillStyle = tema.altoContraste ? tema.traco : c;
                        ctx.fillRect(x0 + (k * (x1 - x0)) / 6, faixaY, (x1 - x0) / 6 + 0.5, faixaA);
                    });
                }
                inicio = fim;
            });
            escreverCanvas(ctx, 'ondas curtas, mais energia', margem, faixaY - tema.rem * 0.4);
            escreverCanvas(ctx, 'ondas longas, menos energia', w - margem, faixaY - tema.rem * 0.4, { alinhar: 'right' });
            const xAtual = ex(expoente);
            linha(ctx, xAtual, faixaY - 3, xAtual, faixaY + faixaA + 3, tema.solClaro, 3);

            const centro = faixaY + faixaA + (h - faixaY - faixaA) / 2;
            const amplitude = Math.min((h - faixaY - faixaA) * 0.3, tema.rem * 4);
            const comprimento = 26 + ((expoente + 12) / 15) * Math.min(w * 0.42, 240);
            const fase = tempo * 3.2;
            linha(ctx, margem, centro, w - margem, centro, tema.eixo, 1);
            const onda = (dx, dy, cor, tracos) => {
                ctx.strokeStyle = cor;
                ctx.lineWidth = 2.5;
                ctx.setLineDash(tracos);
                ctx.beginPath();
                for (let x = margem; x <= w - margem; x += 2) {
                    const s = Math.sin(((x - margem) / comprimento) * Math.PI * 2 - fase);
                    const px = x + s * dx * amplitude, py = centro - s * dy * amplitude;
                    if (x === margem) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.stroke();
                ctx.setLineDash([]);
            };
            onda(0.34, 0.26, tema.destaque, [7, 5]);
            onda(0, 1, tema.agua, []);
            escreverCanvas(ctx, 'campo elétrico E', margem, centro - amplitude - tema.rem * 0.35, { peso: 600, fundo: tema.fundo });
            escreverCanvas(ctx, 'campo magnético B (tracejado)', w - margem, h - tema.rem * 0.6, { alinhar: 'right', peso: 600, fundo: tema.fundo });
        }

        const tela = prepararCanvas(porId('graficoOnda'), () => {});
        const animacao = criarAnimacao(tela, quadro, porId('pausarOnda'));

        function atualizar() {
            const comprimento = Math.pow(10, Number(controle.value));
            const regiao = regiaoDe(comprimento);
            const frequencia = F.frequenciaDaOnda(comprimento);
            const energia = F.energiaFoton(frequencia);
            saida('espectroComprimento', comprimentoLegivel(comprimento));
            definirTexto('espectroFrequencia', `${cientifico(frequencia)} Hz`);
            definirTexto('espectroEnergia', `${cientifico(energia)} eV`);
            definirTexto('espectroRegiao', regiao.nome);
            definirTexto('espectroInfoTitulo', `${regiao.nome}: `);
            definirTexto('espectroInfoTexto', regiao.texto);
            botoes.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.regiao === regiao.id)));
            anunciar(porId('espectroResumo'), `${regiao.nome}. Comprimento de onda de ${comprimentoLegivel(comprimento)}, frequência de ${cientifico(frequencia)} hertz e fóton de ${cientifico(energia)} elétron-volts.`);
            animacao.redesenhar();
        }

        botoes.forEach((botao) => botao.addEventListener('click', () => {
            controle.value = REGIOES.find((r) => r.id === botao.dataset.regiao).centro;
            atualizar();
        }));
        ligarFormulario(formulario, atualizar);
        atualizar();
    }

    /* ---------- Efeito fotoelétrico ---------- */
    function iniciarFotoeletrico() {
        const formulario = porId('simFotoeletrico');
        if (!formulario) return;
        let fotons = [], eletrons = [], acumulador = 0;
        const ler = () => ({ f: valor('feFrequencia') * 1e14, intensidade: valor('feIntensidade'), phi: valor('feMaterial') });

        const posicoes = (tela) => {
            const { largura: w, altura: h } = tela;
            return { placaX: w * 0.2, coletorX: w * 0.86, topo: h * 0.2, base: h * 0.86, lampadaX: w * 0.06, lampadaY: h * 0.08 };
        };
        function corFoton(f) {
            const l = (F.CONSTANTES.c / f) * 1e9;
            if (tema.altoContraste) return tema.traco;
            if (l < 400) return '#C4B5FD';
            if (l < 490) return '#60A5FA';
            if (l < 570) return '#4ADE80';
            if (l < 590) return '#FDE047';
            if (l < 630) return '#FB923C';
            return '#F87171';
        }
        function novoFoton(p, progresso = 0) {
            const alvo = p.topo + Math.random() * (p.base - p.topo);
            return { x0: p.lampadaX, y0: p.lampadaY, x1: p.placaX, y1: alvo, s: progresso };
        }
        function novoEletron(p, y, progresso = 0) {
            return { y, s: progresso, fator: 0.35 + Math.random() * 0.65, deriva: (Math.random() - 0.5) * 22, x: p.placaX, xf: p.coletorX };
        }
        function semear(tela) {
            const p = posicoes(tela), { f, intensidade, phi } = ler();
            const qtd = Math.round(intensidade / 5);
            fotons = Array.from({ length: qtd }, () => novoFoton(p, Math.random()));
            eletrons = F.haEmissao(f, phi) ? Array.from({ length: Math.round(qtd * 0.7) }, () => novoEletron(p, p.topo + Math.random() * (p.base - p.topo), Math.random())) : [];
        }

        function quadro(tela, tempo, passo) {
            if (!tela.largura) return;
            const { ctx, largura: w } = tela;
            const p = posicoes(tela), { f, intensidade, phi } = ler();
            const emite = F.haEmissao(f, phi);
            const kmax = F.energiaCineticaMaxima(f, phi);
            limparTela(tela);

            if (passo > 0) {
                acumulador += (intensidade / 100) * 26 * passo;
                while (acumulador >= 1) { acumulador -= 1; fotons.push(novoFoton(p)); }
                fotons = fotons.filter((foton) => {
                    foton.s += passo * 1.7;
                    if (foton.s < 1) return true;
                    if (emite) eletrons.push(novoEletron(p, foton.y1));
                    return false;
                });
                const rapidez = 0.25 + Math.sqrt(kmax) * 0.55;
                eletrons = eletrons.filter((e) => { e.s += passo * rapidez * e.fator; return e.s < 1; });
            } else if (!fotons.length && intensidade > 0) {
                semear(tela);
            }

            ctx.fillStyle = tema.grade;
            ctx.fillRect(p.placaX - w * 0.035, p.topo, w * 0.035, p.base - p.topo);
            ctx.fillRect(p.coletorX, p.topo, w * 0.03, p.base - p.topo);
            if (tema.altoContraste) { linha(ctx, p.placaX, p.topo, p.placaX, p.base, tema.traco, 2); linha(ctx, p.coletorX, p.topo, p.coletorX, p.base, tema.traco, 2); }
            escreverCanvas(ctx, 'placa metálica', p.placaX - w * 0.035, p.base + tema.rem * 1.1);
            escreverCanvas(ctx, 'coletor', p.coletorX + w * 0.03, p.base + tema.rem * 1.1, { alinhar: 'right' });

            const cor = corFoton(f);
            ctx.fillStyle = cor;
            fotons.forEach((foton) => {
                const x = foton.x0 + (foton.x1 - foton.x0) * foton.s, y = foton.y0 + (foton.y1 - foton.y0) * foton.s;
                ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
            });
            ctx.fillStyle = tema.agua;
            eletrons.forEach((e) => {
                const x = e.x + (e.xf - e.x) * e.s, y = e.y + e.deriva * Math.sin(e.s * Math.PI);
                ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
            });
            escreverCanvas(ctx, emite ? 'elétrons emitidos' : 'sem emissão: fóton com pouca energia', w / 2 + w * 0.03, p.topo - tema.rem * 0.6, { alinhar: 'center', peso: 600, max: w * 0.6 });
        }

        function desenharKmax(tela) {
            if (!tela.largura) return;
            const { ctx, largura: w, altura: h } = tela;
            const { f, phi } = ler();
            limparTela(tela);
            const rem = tema.rem;
            const area = { x: rem * 2.6, y: rem * 0.9, l: w - rem * 3.6, a: h - rem * 3.6 };
            const ex = escalaLinear(3, 16, area.x, area.x + area.l), ey = escalaLinear(0, 5, area.y + area.a, area.y);
            for (let v = 0; v <= 5; v++) {
                linha(ctx, area.x, ey(v), area.x + area.l, ey(v), v ? tema.grade : tema.eixo);
                escreverCanvas(ctx, num(v), area.x - 6, ey(v) + 4, { alinhar: 'right' });
            }
            for (let v = 4; v <= 16; v += 2) escreverCanvas(ctx, num(v), ex(v), area.y + area.a + rem * 1.1, { alinhar: 'center' });
            escreverCanvas(ctx, 'frequência (× 10¹⁴ Hz)', area.x + area.l, h - rem * 0.5, { alinhar: 'right' });
            escreverCanvas(ctx, 'Kmax (eV)', area.x + 6, area.y + rem * 0.8);
            const corte = F.frequenciaCorte(phi) / 1e14;
            ctx.save();
            ctx.beginPath(); ctx.rect(area.x, area.y, area.l, area.a); ctx.clip();
            linha(ctx, ex(corte), ey(0), ex(16), ey(F.energiaCineticaMaxima(16e14, phi)), tema.agua, 2.5);
            ctx.restore();
            linha(ctx, ex(corte), area.y, ex(corte), area.y + area.a, tema.eixo, 1, [4, 4]);
            escreverCanvas(ctx, `corte: ${num(corte, 2)}`, ex(corte) + (corte > 11 ? -5 : 5), area.y + rem * 2, { alinhar: corte > 11 ? 'right' : 'left' });
            marcador(ctx, ex(f / 1e14), ey(F.energiaCineticaMaxima(f, phi)), tema.destaque);
        }

        const tela = prepararCanvas(porId('graficoFotoeletrico'), () => {});
        const animacao = criarAnimacao(tela, quadro, porId('pausarFotoeletrico'));
        const telaK = prepararCanvas(porId('graficoKmax'), desenharKmax);

        function atualizar() {
            const { f, intensidade, phi } = ler();
            const nome = porId('feMaterial').selectedOptions[0].dataset.nome;
            const foton = F.energiaFoton(f), corte = F.frequenciaCorte(phi), emite = F.haEmissao(f, phi);
            const kmax = F.energiaCineticaMaxima(f, phi);
            saida('feFrequencia', `${num(f / 1e14, 1)} × 10¹⁴ Hz`);
            saida('feIntensidade', `${num(intensidade)}%`);
            definirTexto('feFoton', `${num(foton, 2)} eV`);
            definirTexto('feCorte', `${num(corte / 1e14, 2)} × 10¹⁴ Hz`);
            definirTexto('feKmax', emite ? `${num(kmax, 2)} eV` : 'não há');
            definirTexto('feEletrons', !emite || !intensidade ? 'nenhum' : `${num(intensidade)}% do máximo`);
            const frase = emite
                ? `${nome}: há emissão. Cada fóton traz ${num(foton, 2)} eV, gasta ${num(phi, 2)} eV para soltar o elétron e sobram até ${num(kmax, 2)} eV de energia cinética. Mudar a intensidade altera quantos elétrons saem, mas não esse valor.`
                : `${nome}: não há emissão. Cada fóton traz ${num(foton, 2)} eV, menos que os ${num(phi, 2)} eV necessários. Aumentar a intensidade não resolve; é preciso frequência acima de ${num(corte / 1e14, 2)} × 10¹⁴ Hz.`;
            anunciar(porId('feResumo'), frase);
            if (!animacao.rodando()) { fotons = []; eletrons = []; }
            animacao.redesenhar();
            redesenhar(telaK);
        }
        ligarFormulario(formulario, atualizar);
        atualizar();
    }

    /* ---------- Coletor térmico x painel fotovoltaico ---------- */
    function iniciarEnergia() {
        const formulario = porId('simEnergia');
        if (!formulario) return;
        function atualizar() {
            const dados = {
                irradiancia: valor('enSol'), area: valor('enArea'),
                eficienciaColetor: valor('enColetor') / 100, eficienciaPainel: valor('enPainel') / 100, cop: valor('enCop')
            };
            saida('enSol', `${num(dados.irradiancia)} W/m²`);
            saida('enArea', `${num(dados.area)} m²`);
            saida('enColetor', `${num(valor('enColetor'))}%`);
            saida('enPainel', `${num(valor('enPainel'))}%`);
            saida('enCop', num(dados.cop, 1));
            const r = F.compararEnergia(dados);
            desenharBarras(porId('enBarras'), [{ linhas: [
                { rotulo: 'Sol recebido pela área', valor: r.recebida, texto: potenciaLegivel(r.recebida), tom: 'neutro' },
                { rotulo: 'Calor do coletor térmico', valor: r.calorColetor, texto: potenciaLegivel(r.calorColetor), tom: 'sol' },
                { rotulo: 'Eletricidade do painel', valor: r.eletrica, texto: potenciaLegivel(r.eletrica), tom: 'destaque' },
                { rotulo: 'Calor com resistência elétrica', valor: r.calorResistencia, texto: potenciaLegivel(r.calorResistencia), tom: 'destaque' },
                { rotulo: 'Calor com bomba de calor', valor: r.calorBomba, texto: potenciaLegivel(r.calorBomba) }
            ] }]);
            anunciar(porId('enResumo'), `Com ${num(dados.area)} metros quadrados, o coletor entrega ${potenciaLegivel(r.calorColetor)} de calor. O painel gera ${potenciaLegivel(r.eletrica)} de eletricidade, que viram ${potenciaLegivel(r.calorBomba)} de calor em uma bomba de calor com COP ${num(dados.cop, 1)}.`);
        }
        ligarFormulario(formulario, atualizar);
        atualizar();
    }

    /* ---------- Automação da bomba ---------- */
    function iniciarAutomacao() {
        const formulario = porId('simAutomacao');
        if (!formulario) return;
        const NOMES = { desligada: 'Bomba desligada', partida: 'Bomba em partida', ligada: 'Bomba ligada', falha: 'Alarme: bomba bloqueada' };
        const TEMPO_FLUXO = 3;
        let estado = F.novoEstadoAutomacao(), segundos = 0, tempoLigada = 0, historico = [], rearmar = false, acumulado = 0;

        const configuracao = () => ({ ...F.AUTOMACAO_PADRAO, tMeta: valor('auMeta') });

        function registrar(texto) {
            const lista = porId('auRegistro');
            const item = document.createElement('li');
            item.textContent = `${num(segundos)} s: ${texto}`;
            lista.prepend(item);
            while (lista.children.length > 8) lista.lastElementChild.remove();
        }
        function mostrar() {
            const selo = porId('auEstado');
            selo.dataset.estado = estado.modo;
            selo.textContent = NOMES[estado.modo];
            definirTexto('auMotivo', estado.motivo);
            porId('auRearmar').hidden = estado.modo !== 'falha';
        }
        function ler() {
            return {
                tPiscina: valor('auPiscina'), tColetor: valor('auColetor'), irradiancia: valor('auSol'),
                nivelOk: porId('auNivel').checked,
                fluxo: F.bombaLigada(estado) && tempoLigada >= TEMPO_FLUXO && porId('auBomba').checked
            };
        }
        function avancar() {
            const sensores = ler();
            const anterior = estado.modo;
            estado = F.passoAutomacao(estado, { ...sensores, rearmar }, configuracao(), 1);
            rearmar = false;
            segundos += 1;
            tempoLigada = F.bombaLigada(estado) ? tempoLigada + 1 : 0;
            historico.push({ delta: sensores.tColetor - sensores.tPiscina, ligada: F.bombaLigada(estado) });
            if (historico.length > 90) historico.shift();
            if (estado.modo !== anterior) {
                registrar(estado.motivo);
                anunciar(porId('auAnuncio'), `${NOMES[estado.modo]}. ${estado.motivo}`);
            }
            definirTexto('auFluxo', F.bombaLigada(estado) && tempoLigada > TEMPO_FLUXO && porId('auBomba').checked ? 'detectado' : 'sem fluxo');
            mostrar();
        }
        function desenhar(tela) {
            if (!tela.largura) return;
            const { ctx, largura: w, altura: h } = tela;
            const cfg = configuracao(), rem = tema.rem;
            limparTela(tela);
            const area = { x: rem * 2.4, y: rem * 0.8, l: w - rem * 3.2, a: h - rem * 3 };
            const ex = escalaLinear(0, 89, area.x, area.x + area.l), ey = escalaLinear(-5, 25, area.y + area.a, area.y);
            [0, 10, 20].forEach((v) => { linha(ctx, area.x, ey(v), area.x + area.l, ey(v), tema.grade); escreverCanvas(ctx, num(v), area.x - 6, ey(v) + 4, { alinhar: 'right' }); });
            historico.forEach((p, i) => {
                if (!p.ligada) return;
                ctx.fillStyle = tema.grade;
                ctx.fillRect(ex(i + 90 - historico.length - 1), area.y, Math.ceil(area.l / 89) + 1, area.a);
            });
            linha(ctx, area.x, ey(cfg.deltaLiga), area.x + area.l, ey(cfg.deltaLiga), tema.destaque, 1.5, [6, 4]);
            linha(ctx, area.x, ey(cfg.deltaDesliga), area.x + area.l, ey(cfg.deltaDesliga), tema.sol, 1.5, [2, 4]);
            escreverCanvas(ctx, `liga em ${num(cfg.deltaLiga)} °C`, area.x + area.l, ey(cfg.deltaLiga) - 4, { alinhar: 'right', fundo: tema.fundo });
            escreverCanvas(ctx, `desliga em ${num(cfg.deltaDesliga)} °C`, area.x + area.l, ey(cfg.deltaDesliga) + rem, { alinhar: 'right', fundo: tema.fundo });
            ctx.strokeStyle = tema.agua; ctx.lineWidth = 2.5; ctx.beginPath();
            historico.forEach((p, i) => {
                const x = ex(i + 90 - historico.length), y = ey(F.limitar(p.delta, -5, 25));
                if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            });
            ctx.stroke();
            escreverCanvas(ctx, 'diferença coletor − piscina (°C); fundo claro: bomba ligada', area.x, h - rem * 0.5);
        }

        const tela = prepararCanvas(porId('graficoAutomacao'), desenhar);
        const animacao = criarAnimacao(tela, (alvo, tempo, passo) => {
            acumulado += passo;
            while (acumulado >= 0.25) { acumulado -= 0.25; avancar(); }
            desenhar(alvo);
        }, porId('pausarAutomacao'));

        function atualizarRotulos() {
            const pisc = valor('auPiscina'), col = valor('auColetor');
            saida('auPiscina', `${num(pisc, 1)} °C`);
            saida('auColetor', `${num(col, 1)} °C`);
            saida('auSol', `${num(valor('auSol'))} W/m²`);
            definirTexto('auDelta', `${num(col - pisc, 1)} °C`);
            /* Sem sol, o coletor parado fica perto da temperatura do ar. */
            const lembrete = F.lembreteCapa({ irradiancia: valor('auSol'), capaColocada: porId('auCapa').checked, tPiscina: pisc, tAr: col });
            definirTexto('auLembrete', lembrete ? 'Pouco sol e capa fora da água: lembrar de cobrir a piscina.' : 'Sem lembrete no momento.');
            animacao.redesenhar();
        }
        porId('auAvancar').addEventListener('click', () => { for (let i = 0; i < 5; i++) avancar(); animacao.redesenhar(); });
        porId('auRearmar').addEventListener('click', () => { rearmar = true; avancar(); animacao.redesenhar(); });
        formulario.addEventListener('reset', () => {
            estado = F.novoEstadoAutomacao(); segundos = 0; tempoLigada = 0; historico = []; rearmar = false;
            porId('auRegistro').replaceChildren();
            setTimeout(mostrar, 0);
        });
        ligarFormulario(formulario, atualizarRotulos);
        atualizarRotulos();
        mostrar();
        registrar('Simulação iniciada.');
    }

    /* ---------- Gráficos de radiação ---------- */
    const LAMBDA_MIN = 0.1, LAMBDA_MAX = 100; // µm
    const ROTULO_LAMBDA = (l) => num(l, l < 1 ? 1 : 0);

    function eixoComprimento(ctx, area, ex) {
        for (let d = -1; d <= 1; d++) {
            for (let m = 2; m <= 9; m++) {
                const x = ex(m * Math.pow(10, d));
                linha(ctx, x, area.y, x, area.y + area.a, tema.grade, 0.5);
            }
        }
        [0.1, 1, 10, 100].forEach((l) => {
            const x = ex(l);
            linha(ctx, x, area.y, x, area.y + area.a, tema.grade, 1);
            escreverCanvas(ctx, ROTULO_LAMBDA(l), x, area.y + area.a + tema.rem * 1.15, { alinhar: 'center' });
        });
        linha(ctx, area.x, area.y + area.a, area.x + area.l, area.y + area.a, tema.eixo, 1);
        escreverCanvas(ctx, 'comprimento de onda (µm), escala logarítmica', area.x + area.l, area.y + area.a + tema.rem * 2.45, { alinhar: 'right', max: area.l });
    }

    function faixaVisivel(ctx, area, ex) {
        const x0 = ex(0.38), x1 = ex(0.75);
        ctx.fillStyle = tema.altoContraste ? '#333333' : tema.grade;
        ctx.fillRect(x0, area.y, x1 - x0, area.a);
        escreverCanvas(ctx, 'visível', (x0 + x1) / 2, area.y + tema.rem * 0.95, { alinhar: 'center' });
    }

    function faixaDoPico(metros) {
        if (metros < 380e-9) return 'ultravioleta';
        if (metros <= 750e-9) return 'visível';
        if (metros <= 3e-6) return 'infravermelho próximo';
        return 'infravermelho térmico';
    }

    function iniciarPlanck() {
        const formulario = porId('simPlanck');
        if (!formulario) return;
        const T_SOL = F.CONSTANTES.temperaturaSol, T_AGUA = paraKelvin(35);
        const botoes = todos('[data-temperatura]', formulario);

        function desenhar(tela) {
            if (!tela.largura) return;
            const { ctx, largura: w, altura: h } = tela;
            const T = valor('planckTemperatura'), rem = tema.rem;
            limparTela(tela);
            const classica = porId('planckRJ').checked;
            const itens = [{ rotulo: 'corpo escolhido', cor: tema.destaque }];
            if (classica) itens.push({ rotulo: 'física clássica', cor: tema.apoio, tracos: [2, 4] });
            const topo = cabecalhoGrafico(ctx, w, 'potência emitida por m² e por µm (W·m⁻²·µm⁻¹)', itens);
            const area = { x: rem * 3.5, y: topo, l: w - rem * 4.5, a: h - topo - rem * 3.2 };
            const ex = escalaLog(LAMBDA_MIN, LAMBDA_MAX, area.x, area.x + area.l);
            const ey = escalaLog(1e-3, 1e10, area.y + area.a, area.y);
            faixaVisivel(ctx, area, ex);
            eixoComprimento(ctx, area, ex);
            for (let e = -2; e <= 10; e += 2) {
                const y = ey(Math.pow(10, e));
                linha(ctx, area.x, y, area.x + area.l, y, tema.grade, 1);
                escreverCanvas(ctx, potenciaDeDez(e), area.x - 6, y + 4, { alinhar: 'right' });
            }

            const curva = (Tc) => (l) => F.exitanciaEspectral(l * 1e-6, Tc);
            if (classica) {
                tracarCurva(ctx, area, ex, ey, LAMBDA_MIN, LAMBDA_MAX, (l) => F.exitanciaRayleighJeans(l * 1e-6, T), tema.apoio, 2, [2, 4]);
            }
            const referencia = (Tc, cor, nome, tracos) => {
                tracarCurva(ctx, area, ex, ey, LAMBDA_MIN, LAMBDA_MAX, curva(Tc), cor, 2, tracos);
                const pico = F.picoWien(Tc) * 1e6;
                escreverCanvas(ctx, nome, ex(pico), ey(F.exitanciaEspectral(pico * 1e-6, Tc)) - 8, { alinhar: 'center', peso: 600, fundo: tema.fundo });
            };
            if (porId('planckSol').checked) referencia(T_SOL, tema.sol, 'Sol', [8, 5]);
            if (porId('planckAgua').checked) referencia(T_AGUA, tema.agua, 'Água a 35 °C', [8, 5]);

            tracarCurva(ctx, area, ex, ey, LAMBDA_MIN, LAMBDA_MAX, curva(T), tema.destaque, 3);
            const pico = F.picoWien(T) * 1e6;
            const noPico = F.exitanciaEspectral(pico * 1e-6, T);
            linha(ctx, ex(pico), ey(noPico), ex(pico), area.y + area.a, tema.destaque, 1, [3, 3]);
            marcador(ctx, ex(pico), ey(noPico), tema.destaque);

            if (tela.cursorX !== null && tela.cursorX >= area.x && tela.cursorX <= area.x + area.l) {
                const fracao = (tela.cursorX - area.x) / area.l;
                const l = LAMBDA_MIN * Math.pow(LAMBDA_MAX / LAMBDA_MIN, fracao);
                linha(ctx, tela.cursorX, area.y, tela.cursorX, area.y + area.a, tema.texto, 1);
                const y = F.exitanciaEspectral(l * 1e-6, T);
                const texto = `${comprimentoLegivel(l * 1e-6)}: ${y > 1e-3 ? cientifico(y, 1) : 'quase zero'}`;
                escreverCanvas(ctx, texto, tela.cursorX + (fracao > 0.6 ? -6 : 6), area.y + rem * 2.3, { alinhar: fracao > 0.6 ? 'right' : 'left', peso: 600, fundo: tema.fundo });
            }
        }

        const tela = prepararCanvas(porId('graficoPlanck'), desenhar);
        seguirCursor(tela);

        function atualizar() {
            const T = valor('planckTemperatura');
            const pico = F.picoWien(T), potencia = F.stefanBoltzmann(T), visivel = F.fracaoBanda(380e-9, 750e-9, T);
            const faixa = faixaDoPico(pico);
            saida('planckTemperatura', `${num(T)} K (${num(T - 273.15)} °C)`);
            definirTexto('planckPico', comprimentoLegivel(pico));
            definirTexto('planckFaixa', faixa);
            definirTexto('planckPotencia', `${cientifico(potencia)} W/m²`);
            definirTexto('planckVisivel', visivel < 0.0001 ? 'menos de 0,01%' : `${num(visivel * 100, visivel < 0.1 ? 2 : 1)}%`);
            botoes.forEach((b) => b.setAttribute('aria-pressed', String(Math.abs(Number(b.dataset.temperatura) - T) < 0.51)));
            anunciar(porId('planckResumo'), `A ${num(T)} kelvin, o pico de emissão fica em ${comprimentoLegivel(pico)}, no ${faixa}. Um corpo negro nessa temperatura emite ${cientifico(potencia)} watts por metro quadrado.`);
            redesenhar(tela);
        }
        botoes.forEach((botao) => botao.addEventListener('click', () => {
            porId('planckTemperatura').value = Math.round(Number(botao.dataset.temperatura));
            atualizar();
        }));
        ligarFormulario(formulario, atualizar);
        atualizar();
    }

    function iniciarSolAgua() {
        const formulario = porId('simSolAgua');
        if (!formulario) return;
        const T_SOL = F.CONSTANTES.temperaturaSol;
        const tAgua = () => paraKelvin(valor('saAgua'));

        function desenhar(tela) {
            if (!tela.largura) return;
            const { ctx, largura: w, altura: h } = tela;
            const rem = tema.rem, Ta = tAgua();
            limparTela(tela);
            const topo = cabecalhoGrafico(ctx, w, 'emissão relativa ao próprio pico', [{ rotulo: 'Sol', cor: tema.sol }, { rotulo: 'Água', cor: tema.agua, tracos: [9, 5] }]);
            const area = { x: rem * 2.6, y: topo, l: w - rem * 3.6, a: h - topo - rem * 3.2 };
            const ex = escalaLog(LAMBDA_MIN, LAMBDA_MAX, area.x, area.x + area.l);
            const ey = escalaLinear(0, 1.12, area.y + area.a, area.y);
            faixaVisivel(ctx, area, ex);
            eixoComprimento(ctx, area, ex);
            [0, 0.5, 1].forEach((v) => {
                linha(ctx, area.x, ey(v), area.x + area.l, ey(v), tema.grade);
                escreverCanvas(ctx, num(v, v === 0.5 ? 1 : 0), area.x - 6, ey(v) + 4, { alinhar: 'right' });
            });
            const normal = (T) => { const m = F.exitanciaEspectral(F.picoWien(T), T); return (l) => F.exitanciaEspectral(l * 1e-6, T) / m; };
            tracarCurva(ctx, area, ex, ey, LAMBDA_MIN, LAMBDA_MAX, normal(T_SOL), tema.sol, 3);
            tracarCurva(ctx, area, ex, ey, LAMBDA_MIN, LAMBDA_MAX, normal(Ta), tema.agua, 3, [9, 5]);
            escreverCanvas(ctx, 'Sol', ex(F.picoWien(T_SOL) * 1e6), ey(1) - 7, { alinhar: 'center', peso: 700, fundo: tema.fundo });
            escreverCanvas(ctx, 'Água', ex(F.picoWien(Ta) * 1e6), ey(1) - 7, { alinhar: 'center', peso: 700, fundo: tema.fundo });
        }
        const tela = prepararCanvas(porId('graficoSolAgua'), desenhar);

        function atualizar() {
            const Ta = tAgua();
            const pct = (x) => (x < 0.0001 ? 'menos de 0,01%' : `${num(x * 100, 1)}%`);
            definirTexto('saPicoSol', comprimentoLegivel(F.picoWien(T_SOL)));
            definirTexto('saPicoAgua', comprimentoLegivel(F.picoWien(Ta)));
            definirTexto('saPotSol', `${cientifico(F.stefanBoltzmann(T_SOL))} W/m²`);
            definirTexto('saPotAgua', `${num(F.stefanBoltzmann(Ta), 1)} W/m²`);
            definirTexto('saVisSol', pct(F.fracaoBanda(380e-9, 750e-9, T_SOL)));
            definirTexto('saVisAgua', pct(F.fracaoBanda(380e-9, 750e-9, Ta)));
            definirTexto('saIvSol', pct(1 - F.fracaoAte(3e-6, T_SOL)));
            definirTexto('saIvAgua', pct(1 - F.fracaoAte(3e-6, Ta)));
            const razaoPico = F.picoWien(Ta) / F.picoWien(T_SOL);
            const razaoPotencia = F.stefanBoltzmann(T_SOL) / F.stefanBoltzmann(Ta);
            anunciar(porId('saResumo'), `O pico da água fica em comprimento de onda ${num(razaoPico, 1)} vezes maior que o do Sol. Por metro quadrado, a superfície do Sol emite cerca de ${num(razaoPotencia, 0)} vezes mais que um corpo negro a ${num(valor('saAgua'))} °C.`);
            redesenhar(tela);
        }
        ligarFormulario(formulario, atualizar);
        atualizar();
    }

    /* ---------- Coletor: preto comum x seletivo ---------- */
    const SUPERFICIES = {
        preta: { nome: 'Tinta preta comum', absortancia: 0.93, emitancia: 0.93 },
        seletiva: { nome: 'Superfície seletiva', absortancia: 0.97, emitancia: 0.09 }
    };

    function iniciarColetor() {
        const formulario = porId('simColetor');
        if (!formulario) return;
        function atualizar() {
            const condicao = {
                irradiancia: valor('coSol'), tPlaca: valor('coPlaca'), tAr: valor('coAr'),
                tCeu: F.paraCelsius(F.temperaturaCeu(paraKelvin(valor('coAr'))))
            };
            saida('coSol', `${num(condicao.irradiancia)} W/m²`);
            saida('coPlaca', `${num(condicao.tPlaca)} °C`);
            saida('coAr', `${num(condicao.tAr)} °C`);
            const W = (x) => `${num(x)} W/m²`;
            const grupos = [];
            const resultados = {};
            Object.entries(SUPERFICIES).forEach(([chave, s]) => {
                const dados = { ...condicao, absortancia: s.absortancia, emitancia: s.emitancia };
                const r = F.balancoPlaca(dados);
                resultados[chave] = { ...r, estagnacao: F.temperaturaEstagnacao(dados) };
                grupos.push({ titulo: `${s.nome} (absorve ${num(s.absortancia * 100)}%, emite ${num(s.emitancia * 100)}%)`, linhas: [
                    { rotulo: 'Absorvido do Sol', valor: r.absorvido, texto: W(r.absorvido), tom: 'sol' },
                    { rotulo: 'Perdido por radiação', valor: r.radiado, texto: W(r.radiado), tom: 'destaque' },
                    { rotulo: 'Perdido para o ar', valor: r.convectado, texto: W(r.convectado), tom: 'neutro' },
                    { rotulo: 'Calor útil para a água', valor: Math.max(0, r.util), texto: W(r.util) }
                ] });
            });
            desenharBarras(porId('coBarras'), grupos);
            definirTexto('coEstagnacaoPreta', `${num(resultados.preta.estagnacao)} °C`);
            definirTexto('coEstagnacaoSeletiva', `${num(resultados.seletiva.estagnacao)} °C`);
            anunciar(porId('coResumo'), `Com a placa a ${num(condicao.tPlaca)} °C, a tinta preta entrega ${W(resultados.preta.util)} e a superfície seletiva entrega ${W(resultados.seletiva.util)}. A diferença vem principalmente da radiação perdida.`);
        }
        ligarFormulario(formulario, atualizar);
        atualizar();
    }

    /* ---------- Piscina: cálculo passo a passo ---------- */
    const GEOMETRIA = F.geometriaPiscina();

    function iniciarCalculo() {
        const formulario = porId('formCalculo');
        if (!formulario) return;
        function atualizar() {
            const meta = Number(formulario.querySelector('input[name="calcMeta"]:checked').value);
            const variacao = meta - 20;
            const energia = F.energiaAquecimento(GEOMETRIA.massa, variacao);
            todos('[data-calc="meta"]').forEach((e) => { e.textContent = num(meta); });
            todos('[data-calc="delta"]').forEach((e) => { e.textContent = num(variacao); });
            todos('[data-calc="joules"]').forEach((e) => { e.textContent = num(energia); });
            todos('[data-calc="kwh"]').forEach((e) => { e.textContent = num(F.jouleParaKWh(energia), 1); });
            todos('[data-calc="taxa"]').forEach((e) => { e.textContent = duracaoLegivel(F.tempoAquecimento(energia, 500e3)); });
            anunciar(porId('calcResumo'), `Para ir de 20 a ${num(meta)} °C são necessários ${num(F.jouleParaKWh(energia), 1)} quilowatts-hora.`);
        }
        ligarFormulario(formulario, atualizar);
        atualizar();
    }

    /* ---------- Sistema proposto pelo grupo ---------- */
    function iniciarSistema() {
        const info = porId('sistemaInfo');
        if (!info) return;
        const DADOS = {
            coletor: ['Coletor solar térmico', 'Uma superfície escura de alta absortância recebe a radiação solar, visível e infravermelha, e a transforma em energia térmica, que aquece a água que circula por dentro. Não é um corpo negro perfeito. Veja na página do corpo negro por que nem sempre convém imitar um.'],
            bomba: ['Bomba de circulação', 'Força o movimento da água da piscina, passando pelo coletor, onde ganha calor, e de volta à piscina. Consome energia elétrica, que pode vir de painéis fotovoltaicos.'],
            sensores: ['Sensores', 'Medem a temperatura da água e do coletor, além de fluxo, irradiância e nível. Um microcontrolador processa essas leituras para ligar e desligar a bomba automaticamente, otimizando a eficiência.'],
            piscina: ['Piscina', 'A água emite radiação predominantemente no infravermelho térmico, como prevê a lei de Wien. Também perde calor por evaporação, uma mudança de fase que consome muita energia, e por convecção com o ar.'],
            capa: ['Capa térmica', 'Barreira física que reduz muito a evaporação e diminui a convecção e a troca de radiação. Não produz calor: age como isolante, conservando a energia térmica adquirida durante o dia.']
        };
        const botoes = todos('[data-componente]');
        const titulo = porId('sistemaTitulo'), texto = porId('sistemaTexto');
        botoes.forEach((botao) => botao.addEventListener('click', () => {
            const [nome, descricao] = DADOS[botao.dataset.componente];
            botoes.forEach((b) => b.setAttribute('aria-pressed', String(b === botao)));
            titulo.textContent = nome;
            texto.textContent = descricao;
        }));
    }

    /* ---------- Comparativo de perdas com e sem capa ---------- */
    function iniciarPerdas() {
        const formulario = porId('simPerdas');
        if (!formulario) return;
        function atualizar() {
            const tAgua = valor('pdAgua'), tAr = 20;
            const tVizinhanca = porId('pdCeu').value === 'claro' ? F.paraCelsius(F.temperaturaCeu(paraKelvin(tAr))) : tAr;
            const base = { tAgua, tAr, umidade: 0.6, vento: 1, tVizinhanca, emissividade: 0.95 };
            const area = GEOMETRIA.areaSuperficie;
            const montar = (titulo, f) => ({ titulo: `${titulo}: ${potenciaLegivel(f.total * area)} no total`, linhas: [
                { rotulo: 'Evaporação', valor: f.evaporacao * area, texto: potenciaLegivel(f.evaporacao * area) },
                { rotulo: 'Convecção', valor: f.conveccao * area, texto: potenciaLegivel(f.conveccao * area), tom: 'neutro' },
                { rotulo: 'Radiação líquida', valor: f.radiacao * area, texto: potenciaLegivel(f.radiacao * area), tom: 'destaque' }
            ] });
            const sem = F.fluxosSuperficie(base), com = F.fluxosSuperficie({ ...base, capa: true });
            desenharBarras(porId('pdBarras'), [montar('Sem capa', sem), montar('Com capa', com)]);
            const parcela = sem.radiacao / sem.total * 100;
            definirTexto('pdParcela', `${num(parcela)}%`);
            definirTexto('pdReducao', `${num((1 - com.total / sem.total) * 100)}%`);
            definirTexto('pdLitros', `${num(F.litrosEvaporadosPorDia(sem.evaporacao, area, tAgua) / 1000, 1)} mil L/dia`);
            anunciar(porId('pdResumo'), `Com a água a ${num(tAgua)} °C, a radiação líquida é ${num(parcela)}% das perdas sem capa. Com a capa, a perda total cai ${num((1 - com.total / sem.total) * 100)}%.`);
        }
        ligarFormulario(formulario, atualizar);
        atualizar();
    }

    /* ---------- Calculadora da piscina ---------- */
    function iniciarCalculadora() {
        const formulario = porId('formCalculadora');
        if (!formulario) return;
        const CAMPOS = ['caAgua', 'caAmbiente', 'caEmissividade', 'caPotencia', 'caInicial', 'caSol', 'caEficiencia'];
        const A = GEOMETRIA.areaSuperficie, kW = (x) => `${num(x / 1e3, 1)} kW`, W = (x) => `${num(x, 2)} W/m²`;

        function campoValido(id) {
            const campo = porId(id), erro = porId(`${id}Erro`);
            const ok = campo.value !== '' && campo.checkValidity();
            if (ok) campo.removeAttribute('aria-invalid'); else campo.setAttribute('aria-invalid', 'true');
            erro.hidden = ok;
            return ok;
        }
        function atualizar() {
            const validos = CAMPOS.map(campoValido).every(Boolean);
            todos('[data-meta]', formulario).forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.meta) === valor('caAgua'))));
            if (!validos) {
                todos('[data-ca]', formulario).forEach((e) => { e.textContent = '—'; });
                anunciar(porId('caResumo'), 'Há um valor fora da faixa aceita. Corrija o campo indicado.');
                return;
            }
            const tAgua = valor('caAgua'), tViz = valor('caAmbiente'), eps = valor('caEmissividade');
            const K1 = paraKelvin(tAgua), K2 = paraKelvin(tViz);
            const potencia = valor('caPotencia') * 1e3;
            const emitida = F.emissaoSuperficie(K1, eps), recebida = F.emissaoSuperficie(K2, eps);
            const liquida = F.radiacaoLiquida(K1, K2, eps), perda = liquida * A;
            const saldo = potencia - perda;
            const variacao = tAgua - valor('caInicial');
            const energia = F.energiaAquecimento(GEOMETRIA.massa, Math.max(0, variacao));
            const coletor = perda > 0 ? F.areaColetor(perda, valor('caSol'), valor('caEficiencia')) : 0;
            const fixar = (id, texto) => definirTexto(id, texto);
            fixar('caEmitida', W(emitida)); fixar('caEmitidaT', kW(emitida * A));
            fixar('caRecebida', W(recebida)); fixar('caRecebidaT', kW(recebida * A));
            fixar('caLiquida', W(liquida)); fixar('caLiquidaT', kW(perda));
            fixar('caPico', `${num(F.picoWien(K1) * 1e6, 2)} µm`);
            fixar('caSaldo', kW(saldo));
            fixar('caTaxa', `${num(F.taxaAquecimento(saldo, GEOMETRIA.massa), 4)} °C/h`);
            fixar('caEnergia', `${num(energia)} J`);
            fixar('caEnergiaKWh', `${num(F.jouleParaKWh(energia), 1)} kWh`);
            fixar('caTempo', variacao <= 0 ? 'não precisa aquecer' : duracaoLegivel(F.tempoAquecimento(energia, saldo)));
            fixar('caColetor', perda > 0 ? `${num(coletor)} m²` : 'não há perda a repor');
            anunciar(porId('caResumo'), `A água emite ${W(emitida)} e recebe ${W(recebida)} da vizinhança. A perda líquida por radiação é ${W(liquida)}, ou ${kW(perda)} na piscina inteira. Considerando só essa perda, sobram ${kW(saldo)} para aquecer a água.`);
        }
        todos('[data-meta]', formulario).forEach((botao) => botao.addEventListener('click', () => {
            porId('caAgua').value = botao.dataset.meta;
            atualizar();
        }));
        ligarFormulario(formulario, atualizar);
        atualizar();
    }

    /* ---------- Simulador térmico: balanço de potência ---------- */
    function iniciarTermico() {
        const formulario = porId('simTermico');
        if (!formulario) return;
        let sem = null, com = null, agendado = false;

        const parametros = () => ({
            tInicial: valor('teInicial'), tAr: valor('teAr'), tMeta: valor('teMeta'), dias: valor('teDias'),
            areaColetor: valor('teColetor'), potenciaExtra: valor('teExtra') * 1e3,
            umidade: valor('teUmidade') / 100, vento: valor('teVento'), ceu: porId('teCeu').value,
            emissividade: valor('teEmissividade'), irradianciaPico: valor('teSol'),
            eficienciaColetor: valor('teEficiencia') / 100,
            fatorUso: F.USO_PISCINA[porId('teUso').value]
        });

        function desenhar(tela) {
            if (!tela.largura || !sem) return;
            const { ctx, largura: w, altura: h } = tela;
            const rem = tema.rem, p = parametros();
            limparTela(tela);
            const topo = cabecalhoGrafico(ctx, w, 'temperatura da água (°C)', [{ rotulo: 'sem capa', cor: tema.destaque, tracos: [8, 5] }, { rotulo: 'com capa', cor: tema.agua }]);
            const area = { x: rem * 2.9, y: topo, l: w - rem * 3.9, a: h - topo - rem * 3 };
            const todosValores = [...sem.pontos, ...com.pontos].map((q) => q.temperatura).concat(p.tMeta, p.tInicial);
            let minimo = Math.floor(Math.min(...todosValores) - 0.5), maximo = Math.ceil(Math.max(...todosValores) + 0.5);
            if (maximo - minimo < 4) maximo = minimo + 4;
            const ex = escalaLinear(0, p.dias * 24, area.x, area.x + area.l), ey = escalaLinear(minimo, maximo, area.y + area.a, area.y);
            const passoY = Math.max(1, Math.ceil((maximo - minimo) / 5));
            for (let v = minimo; v <= maximo; v += passoY) {
                linha(ctx, area.x, ey(v), area.x + area.l, ey(v), tema.grade);
                escreverCanvas(ctx, num(v), area.x - 6, ey(v) + 4, { alinhar: 'right' });
            }
            const passoX = Math.max(1, Math.ceil(p.dias / 6));
            for (let d = 0; d <= p.dias; d += passoX) escreverCanvas(ctx, num(d), ex(d * 24), area.y + area.a + rem * 1.15, { alinhar: 'center' });
            linha(ctx, area.x, area.y + area.a, area.x + area.l, area.y + area.a, tema.eixo);
            escreverCanvas(ctx, 'dias simulados', area.x + area.l, area.y + area.a + rem * 2.4, { alinhar: 'right' });
            if (p.tMeta >= minimo && p.tMeta <= maximo) {
                linha(ctx, area.x, ey(p.tMeta), area.x + area.l, ey(p.tMeta), tema.apoio, 1, [3, 4]);
                escreverCanvas(ctx, `meta ${num(p.tMeta)} °C`, area.x + 6, ey(p.tMeta) - 5, { fundo: tema.fundo });
            }
            const serie = (dados, cor, tracos) => {
                ctx.strokeStyle = cor; ctx.lineWidth = 2.5; ctx.setLineDash(tracos); ctx.lineJoin = 'round'; ctx.beginPath();
                dados.pontos.forEach((q, i) => { const x = ex(q.horas), y = ey(q.temperatura); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
                ctx.stroke(); ctx.setLineDash([]);
            };
            serie(sem, tema.destaque, [8, 5]);
            serie(com, tema.agua, []);
            if (tela.cursorX !== null && tela.cursorX >= area.x && tela.cursorX <= area.x + area.l) {
                const fracao = (tela.cursorX - area.x) / area.l;
                const i = Math.round(fracao * (sem.pontos.length - 1));
                linha(ctx, tela.cursorX, area.y, tela.cursorX, area.y + area.a, tema.texto, 1);
                escreverCanvas(ctx, `dia ${num(sem.pontos[i].horas / 24, 1)}: sem capa ${num(sem.pontos[i].temperatura, 1)} °C, com capa ${num(com.pontos[i].temperatura, 1)} °C`, tela.cursorX + (fracao > 0.5 ? -6 : 6), area.y + area.a - rem * 0.6, { alinhar: fracao > 0.5 ? 'right' : 'left', peso: 600, fundo: tema.fundo });
            }
        }
        const tela = prepararCanvas(porId('graficoTermico'), desenhar);
        seguirCursor(tela);

        function calcular() {
            agendado = false;
            const p = parametros();
            sem = F.simularPiscina({ ...p, capa: 'sem' });
            com = F.simularPiscina({ ...p, capa: porId('teCapa').value });
            saida('teInicial', `${num(p.tInicial)} °C`);
            saida('teAr', `${num(p.tAr)} °C`);
            saida('teColetor', `${num(p.areaColetor)} m²`);
            saida('teExtra', `${num(p.potenciaExtra / 1e3)} kW`);
            saida('teDias', `${num(p.dias)} ${p.dias === 1 ? 'dia' : 'dias'}`);
            saida('teUmidade', `${num(p.umidade * 100)}%`);
            saida('teVento', `${num(p.vento, 1)} m/s`);
            saida('teEmissividade', num(p.emissividade, 2));
            saida('teSol', `${num(p.irradianciaPico)} W/m²`);
            saida('teEficiencia', `${num(p.eficienciaColetor * 100)}%`);
            definirTexto('teFinalSem', `${num(sem.tFinal, 1)} °C`);
            definirTexto('teFinalCom', `${num(com.tFinal, 1)} °C`);
            definirTexto('teLitrosSem', `${num(sem.litrosPorDia / 1000, 1)} mil L`);
            definirTexto('teLitrosCom', `${num(com.litrosPorDia / 1000, 1)} mil L`);
            const barras = (titulo, m) => ({ titulo, linhas: [
                { rotulo: 'Entrada (Sol, coletor e aquecedor)', valor: m.entrada, texto: potenciaLegivel(m.entrada), tom: 'sol' },
                { rotulo: 'Evaporação', valor: m.evaporacao, texto: potenciaLegivel(m.evaporacao) },
                { rotulo: 'Convecção', valor: m.conveccao, texto: potenciaLegivel(m.conveccao), tom: 'neutro' },
                { rotulo: 'Radiação líquida', valor: m.radiacao, texto: potenciaLegivel(m.radiacao), tom: 'destaque' }
            ] });
            desenharBarras(porId('teBarras'), [barras('Médias sem capa', sem.medias), barras('Médias com capa', com.medias)]);
            const corpo = porId('teTabela');
            const linhas = document.createDocumentFragment();
            for (let d = 0; d <= p.dias; d++) {
                const tr = document.createElement('tr');
                [num(d), num(sem.pontos[d * 24].temperatura, 1), num(com.pontos[d * 24].temperatura, 1)].forEach((t, i) => {
                    const c = document.createElement(i ? 'td' : 'th');
                    if (!i) c.scope = 'row';
                    c.className = 'numero';
                    c.textContent = t;
                    tr.append(c);
                });
                linhas.append(tr);
            }
            corpo.replaceChildren(linhas);
            anunciar(porId('teResumo'), `Depois de ${num(p.dias)} ${p.dias === 1 ? 'dia' : 'dias'}, a água termina em ${num(sem.tFinal, 1)} °C sem capa e ${num(com.tFinal, 1)} °C com capa. A evaporação cai de ${num(sem.litrosPorDia / 1000, 1)} para ${num(com.litrosPorDia / 1000, 1)} mil litros por dia.`);
            redesenhar(tela);
        }
        ligarFormulario(formulario, () => {
            if (!agendado) { agendado = true; requestAnimationFrame(calcular); }
        });
        calcular();
    }

    /* ---------- Vídeos em Libras: só aparecem quando o arquivo existir ---------- */
    function iniciarLibras() {
        todos('.libras-vaga[data-video]').forEach((vaga) => {
            const arquivo = vaga.dataset.video;
            if (!arquivo) return;
            const video = document.createElement('video');
            video.controls = true;
            video.preload = 'none';
            video.src = arquivo;
            if (vaga.dataset.legenda) {
                const faixa = document.createElement('track');
                faixa.kind = 'captions'; faixa.srclang = 'pt-BR'; faixa.label = 'Português'; faixa.src = vaga.dataset.legenda;
                video.append(faixa);
            }
            const estado = vaga.querySelector('[data-libras-estado]');
            estado.replaceWith(video);
            if (vaga.dataset.transcricao) {
                const paragrafo = document.createElement('p');
                const link = document.createElement('a');
                link.href = vaga.dataset.transcricao;
                link.textContent = 'Ler a transcrição do vídeo';
                paragrafo.append(link);
                vaga.append(paragrafo);
            }
        });
    }

    /* ---------- Início ---------- */
    iniciar(iniciarPreferencias);
    iniciar(iniciarAncorasAntigas);
    iniciar(iniciarCabecalho);
    iniciar(iniciarProgresso);
    iniciar(iniciarSecaoAtual);
    iniciar(iniciarCena);
    iniciar(iniciarEspectro);
    iniciar(iniciarFotoeletrico);
    iniciar(iniciarEnergia);
    iniciar(iniciarAutomacao);
    iniciar(iniciarPlanck);
    iniciar(iniciarSolAgua);
    iniciar(iniciarColetor);
    iniciar(iniciarCalculo);
    iniciar(iniciarSistema);
    iniciar(iniciarPerdas);
    iniciar(iniciarCalculadora);
    iniciar(iniciarTermico);
    iniciar(iniciarLibras);
    document.addEventListener('cep:preferencias', () => telas.forEach(redesenhar));
})();
}
