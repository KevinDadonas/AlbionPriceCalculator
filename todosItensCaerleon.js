const BASE_URL = 'https://west.albion-online-data.com'; // Altere para 'europe' ou 'east' se necessário
const CIDADES_ORIGEM = ['Bridgewatch', 'FortSterling', 'Lymhurst', 'Martlock', 'Thetford'];
const CIDADES_DESTINO = ['Caerleon', 'Black Market'];

const LUCRO_MINIMO = 0; // IMPORTANTE
const TAMANHO_LOTE = 40;
const PAUSA_MS = 600;
let monitoramentoAtivo = false;
let todosOsItens = [];

const mapaNomesItens = {};

function nomeQualidade(q) {
  const qualidades = { 1: 'Normal', 2: 'Bom', 3: 'Excelente', 4: 'Obra-Prima', 5: 'Lendário' };
  return qualidades[q] || `Qualidade ${q}`;
}

function estiloQualidade(q) {
  if (q >= 3) return 'bg-amber-950/60 text-amber-400 border-amber-800/40';
  return 'bg-gray-800 text-gray-300 border-gray-700/40';
}

function obterEncantamentoTexto(itemId) {
  const idUpper = itemId.toUpperCase();
  if (idUpper.includes('@1')) return '.1';
  if (idUpper.includes('@2')) return '.2';
  if (idUpper.includes('@3')) return '.3';
  if (idUpper.includes('@4')) return '.4';
  return '.0';
}

function estiloEncantamento(enc) {
  if (enc === '.0') return 'bg-gray-800 text-gray-400 border-gray-700/40';
  if (enc === '.1') return 'bg-green-950/60 text-green-400 border-green-800/40';
  if (enc === '.2') return 'bg-blue-950/60 text-blue-400 border-blue-800/40';
  if (enc === '.3') return 'bg-purple-950/60 text-purple-400 border-purple-800/40';
  if (enc === '.4') return 'bg-amber-950/60 text-amber-400 border-amber-800/40';
  return 'bg-gray-800 text-gray-300 border-gray-700/40';
}

function obterTierTexto(itemId) {
  const match = itemId.match(/^T(\d)/i);
  const tier = match ? match[1] : '4';
  const enc = obterEncantamentoTexto(itemId);
  return `${tier}${enc}`;
}

function obterIdBase(itemId) {
  return itemId.split('@')[0];
}

const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));

async function carregarTodosOsItensEquipaveis() {
  const urlItems = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json';

  try {
    const res = await fetch(urlItems);
    const data = await res.json();

    const itensFiltrados = [];

    data.forEach(item => {
      const id = item.UniqueName;
      const ehEquipamento = /^T[4-8]_/.test(id);
      const categoriasUteis = id.includes('_BAG') || id.includes('_CAPE') || id.includes('_MAIN_') || id.includes('_2HAND_') || id.includes('_HEAD_') || id.includes('_ARMOR_') || id.includes('_SHOES_');

      if (ehEquipamento && categoriasUteis && !id.includes('@')) {
        itensFiltrados.push(id);

        let nomePT = null;
        if (item.LocalizedNames) {
          nomePT = item.LocalizedNames['pt-BR'] ||
                   item.LocalizedNames['PT-BR'] ||
                   item.LocalizedNames['pt_BR'] ||
                   item.LocalizedNames['PT_BR'];
        }

        const nomeEN = item.LocalizedNames ? (item.LocalizedNames['EN-US'] || item.LocalizedNames['en-US']) : id;
        mapaNomesItens[id] = nomePT || nomeEN || id;
      }
    });

    const itensUnicos = [...new Set(itensFiltrados)];
    const listaFinal = [];
    itensUnicos.forEach(id => {
      listaFinal.push(id);
      for (let e = 1; e <= 4; e++) {
        listaFinal.push(`${id}@${e}`);
      }
    });

    return listaFinal;
  } catch (error) {
    console.error('Erro ao carregar lista de itens:', error);
    return [];
  }
}

function criarLotes(array, tamanho) {
  const lotes = [];
  for (let i = 0; i < array.length; i += tamanho) {
    lotes.push(array.slice(i, i + tamanho));
  }
  return lotes;
}

