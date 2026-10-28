# Revisão da migração para Next.js (out/2026)

Ordem seguida: 1) revisão do código · 2) segunda revisão · 3) identificação dos bugs · 4) correção.

## 1ª revisão — leitura do código
Núcleo (`src/lib/core`), plataforma (gravação e Claude), provedor React e todas as telas, comparando
com o comportamento da versão em Python. A equivalência numérica foi verificada com um conjunto de
referência gerado pela versão anterior (`tests/golden.json`): cronograma, orçamento por etapa, status,
indicadores, alertas, medição, lista de materiais, controle de compras e o pedido enviado à Claude.

## 2ª revisão — verificação em execução
- lint (eslint + regras do Next/React);
- varredura de transbordo em 4 larguras (1366, 1024, 768, 390 px) × 7 telas;
- modo de desenvolvimento com React StrictMode;
- simulação do runtime da Claude (banco compartilhado + revisão por "sample");
- abertura de dados gravados pela versão em Python (mesma chave do navegador);
- testes de investigação para cada suspeita.

## Bugs identificados
| # | Bug | Origem |
|---|-----|--------|
| 1 | Total base do controle de compras com desvio de R$ 0,01 (253.858,67 em vez de 253.858,66): soma de valores já arredondados | migração |
| 2 | Cotação escolhida errada quando há linha vazia entre fornecedores (marca o 3º, grava o 1º) | herdado |
| 3 | Editar a obra apaga o valor por m² próprio (volta ao CUB) ao salvar qualquer outro campo | herdado |
| 4 | Editar a obra com o orçamento em branco zera o orçamento de todas as etapas | herdado |
| 5 | Criar obra com orçamento "0,00" grava zero em vez de estimar pela área × m² | herdado |
| 6 | Arredondamento assimétrico de negativos (−2,675 → −2,67; 2,675 → 2,68) | migração |
| 7 | Aviso da última ação reaparece sozinho quando chegam dados do banco compartilhado | migração |
| 8 | Carga inicial frágil no React StrictMode (eventos presos ao primeiro efeito, descartado) | migração |
| 9 | Tabela do controle de compras não cabe entre 768 e ~1100 px e transborda no celular | migração |
| 10 | Cadastro: ao trocar o estado, a lista de padrões e a referência mostram o CUB do estado anterior | herdado |
| 11 | "Cancelar" na confirmação de remoção fecha o item em vez de só cancelar | herdado |
| 12 | Sem destaque de foco do teclado nas setas de fase | migração |
| 13 | Falha ao gravar no navegador (cota cheia/modo privado) não é avisada | herdado |
| 14 | Código: import no meio de `modelos.ts`; variável sem uso (lint) | migração |

Corrigido já na migração: pedido gerado pela lista de materiais ignorava o estado (UF) ao escolher a
especificação do padrão personalizado.
