const BASE_URL = 'https://west.albion-online-data.com'; // Mude para europe ou east se necessário
const CIDADES_ORIGEM = ['Bridgewatch', 'FortSterling', 'Lymhurst', 'Martlock', 'Thetford'];
const CIDADES_DESTINO = ['Caerleon', 'BlackMarket'];

const LUCRO_MINIMO = 5000; 
const TAMANHO_LOTE = 40;   
const PAUSA_MS = 600;       

// Dicionário global para armazenar os nomes traduzidos
const mapaNomesItens = {};

function nomeQualidade(q) {
  const qualidades = { 1: 'Normal', 2: 'Bom', 3: 'Excelente', 4: 'Obra-Prima', 5: 'Lendário' };
  return qualidades[q] || `Qualidade ${q}`;
}

function obterEncantamentoTexto(itemId) {
  if (itemId.includes('@1')) return '1';
  if (itemId.includes('@2')) return '2';
  if (itemId.includes('@3')) return '3';
  if (itemId.includes('@4')) return '4';
  return '0';
}

// Extrai a ID base do item sem o sufixo @1, @2, etc.
function obterIdBase(itemId) {
  return itemId.split('@')[0];
}

async function carregarTodosOsItensEquipaveis() {
  console.log('Baixando lista de itens e nomes em português...');
  const urlItems = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json';
  
  try {
    const res = await fetch(urlItems);
    const data = await res.json();

    const itensFiltrados = [];

    data.forEach(item => {
      const id = item.UniqueName;

      // Filtra equipamentos T4 a T8
      const ehEquipamento = id.startsWith('T4_') || id.startsWith('T5_') || id.startsWith('T6_') || id.startsWith('T7_') || id.startsWith('T8_');
      const categoriasUteis = id.includes('_BAG') || id.includes('_CAPE') || id.includes('_MAIN_') || id.includes('_2HAND_') || id.includes('_HEAD_') || id.includes('_ARMOR_') || id.includes('_SHOES_');

      if (ehEquipamento && categoriasUteis && !id.includes('@')) {
        itensFiltrados.push(id);

        // Busca o nome em PT-BR em todas as variações de chave possíveis do JSON
        let nomePT = null;
        if (item.LocalizedNames) {
          nomePT = item.LocalizedNames['pt-BR'] || 
                   item.LocalizedNames['PT-BR'] || 
                   item.LocalizedNames['pt_BR'] || 
                   item.LocalizedNames['PT_BR'];
        }

        const nomeEN = item.LocalizedNames ? (item.LocalizedNames['EN-US'] || item.LocalizedNames['en-US']) : id;
        
        // Se encontrar em Português usa ele, senão cai para o Inglês ou ID
        mapaNomesItens[id] = nomePT || nomeEN || id;
      }
    });

    const itensUnicos = [...new Set(itensFiltrados)];

    // Gera encantamentos .0 a .4
    const listaFinal = [];
    itensUnicos.forEach(id => {
      listaFinal.push(id);
      for (let e = 1; e <= 4; e++) {
        listaFinal.push(`${id}@${e}`);
      }
    });

    console.log(`Lista carregada! Total de variações para monitorar: ${listaFinal.length}\n`);
    return listaFinal;
  } catch (error) {
    console.error('Erro ao baixar lista de itens:', error.message);
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

const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));

async function monitorarMercadoLoteCompleto(listaCompletaItens) {
  const lotes = criarLotes(listaCompletaItens, TAMANHO_LOTE);
  const todasCidades = [...CIDADES_ORIGEM, ...CIDADES_DESTINO].join(',');

  console.clear();
  console.log(`=== MONITORANDO EM TEMPO REAL COM NOMES EM PORTUGUÊS ===`);
  console.log(`Horário: ${new Date().toLocaleTimeString()}\n`);

  let oportunidadesTotais = 0;

  for (let i = 0; i < lotes.length; i++) {
    const loteAtual = lotes[i];
    const itemList = loteAtual.join(',');
    const url = `${BASE_URL}/api/v2/stats/prices/${itemList}.json?locations=${todasCidades}&qualities=1,2,3,4,5`;

    try {
      const response = await fetch(url);
      if (response.ok) {
        const dados = await response.json();
        const relatorioLote = {};

        dados.forEach(entry => {
          const itemId = entry.item_id;
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

          if (CIDADES_ORIGEM.includes(entry.city)) {
            if (entry.sell_price_min > 0 && entry.sell_price_min < relatorioLote[chave].compra.preco) {
              relatorioLote[chave].compra = { cidade: entry.city, preco: entry.sell_price_min };
            }
          }

          if (CIDADES_DESTINO.includes(entry.city)) {
            if (entry.buy_price_max > relatorioLote[chave].venda.preco) {
              relatorioLote[chave].venda = { cidade: entry.city, preco: entry.buy_price_max };
            }
          }
        });

        for (const [chave, info] of Object.entries(relatorioLote)) {
          const precoCompra = info.compra.preco;
          const precoVenda = info.venda.preco;

          if (precoCompra < Infinity && precoVenda > 0) {
            const taxaMercado = 0.08; // 8% SEM Premium, mas mudar para 0.04 (4%) caso seja COM Premium
            const valorLiquido = precoVenda * (1 - taxaMercado);
            const lucroLiquido = Math.floor(valorLiquido - precoCompra);
            const margem = ((lucroLiquido / precoCompra) * 100).toFixed(1);

            if (lucroLiquido >= LUCRO_MINIMO) {
              oportunidadesTotais++;
              
              // Busca o nome traduzido e formata com o nível de encantamento
              const idBase = obterIdBase(info.itemId);
              const nomeTraduzido = mapaNomesItens[idBase] || idBase;
              const encantamento = obterEncantamentoTexto(info.itemId);
              
              console.log(`[Lote ${i + 1}/${lotes.length}] Item: ${nomeTraduzido} (${info.itemId})`);
              console.log(`  Encantamento: ${encantamento}`)
              console.log(`  Qualidade: ${nomeQualidade(info.qualidade)}`);
              console.log(`  Comprar em: ${info.compra.cidade} por ${precoCompra.toLocaleString()} Silver`);
              console.log(`  Vender em:  ${info.venda.cidade} por ${precoVenda.toLocaleString()} Silver`);
              console.log(`  LUCRO REAL: +${lucroLiquido.toLocaleString()} Silver (${margem}%)\n`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Erro no lote ${i + 1}:`, error.message);
    }

    await esperar(PAUSA_MS);
  }

  console.log(`=== VARREDURA CONCLUÍDA. Total de oportunidades: ${oportunidadesTotais} ===\n`);
}

async function iniciar() {
  const todosOsItens = await carregarTodosOsItensEquipaveis();
  
  if (todosOsItens.length > 0) {
    const rodarCiclo = async () => {
      await monitorarMercadoLoteCompleto(todosOsItens);
      console.log('Iniciando próximo ciclo em 10 segundos...');
      setTimeout(rodarCiclo, 10000);
    };

    rodarCiclo();
  }
}

iniciar();