function renderizarLinhaTabela(oportunidade) {
  const { itemId, qualidade, compra, venda, lucroLiquido, margem } = oportunidade;
  
  const idBase = obterIdBase(itemId);
  const nomeItem = mapaNomesItens[idBase] || idBase;
  const tierBadge = obterTierTexto(itemId);
  const encantamento = obterEncantamentoTexto(itemId);
  const imgUrl = `https://render.albiononline.com/v1/item/${itemId}.png`;
  
  const linhaId = `item-${itemId}-Q${qualidade}`.replace(/[@.]/g, '_');

  return `
    <tr id="${linhaId}" class="hover:bg-[#1f1d27] transition-colors">
      <td class="py-3 px-4 flex items-center gap-3">
        <div class="relative w-10 h-10 bg-[#111015] border border-gray-700/50 rounded-lg flex items-center justify-center overflow-hidden">
          <img src="${imgUrl}" alt="${nomeItem}" class="w-9 h-9 object-contain" loading="lazy">
        </div>
        <div>
          <div class="font-bold text-gray-100">${nomeItem}</div>
          <span class="inline-block mt-0.5 px-1.5 py-0.2 text-[10px] font-bold rounded bg-amber-950 text-amber-500 border border-amber-800/60">${tierBadge}</span>
        </div>
      </td>
      <td class="py-3 px-4 text-gray-300">${compra.cidade} → ${venda.cidade}</td>
      
      <!-- Coluna Qualidade -->
      <td class="py-3 px-4">
        <span class="px-2 py-0.5 rounded-full text-[10px] border font-semibold ${estiloQualidade(qualidade)}">${nomeQualidade(qualidade)}</span>
      </td>

      <!-- Coluna Encantamento -->
      <td class="py-3 px-4">
        <span class="px-2 py-0.5 rounded-full text-[10px] border font-semibold ${estiloEncantamento(encantamento)}">Encantamento ${encantamento}</span>
      </td>

      <td class="py-3 px-4 text-right font-mono text-gray-300">${compra.preco.toLocaleString('pt-BR')}</td>
      <td class="py-3 px-4 text-right font-mono text-gray-300">${venda.preco.toLocaleString('pt-BR')}</td>
      <td class="py-3 px-4 text-center">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Alta
        </span>
      </td>
      <td class="py-3 px-4 text-right font-mono font-bold text-amber-400 text-sm">+${lucroLiquido.toLocaleString('pt-BR')}</td>
      <td class="py-3 px-4 text-right font-mono text-gray-300">${margem}%</td>
      <td class="py-3 px-4 text-right text-emerald-500/80 font-medium text-[11px]">Recente</td>
    </tr>
  `;
}

// Função chamada pelo clique do botão
function alternarMonitoramento() {
  const btn = document.getElementById('btnToggleMonitor');
  const icone = document.getElementById('iconeBtn');
  const texto = document.getElementById('textoBtn');

  monitoramentoAtivo = !monitoramentoAtivo;

  if (monitoramentoAtivo) {
    // Estilo visual: Parar (Vermelho / Amber)
    btn.className = 'flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs transition-all bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/40 cursor-pointer';
    icone.innerText = '⏸';
    texto.innerText = 'Pausar Monitoramento';
    
    // Inicia o loop de requisições
    executarCiclo();
  } else {
    // Estilo visual: Iniciar (Verde)
    btn.className = 'flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 cursor-pointer';
    icone.innerText = '▶';
    texto.innerText = 'Iniciar Monitoramento';
  }
}

async function executarCiclo() {
  if (!monitoramentoAtivo) return;

  await monitorarMercado(todosOsItens);

  // Se o usuário não pausou durante a execução do lote, agenda o próximo ciclo
  if (monitoramentoAtivo) {
    setTimeout(executarCiclo, 10000);
  }
}

