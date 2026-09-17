// Compartilhado pelo servidor e pela janela: uma única definição do tabuleiro.
export const RULES = Object.freeze({startingMoney:500000, lapBonus:50000, industryPrice:25000, chanceBonus:25000, repairs:15000, tax:18000, turnMs:75000, jailTurns:3});
export const money = value => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits:0}).format(value);
export const SIDE = 15;
export const JAIL = SIDE;
export const INDUSTRIES = [7, 22, 37, 52];
const places = [
  ['Avenida Ipiranga', 'São Paulo'], ['Avenida São João', 'São Paulo'], ['Rua Augusta', 'São Paulo'], ['Avenida Paulista', 'São Paulo'],
  ['Avenida Atlântica', 'Rio de Janeiro'], ['Rua Visconde de Pirajá', 'Rio de Janeiro'], ['Avenida Vieira Souto', 'Rio de Janeiro'], ['Avenida Rio Branco', 'Rio de Janeiro'],
  ['Avenida Afonso Pena', 'Belo Horizonte'], ['Rua da Bahia', 'Belo Horizonte'], ['Avenida do Contorno', 'Belo Horizonte'], ['Praça da Liberdade', 'Belo Horizonte'],
  ['Eixo Monumental', 'Brasília'], ['W3 Sul', 'Brasília'], ['L2 Norte', 'Brasília'], ['Esplanada dos Ministérios', 'Brasília'],
  ['Avenida Sete de Setembro', 'Salvador'], ['Avenida Oceânica', 'Salvador'], ['Rua Chile', 'Salvador'], ['Largo do Pelourinho', 'Salvador'],
  ['Avenida Boa Viagem', 'Recife'], ['Rua da Aurora', 'Recife'], ['Avenida Conde da Boa Vista', 'Recife'], ['Praça do Marco Zero', 'Recife'],
  ['Rua XV de Novembro', 'Curitiba'], ['Avenida do Batel', 'Curitiba'], ['Avenida Cândido de Abreu', 'Curitiba'], ['Praça Tiradentes', 'Curitiba'],
  ['Avenida Borges de Medeiros', 'Porto Alegre'], ['Rua dos Andradas', 'Porto Alegre'], ['Avenida Carlos Gomes', 'Porto Alegre'], ['Praça da Alfândega', 'Porto Alegre'],
  ['Avenida Beira-Mar', 'Fortaleza'], ['Avenida Monsenhor Tabosa', 'Fortaleza'], ['Avenida Eduardo Ribeiro', 'Manaus'], ['Largo de São Sebastião', 'Manaus'],
  ['Avenida Nazaré', 'Belém'], ['Rua das Pedras', 'Búzios'], ['Avenida das Cataratas', 'Foz do Iguaçu'], ['Avenida Beira-Mar Norte', 'Florianópolis']
];
const colors = ['#ed9e64', '#50bdd4', '#79bd8a', '#a389dc', '#efcb62', '#ef829a', '#8bcac0', '#bdb8ed', '#cfad7b', '#d5e77d'];
const special = new Map([
  [0, ['start', 'PARTIDA']], [15, ['jail', 'PRISÃO / VISITA']],
  [30, ['rest', 'FÉRIAS']], [45, ['go-to-jail', 'VÁ À PRISÃO']],
  ...[4,11,19,26,34,41,49,56].map(id => [id, ['event', 'SORTE']]),
  ...[13,28,43,58].map(id => [id, ['tax', 'IMPOSTO']])
]);
const factories = ['Indústria Solar', 'Indústria Naval', 'Indústria Digital', 'Indústria Metalúrgica'];
let property = 0;
export const board = Array.from({length: SIDE * 4}, (_, id) => {
  if (special.has(id)) return {id, type:special.get(id)[0], name:special.get(id)[1]};
  if (INDUSTRIES.includes(id)) return {id, type:'industry', name:factories[INDUSTRIES.indexOf(id)], color:'#77b4cf', price:RULES.industryPrice};
  const n = property++, group = Math.floor(n / 4);
  return {id, type:'property', name:places[n][0], city:places[n][1], group, color:colors[group], price:40000 + group * 12000, rent:3000 + group * 1200};
});
export const buyable = tile => tile?.type === 'property' || tile?.type === 'industry';
export const RENT_MULTIPLIERS = [1, 2, 3, 5, 8];
export const improvementCost = (tile, nextLevel) => Math.round(tile.price * (nextLevel === 4 ? .6 : .35));
export const ownsGroup = (gameBoard, properties, owner, group) => gameBoard
  .filter(tile => tile.type === 'property' && tile.group === group)
  .every(tile => properties[tile.id]?.owner === owner);
export const rentFor = (tile, lot, diceTotal, completeGroup = false) => tile.type === 'industry'
  ? tile.price * diceTotal
  : tile.rent * RENT_MULTIPLIERS[lot.level || 0] * (completeGroup && lot.level === 0 ? 2 : 1);

const smallSpecial = new Map([[0,['start','PARTIDA']],[8,['jail','PRISÃO / VISITA']],[16,['rest','FÉRIAS']],[24,['go-to-jail','VÁ À PRISÃO']],...[4,12,20,28].map(id=>[id,['event','SORTE']])]);
export const SMALL_INDUSTRIES = [2,10,18,26];
let smallProperty = 0;
export const smallBoard = Array.from({length:32}, (_, id) => {
  if (smallSpecial.has(id)) return {id,type:smallSpecial.get(id)[0],name:smallSpecial.get(id)[1]};
  if (SMALL_INDUSTRIES.includes(id)) return {id,type:'industry',name:factories[SMALL_INDUSTRIES.indexOf(id)],color:'#77b4cf',price:RULES.industryPrice};
  const n=smallProperty++, group=Math.floor(n/4);
  return {id,type:'property',name:places[n][0],city:places[n][1],group,color:colors[group],price:40000+group*12000,rent:3000+group*1200};
});
