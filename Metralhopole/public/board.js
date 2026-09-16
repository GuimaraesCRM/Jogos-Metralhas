// Compartilhado pelo servidor e pela janela: uma única definição do tabuleiro.
export const RULES = Object.freeze({startingMoney:500000, lapBonus:50000, industryPrice:25000, chanceBonus:25000, repairs:15000, tax:18000, turnMs:75000, jailTurns:3});
export const money = value => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits:0}).format(value);
export const SIDE = 15;
export const JAIL = SIDE;
export const INDUSTRIES = [7, 22, 37, 52];
const names = [
  'Vila Aurora', 'Rua das Flores', 'Praça Solar', 'Bairro Estrela',
  'Porto Azul', 'Marina', 'Ilha Coral', 'Cais do Sol',
  'Alameda Verde', 'Jardim Real', 'Parque Central', 'Bosque Vivo',
  'Avenida Neon', 'Distrito Tech', 'Torre Digital', 'Vale do Silício',
  'Praia Dourada', 'Costa Bela', 'Mirante', 'Vila das Ondas',
  'Boulevard', 'Palácio', 'Skyline', 'Praça Imperial',
  'Vila Serena', 'Lago Cristal', 'Ponte Nova', 'Jardim das Águas',
  'Mercado Central', 'Rua do Comércio', 'Galeria Real', 'Avenida Capital',
  'Colina Nobre', 'Solar dos Ventos', 'Vista Alta', 'Monte Belo',
  'Avenida Metralha', 'Praça dos Amigos', 'Distrito Diamante', 'Torre Metralhopole'
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
  return {id, type:'property', name:names[n], group, color:colors[group], price:40000 + group * 12000, rent:3000 + group * 1200};
});
export const buyable = tile => tile?.type === 'property' || tile?.type === 'industry';
export const rentFor = (tile, lot, diceTotal) => tile.type === 'industry' ? tile.price * diceTotal : tile.rent * (lot.level + 1);
