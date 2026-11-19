'use strict';
/* Testes da estrutura das páginas, sem navegador. Para rodar: node --test _testes/*.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const PAGINAS = ['index.html', 'corpo-negro.html', 'piscina-cep.html'];
const HTML = Object.fromEntries(PAGINAS.map((p) => [p, fs.readFileSync(path.join(RAIZ, p), 'utf8')]));
const trecho = (texto, inicio, fim) => texto.slice(texto.indexOf(inicio), texto.indexOf(fim) + fim.length);
const ids = (texto) => [...texto.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

test('cabeçalho e rodapé iguais nas três páginas', () => {
    const cab = (t) => trecho(t, '<header', '</header>').replace(' aria-current="page"', '');
    const rod = (t) => trecho(t, '<footer', '</footer>');
    const [a, ...resto] = PAGINAS;
    for (const p of resto) {
        assert.equal(cab(HTML[p]), cab(HTML[a]), `cabeçalho de ${p}`);
        assert.equal(rod(HTML[p]), rod(HTML[a]), `rodapé de ${p}`);
    }
    assert.match(rod(HTML[a]), /Grupo 2/);
    assert.match(rod(HTML[a]), /© 2026/);
    assert.match(rod(HTML[a]), /Mapa do site/);
});

test('menu na ordem definida, com a piscina por último e em destaque', () => {
    const menu = trecho(HTML['index.html'], '<ul class="menu">', '</ul>');
    const itens = [...menu.matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map((m) => m[1]);
    assert.deepEqual(itens, ['Início', 'Ondas', 'Corpo Negro', 'Fotoelétrico', 'Robótica', 'Sustentabilidade', 'Sobre', 'Piscina do CEP']);
    assert.match(menu, /class="menu__destaque" href="piscina-cep.html"/);
});

test('página atual marcada no menu', () => {
    assert.match(HTML['index.html'], /<a href="index.html" aria-current="page">Início/);
    assert.match(HTML['corpo-negro.html'], /<a href="corpo-negro.html" aria-current="page">Corpo Negro/);
    assert.match(HTML['piscina-cep.html'], /href="piscina-cep.html" aria-current="page">Piscina do CEP/);
});

test('cada página tem idioma, título, descrição e um único h1 próprios', () => {
    const titulos = new Set(), descricoes = new Set();
    for (const p of PAGINAS) {
        const t = HTML[p];
        assert.match(t, /<html lang="pt-BR">/);
        titulos.add(t.match(/<title>([^<]+)/)[1]);
        descricoes.add(t.match(/name="description" content="([^"]+)/)[1]);
        assert.equal((t.match(/<h1[\s>]/g) || []).length, 1, `h1 em ${p}`);
        assert.match(t, /<a class="pular" href="#conteudo">/);
        assert.match(t, /<main id="conteudo"/);
        assert.match(t, /href="styles.css"/);
        assert.match(t, /src="script.js"/);
        assert.match(t, /vlibras\.gov\.br\/app\/vlibras-plugin\.js/);
    }
    assert.equal(titulos.size, 3);
    assert.equal(descricoes.size, 3);
});

test('sem identificadores repetidos', () => {
    for (const p of PAGINAS) {
        const lista = ids(HTML[p]);
        assert.deepEqual(lista.filter((id, i) => lista.indexOf(id) !== i), [], p);
    }
});

test('links internos apontam para arquivos e âncoras existentes, com caminhos relativos', () => {
    for (const p of PAGINAS) {
        for (const [, href] of HTML[p].matchAll(/<a\s[^>]*href="([^"]+)"/g)) {
            if (/^https?:/.test(href)) continue;
            assert.ok(!href.startsWith('/'), `caminho absoluto em ${p}: ${href}`);
            assert.notEqual(href, '#', `link vazio em ${p}`);
            const [arquivo, ancora] = href.split('#');
            const alvo = arquivo || p;
            assert.ok(PAGINAS.includes(alvo), `${p}: arquivo ${alvo}`);
            if (ancora) assert.ok(ids(HTML[alvo]).includes(ancora), `${p}: âncora ${href}`);
        }
    }
});

test('links antigos continuam com destino', () => {
    const lista = ids(HTML['index.html']);
    for (const id of ['radiacao', 'piscina', 'simuladores', 'fundamentos']) assert.ok(lista.includes(id), id);
    const js = fs.readFileSync(path.join(RAIZ, 'script.js'), 'utf8');
    assert.match(js, /'#radiacao': 'corpo-negro.html'/);
    assert.match(js, /'#piscina': 'piscina-cep.html'/);
    assert.match(js, /'#simuladores': 'piscina-cep.html#simulador-termico'/);
});

test('percurso de leitura termina na piscina', () => {
    const etapas = [];
    for (const p of PAGINAS) {
        for (const [bloco] of HTML[p].matchAll(/<nav class="percurso[^"]*"[\s\S]*?<\/nav>/g)) {
            const prox = bloco.match(/rel="next" href="([^"]+)"><span>Próximo<\/span>([^<]+)/);
            const ant = bloco.match(/rel="prev" href="([^"]+)"><span>Anterior<\/span>([^<]+)/);
            etapas.push({ pagina: p, proximo: prox && prox[2], anterior: ant && ant[2] });
        }
    }
    const proximos = etapas.map((e) => e.proximo).filter(Boolean);
    for (const nome of ['Ondas', 'Corpo Negro', 'Fotoelétrico', 'Robótica', 'Sustentabilidade', 'Piscina do CEP']) assert.ok(proximos.includes(nome), nome);
    const fim = etapas.find((e) => e.pagina === 'piscina-cep.html');
    assert.equal(fim.proximo, null, 'a piscina encerra o percurso');
    assert.equal(fim.anterior, 'Sustentabilidade');
});

test('controles têm rótulo e gráficos têm alternativa', () => {
    for (const p of PAGINAS) {
        const t = HTML[p];
        for (const m of t.matchAll(/<(input|select)\s[^>]*>/g)) {
            const id = (m[0].match(/\sid="([^"]+)"/) || [])[1];
            const antes = t.slice(0, m.index);
            const dentroDeLabel = antes.lastIndexOf('<label') > antes.lastIndexOf('</label>');
            assert.ok(dentroDeLabel || (id && t.includes(`for="${id}"`)), `${p}: ${m[0].slice(0, 60)}`);
        }
        for (const [c] of t.matchAll(/<canvas\s[^>]*>/g)) {
            assert.match(c, /role="img"/, `${p}: ${c}`);
            assert.match(c, /aria-label="[^"]{20,}"/, `${p}: ${c}`);
        }
        assert.doesNotMatch(t, /\sonclick=/, `${p}: manipulador embutido`);
    }
});

test('resultados de referência aparecem no texto', () => {
    const t = HTML['piscina-cep.html'];
    for (const v of ['1.070,7 m²', '4.282,8 m³', '4.282.800 kg', '268.788.528.000', '74.663,5', '87,89 W/m²', '94,1 kW', '261 m²', '0,1005 °C']) assert.ok(t.includes(v), v);
    assert.ok(HTML['index.html'].includes('39.820,5 kWh'));
});

test('sem dados privados nem afirmações proibidas', () => {
    const escapar = (termo) => termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const proibidos = [new RegExp('can' + 'va(?!s)', 'i'), new RegExp('escola' + '\\.pr\\.gov\\.br', 'i')];
    /* Nomes de pessoas não ficam neste arquivo público. Para conferir, informe-os em
       TERMOS_PRIVADOS, separados por vírgula, ao rodar os testes. */
    for (const termo of (process.env.TERMOS_PRIVADOS || '').split(',').map((x) => x.trim()).filter(Boolean)) {
        proibidos.push(new RegExp(escapar(termo), 'i'));
    }
    const arquivos = [...PAGINAS, 'styles.css', 'script.js', 'README.md', '_testes/fisica.test.js', '_testes/estrutura.test.js'];
    for (const a of arquivos) {
        const t = fs.readFileSync(path.join(RAIZ, a), 'utf8');
        for (const padrao of proibidos) assert.doesNotMatch(t, padrao, `${a}: dado privado`);
    }
    const texto = PAGINAS.map((p) => HTML[p]).join('\n');
    assert.doesNotMatch(texto, /© 2024/);
    assert.doesNotMatch(texto, /até 70%/i);
    assert.doesNotMatch(texto, /100% acess[ií]vel/i);
    assert.doesNotMatch(texto, /R\$\s*850/);
});