async function monitorarMercado(listaCompletaItens) {
  const tabelaCorpo = document.getElementById('tabelaCorpo');
  const lotes = criarLotes(listaCompletaItens, TAMANHO_LOTE);
  
  const cidadesOrigemOk = ['Bridgewatch', 'FortSterling', 'Lymhurst', 'Martlock', 'Thetford'];
  const cidadesDestinoOk = ['Caerleon', 'Black Market', 'BlackMarket'];
  const todasCidades = [...cidadesOrigemOk, ...cidadesDestinoOk].join(',');

  for (let i = 0; i < lotes.length; i++) {
    // Se o usuário pausou o monitoramento no meio dos lotes, interrompe o loop imediatamente
    if (!monitoramentoAtivo) break;

    const loteAtual = lotes[i];
    const itemList = loteAtual.join(',');
    const url = `${BASE_URL}/api/v2/stats/prices/${itemList}.json?locations=${todasCidades}&qualities=1,2,3,4,5&_t=${Date.now()}`;

    try {
      const response = await fetch(url);
      if (response.ok) {
        const dados = await response.json();
        const relatorioLote = {};

        dados.forEach(entry => {
          const itemId = entry.item_id.toUpperCase();
          const qualidade = entry.quality;
          const chave = `${itemId}_Q${qualidade}`;

          if (!relatorioLote[chave]) {
            relatorioLote[chave] = {
              itemId: itemId,
              qualidade: qualidade,
              compra: { cidade: '', preco: Infinity },
              venda: { cidade: '', preco: 0 }
            };
          }

          const cidadeEntrada = entry.city.replace(/\s+/g, '');

          if (cidadesOrigemOk.some(c => c.toLowerCase() === cidadeEntrada.toLowerCase())) {
            if (entry.sell_price_min > 0 && entry.sell_price_min < relatorioLote[chave].compra.preco) {
              relatorioLote[chave].compra = { cidade: entry.city, preco: entry.sell_price_min };
            }
          }

          if (cidadesDestinoOk.some(c => c.toLowerCase() === cidadeEntrada.toLowerCase())) {
            if (entry.buy_price_max > relatorioLote[chave].venda.preco) {
              relatorioLote[chave].venda = { cidade: entry.city, preco: entry.buy_price_max };
            }
          }
        });

        for (const [chave, info] of Object.entries(relatorioLote)) {
          const precoCompra = info.compra.preco;
          const precoVenda = info.venda.preco;

          if (precoCompra < Infinity && precoVenda > 0) {
            const taxaMercado = 0.04;
            const valorLiquido = precoVenda * (1 - taxaMercado);
            const lucroLiquido = Math.floor(valorLiquido - precoCompra);
            const margem = ((lucroLiquido / precoCompra) * 100).toFixed(1);

            if (lucroLiquido >= LUCRO_MINIMO) {
              const oportunidade = {
                ...info,
                lucroLiquido,
                margem
              };
              
              const linhaId = `item-${info.itemId}-Q${info.qualidade}`.replace(/[@.]/g, '_');
              const linhaExistente = document.getElementById(linhaId);

              if (linhaExistente) {
                linhaExistente.outerHTML = renderizarLinhaTabela(oportunidade);
              } else {
                tabelaCorpo.insertAdjacentHTML('beforeend', renderizarLinhaTabela(oportunidade));
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Erro ao buscar lote ${i + 1}:`, error);
    }

    await esperar(PAUSA_MS);
  }
}

async function iniciar() {
  const tabelaCorpo = document.getElementById('tabelaCorpo');
  tabelaCorpo.innerHTML = `
    <tr id="linhaMensagemCarregando">
      <td colspan="10" class="py-8 text-center text-gray-400">
        Carregando banco de dados de itens e nomes em português...
      </td>
    </tr>
  `;

  // Carrega apenas a lista estática de IDs de itens
  todosOsItens = await carregarTodosOsItensEquipaveis();

  if (todosOsItens.length > 0) {
    tabelaCorpo.innerHTML = `
      <tr>
        <td colspan="10" class="py-8 text-center text-gray-500">
          Clique em <b>Iniciar Monitoramento</b> para buscar oportunidades em tempo real.
        </td>
      </tr>
    `;
  }
}

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
  const tabelaCorpo = document.getElementById('tabelaCorpo');
  tabelaCorpo.innerHTML = `
    <tr id="linhaMensagemCarregando">
      <td colspan="10" class="py-8 text-center text-gray-400">
        Carregando banco de dados de itens e nomes em português...
      </td>
    </tr>
  `;

  const todosOsItens = await carregarTodosOsItensEquipaveis();

  if (todosOsItens.length > 0) {
    const msg = document.getElementById('linhaMensagemCarregando');
    if (msg) msg.remove();

    const rodarCiclo = async () => {
      await monitorarMercado(todosOsItens);
      setTimeout(rodarCiclo, 10000);
    };

    rodarCiclo();
  }
}

document.addEventListener('DOMContentLoaded', iniciar);