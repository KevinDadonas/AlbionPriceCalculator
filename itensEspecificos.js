let BASE_URL = 'https://west.albion-online-data.com'; // Mude a URL para europe ou east se necessário
let CIDADES_ORIGEM = ['Bridgewatch', 'FortSterling', 'Lymhurst', 'Martlock', 'Thetford'];
let CIDADES_DESTINO = ['Caerleon', 'BlackMarket'];

let LUCRO_MINIMO = 100;

let ITENS_BASE = [
  'T4_BAG',
  'T5_BAG',
  'T6_BAG',
  'T4_MAIN_HOLYSTAFF',
  'T5_MAIN_HOLYSTAFF',
  'T6_MAIN_HOLYSTAFF',
  'T4_2HAND_SWORD',
  'T5_2HAND_SWORD',
  'T6_2HAND_SWORD',
  'T4_HEAD_PLATE_SET1',
  'T5_HEAD_PLATE_SET1',
  'T4_ARMOR_PLATE_SET1',
  'T5_ARMOR_PLATE_SET1'
];

function gerarItensComEncantamento(listaBase) {
  let listaCompleta = [];
  listaBase.forEach(item => {
    listaCompleta.push(item);
    for (let e = 1; e <= 4; e++) {
      listaCompleta.push(`${item}@${e}`);
    }
  });
  return listaCompleta;
}

// Retorna o encantamento formatado em texto (ex: .0, .1, .2)
function obterEncantamentoTexto(itemId) {
  if (itemId.includes('@1')) return '1';
  if (itemId.includes('@2')) return '2';
  if (itemId.includes('@3')) return '3';
  if (itemId.includes('@4')) return '4';
  return '0'; // Se não tiver @, é o item base (.0)
}

// Mapeia o número da qualidade para o nome dentro do jogo
function nomeQualidade(q) {
  let qualidades = { 1: 'Normal', 2: 'Bom', 3: 'Excelente', 4: 'Obra-Prima', 5: 'Lendário' };
  return qualidades[q] || `Qualidade ${q}`;
}

async function monitorarMercado() {
  let todosOsItens = gerarItensComEncantamento(ITENS_BASE);
  let todasCidades = [...CIDADES_ORIGEM, ...CIDADES_DESTINO].join(',');
  let itemList = todosOsItens.join(',');
  
  let url = `${BASE_URL}/api/v2/stats/prices/${itemList}.json?locations=${todasCidades}&qualities=1,2,3,4,5`;

  try {
    let response = await fetch(url);
    if (!response.ok) throw new Error(`Erro na API: ${response.status}`);

    let dados = await response.json();
    let relatorio = {};

    dados.forEach(entry => {
      let itemId = entry.item_id;
      let qualidade = entry.quality;

      // Chave única para isolar Item + Qualidade (Ex: "T4_BAG@1_Q2")
      let chaveItemQualidade = `${itemId}_Q${qualidade}`;

      if (!relatorio[chaveItemQualidade]) {
        relatorio[chaveItemQualidade] = {
          itemId: itemId,
          qualidade: qualidade,
          compra: { cidade: '', preco: Infinity },
          venda: { cidade: '', preco: 0 }
        };
      }

      // 1. Pega menor compra apenas nas cidades seguras para ESTA qualidade específica
      if (CIDADES_ORIGEM.includes(entry.city)) {
        if (entry.sell_price_min > 0 && entry.sell_price_min < relatorio[chaveItemQualidade].compra.preco) {
          relatorio[chaveItemQualidade].compra = { 
            cidade: entry.city, 
            preco: entry.sell_price_min 
          };
        }
      }

      // 2. Pega maior venda apenas em Caerleon / BlackMarket para ESTA MESMA qualidade
      if (CIDADES_DESTINO.includes(entry.city)) {
        if (entry.buy_price_max > relatorio[chaveItemQualidade].venda.preco) {
          relatorio[chaveItemQualidade].venda = { 
            cidade: entry.city, 
            preco: entry.buy_price_max 
          };
        }
      }
    });

    console.clear();
    console.log(`=== MONITOR DE MERCADO (MESMA QUALIDADE E ENCANTAMENTO) ===`);
    console.log(`Horário: ${new Date().toLocaleTimeString()}\n`);

    let encontrados = 0;

    for (let [chave, info] of Object.entries(relatorio)) {
      let precoCompra = info.compra.preco;
      let precoVenda = info.venda.preco;

      // Garante que só compara se houver preço válido de compra e venda PARA A MESMA QUALIDADE
      if (precoCompra < Infinity && precoVenda > 0) {
        let taxaMercado = 0.04; // 4% Premium
        let valorLiquido = precoVenda * (1 - taxaMercado);
        let lucroLiquido = Math.floor(valorLiquido - precoCompra);
        let margem = ((lucroLiquido / precoCompra) * 100).toFixed(1);

        if (lucroLiquido >= LUCRO_MINIMO) {
          encontrados++;
          let encantamento = obterEncantamentoTexto(info.itemId);
          console.log(`Item: ${info.itemId} (Encantamento: ${encantamento}) | Qualidade: ${nomeQualidade(info.qualidade)}`);
          console.log(`  Comprar em: ${info.compra.cidade} por ${precoCompra.toLocaleString()} Silver`);
          console.log(`  Vender em:  ${info.venda.cidade} por ${precoVenda.toLocaleString()} Silver`);
          console.log(`  LUCRO REAL: +${lucroLiquido.toLocaleString()} Silver (${margem}%)\n`);
        }
      }
    }

    if (encontrados === 0) {
      console.log(`Nenhuma oportunidade encontrada com compra e venda da mesma qualidade no momento.`);
    }

  } catch (error) {
    console.error('Falha ao buscar dados:', error.message);
  }
}

monitorarMercado();
setInterval(monitorarMercado, 30000);