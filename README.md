# Radiação do corpo negro: Sol, Água e Tecnologia

Site do Projeto Integrador do Colégio Estadual do Paraná (Grupo 2, 3º trimestre).
Feito com HTML, CSS e JavaScript puros, sem etapa de build, para o GitHub Pages.

## Páginas

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Início, ondas eletromagnéticas, efeito fotoelétrico, robótica, sustentabilidade, sobre e mapa do site |
| `corpo-negro.html` | Radiação do corpo negro, leis, simulador de Planck e Wien, Sol × água e coletor solar |
| `piscina-cep.html` | Medidas, cálculos, perdas, capa térmica, simulador térmico e calculadora da piscina |

As três páginas usam os mesmos `styles.css` e `script.js`.
O cabeçalho e o rodapé ficam no HTML de cada página e precisam continuar iguais.

## Como testar

Com o Node.js instalado, na pasta do projeto:

```
node --test _testes/*.test.js
```

Os testes conferem as contas de física e a estrutura das páginas.
A pasta `_testes` não é publicada pelo GitHub Pages.

## Como publicar um vídeo em Libras

1. Coloque o vídeo, a legenda (`.vtt`) e a transcrição em uma pasta `videos`.
2. Em `index.html`, procure a seção de vídeos em Libras e preencha a vaga correspondente:

```html
<div class="libras-vaga" data-video="videos/apresentacao.mp4"
     data-legenda="videos/apresentacao.vtt" data-transcricao="videos/apresentacao.html">
```

O player só aparece quando `data-video` está preenchido.

## Créditos de terceiros

A fonte OpenDyslexic, em `fonts/`, é distribuída sob a licença SIL Open Font License (`fonts/OFL.txt`).
