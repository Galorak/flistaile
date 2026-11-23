/* Flistaile — o guardião dos dois escudos. Jogo incremental. */
'use strict';
(() => {
  // ======================================================================
  // Constantes
  // ======================================================================
  const W = 900, H = 440, GROUND = 368, HX = 250, MX = 640;
  const SAVE_KEY = 'flistaile-save-v1';
  const KILLS_PER_ZONE = 10;
  const BOSS_TIME = 30;
  const PRESTIGE_ZONE = 30;
  const OFFLINE_CAP = 12 * 3600;
  const MAX_KILLS_PER_SEC = 4;

  // ======================================================================
  // Formatação
  // ======================================================================
  const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];
  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n);
    if (n < 1000) {
      const s = (n < 100 && n % 1 !== 0) ? (Math.floor(n * 10) / 10).toString() : Math.floor(n).toString();
      return s.replace('.', ',');
    }
    let e = Math.floor(Math.log10(n) / 3);
    let v = n / Math.pow(1000, e);
    if (v >= 1000) { e++; v /= 1000; }
    if (e < UNITS.length) {
      const s = v < 10 ? (Math.floor(v * 100) / 100).toFixed(2) : v < 100 ? (Math.floor(v * 10) / 10).toFixed(1) : Math.floor(v).toString();
      return s.replace('.', ',') + UNITS[e];
    }
    return n.toExponential(2).replace('e+', 'e').replace('.', ',');
  }
  function fmtTime(s) {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
    return `${sec}s`;
  }
  const pct = (x) => (Math.round(x * 1000) / 10).toString().replace('.', ',') + '%';
  function roman(n) {
    const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let r = '';
    for (const [v, s] of map) while (n >= v) { r += s; n -= v; }
    return r;
  }

  // ======================================================================
  // Dados do jogo
  // ======================================================================
  const TRAININGS = [
    { id: 'forca', icon: '💪', name: 'Força do Braço', type: 'click', base: 5, growth: 1.07, per: 1, unlock: 1,
      desc: 'Golpes de escudo mais pesados. Aumenta o dano por clique.' },
    { id: 'arremesso', icon: '🛡️', name: 'Arremesso de Escudo', type: 'dps', base: 25, growth: 1.07, per: 1.5, unlock: 1,
      desc: 'Um escudo espectral é arremessado sozinho contra o inimigo.' },
    { id: 'giro', icon: '🌀', name: 'Escudo Giratório', type: 'dps', base: 600, growth: 1.072, per: 10, unlock: 3,
      desc: 'Os escudos giram ao redor de Flistaile cortando tudo.' },
    { id: 'eco', icon: '🔔', name: 'Eco do Impacto', type: 'dps', base: 2.5e4, growth: 1.075, per: 90, unlock: 8,
      desc: 'Cada pancada ecoa e golpeia de novo.' },
    { id: 'bastiao', icon: '🔥', name: 'Fúria do Bastião', type: 'dps', base: 1.5e6, growth: 1.08, per: 800, unlock: 15,
      desc: 'A defesa vira ataque: os escudos ardem em chamas.' },
    { id: 'tempestade', icon: '⛈️', name: 'Tempestade de Escudos', type: 'dps', base: 2e8, growth: 1.085, per: 1e4, unlock: 25,
      desc: 'Uma chuva de escudos de luz cai do céu.' },
    { id: 'cometa', icon: '☄️', name: 'Cometa de Égide', type: 'dps', base: 5e10, growth: 1.09, per: 1.5e5, unlock: 40,
      desc: 'Flistaile lança o escudo como um cometa.' },
    { id: 'eclipse', icon: '🌑', name: 'Eclipse Gêmeo', type: 'dps', base: 2e13, growth: 1.095, per: 3e6, unlock: 60,
      desc: 'Os dois escudos se unem e apagam o sol do inimigo.' },
    { id: 'juramento', icon: '⚜️', name: 'Juramento Eterno', type: 'dps', base: 1e19, growth: 1.1, per: 4e9, unlock: 100,
      desc: 'Flistaile jura proteger Égide, e cada escudo responde ao chamado.' },
    { id: 'genese', icon: '🌌', name: 'Gênese da Égide', type: 'dps', base: 1e27, growth: 1.105, per: 2e13, unlock: 160,
      desc: 'O poder que forjou o primeiro escudo do mundo desperta.' },
  ];

  const ATTRS = [
    { id: 'precisao', icon: '🎯', name: 'Precisão', base: 150, growth: 1.55, max: 50, unlock: 1,
      desc: '+1% de chance de golpe crítico (máx. 50%).' },
    { id: 'impacto', icon: '💥', name: 'Impacto Esmagador', base: 400, growth: 1.6, unlock: 1,
      desc: '+50% de dano nos golpes críticos.' },
    { id: 'ganancia', icon: '💰', name: 'Ganância', base: 80, growth: 2.2, unlock: 1,
      desc: '+15% de ouro por criatura (multiplicativo).' },
    { id: 'sinergia', icon: '🔗', name: 'Sinergia', base: 3000, growth: 2.2, max: 25, unlock: 6,
      desc: 'Cada golpe recebe +1% do seu DPS.' },
  ];

  const TIERS = [
    { n: 'Madeira', c: '#9a6532', r: '#5a3a1a' },
    { n: 'Couro Batido', c: '#a8743e', r: '#6b4423' },
    { n: 'Bronze', c: '#cd7f32', r: '#7d4a1a' },
    { n: 'Ferro', c: '#8e959c', r: '#4f555c' },
    { n: 'Aço', c: '#c4ccd4', r: '#6e7882' },
    { n: 'Prata', c: '#e8edf3', r: '#8e9aa8' },
    { n: 'Ouro', c: '#ffd24a', r: '#a87e12' },
    { n: 'Mithril', c: '#a8f0ff', r: '#3f9cb8', glow: '#a8f0ff' },
    { n: 'Adamantina', c: '#8a52ff', r: '#3d1a8a', glow: '#b48aff' },
    { n: 'Rúnico', c: '#3cffb4', r: '#147a52', glow: '#3cffb4' },
    { n: 'Dracônico', c: '#ff5a2a', r: '#7a1606', glow: '#ff7a2a' },
    { n: 'Celestial', c: '#fff6c8', r: '#c9a43a', glow: '#fff2a0' },
    { n: 'Abissal', c: '#3a1a5a', r: '#ff2a9a', glow: '#ff2a9a' },
    { n: 'Eterno', c: '#ffffff', r: '#ffc800', glow: '#ffffff' },
  ];
  const tierOf = (l) => TIERS[Math.min(l, TIERS.length - 1)];
  const tierName = (l) => l < TIERS.length ? TIERS[l].n : `${TIERS[TIERS.length - 1].n} +${l - TIERS.length + 1}`;

  const SKILLS = [
    { id: 'furia', icon: '⚔️', name: 'Fúria Dupla', dur: 30, cd: 300, unlock: 10, desc: 'DPS ×2 por 30s.' },
    { id: 'rajada', icon: '👊', name: 'Rajada', dur: 30, cd: 420, unlock: 25, desc: '10 golpes automáticos por segundo durante 30s.' },
    { id: 'falcao', icon: '🦅', name: 'Olho do Falcão', dur: 30, cd: 480, unlock: 45, desc: '+50% de chance de crítico por 30s.' },
    { id: 'ouro', icon: '🪙', name: 'Chuva de Ouro', dur: 30, cd: 600, unlock: 70, desc: 'Ouro ×3 por 30s.' },
    { id: 'sismo', icon: '💢', name: 'Impacto Sísmico', dur: 0, cd: 600, unlock: 100, desc: 'Causa de uma vez 60s de DPS + 100 golpes.' },
    { id: 'grito', icon: '📯', name: 'Grito de Guerra', dur: 30, cd: 600, unlock: 140, desc: 'Golpes ×3 por 30s.' },
    { id: 'muralha', icon: '🧱', name: 'Muralha do Tempo', dur: 15, cd: 900, unlock: 185, desc: 'Congela o relógio do chefe por 15s.' },
    { id: 'ima', icon: '🧲', name: 'Ímã de Tesouros', dur: 30, cd: 1200, unlock: 240, desc: 'Baús Vivos aparecem muito mais por 30s.' },
    { id: 'eco', icon: '⏪', name: 'Eco Temporal', dur: 0, cd: 3600, unlock: 310, desc: 'Recarrega na hora todas as outras habilidades.' },
    { id: 'ascensao', icon: '🌟', name: 'Ascensão Gêmea', dur: 30, cd: 1800, unlock: 390, desc: 'Todo o dano ×5 por 30s.' },
  ];
  const SKILL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  const RELICS = [
    { id: 'egide', icon: '🏺', name: 'Égide Ancestral', desc: '+25% de todo o dano por nível.', cost: (l) => l + 1 },
    { id: 'bolsa', icon: '👝', name: 'Bolsa do Andarilho', desc: '+20% de ouro por nível.', cost: (l) => l + 1 },
    { id: 'mao', icon: '🧤', name: 'Luvas do Escudeiro', desc: 'Escudeiros trabalham 20% mais rápido.', cost: (l) => (l + 1) * 2, max: 20 },
    { id: 'ampulheta', icon: '⏳', name: 'Ampulheta de Bronze', desc: '+3s para derrotar chefes.', cost: (l) => Math.pow(2, l), max: 10 },
    { id: 'pressa', icon: '📜', name: 'Pergaminho da Pressa', desc: 'Habilidades recarregam 4% mais rápido.', cost: (l) => 2 + l * 2, max: 15 },
    { id: 'ferreiro', icon: '🔨', name: 'Bênção do Ferreiro', desc: 'Forjar escudos fica 4% mais barato.', cost: (l) => 2 + l * 2, max: 15 },
    { id: 'tesouro', icon: '🗝️', name: 'Faro de Tesouro', desc: '+1% de chance de aparecer um Baú Vivo.', cost: (l) => 3 + l, max: 10 },
  ];

  // Escudeiros (auto clickers): comprados com gemas, ficam após renascer
  const AC_COSTS = [3, 8, 15, 25, 40, 60, 90, 130, 180, 250];
  const AC_BASE_RATE = 5;
  const FINAL_ZONE = 500;

  const BIOMES = [
    { name: 'Campos Verdejantes', lore: 'Onde tudo começa: gosmas e lobos rondam as fazendas de Égide.', sky: ['#7ec0ff', '#d6efff'], hills: ['#8fcf7a', '#6eb35a'], ground: '#5fa83c', dirt: '#7a5a34', fx: 'leaves', clouds: true, sun: '#fff6c0',
      variants: [['Outonal', 'Outonal', '#d98a2b'], ['Florido', 'Florida', '#e58fb6']],
      monsters: [['Gosma', 'slime', '#6ad04a'], ['Cogumelo Raivoso', 'mushroom', '#d9473f'], ['Lobo Cinzento', 'beast', '#8a8f99'], ['Goblin Saqueador', 'goblin', '#7cb342', 'm'], ['Planta Faminta', 'plant', '#4caf50', 'f']] },
    { name: 'Floresta Sombria', lore: 'As árvores sussurram. Algo voa entre os galhos.', sky: ['#1e3a2e', '#5f8a66'], hills: ['#2f5a3a', '#244a2e'], ground: '#2f5a2a', dirt: '#3e2f22', fx: 'fireflies', moon: '#e8f5d0',
      variants: [['Musgoso', 'Musgosa', '#4f7a3a'], ['Noturno', 'Noturna', '#2e2a48']],
      monsters: [['Morcego Noturno', 'bat', '#5b3f7a'], ['Espírito do Bosque', 'ghost', '#9fe0c0'], ['Lobo Sombrio', 'beast', '#3e3a52'], ['Aranha da Mata', 'spider', '#5a4632', 'f'], ['Planta Carnívora', 'plant', '#3f8f3a', 'f']] },
    { name: 'Cavernas de Cristal', lore: 'Cristais brilham no escuro e golems guardam cada veio.', sky: ['#15142b', '#3a3670'], hills: ['#2c2a52', '#232145'], ground: '#4a4560', dirt: '#2f2b40', fx: 'sparkle', stars: true, crystals: true,
      variants: [['Ametista', 'Ametista', '#9a5ae0'], ['Safira', 'Safira', '#3a7ae0']],
      monsters: [['Golem de Cristal', 'golem', '#7fd6ff'], ['Olho Errante', 'eye', '#c86bff'], ['Gosma Cristalina', 'slime', '#58e0e0'], ['Aranha de Cristal', 'spider', '#7fb0ff', 'f'], ['Esqueleto Mineiro', 'skeleton', '#e8e0cc', 'm']] },
    { name: 'Deserto Escaldante', lore: 'O sol castiga. Nas dunas, os mortos ainda caminham.', sky: ['#f3a54e', '#ffe7a8'], hills: ['#e6b46a', '#d49a50'], ground: '#dcae62', dirt: '#b5823e', fx: 'dust', sun: '#fff1b0',
      variants: [['Arenoso', 'Arenosa', '#d8b070'], ['Escaldante', 'Escaldante', '#e0602a']],
      monsters: [['Chacal de Areia', 'beast', '#c08a4a'], ['Múmia Errante', 'ghost', '#e8dcb5'], ['Golem de Arenito', 'golem', '#d2a35f'], ['Serpente das Dunas', 'serpent', '#d9a441', 'f'], ['Esqueleto do Deserto', 'skeleton', '#f0e2c0', 'm']] },
    { name: 'Pântano Pútrido', lore: 'O ar pesa. Cada passo afunda na lama tóxica.', sky: ['#3d4a32', '#8a9a66'], hills: ['#4f6038', '#3e4d2c'], ground: '#4a5a30', dirt: '#33301e', fx: 'spores',
      variants: [['Lodoso', 'Lodosa', '#5d5a2c'], ['Venenoso', 'Venenosa', '#8a3fbf']],
      monsters: [['Gosma Tóxica', 'slime', '#9acd32'], ['Cogumelo Venenoso', 'mushroom', '#8a4fbf'], ['Olho do Lodo', 'eye', '#7aa83a'], ['Serpente do Lodo', 'serpent', '#5f7a2a', 'f'], ['Goblin do Brejo', 'goblin', '#6b8e23', 'm']] },
    { name: 'Tundra Congelada', lore: 'Um vento cortante. Os escudos de Flistaile ficam cobertos de gelo.', sky: ['#8fb9dc', '#eef7ff'], hills: ['#dbe9f5', '#c3d8ea'], ground: '#e9f3fb', dirt: '#9fb5c8', fx: 'snow', clouds: true,
      variants: [['Ártico', 'Ártica', '#bfe6ff'], ['Nevado', 'Nevada', '#f4f8ff']],
      monsters: [['Lobo do Gelo', 'beast', '#cfe6f5'], ['Golem de Gelo', 'golem', '#9fd8ff'], ['Espectro Gélido', 'ghost', '#bfe8ff'], ['Goblin da Neve', 'goblin', '#9fc3d6', 'm'], ['Aranha Glacial', 'spider', '#bfe0f5', 'f']] },
    { name: 'Cratera Vulcânica', lore: 'O chão ferve. Até as gosmas aqui são de magma.', sky: ['#2a0a08', '#a3361a'], hills: ['#4a1a12', '#33110c'], ground: '#3b2420', dirt: '#24130f', fx: 'embers', lava: true,
      variants: [['Incandescente', 'Incandescente', '#ffb43a'], ['Carbonizado', 'Carbonizada', '#3a2e2a']],
      monsters: [['Gosma de Magma', 'slime', '#ff6a1a'], ['Morcego Ígneo', 'bat', '#ff4a2a'], ['Golem de Obsidiana', 'golem', '#3a2f45'], ['Serpente de Fogo', 'serpent', '#ff5a1a', 'f'], ['Esqueleto Ardente', 'skeleton', '#ffcf9a', 'm']] },
    { name: 'Ruínas Celestes', lore: 'Templos flutuam acima das nuvens, vigiados por olhos dourados.', sky: ['#6f7fff', '#ffd6f5'], hills: ['#c8bfff', '#b0a6f0'], ground: '#cfc8ec', dirt: '#9a90c8', fx: 'motes', clouds: true,
      variants: [['Estelar', 'Estelar', '#7fa0ff'], ['Rosado', 'Rosada', '#ffa8d8']],
      monsters: [['Olho Celestial', 'eye', '#ffd84a'], ['Guardião Alado', 'bat', '#f0f0ff'], ['Espírito Astral', 'ghost', '#c9a8ff'], ['Planta Celeste', 'plant', '#ff9ad5', 'f'], ['Serpente Alada', 'serpent', '#a8e0ff', 'f']] },
    { name: 'Abismo Eterno', lore: 'O fim do mundo conhecido. Lá no fundo, algo devora estrelas.', sky: ['#05030d', '#2a0f3d'], hills: ['#1a0a2a', '#12061f'], ground: '#1a0f26', dirt: '#0d0714', fx: 'void', stars: true,
      variants: [['Abissal', 'Abissal', '#2a1a5a'], ['Carmesim', 'Carmesim', '#c0103a']],
      monsters: [['Devorador', 'beast', '#6a1a8a'], ['Olho do Vazio', 'eye', '#ff2a6a'], ['Sombra Primordial', 'ghost', '#4a3a7a'], ['Aranha do Vazio', 'spider', '#3a2a4a', 'f'], ['Esqueleto Ancestral', 'skeleton', '#b8a8d8', 'm']] },
  ];
  // as últimas 10 zonas antes do chefe final são sempre no Abismo
  const biomeIndex = (z) => (z > FINAL_ZONE - 10 && z <= FINAL_ZONE ? BIOMES.length - 1 : Math.floor((z - 1) / 10) % BIOMES.length);
  const biomeOf = (z) => BIOMES[biomeIndex(z)];

  // Conquistas: cada uma dá +3% de todo o dano; algumas dão gemas
  const ACH = [];
  {
    // cur(): valor atual; goal: meta. unit: como mostrar o que falta
    const add = (id, icon, name, desc, cur, goal, gems, unit) => ACH.push({ id, icon, name, desc, cur, goal, unit: unit || '', test: () => cur() >= goal, gems: gems || 0 });
    const minShield = () => Math.min(S.shields.left, S.shields.right);
    [10, 25, 50, 100, 150, 200, 300, 400].forEach((z, i) => add('z' + z, '🗺️', `Explorador ${roman(i + 1)}`, `Alcance a zona ${z}.`, () => S.stats.maxZoneEver, z, [1, 1, 2, 2, 3, 3, 4, 5][i], 'zona'));
    add('final', '👑', 'Fim do Devorador', `Derrote o chefe final da zona ${FINAL_ZONE}.`, () => (S.stats.finalBeaten ? FINAL_ZONE : Math.min(S.stats.maxZoneEver, FINAL_ZONE - 1)), FINAL_ZONE, 15, 'zona');
    [100, 1e3, 1e4, 1e5, 1e6].forEach((n, i) => add('k' + n, '⚔️', `Caçador ${roman(i + 1)}`, `Derrote ${fmt(n)} criaturas.`, () => S.stats.kills, n, i >= 2 ? 1 : 0, 'criatura'));
    [10, 100, 1000, 5000].forEach((n, i) => add('b' + n, '☠️', `Matador de Chefes ${roman(i + 1)}`, `Derrote ${fmt(n)} chefes.`, () => S.stats.bosses, n, i >= 1 ? 2 : 0, 'chefe'));
    [1000, 1e4, 1e5, 1e6].forEach((n, i) => add('c' + n, '👆', `Braço de Ferro ${roman(i + 1)}`, `Dê ${fmt(n)} golpes com as próprias mãos.`, () => S.stats.clicks, n, i >= 1 ? 1 : 0, 'golpe'));
    [1e6, 1e15, 1e30, 1e60, 1e100].forEach((n, i) => add('g' + i, '💰', `Tesoureiro ${roman(i + 1)}`, `Junte ${fmt(n)} de ouro no total.`, () => S.stats.goldTotal, n, i >= 2 ? 2 : 0, 'ouro'));
    [1, 5, 20, 50].forEach((n, i) => add('p' + n, '✨', `Renascido ${roman(i + 1)}`, `Renasça ${n} vez${n > 1 ? 'es' : ''}.`, () => S.stats.prestiges, n, 2, 'renascimento'));
    [10, 100, 500].forEach((n, i) => add('t' + n, '🗝️', `Caçador de Tesouros ${roman(i + 1)}`, `Abra ${n} Baús Vivos.`, () => S.stats.chests, n, 1, 'baú'));
    add('mithril', '🛡️', 'Mithril nos Dois Braços', 'Forje os dois escudos até Mithril.', minShield, 7, 2, 'forja');
    add('eterno', '💠', 'Escudos Eternos', 'Forje os dois escudos até Eterno.', minShield, 13, 5, 'forja');
    add('ac1', '🧤', 'Primeiro Escudeiro', 'Contrate um Escudeiro.', () => S.ac.owned, 1, 0, 'escudeiro');
    add('ac10', '🎖️', 'Exército de Escudeiros', 'Tenha 10 Escudeiros.', () => S.ac.owned, 10, 5, 'escudeiro');
    add('skills', '📖', 'Mestre das Técnicas', 'Use cada uma das 10 habilidades.', () => Object.keys(S.stats.skillUses || {}).length, SKILLS.length, 3, 'habilidade');
    add('lenda', '🏋️', 'Lenda do Treino', 'Leve um treino ao nível 1000.', () => Math.max(0, ...Object.values(S.trainings)), 1000, 3, 'nível');
  }

  // Parâmetros de balanceamento (ajustados com tools/sim.html)
  const BAL = {
    hpGrowth: 1.55, hpLateGrowth: 1.0, hpLateStart: 100, goldDiv: 5.5, bossHp: 7, finalHp: 10,
    soulsBase: 10, soulsGrowth: 1.22, soulsStep: 5, ms25: 2, ms100: 1, shieldMult: 1.6, shieldCost: 10,
  };

  // ======================================================================
  // Estado
  // ======================================================================
  function defaultState() {
    return {
      v: 2,
      gold: 0,
      zone: 1,
      maxZone: 1,
      zoneKills: 0,
      autoAdvance: true,
      trainings: {},
      shields: { left: 0, right: 0 },
      relics: {},
      souls: 0,
      gems: 0,
      ac: { owned: 0, assign: [] },
      achievements: {},
      skills: {},
      buyMode: 1,
      settings: { sound: true, numbers: true },
      stats: { clicks: 0, kills: 0, bosses: 0, goldTotal: 0, prestiges: 0, maxZoneEver: 1, playTime: 0, soulsTotal: 0, chests: 0, gemsTotal: 0, gemZone: 0, finalBeaten: false, skillUses: {}, startedAt: Date.now() },
      seenIntro: false,
      lastSave: Date.now(),
    };
  }
  function merge(def, d) {
    for (const k in d) {
      if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) && d[k] && typeof d[k] === 'object') def[k] = merge(def[k], d[k]);
      else def[k] = d[k];
    }
    return def;
  }
  let S = defaultState();
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) S = merge(defaultState(), JSON.parse(raw));
    } catch (e) { S = defaultState(); }
    sanitize();
  }
  function sanitize() {
    const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
    S.gold = Math.max(0, num(S.gold, 0));
    S.maxZone = Math.max(1, Math.floor(num(S.maxZone, 1)));
    S.zone = Math.min(S.maxZone, Math.max(1, Math.floor(num(S.zone, 1))));
    S.souls = Math.max(0, Math.floor(num(S.souls, 0)));
    S.gems = Math.max(0, Math.floor(num(S.gems, 0)));
    S.ac.owned = Math.max(0, Math.min(AC_COSTS.length, Math.floor(num(S.ac.owned, 0))));
    if (!Array.isArray(S.ac.assign)) S.ac.assign = [];
    S.ac.assign.length = S.ac.owned;
    for (let i = 0; i < S.ac.owned; i++) if (typeof S.ac.assign[i] !== 'string') S.ac.assign[i] = null;
    if (![1, 10, 25, 'max'].includes(S.buyMode)) S.buyMode = 1;
  }
  function save() {
    S.lastSave = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* armazenamento indisponível */ }
  }
  function exportSave() {
    S.lastSave = Date.now();
    return btoa(unescape(encodeURIComponent(JSON.stringify(S))));
  }
  function importSave(str) {
    const data = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
    if (!data || typeof data !== 'object' || !('gold' in data)) throw new Error('inválido');
    S = merge(defaultState(), data);
    sanitize();
    save();
  }

  // ======================================================================
  // Fórmulas
  // ======================================================================
  let clock = () => Date.now();
  const lvl = (id) => S.trainings[id] || 0;
  const rl = (id) => S.relics[id] || 0;
  const milestone = (l) => Math.pow(BAL.ms25, Math.floor(l / 25)) * Math.pow(BAL.ms100, Math.floor(l / 100));
  const nextMilestone = (l) => (Math.floor(l / 25) + 1) * 25;
  const shieldMult = (l) => Math.pow(BAL.shieldMult, l);
  const harmony = () => 1 + 0.15 * Math.min(S.shields.left, S.shields.right);
  const achCount = () => { let n = 0; for (const k in S.achievements) if (S.achievements[k]) n++; return n; };
  const achMult = () => 1 + 0.03 * achCount();
  const globalMult = () => (1 + 0.1 * S.souls) * (1 + 0.25 * rl('egide')) * harmony() * achMult();
  const trainPower = (t, l) => t.per * l * milestone(l);
  const buffAll = () => (skillActive('ascensao') ? 5 : 1);

  function monsterHP(z) {
    return Math.ceil(10 * Math.pow(BAL.hpGrowth, z - 1) * (z > BAL.hpLateStart ? Math.pow(BAL.hpLateGrowth, z - BAL.hpLateStart) : 1));
  }
  function baseGold(z) { return Math.max(1, Math.ceil(monsterHP(z) / BAL.goldDiv)); }
  const isBoss = (z) => z % 5 === 0;

  function rawDps() { let s = 0; for (const t of TRAININGS) if (t.type === 'dps') s += trainPower(t, lvl(t.id)); return s; }
  function baseDps() { return rawDps() * shieldMult(S.shields.right) * globalMult(); }
  function dps() { return baseDps() * (skillActive('furia') ? 2 : 1) * buffAll(); }
  function baseClick() {
    return (1 + trainPower(TRAININGS[0], lvl('forca'))) * shieldMult(S.shields.left) * globalMult() + baseDps() * 0.01 * lvl('sinergia');
  }
  function clickDmg() { return baseClick() * (skillActive('grito') ? 3 : 1) * buffAll(); }
  function critChance() { return Math.min(0.5, 0.01 * lvl('precisao')) + (skillActive('falcao') ? 0.5 : 0); }
  function critMult() { return 3 + 0.5 * lvl('impacto'); }
  function goldMult(withBuff = true) { return Math.pow(1.15, lvl('ganancia')) * (1 + 0.2 * rl('bolsa')) * (withBuff && skillActive('ouro') ? 3 : 1); }
  function autoClicks() { return skillActive('rajada') ? 10 : 0; }
  function acRate() { return AC_BASE_RATE * (1 + 0.2 * rl('mao')); }
  function acOn(target) { let n = 0; for (let i = 0; i < S.ac.owned; i++) if (S.ac.assign[i] === target) n++; return n; }
  function bossTime() { return BOSS_TIME + 3 * rl('ampulheta'); }
  function chestChance() { return Math.min(0.6, 0.015 + 0.01 * rl('tesouro') + (skillActive('ima') ? 0.3 : 0)); }
  function cdMult() { return 1 - 0.04 * rl('pressa'); }
  function shieldCost(side) {
    const l = S.shields[side];
    return (side === 'left' ? 80 : 300) * Math.pow(BAL.shieldCost, l) * (1 - 0.04 * rl('ferreiro'));
  }
  function soulsFor(z) { return z < PRESTIGE_ZONE ? 0 : Math.floor(BAL.soulsBase * Math.pow(BAL.soulsGrowth, (z - PRESTIGE_ZONE) / BAL.soulsStep)); }
  function costBulk(base, g, l, n) { return base * Math.pow(g, l) * (Math.pow(g, n) - 1) / (g - 1); }
  function maxAffordable(base, g, l, gold) {
    const first = base * Math.pow(g, l);
    if (gold < first) return 0;
    return Math.floor(Math.log(gold * (g - 1) / first + 1) / Math.log(g));
  }
  function avgClick() { const c = Math.min(1, critChance()); return clickDmg() * (1 - c + c * critMult()); }

  // ======================================================================
  // Habilidades
  // ======================================================================
  function skillActive(id) { const s = S.skills[id]; return !!s && s.until > clock(); }
  function skillReady(id) { const s = S.skills[id]; return !s || s.ready <= clock(); }
  function useSkill(id, silent) {
    const sk = SKILLS.find((s) => s.id === id);
    if (!sk || S.maxZone < sk.unlock || !skillReady(id)) return false;
    const now = clock();
    S.skills[id] = { until: now + sk.dur * 1000, ready: now + sk.cd * cdMult() * 1000 };
    S.stats.skillUses[id] = (S.stats.skillUses[id] || 0) + 1;
    Sfx.skill();
    if (id === 'sismo') {
      shakeT = 0.6;
      if (M && !M.dying) {
        const d = (baseDps() * 60 + baseClick() * 100) * buffAll();
        addFloat(MX, GROUND - 170, fmt(d), '#ffb14a', 34);
        burst(MX, GROUND - 60, '#ffb14a', 30);
        damage(d, false);
      }
    }
    if (id === 'eco') {
      for (const o of SKILLS) if (o.id !== 'eco' && S.skills[o.id]) S.skills[o.id].ready = now;
    }
    if (!silent) toast(`${sk.icon} ${sk.name}!`);
    return true;
  }

  // ======================================================================
  // Gemas, escudeiros e conquistas
  // ======================================================================
  function addGems(n, why) {
    if (n <= 0) return;
    S.gems += n;
    S.stats.gemsTotal += n;
    toast(`💎 +${n} gema${n > 1 ? 's' : ''}${why ? ' — ' + why : ''}`, 'gem');
  }
  function acNextCost() { return S.ac.owned < AC_COSTS.length ? AC_COSTS[S.ac.owned] : Infinity; }
  function buyAutoclicker() {
    const c = acNextCost();
    if (S.gems < c) return;
    S.gems -= c;
    S.ac.owned++;
    S.ac.assign.push(null);
    Sfx.buy();
    toast('🧤 Novo Escudeiro! Arraste-o para o monstro, uma habilidade ou um botão de compra.', 'gold');
    acDirty = true;
  }
  function checkAchievements() {
    for (const a of ACH) {
      if (S.achievements[a.id] || !a.test()) continue;
      S.achievements[a.id] = true;
      toast(`🏆 Conquista: ${a.name}`, 'gold');
      if (a.gems) addGems(a.gems);
      shopDirty = true;
    }
  }

  // ======================================================================
  // Monstros e combate
  // ======================================================================
  let M = null;
  let corpses = [];
  const DEATH_T = 0.9;
  const DEATHS = ['launch', 'squash', 'sink', 'spin', 'pop', 'soul'];
  // a Dourada é rara e vale em todo lugar; as outras cores vêm de cada mapa (BIOMES[].variants)
  const GOLD_VARIANT = { id: 'ouro', m: 'Dourado', f: 'Dourada', color: '#ffc83a', gold: 3 };
  function spawnMonster() {
    const z = S.zone;
    const boss = isBoss(z);
    const final = z === FINAL_ZONE;
    const chest = !boss && Math.random() < chestChance();
    const b = biomeOf(z);
    const cycle = Math.floor((z - 1) / (10 * BIOMES.length));
    let spec;
    if (final) spec = ['Devorador de Mundos', 'eye', '#ff2a6a', 'm'];
    else if (chest) spec = ['Baú Vivo', 'chest', '#b07a3a', 'm'];
    else if (boss) spec = b.monsters[Math.floor(z / 5) % b.monsters.length];
    else spec = b.monsters[Math.floor(Math.random() * b.monsters.length)];
    let name = spec[0], color = spec[2];
    const fem = (spec[3] || (/^(Gosma|Múmia|Sombra|Aranha|Serpente|Planta)/.test(name) ? 'f' : 'm')) === 'f';
    // variações de cor: mudam a cor e o nome (a dourada é rara e dá mais ouro)
    let variant = null;
    if (!final && !chest) {
      if (!boss && Math.random() < 0.02) variant = GOLD_VARIANT;
      else if (b.variants && Math.random() < (boss ? 0.12 : 0.22)) {
        const v = b.variants[Math.floor(Math.random() * b.variants.length)];
        if (!name.includes(v[0].slice(0, 5))) variant = { id: 'cor', m: v[0], f: v[1], color: v[2] };
      }
    }
    if (variant) { color = variant.color; name += ' ' + (fem ? variant.f : variant.m); }
    if (boss && !final) name += z % 10 === 0 ? (fem ? ' Soberana' : ' Soberano') : ' Colossal';
    if (cycle > 0 && !final) name += ' ' + roman(Math.min(cycle + 1, 39));
    const hp = monsterHP(z) * (final ? BAL.finalHp : boss ? BAL.bossHp : 1) * (chest ? 0.5 : 1);
    M = {
      name, shape: spec[1], color, fem, variant: variant ? variant.id : null, boss, chest, final, hp, maxHp: hp,
      gold: baseGold(z) * (final ? 100 : boss ? 6 : 1) * (chest ? 15 : 1) * (variant && variant.gold ? variant.gold : 1),
      size: final ? 1.8 : boss ? 1.4 : 0.9 + Math.random() * 0.2,
      hit: 0, dying: 0, spawn: 0, time: boss ? bossTime() * (final ? 2 : 1) : 0, seed: Math.random() * 10,
    };
    hudDirty = true;
    puff(MX, GROUND - 30, 6);
  }

  function damage(d, silent) {
    if (!M || M.dying > 0) return;
    M.hp -= d;
    if (!silent) M.hit = 1;
    if (M.hp <= 0) kill();
  }

  function kill() {
    const g = M.gold * goldMult();
    S.gold += g;
    S.stats.goldTotal += g;
    S.stats.kills++;
    if (M.boss) S.stats.bosses++;
    if (M.chest) S.stats.chests++;
    M.hp = 0;
    M.dying = 0.0001;
    // jeito de morrer: fantasmas sobem como alma, o resto varia
    M.death = M.shape === 'ghost' && Math.random() < 0.6 ? 'soul' : DEATHS[Math.floor(Math.random() * DEATHS.length)];
    if (M.final) M.death = 'pop';
    burst(MX, GROUND - 60 * M.size, M.color, (M.boss ? 30 : 16) + (M.death === 'pop' ? 20 : 0));
    if (M.death === 'pop') parts.push({ x: MX, y: GROUND - 70 * M.size, vx: 0, vy: 0, g: 0, life: 0, max: 0.35, type: 'ring', color: M.color, r0: 20, r1: 120 * M.size });
    if (M.death === 'squash' || M.death === 'sink') puff(MX, GROUND - 6, 5);
    if (M.variant === 'ouro') coins(MX, GROUND - 80, 10);
    coins(MX, GROUND - 60, M.boss || M.chest ? 14 : 6);
    addFloat(MX, GROUND - 130 * M.size - 20, '+' + fmt(g), '#ffd24a', M.boss || M.chest ? 28 : 22);
    Sfx.coin();
    if (M.boss) toast(`☠ ${M.name} derrotad${M.fem ? 'a' : 'o'}!`, 'gold');
    else if (M.variant === 'ouro') toast(`✨ ${M.name}! Ouro ×3`, 'gold');
    if (M.chest) toast(`🗝️ Baú Vivo! +${fmt(g)} de ouro`, 'gold');
    // gemas: todo chefe derrotado pela primeira vez dá 1 gema; depois, chance pequena
    if (M.boss) {
      if (S.zone > S.stats.gemZone) { S.stats.gemZone = S.zone; addGems(M.final ? 10 : 1, 'primeiro chefe'); }
      else if (Math.random() < 0.04) addGems(1);
    }
    if (M.chest && Math.random() < 0.03) addGems(1);
    if (M.final && !S.stats.finalBeaten) { S.stats.finalBeaten = true; setTimeout(showEnding, 900); }
    if (S.zone === S.maxZone) {
      if (M.boss) unlockNext();
      else if (++S.zoneKills >= KILLS_PER_ZONE) unlockNext();
    }
    hudDirty = true;
  }

  function unlockNext() {
    const firstTime = S.maxZone + 1 > S.stats.maxZoneEver;
    S.maxZone++;
    S.zoneKills = 0;
    if (S.maxZone > S.stats.maxZoneEver) S.stats.maxZoneEver = S.maxZone;
    if (S.autoAdvance) S.zone = S.maxZone;
    for (const sk of SKILLS) if (sk.unlock === S.maxZone) toast(`Nova habilidade: ${sk.icon} ${sk.name}`, 'gold');
    for (const t of TRAININGS) if (t.unlock === S.maxZone && t.unlock > 1) toast(`Novo treino: ${t.icon} ${t.name}`);
    for (const a of ATTRS) if (a.unlock === S.maxZone && a.unlock > 1) toast(`Novo atributo: ${a.icon} ${a.name}`);
    if (S.maxZone === PRESTIGE_ZONE) toast('✨ Renascimento liberado na aba Relíquias!', 'gold');
    if (biomeIndex(S.maxZone) !== biomeIndex(S.maxZone - 1)) {
      const b = biomeOf(S.maxZone);
      toast(firstTime ? `${b.name}: ${b.lore}` : `Você chegou a: ${b.name}`);
    }
    if (S.maxZone === FINAL_ZONE) toast('👁 O Devorador de Mundos espera por você...', 'bad');
    shopDirty = true;
    zonesDirty = true;
  }

  function bossFail() {
    toast(`${M.name} resistiu! Fortaleça Flistaile e tente de novo.`, 'bad');
    S.autoAdvance = false;
    S.zone = Math.max(1, S.zone - 1);
    zonesDirty = true;
    spawnMonster();
  }

  let autoSide = 'L';
  function attack(auto, side) {
    if (!auto) { S.stats.clicks++; if (introClicks < 6) introClicks++; }
    side = side || (autoSide = autoSide === 'L' ? 'R' : 'L');
    if (!M || M.dying > 0 || M.spawn < 0.5) { if (!auto) heroCharge(side); return; }
    const crit = Math.random() < critChance();
    const d = clickDmg() * (crit ? critMult() : 1);
    if (crit) side = 'B';
    if (!auto) heroCharge(side); else if (hero.pos > 0.9 && Math.max(hero.bashL, hero.bashR) < 0.3) heroBash(side, 0.7);
    const fx = MX + (Math.random() - 0.5) * 80, fy = GROUND - 110 * M.size - Math.random() * 40;
    if (crit) addFloat(fx, fy, 'CRÍTICO ' + fmt(d), '#ff9a3c', 26);
    else if (!auto || Math.random() < 0.25) addFloat(fx, fy, fmt(d), '#ffffff', auto ? 16 : 20);
    sparks(MX - 40 * M.size, GROUND - 70 * M.size, crit ? '#ffb14a' : '#fff6c0', crit ? 10 : 5);
    if (!auto || Math.random() < 0.25) impact(MX - 40 * M.size, GROUND - 75 * M.size, crit);
    if (!auto || Math.random() < 0.2) Sfx.hit(crit);
    damage(d, false);
  }

  function setZone(z) {
    z = Math.max(1, Math.min(S.maxZone, z));
    if (z === S.zone) return;
    if (z < S.maxZone) S.autoAdvance = false;
    S.zone = z;
    zonesDirty = true;
    spawnMonster();
  }

  // Ganhos em bloco (aba em segundo plano ou ausência)
  function bulkGains(secs) {
    let z = S.zone;
    if (isBoss(z) && z > 1) z--;
    const hp = monsterHP(z);
    const eff = baseDps() + acOn('arena') * acRate() * avgClick();
    const kps = Math.min(MAX_KILLS_PER_SEC, eff / hp);
    const kills = Math.floor(kps * secs);
    const gold = kills * baseGold(z) * goldMult(false);
    S.gold += gold;
    S.stats.goldTotal += gold;
    S.stats.kills += kills;
    return { kills, gold };
  }

  // ======================================================================
  // Renascimento
  // ======================================================================
  function prestige() {
    const gain = soulsFor(S.maxZone);
    if (gain <= 0) return;
    const keep = {
      souls: S.souls + gain, relics: S.relics, settings: S.settings, seenIntro: true, buyMode: S.buyMode,
      gems: S.gems, ac: S.ac, achievements: S.achievements,
      stats: Object.assign({}, S.stats, { prestiges: S.stats.prestiges + 1, soulsTotal: S.stats.soulsTotal + gain }),
    };
    S = Object.assign(defaultState(), keep);
    save();
    spawnMonster();
    shopDirty = true; zonesDirty = true; acDirty = true;
    toast(`✨ Flistaile renasceu com +${fmt(gain)} Égides!`, 'gold');
    Sfx.skill();
  }

  // ======================================================================
  // Efeitos visuais
  // ======================================================================
  const hero = { pos: 0, vel: 0, step: 0, bashL: 0, bashR: 0, dashT: 0, pendingBash: null, x: HX };
  // side: 'L' (escudo esquerdo), 'R' (escudo direito) ou 'B' (os dois, no crítico)
  function heroBash(side, v) {
    if (side !== 'R') hero.bashL = Math.max(hero.bashL, v);
    if (side !== 'L') hero.bashR = Math.max(hero.bashR, v);
  }
  // clique: Flistaile corre até o monstro e dá uma escudada; se continuar clicando, fica lá golpeando
  function heroCharge(side) {
    hero.dashT = 0.55;
    if (hero.pos >= 0.9) { hero.bashL = hero.bashR = 0; heroBash(side, 1); }
    else hero.pendingBash = hero.pendingBash && hero.pendingBash !== side ? 'B' : side;
  }
  function updateHero(dt) {
    const prev = hero.pos;
    hero.dashT = Math.max(0, hero.dashT - dt);
    if (hero.dashT > 0) hero.pos = Math.min(1, hero.pos + dt * 5.5);
    else hero.pos = Math.max(0, hero.pos - dt * 2.4);
    const v = dt > 0 ? (hero.pos - prev) / dt : 0;
    hero.vel += ((v / 5.5) * 1.6 - hero.vel) * Math.min(1, dt * 20);
    if (Math.abs(v) > 0.01) hero.step += dt * 16;
    hero.bashL = Math.max(0, hero.bashL - dt * 5);
    hero.bashR = Math.max(0, hero.bashR - dt * 5);
    if (hero.pendingBash && hero.pos >= 0.9) {
      heroBash(hero.pendingBash, 1);
      hero.pendingBash = null;
      shakeT = Math.max(shakeT, 0.18);
      if (M && !M.dying) impact(heroX() + 100, GROUND - 76, false);
    }
    hero.x = heroX();
  }
  let floats = [], parts = [], projs = [];
  let shakeT = 0, critFlash = 0, projTimer = 0, dpsAcc = 0, dpsTimer = 0, autoAcc = 0, introClicks = 0;

  function addFloat(x, y, text, color, size) {
    if (!S.settings.numbers && color !== '#ffd24a') return;
    floats.push({ x, y, text, color, size, life: 0, max: 1.1 });
    if (floats.length > 40) floats.shift();
  }
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 220;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0, max: 0.5 + Math.random() * 0.4, color, size: 3 + Math.random() * 5, g: 400, type: 'puff' });
    }
  }
  function sparks(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (Math.random() - 0.5) * 2.2, s = 120 + Math.random() * 260;
      parts.push({ x, y, vx: -Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0, max: 0.25 + Math.random() * 0.25, color, size: 2 + Math.random() * 2.5, g: 300, type: 'spark' });
    }
    if (parts.length > 260) parts.splice(0, parts.length - 260);
  }
  function coins(x, y, n) {
    for (let i = 0; i < n; i++) {
      parts.push({ x, y, vx: (Math.random() - 0.5) * 260, vy: -220 - Math.random() * 200, life: 0, max: 0.9 + Math.random() * 0.3, color: '#ffd24a', size: 6, g: 700, type: 'coin', floor: GROUND - 4 });
    }
  }

  // ======================================================================
  // Som (WebAudio sintetizado)
  // ======================================================================
  const Sfx = {
    ac: null,
    init() { if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ac = null; } } },
    tone(freq, dur, type, vol, slide) {
      if (!S.settings.sound || !this.ac) return;
      const t = this.ac.currentTime;
      const o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ac.destination); o.start(t); o.stop(t + dur);
    },
    hit(crit) { this.tone(crit ? 220 : 160, 0.12, 'square', 0.035, 60); },
    coin() { this.tone(880, 0.08, 'triangle', 0.05); setTimeout(() => this.tone(1320, 0.12, 'triangle', 0.04), 60); },
    skill() { this.tone(330, 0.3, 'sawtooth', 0.04, 990); },
    buy() { this.tone(660, 0.07, 'triangle', 0.04, 990); },
  };

  // ======================================================================
  // Canvas e desenho
  // ======================================================================
  const cv = document.getElementById('cv') || document.createElement('canvas');
  const ctx = cv.getContext('2d');
  let sx = 1, sy = 1;
  function resize() {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    sx = cv.width / W; sy = cv.height / H;
  }

  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    const r = Math.round(A[0] + (B[0] - A[0]) * t), g = Math.round(A[1] + (B[1] - A[1]) * t), bl = Math.round(A[2] + (B[2] - A[2]) * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }
  const shade = (c, t) => (t >= 0 ? mix(c, '#ffffff', t) : mix(c, '#000000', -t));
  // ---- contorno estilo desenho animado ----
  const OLC = '#1b1426';
  let OL = false;
  function outline(on) { OL = on; }
  function strokeOL(lw) { ctx.strokeStyle = OLC; ctx.lineWidth = lw || 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  function fillOL() { ctx.fill(); if (OL) strokeOL(); }
  function ellipse(x, y, rx, ry, rot) {
    rx = Math.max(0, rx); ry = Math.max(0, ry);
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); ctx.fill();
    if (OL && rx > 2.5 && ry > 2.5) strokeOL(Math.min(3, Math.min(rx, ry) * 0.3));
  }
  function rrect(x, y, w, h, r) {
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); ctx.fill();
    if (OL) strokeOL(Math.min(3, Math.min(w, h) * 0.25));
  }
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---- cenário (pré-renderizado por bioma) ----
  const bgCache = { idx: -1, canvas: null };
  let vignette = null;
  const BIOME_PROPS = [
    { far: ['tree', '#4f9a3a'], near: ['tree', '#5fb244'], rock: '#8c8c84' },
    { far: ['pine', '#1f4a30'], near: ['pine', '#2a5a3a'], rock: '#4a4a52' },
    { far: ['crystal', '#5fa8d8'], near: ['crystal', '#b66bff'], rock: '#3a3658' },
    { far: ['cactus', '#7aa05a'], near: ['cactus', '#5f9a4a'], rock: '#b38a56' },
    { far: ['deadtree', '#3a3a28'], near: ['deadtree', '#2a281a'], rock: '#4a4a36' },
    { far: ['ice', '#cfe4f4'], near: ['ice', '#dff0ff'], rock: '#9fb5c8' },
    { far: ['spire', '#3a1a14'], near: ['spire', '#2a120e'], rock: '#2a1a18' },
    { far: ['pillar', '#e6e0ff'], near: ['pillar', '#f4f0ff'], rock: '#b0a6d8' },
    { far: ['spire', '#24103a'], near: ['spire', '#1a0a2a'], rock: '#1a0f26' },
  ];
  function rrg(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill(); }
  const PROPS = {
    tree(g, x, y, s, col) {
      g.fillStyle = shade(col, -0.6); rrg(g, x - 6 * s, y - 64 * s, 12 * s, 64 * s, 3 * s);
      for (const [dx, dy, r] of [[-22, -72, 28], [22, -76, 30], [0, -102, 34]]) {
        const cx = x + dx * s, cy = y + dy * s, rr = r * s;
        const gr = g.createRadialGradient(cx - rr * 0.4, cy - rr * 0.5, rr * 0.1, cx, cy, rr);
        gr.addColorStop(0, shade(col, 0.3)); gr.addColorStop(1, shade(col, -0.2));
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill();
      }
    },
    pine(g, x, y, s, col) {
      g.fillStyle = shade(col, -0.45); g.fillRect(x - 4 * s, y - 22 * s, 8 * s, 22 * s);
      for (let i = 0; i < 4; i++) {
        const w = (36 - i * 7) * s, base = y - (16 + 26 * i) * s;
        g.fillStyle = shade(col, -0.08 + i * 0.07);
        g.beginPath(); g.moveTo(x - w, base); g.lineTo(x, base - 44 * s); g.lineTo(x + w, base); g.closePath(); g.fill();
      }
    },
    cactus(g, x, y, s, col) {
      g.fillStyle = col;
      rrg(g, x - 9 * s, y - 74 * s, 18 * s, 74 * s, 9 * s);
      rrg(g, x - 28 * s, y - 52 * s, 11 * s, 28 * s, 5.5 * s); rrg(g, x - 28 * s, y - 32 * s, 22 * s, 10 * s, 5 * s);
      rrg(g, x + 17 * s, y - 62 * s, 11 * s, 26 * s, 5.5 * s); rrg(g, x + 6 * s, y - 44 * s, 22 * s, 10 * s, 5 * s);
      g.fillStyle = shade(col, 0.25); rrg(g, x - 5 * s, y - 70 * s, 4 * s, 62 * s, 2 * s);
    },
    deadtree(g, x, y, s, col, R) {
      g.strokeStyle = col; g.lineCap = 'round';
      const br = (bx, by, ang, len, w, d) => {
        const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
        g.lineWidth = w; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
        if (d > 0) { br(ex, ey, ang - 0.5 - R() * 0.3, len * 0.68, w * 0.62, d - 1); br(ex, ey, ang + 0.45 + R() * 0.3, len * 0.62, w * 0.62, d - 1); }
      };
      br(x, y, -Math.PI / 2 + (R() - 0.5) * 0.2, 50 * s, 10 * s, 3);
    },
    ice(g, x, y, s, col) {
      for (const [dx, h, w] of [[-14, 70, 14], [8, 96, 16], [26, 54, 11]]) {
        const bx = x + dx * s;
        g.fillStyle = col; g.beginPath(); g.moveTo(bx - w * s, y); g.lineTo(bx, y - h * s); g.lineTo(bx + w * s, y); g.closePath(); g.fill();
        g.save(); g.globalAlpha *= 0.6; g.fillStyle = '#ffffff';
        g.beginPath(); g.moveTo(bx - w * s * 0.6, y); g.lineTo(bx, y - h * s); g.lineTo(bx - w * s * 0.1, y); g.closePath(); g.fill(); g.restore();
      }
    },
    rock(g, x, y, s, col, R) {
      const pts = [];
      for (let i = 0; i <= 6; i++) { const a = Math.PI + (i / 6) * Math.PI; pts.push([x + Math.cos(a) * (30 + R() * 10) * s, y + Math.sin(a) * (22 + R() * 14) * s]); }
      g.fillStyle = col; g.beginPath(); g.moveTo(pts[0][0], y); for (const p of pts) g.lineTo(p[0], p[1]); g.closePath(); g.fill();
      g.fillStyle = shade(col, 0.2); g.beginPath(); g.moveTo(pts[1][0], pts[1][1]); g.lineTo(pts[2][0], pts[2][1]); g.lineTo(pts[3][0], pts[3][1]); g.lineTo(x - 4 * s, y - 8 * s); g.closePath(); g.fill();
    },
    spire(g, x, y, s, col, R) {
      const h = (90 + R() * 70) * s, w = (16 + R() * 8) * s;
      g.fillStyle = col; g.beginPath(); g.moveTo(x - w, y); g.lineTo(x - w * 0.3, y - h * 0.6); g.lineTo(x, y - h); g.lineTo(x + w * 0.4, y - h * 0.55); g.lineTo(x + w, y); g.closePath(); g.fill();
      g.fillStyle = shade(col, 0.15); g.beginPath(); g.moveTo(x - w, y); g.lineTo(x - w * 0.3, y - h * 0.6); g.lineTo(x, y - h); g.lineTo(x - w * 0.05, y); g.closePath(); g.fill();
    },
    pillar(g, x, y, s, col, R) {
      const h = (80 + R() * 60) * s, w = 22 * s;
      g.fillStyle = shade(col, -0.12); g.fillRect(x - w * 0.8, y - h, w * 1.6, h);
      g.fillStyle = col; g.fillRect(x - w * 0.8, y - h, w * 0.7, h);
      g.fillStyle = shade(col, -0.25); for (let i = 1; i < 4; i++) g.fillRect(x - w * 0.8 + i * w * 0.4, y - h, 2 * s, h);
      g.fillStyle = shade(col, 0.05); g.fillRect(x - w * 1.1, y - 10 * s, w * 2.2, 10 * s);
      g.fillStyle = shade(col, -0.12); g.beginPath(); g.moveTo(x - w * 0.8, y - h); g.lineTo(x - w * 0.3, y - h - 12 * s); g.lineTo(x + w * 0.1, y - h - 4 * s); g.lineTo(x + w * 0.5, y - h - 16 * s); g.lineTo(x + w * 0.8, y - h); g.closePath(); g.fill();
    },
    crystal(g, x, y, s, col) {
      for (const [dx, h, w, a] of [[-12, 60, 12, -0.25], [4, 92, 15, 0.05], [20, 50, 10, 0.3]]) {
        g.save(); g.translate(x + dx * s, y); g.rotate(a);
        g.fillStyle = col; g.beginPath(); g.moveTo(-w * s, 0); g.lineTo(-w * s, -h * s * 0.75); g.lineTo(0, -h * s); g.lineTo(w * s, -h * s * 0.75); g.lineTo(w * s, 0); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(-w * s, 0); g.lineTo(-w * s, -h * s * 0.75); g.lineTo(0, -h * s); g.lineTo(0, 0); g.closePath(); g.fill();
        g.restore();
      }
    },
  };

  function buildVignette() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const v = g.createRadialGradient(W / 2, H * 0.52, H * 0.38, W / 2, H * 0.52, W * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,5,24,.5)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    vignette = c;
  }

  function buildBg(idx) {
    const b = BIOMES[idx], P = BIOME_PROPS[idx];
    const c = document.createElement('canvas');
    c.width = W * 2; c.height = H * 2;
    const g = c.getContext('2d');
    g.scale(2, 2);
    const R = rng(idx * 131 + 7);
    const sky = g.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, b.sky[0]); sky.addColorStop(0.65, mix(b.sky[0], b.sky[1], 0.7)); sky.addColorStop(1, b.sky[1]);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    if (b.stars) {
      for (let i = 0; i < 110; i++) { g.globalAlpha = 0.25 + R() * 0.75; g.fillStyle = '#ffffff'; const r = R() < 0.1 ? 1.6 : 0.9; g.beginPath(); g.arc(R() * W, R() * GROUND * 0.8, r, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
    }
    if (b.sun) {
      g.save(); g.globalAlpha = 0.1; g.fillStyle = b.sun;
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * 0.55 + i * 0.2 + R() * 0.05, len = 700;
        g.beginPath(); g.moveTo(720, 80); g.lineTo(720 + Math.cos(a - 0.04) * len, 80 + Math.sin(a - 0.04) * len); g.lineTo(720 + Math.cos(a + 0.04) * len, 80 + Math.sin(a + 0.04) * len); g.closePath(); g.fill();
      }
      g.restore();
      const sg = g.createRadialGradient(720, 80, 10, 720, 80, 130);
      sg.addColorStop(0, b.sun); sg.addColorStop(0.3, b.sun + 'aa'); sg.addColorStop(1, b.sun + '00');
      g.fillStyle = sg; g.fillRect(560, 0, 340, 240);
      g.fillStyle = b.sun; g.beginPath(); g.arc(720, 80, 30, 0, Math.PI * 2); g.fill();
    }
    if (b.moon) {
      const mg = g.createRadialGradient(160, 70, 10, 160, 70, 90);
      mg.addColorStop(0, b.moon + '55'); mg.addColorStop(1, b.moon + '00');
      g.fillStyle = mg; g.fillRect(60, 0, 200, 170);
      g.fillStyle = b.moon; g.globalAlpha = 0.95; g.beginPath(); g.arc(160, 70, 26, 0, Math.PI * 2); g.fill();
      g.fillStyle = b.sky[0]; g.beginPath(); g.arc(172, 62, 24, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    }
    // montanhas distantes
    g.fillStyle = mix(b.hills[0], b.sky[1], 0.55);
    g.beginPath(); g.moveTo(0, GROUND);
    let mx = -20;
    g.lineTo(mx, GROUND - 120);
    while (mx < W + 40) { g.lineTo(mx + 40 + R() * 30, GROUND - 160 - R() * 90); mx += 90 + R() * 70; g.lineTo(mx, GROUND - 105 - R() * 40); }
    g.lineTo(W, GROUND); g.closePath(); g.fill();
    // névoa
    const haze = g.createLinearGradient(0, GROUND - 200, 0, GROUND);
    haze.addColorStop(0, b.sky[1] + '00'); haze.addColorStop(1, b.sky[1] + '88');
    g.fillStyle = haze; g.fillRect(0, GROUND - 200, W, 200);
    const hill = (layer) => {
      g.fillStyle = b.hills[layer];
      g.beginPath(); g.moveTo(0, GROUND);
      const base = GROUND - (layer === 0 ? 110 : 50), amp = layer === 0 ? 40 : 26, f1 = 0.006 + layer * 0.004, ph = R() * 10;
      for (let x = 0; x <= W; x += 10) g.lineTo(x, base - Math.sin(x * f1 + ph) * amp - Math.sin(x * f1 * 2.7 + ph * 2) * amp * 0.4);
      g.lineTo(W, GROUND); g.closePath(); g.fill();
    };
    hill(0);
    // elementos distantes
    for (let i = 0; i < 8; i++) {
      const x = (i + R() * 0.8) * (W / 8), s = 0.42 + R() * 0.2;
      PROPS[P.far[0]](g, x, GROUND - 55 - R() * 22, s, mix(P.far[1], b.sky[1], 0.35), R);
    }
    hill(1);
    if (b.crystals) {
      for (let i = 0; i < 6; i++) PROPS.crystal(g, R() * W, GROUND - 8, 0.35 + R() * 0.2, ['#7fd6ff', '#c86bff', '#58e0e0'][i % 3] + 'aa', R);
    }
    // elementos próximos (nas bordas, longe dos lutadores)
    for (let i = 0; i < 4; i++) {
      const x = i < 2 ? 15 + i * 85 + R() * 40 : 760 + (i - 2) * 85 + R() * 40;
      PROPS[P.near[0]](g, x, GROUND - 2, 0.8 + R() * 0.35, P.near[1], R);
    }
    PROPS.rock(g, 120 + R() * 40, GROUND - 2, 0.6, P.rock, R);
    PROPS.rock(g, 820 + R() * 40, GROUND - 2, 0.75, P.rock, R);
    // chão
    const gg = g.createLinearGradient(0, GROUND - 8, 0, H);
    gg.addColorStop(0, shade(b.ground, 0.12)); gg.addColorStop(0.14, b.ground); gg.addColorStop(0.15, shade(b.dirt, 0.1)); gg.addColorStop(1, shade(b.dirt, -0.4));
    g.fillStyle = gg; g.fillRect(0, GROUND - 8, W, H - GROUND + 8);
    g.fillStyle = shade(b.ground, 0.12);
    for (let x = 0; x <= W; x += 16) { g.beginPath(); g.arc(x + R() * 4, GROUND - 7, 7 + R() * 3, Math.PI, 0); g.fill(); }
    g.fillStyle = shade(b.ground, -0.25); g.fillRect(0, GROUND + 3, W, 3);
    for (let i = 0; i < 55; i++) {
      const sx2 = R() * W, sy2 = GROUND + 18 + R() * (H - GROUND - 22), r = 2 + R() * 7;
      g.fillStyle = shade(b.dirt, -0.25); g.beginPath(); g.ellipse(sx2, sy2, r, r * 0.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = shade(b.dirt, 0.2); g.beginPath(); g.ellipse(sx2 - r * 0.2, sy2 - r * 0.2, r * 0.5, r * 0.25, 0, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 90; i++) {
      const x = R() * W; g.strokeStyle = shade(b.ground, -0.25 + R() * 0.35); g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, GROUND - 6); g.lineTo(x + (R() - 0.5) * 7, GROUND - 13 - R() * 9); g.stroke();
    }
    // trilha clara sob os lutadores
    const tr = g.createRadialGradient(W / 2 - 10, GROUND + 6, 10, W / 2 - 10, GROUND + 6, 340);
    tr.addColorStop(0, 'rgba(255,255,255,.12)'); tr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = tr; g.fillRect(0, GROUND - 10, W, 60);
    if (b.lava) {
      for (let i = 0; i < 5; i++) {
        const lx = R() * W, ly = GROUND + 45 + R() * 20, rx = 40 + R() * 50;
        const lg = g.createRadialGradient(lx, ly, 2, lx, ly, rx);
        lg.addColorStop(0, '#ffd06a'); lg.addColorStop(0.5, '#ff6a1a'); lg.addColorStop(1, 'rgba(163,32,10,0)');
        g.fillStyle = lg; g.beginPath(); g.ellipse(lx, ly, rx, 8, 0, 0, Math.PI * 2); g.fill();
      }
    }
    bgCache.idx = idx; bgCache.canvas = c;
  }

  function drawAmbient(t, b) {
    if (b.clouds) {
      for (let i = 0; i < 3; i++) {
        const x = ((i * 340 + t * (8 + i * 4)) % (W + 240)) - 120, y = 50 + i * 38;
        ctx.fillStyle = 'rgba(160,180,220,.35)'; ellipse(x + 4, y + 6, 50, 15);
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ellipse(x, y, 46, 16); ellipse(x + 30, y - 10, 30, 16); ellipse(x - 28, y - 4, 26, 12); ellipse(x + 8, y - 16, 22, 14);
      }
    }
    const n = 28;
    for (let i = 0; i < n; i++) {
      const f = (i * 0.6180339) % 1, f2 = (i * 0.3819) % 1;
      let x, y, r = 2, col, a = 1;
      switch (b.fx) {
        case 'snow': x = (f * W + Math.sin(t + i) * 20 + t * 15) % W; y = (f2 * H + t * (30 + f * 30)) % GROUND; col = '#ffffff'; r = 1.5 + f * 2; break;
        case 'embers': x = (f * W + Math.sin(t * 2 + i) * 15) % W; y = GROUND - ((f2 * GROUND + t * (30 + f * 40)) % GROUND); col = f > 0.5 ? '#ffb14a' : '#ff5a2a'; r = 1.5 + f * 1.5; break;
        case 'fireflies': x = f * W + Math.sin(t * 0.7 + i) * 30; y = 120 + f2 * 220 + Math.cos(t * 0.9 + i * 2) * 20; col = '#e8ff8a'; a = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)); r = 2; break;
        case 'sparkle': x = f * W; y = 30 + f2 * 300; col = '#bfefff'; a = Math.max(0, Math.sin(t * 2 + i * 1.7)); r = 1.5; break;
        case 'dust': x = (f * W + t * (40 + f * 60)) % W; y = GROUND - 10 - f2 * 120; col = '#fff0c8'; a = 0.5; r = 1.5; break;
        case 'spores': x = f * W + Math.sin(t * 0.5 + i) * 25; y = GROUND - ((f2 * 300 + t * 12) % 300); col = '#d8ff9a'; a = 0.6; r = 2; break;
        case 'motes': x = f * W + Math.sin(t * 0.4 + i) * 20; y = 40 + ((f2 * 300 + t * 10) % 300); col = '#fff7d6'; a = 0.4 + 0.6 * Math.abs(Math.sin(t + i)); r = 2; break;
        case 'void': x = f * W + Math.sin(t * 0.3 + i) * 40; y = 60 + f2 * 280; col = '#c46bff'; a = 0.3 + 0.4 * Math.abs(Math.sin(t * 1.3 + i)); r = 2.5; break;
        default: x = (f * W + t * (20 + f * 20)) % W; y = 150 + f2 * 180 + Math.sin(t * 2 + i) * 10; col = '#9fdc6a'; a = 0.7; r = 2.5; break;
      }
      ctx.globalAlpha = a; ctx.fillStyle = col; ellipse(x, y, r, r);
      if (b.fx === 'fireflies' || b.fx === 'void' || b.fx === 'embers') { ctx.globalAlpha = a * 0.25; ellipse(x, y, r * 3, r * 3); }
    }
    ctx.globalAlpha = 1;
  }

  // ---- escudo ----
  function shieldPath(w, h) {
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2 + 7);
    ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + 7, -h / 2);
    ctx.lineTo(w / 2 - 7, -h / 2);
    ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + 7);
    ctx.lineTo(w / 2, -h * 0.05);
    ctx.quadraticCurveTo(w / 2, h * 0.3, 0, h / 2);
    ctx.quadraticCurveTo(-w / 2, h * 0.3, -w / 2, -h * 0.05);
    ctx.closePath();
  }
  function drawShield(level, w, h, t, back, alpha) {
    const tier = tierOf(level);
    const prevOL = OL;
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    if (prevOL) { shieldPath(w, h); ctx.lineWidth = 9; ctx.strokeStyle = OLC; ctx.lineJoin = 'round'; ctx.stroke(); }
    OL = false;
    if (tier.glow) { ctx.shadowColor = tier.glow; ctx.shadowBlur = 16 + Math.sin(t * 3) * 6 + Math.max(0, level - TIERS.length + 1) * 2; }
    shieldPath(w, h);
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, shade(tier.c, 0.4)); g.addColorStop(0.45, tier.c); g.addColorStop(1, shade(tier.c, -0.35));
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save(); shieldPath(w, h); ctx.clip();
    if (level < 2) {
      ctx.strokeStyle = shade(tier.c, -0.35); ctx.lineWidth = 2;
      for (const x of [-w / 4, 0, w / 4]) { ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2); ctx.stroke(); }
      ctx.strokeStyle = shade(tier.c, -0.2); ctx.lineWidth = 1;
      for (const x of [-w / 8 * 3, -w / 8, w / 8, w / 8 * 3]) { ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.quadraticCurveTo(x + 3, 0, x - 1, h / 2); ctx.stroke(); }
    }
    if (level >= 4) {
      ctx.strokeStyle = shade(tier.r, 0.15); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, h / 2); ctx.moveTo(-w / 2, -h * 0.1); ctx.lineTo(w / 2, -h * 0.1); ctx.stroke();
    }
    // brilho que corre pelo escudo
    const sweep = ((t * 0.35 + level * 0.13) % 1.6) - 0.3;
    const sg = ctx.createLinearGradient(-w / 2 + sweep * w * 1.4 - 12, -h / 2, -w / 2 + sweep * w * 1.4 + 12, h / 2);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, `rgba(255,255,255,${level >= 3 ? 0.35 : 0.12})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.beginPath(); ctx.ellipse(-w * 0.18, -h * 0.25, w * 0.2, h * 0.16, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.lineWidth = 5; ctx.strokeStyle = tier.r; shieldPath(w, h); ctx.stroke();
    ctx.save(); ctx.scale(0.84, 0.86); ctx.lineWidth = 1.5; ctx.strokeStyle = shade(tier.c, 0.45); ctx.globalAlpha *= 0.7; shieldPath(w, h); ctx.stroke(); ctx.restore();
    if (level >= 3) {
      ctx.fillStyle = shade(tier.r, 0.35);
      for (const [rx, ry] of [[-w / 2 + 6, -h / 2 + 6], [w / 2 - 6, -h / 2 + 6], [-w / 2 + 5, -h * 0.05], [w / 2 - 5, -h * 0.05]]) ellipse(rx, ry, 2.2, 2.2);
    }
    if (level >= 2) {
      ctx.fillStyle = tier.r; ellipse(0, -h * 0.1, w * 0.17, w * 0.17);
      const bg = ctx.createRadialGradient(-w * 0.03, -h * 0.13, 1, 0, -h * 0.1, w * 0.1);
      bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, shade(tier.c, 0.2));
      ctx.fillStyle = bg; ellipse(0, -h * 0.1, w * 0.09, w * 0.09);
    } else {
      ctx.strokeStyle = tier.r; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-w * 0.18, -h * 0.05); ctx.lineTo(0, h * 0.1); ctx.lineTo(w * 0.18, -h * 0.05); ctx.stroke();
    }
    if (level >= 7) {
      ctx.strokeStyle = tier.glow || '#fff'; ctx.lineWidth = 1.5; ctx.globalAlpha *= 0.7 + 0.3 * Math.sin(t * 4);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5, r = w * 0.3;
        const px = Math.cos(a) * r, py = -h * 0.1 + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
    }
    if (back) { ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * 0.22; ctx.fillStyle = '#000'; shieldPath(w, h); ctx.fill(); }
    ctx.restore();
    OL = prevOL;
  }

  // ---- herói ----
  function limb(x1, y1, x2, y2, col, w) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = OLC; ctx.lineWidth = w + 5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function steel(x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#f4f7fb'); g.addColorStop(0.45, '#b4bfcc'); g.addColorStop(1, '#5f6b7e');
    return g;
  }
  // posição de contato: na frente do monstro, com o escudo encostando nele
  function heroContactX() { return M ? MX - 78 - 58 * M.size : MX - 150; }
  const easeIO = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  function heroX() { return HX + easeIO(hero.pos) * (heroContactX() - HX); }

  function drawLeg(hipX, ang, bend) {
    ctx.save(); ctx.translate(hipX, -46); ctx.rotate(ang);
    // coxa e canela
    ctx.fillStyle = '#34395a'; rrect(-6.5, -2, 13, 26, 5);
    ctx.save(); ctx.translate(0, 22); ctx.rotate(bend);
    ctx.fillStyle = '#34395a'; rrect(-6, -2, 12, 14, 4);
    // bota com bico para a frente
    const bg = ctx.createLinearGradient(0, 8, 0, 24); bg.addColorStop(0, '#8a5a34'); bg.addColorStop(1, '#4e3018');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(7, 8); ctx.quadraticCurveTo(9, 16, 17, 17); ctx.quadraticCurveTo(21, 19, 19, 24); ctx.lineTo(-8, 24); ctx.closePath(); fillOL();
    ctx.fillStyle = '#ffd24a'; noOL(() => rrect(-7, 10, 13, 3, 1.5));
    ctx.restore();
    // joelheira
    ctx.fillStyle = steel(-7, 16, 7, 28); ellipse(0.5, 22, 8, 6.5);
    ctx.restore();
  }

  function drawHero(t) {
    const hx = heroX();
    const bL = hero.bashL > 0 ? Math.sin((1 - hero.bashL) * Math.PI) : 0;
    const bR = hero.bashR > 0 ? Math.sin((1 - hero.bashR) * Math.PI) : 0;
    const bash = Math.max(bL, bR);
    const run = Math.min(1, Math.abs(hero.vel));
    const stride = Math.sin(hero.step) * run;
    const idle = 1 - run;
    const br = Math.sin(t * 2.6) * idle;
    const hop = -Math.abs(Math.sin(hero.step)) * 6 * run;
    const lean = Math.max(-0.12, Math.min(0.22, hero.vel * 0.16)) + bash * 0.16;
    ctx.save();
    ctx.translate(hx, GROUND);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ellipse(0, 2, 46 + bash * 6, 10);
    ctx.translate(0, hop);
    ctx.rotate(lean);
    outline(true);
    const wave = Math.sin(t * 4) * 5 + run * 16 + bash * 10;

    // capa
    const cg = ctx.createLinearGradient(-8, -104, -52, -24);
    cg.addColorStop(0, '#e8503f'); cg.addColorStop(1, '#7a1a16');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.moveTo(-6, -102 + br);
    ctx.quadraticCurveTo(-34 - wave, -72, -50 - wave * 1.2, -26 + run * 6);
    ctx.quadraticCurveTo(-40 - wave * 0.8, -20 + run * 4, -30 - wave * 0.4, -28);
    ctx.quadraticCurveTo(-26, -34, -22, -24);
    ctx.quadraticCurveTo(-18, -60, -2, -96 + br); ctx.closePath(); fillOL();
    ctx.fillStyle = '#a8261e'; noOL(() => { ctx.beginPath(); ctx.moveTo(-8, -100 + br); ctx.quadraticCurveTo(-26 - wave * 0.6, -70, -36 - wave, -30); ctx.lineTo(-30 - wave * 0.8, -30); ctx.quadraticCurveTo(-20 - wave * 0.4, -66, -6, -98 + br); ctx.fill(); });

    // Flistaile olha para a direita: o braço de trás é o ESQUERDO e o da frente é o DIREITO.
    // braço e escudo de trás (mão esquerda), em guarda; na escudada com ele é desenhado na frente
    if (bL <= 0.02) {
      limb(-4, -92 + br, -22, -84 - bR * 6, '#24507f', 11);
      ctx.save(); ctx.translate(-36, -82 - bR * 8 + br); ctx.rotate(-0.16 - bR * 0.2 - run * 0.15); drawShield(S.shields.left, 48, 60, t, true); ctx.restore();
    }

    // pernas (a de trás primeiro)
    drawLeg(-8, -0.55 * stride - bash * 0.35, Math.max(0, stride) * 0.7 + bash * 0.2);
    drawLeg(8, 0.55 * stride + bash * 0.45, Math.max(0, -stride) * 0.7);

    ctx.save(); ctx.translate(0, br * 0.8);
    // saiote de placas
    ctx.fillStyle = '#2f6fb3';
    ctx.beginPath(); ctx.moveTo(-20, -60); ctx.lineTo(22, -60); ctx.quadraticCurveTo(28, -48, 24, -38); ctx.quadraticCurveTo(2, -32, -22, -38); ctx.quadraticCurveTo(-25, -48, -20, -60); ctx.closePath(); fillOL();
    noOL(() => {
      ctx.strokeStyle = '#1f4f88'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-6, -58); ctx.lineTo(-8, -36); ctx.moveTo(9, -58); ctx.lineTo(10, -35); ctx.stroke();
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(-21, -41, 45, 2.5);
    });
    // peitoral arredondado
    const pg2 = ctx.createRadialGradient(10, -92, 4, 2, -82, 34);
    pg2.addColorStop(0, '#ffffff'); pg2.addColorStop(0.35, '#c9d2de'); pg2.addColorStop(1, '#5f6b7e');
    ctx.fillStyle = pg2;
    ctx.beginPath(); ctx.moveTo(-17, -104); ctx.quadraticCurveTo(2, -110, 21, -104); ctx.quadraticCurveTo(28, -84, 21, -60); ctx.lineTo(-18, -60); ctx.quadraticCurveTo(-24, -84, -17, -104); ctx.closePath(); fillOL();
    noOL(() => {
      ctx.strokeStyle = 'rgba(70,80,100,.55)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(4, -106); ctx.quadraticCurveTo(7, -84, 3, -62); ctx.stroke();
      // emblema: duas divisas douradas
      ctx.strokeStyle = '#d99a24'; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-3, -92); ctx.lineTo(5, -85); ctx.lineTo(13, -92); ctx.moveTo(-3, -84); ctx.lineTo(5, -77); ctx.lineTo(13, -84); ctx.stroke();
    });
    // cinto
    ctx.fillStyle = '#5a3a22'; rrect(-20, -64, 44, 9, 3);
    ctx.fillStyle = '#ffd24a'; rrect(1, -65.5, 11, 12, 2.5);
    noOL(() => { ctx.fillStyle = '#5a3a22'; ctx.fillRect(4, -62, 5, 6); });

    // cabeça (mais redonda e um pouco maior)
    ctx.save(); ctx.translate(4, -128); ctx.rotate(-lean * 0.4);
    ctx.fillStyle = '#f2c79b'; ellipse(5, 3, 18, 18.5);
    // rosto
    noOL(() => {
      ctx.fillStyle = 'rgba(255,140,120,.4)'; ellipse(15.5, 11, 4, 2.6);
      const blink = (t % 4.2) > 4.05 ? 0.15 : 1;
      ctx.fillStyle = '#ffffff'; ellipse(11.5, 3, 4.8, 5.8 * blink);
      if (blink > 0.5) {
        ctx.fillStyle = '#2b4a8a'; ellipse(13, 3.8, 3.2, 4);
        ctx.fillStyle = '#0f1426'; ellipse(13.5, 4.2, 1.7, 2.2);
        ctx.fillStyle = '#ffffff'; ellipse(11.8, 2, 1.3, 1.3);
      }
      ctx.strokeStyle = '#4a2a16'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      const frown = bash * 2 + run;
      ctx.beginPath(); ctx.moveTo(6.5, -4 + frown * 0.6); ctx.lineTo(17, -3.5 - frown * 0.8); ctx.stroke();
      // nariz
      ctx.fillStyle = '#e4a77e'; ellipse(21, 8, 2.6, 2.2);
      // boca: sorriso confiante, grito na escudada
      ctx.strokeStyle = '#7a3a22'; ctx.lineWidth = 1.9;
      if (bash > 0.3) { ctx.fillStyle = '#7a2a22'; ellipse(15, 15, 3.2, 2.8 * bash); }
      else { ctx.beginPath(); ctx.moveTo(11, 14.5); ctx.quadraticCurveTo(15, 17, 18.5, 13.5); ctx.stroke(); }
    });
    // elmo de viseira aberta: cobre o topo e a nuca, deixa o rosto à mostra
    ctx.fillStyle = steel(-16, -22, 20, 10);
    ctx.beginPath();
    ctx.moveTo(22, -8); ctx.quadraticCurveTo(20, -25, 2, -25); ctx.quadraticCurveTo(-21, -25, -20, -2);
    ctx.lineTo(-19, 15); ctx.quadraticCurveTo(-11, 20, -3, 16); ctx.lineTo(-2, -2); ctx.quadraticCurveTo(7, -9, 22, -8);
    ctx.closePath(); fillOL();
    noOL(() => {
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ellipse(-7, -16, 8, 3.2, -0.35);
      ctx.fillStyle = '#8e99a8'; ctx.fillRect(-18, -3, 16, 3);
      ctx.fillStyle = '#ffd24a'; ellipse(-13, 6, 1.8, 1.8); ellipse(-8, 10, 1.8, 1.8);
    });
    // aba do elmo (testeira)
    ctx.fillStyle = steel(-4, -14, 24, -8); rrect(-3, -14, 27, 6, 3);
    // penacho
    const plg = ctx.createLinearGradient(2, -40, -34, -8);
    plg.addColorStop(0, '#ff7a54'); plg.addColorStop(1, '#a8221a');
    ctx.fillStyle = plg;
    ctx.beginPath(); ctx.moveTo(4, -21); ctx.quadraticCurveTo(-8, -46, -36 - wave * 0.7, -26 + run * 6); ctx.quadraticCurveTo(-24, -26, -16, -18); ctx.quadraticCurveTo(-6, -28, 0, -20); ctx.closePath(); fillOL();
    ctx.restore();

    // ombreira da frente
    ctx.fillStyle = steel(4, -106, 26, -88); ellipse(14, -97, 13, 9.5, -0.25);
    noOL(() => { ctx.fillStyle = '#ffd24a'; ellipse(14, -97, 2, 2); });
    ctx.restore();

    // braço da frente + escudo da mão direita: avança reto contra o monstro na escudada
    const push = bR * 32 - bL * 14;
    const fy = -66 - bR * 4 + bL * 6;
    limb(14, -92 + br, 34 + push * 0.6, fy - 6, '#2f6fb3', 12);
    ctx.fillStyle = steel(28 + push * 0.6, fy - 14, 40 + push * 0.6, fy); ellipse(34 + push * 0.6, fy - 7, 7, 6);
    ctx.save();
    ctx.translate(44 + push, fy);
    ctx.rotate(0.08 + run * 0.12 - bR * 0.1);
    const sc = 1 + bR * 0.08;
    ctx.scale(sc, sc);
    drawShield(S.shields.right, 60, 74, t, false);
    ctx.restore();
    // escudada com o escudo esquerdo: o braço de trás avança reto, na altura do peito, por cima do outro escudo
    if (bL > 0.02) {
      const lx = -36 + bL * 112, ly = -82 - bL * 8 + br;
      limb(-2, -94 + br, lx - 10, ly + 2, '#24507f', 11);
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(-0.16 + bL * 0.22);
      const ls = 1 + bL * 0.14; ctx.scale(ls, ls);
      drawShield(S.shields.left, 48, 60, t, false);
      ctx.restore();
    }
    outline(false);
    ctx.restore();

    // rastro de velocidade durante a investida
    if (hero.vel > 0.4) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, (hero.vel - 0.4) * 0.6);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const y = GROUND - 30 - i * 26, len = 30 + i * 10;
        ctx.beginPath(); ctx.moveTo(hx - 50 - len, y); ctx.lineTo(hx - 50, y); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ---- monstros ----
  let flashT = 0;
  const fc = (c) => (flashT > 0 ? mix(c, '#ffe0c8', flashT * 0.22) : c);
  function bodyGrad(c, x, y, r) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.08, x, y, r * 1.1);
    g.addColorStop(0, fc(shade(c, 0.35))); g.addColorStop(0.55, fc(c)); g.addColorStop(1, fc(shade(c, -0.35)));
    return g;
  }
  function eyes(x1, x2, y, r, angry, pupil) {
    for (const x of [x1, x2]) {
      ctx.fillStyle = fc('#ffffff'); ellipse(x, y, r, r * 1.1);
      const was = OL; OL = false;
      ctx.fillStyle = pupil || '#1a1020'; ellipse(x - r * 0.35, y + r * 0.1, r * 0.5, r * 0.6);
      ctx.fillStyle = '#ffffff'; ellipse(x - r * 0.5, y - r * 0.15, r * 0.17, r * 0.17);
      OL = was;
    }
    if (angry) {
      ctx.strokeStyle = OLC; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1 - r, y - r * 1.4); ctx.lineTo(x1 + r, y - r * 0.8); ctx.moveTo(x2 - r, y - r * 0.8); ctx.lineTo(x2 + r, y - r * 1.4); ctx.stroke();
    }
  }
  function noOL(fn) { const was = OL; OL = false; fn(); OL = was; }
  const TOPS = { slime: 100, mushroom: 108, beast: 104, bat: 160, golem: 160, ghost: 160, eye: 165, chest: 96, goblin: 130, spider: 92, serpent: 150, skeleton: 146, plant: 152 };
  // traço com contorno (pernas, caules, pescoços)
  function curveOL(col, w, fn) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = OLC; ctx.lineWidth = w + 5; ctx.beginPath(); fn(); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); fn(); ctx.stroke();
  }
  const NEW_SHAPES = {
    goblin(c, t) {
      const b = Math.sin(t * 5) * 2, sw = Math.sin(t * 4) * 0.35;
      ctx.fillStyle = fc(shade(c, -0.25)); rrect(-22, -38, 13, 38, 5); rrect(6, -38, 13, 38, 5);
      ctx.fillStyle = fc('#5a3a22'); ellipse(-20, -3, 12, 5); ellipse(9, -3, 12, 5);
      // clava atrás
      ctx.save(); ctx.translate(26, -68 + b); ctx.rotate(-0.5 + sw);
      ctx.fillStyle = fc('#8a5a32'); rrect(-5, -56, 10, 58, 4);
      ctx.fillStyle = fc('#6e4424'); ellipse(0, -58, 12, 15);
      noOL(() => { ctx.fillStyle = fc('#d8d0c0'); for (const [px, py] of [[-11, -62], [10, -54], [-4, -72]]) ellipse(px, py, 3, 3); });
      ctx.restore();
      ctx.fillStyle = fc('#8a5a32'); rrect(-28, -82 + b, 56, 50, 16);
      noOL(() => { ctx.fillStyle = fc('#5a3a22'); ctx.fillRect(-27, -48 + b, 54, 6); ctx.fillStyle = '#ffd24a'; ctx.fillRect(-4, -49 + b, 8, 8); });
      limb(-18, -70 + b, -36, -48 + b, fc(c), 10);
      ctx.fillStyle = bodyGrad(c, -6, -108 + b, 32);
      ctx.beginPath(); ctx.moveTo(-26, -112 + b); ctx.lineTo(-62, -128 + b); ctx.lineTo(-30, -96 + b); ctx.closePath(); fillOL();
      ctx.beginPath(); ctx.moveTo(20, -114 + b); ctx.lineTo(54, -130 + b); ctx.lineTo(24, -96 + b); ctx.closePath(); fillOL();
      ellipse(-4, -106 + b, 30, 26);
      ctx.fillStyle = fc(shade(c, -0.15)); ellipse(-28, -100 + b, 9, 7);
      eyes(-20, 0, -112 + b, 6.5, true, '#c0201a');
      ctx.fillStyle = '#3a0a1a'; ctx.beginPath(); ctx.ellipse(-10, -90 + b, 12, 6, 0, 0, Math.PI); ctx.closePath(); fillOL();
      noOL(() => { ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.moveTo(-18, -90 + b); ctx.lineTo(-15, -84 + b); ctx.lineTo(-12, -90 + b); ctx.moveTo(-4, -90 + b); ctx.lineTo(-1, -84 + b); ctx.lineTo(2, -90 + b); ctx.fill(); });
    },
    spider(c, t) {
      const w = t * 9, leg = fc(shade(c, -0.3));
      for (let i = 0; i < 4; i++) {
        for (const s of [-1, 1]) {
          const ax = i * 8 - 10, ay = -46;
          const kx = s * (38 + i * 6) + i * 4 - 6, ky = -86 + i * 5 + Math.sin(w + i + s) * 5;
          const fx = s * (64 + i * 7), fy = -Math.max(0, Math.sin(w + i * 1.3 + s)) * 7;
          curveOL(leg, 6, () => { ctx.moveTo(ax, ay); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); });
        }
      }
      ctx.fillStyle = bodyGrad(c, 26, -62, 42); ellipse(28, -58, 40, 34);
      noOL(() => { ctx.fillStyle = fc(shade(c, 0.4)); ellipse(36, -66, 7, 12); ellipse(36, -46, 5, 6); ctx.fillStyle = 'rgba(255,255,255,.3)'; ellipse(14, -80, 12, 6, -0.4); });
      ctx.fillStyle = bodyGrad(c, -24, -52, 28); ellipse(-22, -46, 27, 22);
      noOL(() => {
        ctx.fillStyle = '#ff3a2a';
        for (const [ex, ey, r] of [[-36, -52, 4.5], [-25, -57, 5.5], [-14, -54, 4], [-33, -42, 3], [-20, -45, 3]]) ellipse(ex, ey, r, r);
        ctx.fillStyle = '#ffffff'; ellipse(-27, -59, 1.6, 1.6); ellipse(-37, -54, 1.3, 1.3);
        ctx.fillStyle = '#fff6e0';
        ctx.beginPath(); ctx.moveTo(-42, -32); ctx.lineTo(-38, -20); ctx.lineTo(-34, -32); ctx.moveTo(-30, -30); ctx.lineTo(-26, -19); ctx.lineTo(-22, -30); ctx.fill();
      });
    },
    serpent(c, t) {
      const sway = Math.sin(t * 2.4) * 8;
      ctx.fillStyle = bodyGrad(c, 0, -20, 60); ellipse(10, -16, 62, 18);
      ctx.fillStyle = bodyGrad(c, 0, -44, 50); ellipse(6, -40, 48, 16);
      noOL(() => { ctx.fillStyle = fc(shade(c, -0.3)); for (const [px, py] of [[-34, -16], [-8, -20], [20, -18], [44, -14], [-20, -42], [8, -44], [32, -40]]) ellipse(px, py, 5, 3); });
      curveOL(fc(c), 24, () => { ctx.moveTo(22, -48); ctx.bezierCurveTo(44, -92, -6, -100, -30 + sway, -122); });
      noOL(() => { curveOL(fc(shade(c, 0.45)), 8, () => { ctx.moveTo(10, -52); ctx.bezierCurveTo(30, -88, -14, -98, -34 + sway, -114); }); });
      // língua
      if (Math.sin(t * 6) > 0.2) {
        ctx.strokeStyle = '#e02a3a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        const tx = -66 + sway;
        ctx.beginPath(); ctx.moveTo(tx + 6, -122); ctx.lineTo(tx - 10, -121); ctx.lineTo(tx - 16, -126); ctx.moveTo(tx - 10, -121); ctx.lineTo(tx - 16, -116); ctx.stroke();
      }
      ctx.fillStyle = bodyGrad(c, -40 + sway, -132, 30); ellipse(-40 + sway, -128, 28, 18, -0.15);
      noOL(() => {
        ctx.fillStyle = '#ffe14a'; ellipse(-46 + sway, -136, 5.5, 5.5);
        ctx.fillStyle = '#1a1020'; ellipse(-46 + sway, -136, 1.7, 4.6);
        ctx.fillStyle = fc(shade(c, -0.35)); ellipse(-62 + sway, -130, 2, 1.5);
      });
      ctx.strokeStyle = OLC; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-54 + sway, -143); ctx.lineTo(-38 + sway, -140); ctx.stroke();
    },
    skeleton(c, t) {
      const b = Math.sin(t * 4) * 1.5, jaw = Math.max(0, Math.sin(t * 6)) * 3, bone = fc(c);
      limb(-12, -42, -16, -4, bone, 7); limb(10, -42, 13, -4, bone, 7);
      ctx.fillStyle = bone; ellipse(-20, -3, 10, 4.5); ellipse(9, -3, 10, 4.5);
      ctx.fillStyle = bone; ellipse(-2, -44, 17, 8);
      // espada
      ctx.save(); ctx.translate(34, -64 + b); ctx.rotate(-1 + Math.sin(t * 3) * 0.25);
      ctx.fillStyle = steel(-3, -64, 3, 0); rrect(-3.5, -64, 7, 64, 2);
      ctx.fillStyle = '#6e4424'; rrect(-11, -3, 22, 6, 2); rrect(-3, 2, 6, 14, 2);
      ctx.restore();
      limb(14, -92 + b, 34, -64 + b, bone, 6);
      ctx.fillStyle = bone; rrect(-5, -100 + b, 9, 58, 4);
      for (let i = 0; i < 4; i++) curveOL(bone, 4, () => { ctx.moveTo(-22 + i * 2, -88 + i * 10 + b); ctx.quadraticCurveTo(-2, -98 + i * 10 + b, 20 - i * 2, -88 + i * 10 + b); });
      limb(-18, -92 + b, -36, -66 + b, bone, 6);
      const hg = ctx.createRadialGradient(-14, -132 + b, 3, -6, -122 + b, 28);
      hg.addColorStop(0, fc(shade(c, 0.4))); hg.addColorStop(1, fc(shade(c, -0.3)));
      ctx.fillStyle = hg; rrect(-22, -110 + b + jaw, 24, 12, 4);
      ellipse(-6, -124 + b, 24, 21);
      noOL(() => {
        ctx.fillStyle = '#1a1020'; ellipse(-17, -126 + b, 6.5, 7.5); ellipse(1, -126 + b, 6.5, 7.5); ellipse(-9, -114 + b, 3, 3.5);
        ctx.fillStyle = '#ff6a3a'; ellipse(-17, -125 + b, 2.2, 2.2); ellipse(1, -125 + b, 2.2, 2.2);
        ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 1.5;
        ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(-18 + i * 5, -104 + b); ctx.lineTo(-18 + i * 5, -99 + b + jaw); } ctx.stroke();
      });
    },
    plant(c, t) {
      const sway = Math.sin(t * 2) * 8, o = 0.25 + 0.22 * Math.max(0, Math.sin(t * 4));
      ctx.fillStyle = fc(shade(c, -0.2)); ellipse(-34, -12, 32, 10, -0.3); ellipse(34, -12, 32, 10, 0.3);
      noOL(() => { ctx.strokeStyle = fc(shade(c, -0.45)); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-60, -4); ctx.lineTo(-10, -16); ctx.moveTo(60, -4); ctx.lineTo(10, -16); ctx.stroke(); });
      curveOL(fc(shade(c, -0.1)), 14, () => { ctx.moveTo(0, -6); ctx.bezierCurveTo(4, -60, 34, -84, 10 + sway, -118); });
      ctx.fillStyle = fc(shade(c, 0.1)); ellipse(18, -66, 16, 7, -0.8);
      const hx = 12 + sway, hy = -122;
      ctx.save(); ctx.translate(hx, hy);
      ctx.fillStyle = '#7a1a2a'; ellipse(-34, 0, 32, 34 * o + 4);
      // mandíbula de baixo
      ctx.save(); ctx.rotate(o * 0.7);
      ctx.fillStyle = bodyGrad(c, -30, 6, 34); ctx.beginPath(); ctx.ellipse(-32, 0, 36, 18, 0, 0, Math.PI); ctx.closePath(); fillOL();
      noOL(() => { ctx.fillStyle = '#fff6e0'; ctx.beginPath(); for (let i = 0; i < 5; i++) { const x = -62 + i * 12; ctx.moveTo(x, 1); ctx.lineTo(x + 4, -9); ctx.lineTo(x + 8, 1); } ctx.fill(); });
      ctx.restore();
      // mandíbula de cima
      ctx.save(); ctx.rotate(-o * 0.7);
      ctx.fillStyle = bodyGrad(c, -30, -12, 40); ctx.beginPath(); ctx.ellipse(-32, 0, 40, 26, 0, Math.PI, 0); ctx.closePath(); fillOL();
      noOL(() => {
        ctx.fillStyle = '#fff6e0'; ctx.beginPath(); for (let i = 0; i < 6; i++) { const x = -66 + i * 12; ctx.moveTo(x, -1); ctx.lineTo(x + 4, 10); ctx.lineTo(x + 8, -1); } ctx.fill();
        ctx.fillStyle = fc(shade(c, 0.5)); ellipse(-20, -14, 5, 4); ellipse(-46, -10, 4, 3); ellipse(-8, -6, 3, 3);
      });
      eyes(-44, -26, -16, 5.5, true);
      ctx.restore(); // mandíbula de cima
      ctx.restore(); // cabeça
    },
  };
  const SHAPES = {
    slime(c, t) {
      const sq = Math.sin(t * 4) * 0.06, w = 66 * (1 + sq), h = 62 * (1 - sq);
      ctx.fillStyle = bodyGrad(c, -10, -h * 0.9, w * 1.1);
      ctx.beginPath(); ctx.moveTo(-w, 0);
      ctx.bezierCurveTo(-w, -h * 1.2, -w * 0.4, -h * 1.62, 0, -h * 1.58);
      ctx.bezierCurveTo(w * 0.4, -h * 1.62, w, -h * 1.2, w, 0); ctx.closePath(); fillOL();
      noOL(() => {
        ctx.fillStyle = fc(shade(c, -0.3)); ellipse(0, -6, w * 0.9, 7);
        ctx.fillStyle = 'rgba(255,255,255,.45)'; ellipse(-w * 0.4, -h * 1.12, 9, 17, 0.5); ellipse(-w * 0.62, -h * 0.75, 4, 6, 0.3);
        ctx.fillStyle = fc(shade(c, 0.4)); ctx.globalAlpha *= 0.6;
        ellipse(w * 0.32, -h * 0.5 - Math.sin(t * 2) * 4, 6, 6); ellipse(w * 0.5, -h * 0.95, 4, 4); ellipse(w * 0.15, -h * 1.25, 3, 3);
        ctx.globalAlpha /= 0.6;
      });
      eyes(-32, -6, -h * 0.85, 10, true);
      ctx.fillStyle = '#3a0a1a'; ctx.beginPath(); ctx.ellipse(-20, -h * 0.5, 11, 7 + Math.sin(t * 4) * 1.5, 0, 0, Math.PI); ctx.closePath(); fillOL();
      noOL(() => { ctx.fillStyle = '#ff7a9a'; ellipse(-20, -h * 0.5 + 4, 5, 2.5); });
    },
    mushroom(c, t) {
      const b = Math.sin(t * 3) * 2;
      const sg = ctx.createLinearGradient(-24, 0, 24, 0);
      sg.addColorStop(0, fc('#fff4dc')); sg.addColorStop(1, fc('#c9b48e'));
      ctx.fillStyle = sg; rrect(-24, -68, 48, 68, 14);
      ctx.fillStyle = fc(shade(c, -0.45)); ctx.beginPath(); ctx.ellipse(0, -60 + b, 56, 10, 0, 0, Math.PI * 2); fillOL();
      ctx.fillStyle = bodyGrad(c, -10, -100 + b, 70);
      ctx.beginPath(); ctx.moveTo(-66, -60 + b); ctx.bezierCurveTo(-66, -132 + b, 66, -132 + b, 66, -60 + b); ctx.quadraticCurveTo(0, -50 + b, -66, -60 + b); ctx.closePath(); fillOL();
      noOL(() => {
        ctx.fillStyle = fc('#fff8ee');
        ellipse(-30, -88 + b, 10, 8); ellipse(10, -102 + b, 12, 9); ellipse(38, -80 + b, 8, 6); ellipse(-6, -76 + b, 6, 5); ellipse(-48, -70 + b, 5, 4);
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ellipse(-24, -108 + b, 18, 6, -0.3);
      });
      eyes(-14, 8, -38, 8, true);
      ctx.fillStyle = '#3a0a1a'; ctx.beginPath(); ctx.ellipse(-3, -20, 9, 5, 0, 0, Math.PI); ctx.closePath(); fillOL();
    },
    beast(c, t) {
      const step = Math.sin(t * 6) * 4;
      ctx.fillStyle = fc(shade(c, -0.2));
      ctx.beginPath(); ctx.moveTo(52, -62); ctx.quadraticCurveTo(92, -82 + step, 86, -108); ctx.quadraticCurveTo(76, -80, 50, -50); ctx.closePath(); fillOL();
      ctx.fillStyle = fc(shade(c, -0.25));
      rrect(-36, -44, 14, 44, 5); rrect(26, -44, 14, 44, 5);
      ctx.fillStyle = bodyGrad(c, 0, -60, 60);
      ctx.beginPath(); ctx.ellipse(10, -58, 58, 30, 0, 0, Math.PI * 2); fillOL();
      ctx.fillStyle = fc(shade(c, -0.1));
      rrect(-22 + step * 0.5, -44, 14, 44, 5); rrect(38 - step * 0.5, -44, 14, 44, 5);
      ctx.fillStyle = fc(shade(c, -0.3));
      ctx.beginPath(); ctx.moveTo(-30, -82); for (let i = 0; i < 5; i++) { ctx.lineTo(-20 + i * 14, -98 + (i % 2) * 4); ctx.lineTo(-14 + i * 14, -84); } ctx.lineTo(44, -80); ctx.closePath(); fillOL();
      ctx.fillStyle = bodyGrad(c, -50, -80, 30);
      ctx.beginPath(); ctx.moveTo(-64, -96); ctx.lineTo(-58, -126); ctx.lineTo(-44, -100); ctx.closePath(); fillOL();
      ctx.beginPath(); ctx.moveTo(-42, -100); ctx.lineTo(-30, -126); ctx.lineTo(-26, -94); ctx.closePath(); fillOL();
      ctx.beginPath(); ctx.ellipse(-50, -78, 28, 26, 0, 0, Math.PI * 2); fillOL();
      ctx.fillStyle = fc(shade(c, 0.2)); ctx.beginPath(); ctx.ellipse(-76, -68, 21, 13, 0, 0, Math.PI * 2); fillOL();
      noOL(() => {
        ctx.fillStyle = '#1a1020'; ellipse(-95, -72, 5, 4);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(-88, -58); ctx.lineTo(-84, -47); ctx.lineTo(-80, -58); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-73, -58); ctx.lineTo(-69, -48); ctx.lineTo(-65, -58); ctx.fill();
        ctx.fillStyle = '#ffd23a'; ellipse(-57, -85, 6, 5);
        ctx.fillStyle = '#1a1020'; ellipse(-59, -85, 2, 4);
      });
      ctx.strokeStyle = OLC; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-66, -93); ctx.lineTo(-50, -89); ctx.stroke();
    },
    bat(c, t) {
      const fy = -120 + Math.sin(t * 3) * 10, flap = Math.sin(t * 12) * 0.6;
      ctx.save(); ctx.translate(0, fy);
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(s, 1); ctx.rotate(flap * 0.5);
        ctx.fillStyle = fc(shade(c, -0.25));
        ctx.beginPath(); ctx.moveTo(10, -6); ctx.quadraticCurveTo(50, -52, 92, -30); ctx.quadraticCurveTo(80, -10, 86, 6); ctx.quadraticCurveTo(66, -2, 58, 12); ctx.quadraticCurveTo(40, 0, 30, 16); ctx.quadraticCurveTo(20, 6, 10, 10); ctx.closePath(); fillOL();
        ctx.strokeStyle = fc(shade(c, -0.5)); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(14, -2); ctx.lineTo(86, 2); ctx.moveTo(14, 0); ctx.lineTo(58, 10); ctx.moveTo(14, 2); ctx.lineTo(30, 14); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = bodyGrad(c, 0, 0, 30);
      ctx.beginPath(); ctx.moveTo(-18, -18); ctx.lineTo(-14, -48); ctx.lineTo(-3, -26); ctx.closePath(); fillOL();
      ctx.beginPath(); ctx.moveTo(18, -18); ctx.lineTo(14, -48); ctx.lineTo(3, -26); ctx.closePath(); fillOL();
      ctx.beginPath(); ctx.ellipse(0, 0, 26, 30, 0, 0, Math.PI * 2); fillOL();
      noOL(() => {
        ctx.fillStyle = fc(shade(c, 0.25)); ellipse(0, 8, 14, 16);
        ctx.fillStyle = '#ff3a2a'; ellipse(-10, -7, 5.5, 5.5); ellipse(8, -7, 5.5, 5.5);
        ctx.fillStyle = '#fff'; ellipse(-11.5, -8.5, 1.5, 1.5); ellipse(6.5, -8.5, 1.5, 1.5);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(-8, 10); ctx.lineTo(-5, 21); ctx.lineTo(-2, 10); ctx.fill();
        ctx.beginPath(); ctx.moveTo(2, 10); ctx.lineTo(5, 21); ctx.lineTo(8, 10); ctx.fill();
      });
      ctx.restore();
    },
    golem(c, t) {
      const sw = Math.sin(t * 2.5) * 0.12;
      const lg = (x0, x1) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, fc(shade(c, 0.25))); g.addColorStop(1, fc(shade(c, -0.3))); return g; };
      ctx.fillStyle = lg(-38, 40);
      rrect(-38, -42, 28, 42, 6); rrect(12, -42, 28, 42, 6);
      ctx.save(); ctx.translate(46, -114); ctx.rotate(-sw); ctx.fillStyle = lg(-12, 14); rrect(-12, 0, 26, 72, 10); ctx.restore();
      ctx.fillStyle = lg(-50, 50); rrect(-50, -126, 100, 90, 16);
      ctx.fillStyle = lg(-28, 28); rrect(-28, -164, 56, 42, 10);
      ctx.save(); ctx.translate(-50, -114); ctx.rotate(sw); ctx.fillStyle = lg(-16, 12); rrect(-16, 0, 28, 76, 10); ctx.restore();
      ctx.strokeStyle = fc(shade(c, -0.45)); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-20, -112); ctx.lineTo(-6, -92); ctx.lineTo(-16, -66); ctx.moveTo(18, -102); ctx.lineTo(30, -82); ctx.moveTo(-14, -158); ctx.lineTo(-6, -146); ctx.stroke();
      noOL(() => {
        ctx.save(); ctx.shadowColor = shade(c, 0.7); ctx.shadowBlur = 16;
        ctx.fillStyle = shade(c, 0.8); rrect(-20, -148, 14, 8, 3); rrect(2, -148, 14, 8, 3);
        const pulse = 0.6 + 0.4 * Math.sin(t * 3);
        ctx.globalAlpha *= pulse; ellipse(0, -88, 10, 10);
        ctx.restore();
      });
    },
    ghost(c, t) {
      const fy = -26 + Math.sin(t * 2) * 8;
      ctx.save(); ctx.translate(0, fy); ctx.globalAlpha *= 0.9;
      ctx.fillStyle = bodyGrad(c, -10, -100, 60);
      ctx.beginPath(); ctx.moveTo(-48, -40); ctx.lineTo(-48, -96);
      ctx.arc(0, -96, 48, Math.PI, 0); ctx.lineTo(48, -40);
      for (let i = 0; i < 4; i++) {
        const x0 = 48 - i * 24, wv = Math.sin(t * 5 + i) * 6;
        ctx.quadraticCurveTo(x0 - 6, -16 + wv, x0 - 12, -30); ctx.quadraticCurveTo(x0 - 18, -44 - wv, x0 - 24, -30);
      }
      ctx.closePath(); fillOL();
      ctx.globalAlpha /= 0.9;
      noOL(() => {
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ellipse(-22, -122, 12, 7, -0.5);
        ctx.fillStyle = '#1a1020'; ellipse(-20, -100, 9, 13); ellipse(8, -100, 9, 13); ellipse(-6, -70, 10, 7 + Math.sin(t * 3) * 3);
        ctx.fillStyle = 'rgba(160,255,230,.8)'; ellipse(-22, -103, 3, 4); ellipse(6, -103, 3, 4);
      });
      ctx.restore();
    },
    eye(c, t) {
      const fy = -112 + Math.sin(t * 2.2) * 9;
      ctx.save(); ctx.translate(0, fy);
      for (let i = 0; i < 5; i++) {
        const x = -30 + i * 15;
        const ex = x + Math.sin(t * 3 + i + 1) * 10, cx = x + Math.sin(t * 3 + i) * 16;
        ctx.lineCap = 'round';
        ctx.strokeStyle = OLC; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(x, 30); ctx.quadraticCurveTo(cx, 60, ex, 86); ctx.stroke();
        ctx.strokeStyle = fc(shade(c, -0.2)); ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x, 30); ctx.quadraticCurveTo(cx, 60, ex, 86); ctx.stroke();
      }
      ctx.fillStyle = bodyGrad(c, 0, 0, 52);
      ctx.beginPath(); ctx.arc(0, 0, 52, 0, Math.PI * 2); fillOL();
      ctx.fillStyle = fc('#fff7f0'); ellipse(-6, 0, 34, 34);
      noOL(() => {
        ctx.strokeStyle = 'rgba(200,30,30,.5)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 7; i++) { const a = i * 0.9; ctx.beginPath(); ctx.moveTo(-6 + Math.cos(a) * 33, Math.sin(a) * 33); ctx.quadraticCurveTo(-6 + Math.cos(a + 0.2) * 26, Math.sin(a + 0.2) * 26, -6 + Math.cos(a) * 20, Math.sin(a) * 20); ctx.stroke(); }
        const ig = ctx.createRadialGradient(-16, 2, 2, -16, 2, 17);
        ig.addColorStop(0, fc(shade(c, 0.4))); ig.addColorStop(1, fc(shade(c, -0.3)));
        ctx.fillStyle = ig; ellipse(-16, 2, 17, 17);
        ctx.fillStyle = '#100810'; ellipse(-18, 2, 7, 9);
        ctx.fillStyle = '#fff'; ellipse(-22, -4, 3.5, 3.5);
        const blink = Math.max(0, Math.sin(t * 0.8) * 30 - 29);
        ctx.fillStyle = fc(shade(c, -0.15)); ctx.fillRect(-42, -36, 74, 36 * blink);
      });
      ctx.restore();
    },
    chest(c, t) {
      const open = Math.max(0, Math.sin(t * 5)) * 0.35;
      const wg = ctx.createLinearGradient(0, -60, 0, 0); wg.addColorStop(0, fc(shade(c, 0.15))); wg.addColorStop(1, fc(shade(c, -0.3)));
      ctx.fillStyle = wg; rrect(-54, -60, 108, 60, 6);
      noOL(() => {
        ctx.strokeStyle = fc(shade(c, -0.4)); ctx.lineWidth = 1.5;
        for (const y of [-44, -24]) { ctx.beginPath(); ctx.moveTo(-50, y); ctx.lineTo(50, y); ctx.stroke(); }
      });
      ctx.fillStyle = fc('#ffd24a'); ctx.fillRect(-30, -60, 7, 60); ctx.fillRect(23, -60, 7, 60);
      ctx.fillStyle = '#1a0a08'; ctx.fillRect(-50, -66, 100, 8);
      noOL(() => {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(-48 + i * 14, -60); ctx.lineTo(-41 + i * 14, -52); ctx.lineTo(-34 + i * 14, -60); ctx.fill(); }
        ctx.fillStyle = '#ffe14a'; ellipse(-20, -64, 5, 4); ellipse(14, -64, 5, 4);
      });
      ctx.save(); ctx.translate(54, -62); ctx.rotate(-open);
      const lg2 = ctx.createLinearGradient(0, -32, 0, 0); lg2.addColorStop(0, fc(shade(c, 0.3))); lg2.addColorStop(1, fc(shade(c, -0.1)));
      ctx.fillStyle = lg2; rrect(-108, -32, 108, 32, 14);
      ctx.fillStyle = fc('#ffd24a'); ctx.fillRect(-84, -32, 7, 32); ctx.fillRect(-31, -32, 7, 32);
      ctx.fillStyle = fc('#ffe680'); rrect(-60, -8, 12, 15, 3);
      ctx.restore();
      noOL(() => {
        ctx.save(); ctx.globalAlpha *= 0.5 + 0.5 * Math.sin(t * 6);
        ctx.fillStyle = '#fff6b0';
        for (const [sx3, sy3] of [[-40, -80], [30, -96], [50, -40]]) { ctx.beginPath(); ctx.moveTo(sx3, sy3 - 7); ctx.lineTo(sx3 + 2, sy3); ctx.lineTo(sx3, sy3 + 7); ctx.lineTo(sx3 - 2, sy3); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(sx3 - 7, sy3); ctx.lineTo(sx3, sy3 + 2); ctx.lineTo(sx3 + 7, sy3); ctx.lineTo(sx3, sy3 - 2); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      });
    },
  };
  Object.assign(SHAPES, NEW_SHAPES);

  function drawMonster(t, mon) {
    const M = mon;
    if (!M) return;
    const k = M.dying > 0 ? Math.min(1, M.dying / DEATH_T) : 0;
    const appear = M.spawn;
    const pop = appear < 1 ? 1 + Math.sin(appear * Math.PI) * 0.12 : 1;
    const s = M.size * (0.3 + 0.7 * appear) * pop;
    const shake = M.hit * 6;
    const squash = 1 - M.hit * 0.08;
    ctx.save();
    ctx.translate(MX + (Math.random() - 0.5) * shake + M.hit * 8, GROUND);
    let alpha = Math.min(1, appear * 1.5);
    const fadeAfter = (a) => Math.max(0, 1 - Math.max(0, k - a) / (1 - a));
    // animações de morte
    if (k > 0) {
      const d = M.death || 'pop';
      const mid = -70 * s;
      if (d === 'launch') { // arremessada para longe, girando
        alpha *= fadeAfter(0.55);
        ctx.translate(k * 340, -Math.sin(Math.min(1, k * 1.2) * Math.PI * 0.85) * 210);
        ctx.translate(0, mid); ctx.rotate(k * 8); ctx.translate(0, -mid);
      } else if (d === 'squash') { // achatada contra o chão
        const q = Math.min(1, k * 4);
        alpha *= fadeAfter(0.45);
        ctx.scale(1 + q * 0.55, 1 - q * 0.86);
      } else if (d === 'sink') { // afunda no chão
        alpha *= fadeAfter(0.8);
        ctx.beginPath(); ctx.rect(-400, -700, 800, 702); ctx.clip();
        ctx.translate(Math.sin(k * 40) * 4 * (1 - k), k * k * 190 * s);
      } else if (d === 'spin') { // rodopia e some
        alpha *= fadeAfter(0.5);
        ctx.translate(0, mid); ctx.rotate(k * k * 16); ctx.scale(1 - k, 1 - k); ctx.translate(0, -mid);
      } else if (d === 'pop') { // incha e estoura
        const g = k < 0.18 ? k / 0.18 : 1;
        alpha *= k < 0.18 ? 1 : 0;
        ctx.translate(0, mid); ctx.scale(1 + g * 0.35, 1 + g * 0.35); ctx.translate(0, -mid);
      } else { // 'soul': a alma sobe e desaparece
        alpha *= 1 - k;
        ctx.translate(Math.sin(k * 14) * 10, -k * 170);
        ctx.scale(1 - k * 0.3, 1 + k * 0.25);
      }
    }
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; if (!k) ellipse(0, 2, 64 * s, 11 * s);
    if (M.variant === 'ouro') {
      const ag = ctx.createRadialGradient(0, -70 * s, 10, 0, -70 * s, 120 * s);
      ag.addColorStop(0, `rgba(255,214,90,${0.3 + 0.12 * Math.sin(t * 5)})`); ag.addColorStop(1, 'rgba(255,214,90,0)');
      ctx.fillStyle = ag; ctx.fillRect(-130 * s, -200 * s, 260 * s, 220 * s);
    }
    if (M.boss) {
      const ag = ctx.createRadialGradient(0, -80 * s, 10, 0, -80 * s, 150 * s);
      ag.addColorStop(0, 'rgba(255,60,80,.28)'); ag.addColorStop(1, 'rgba(255,60,80,0)');
      ctx.fillStyle = ag; ctx.fillRect(-160 * s, -240 * s, 320 * s, 260 * s);
    }
    if (M.chest) {
      const ag = ctx.createRadialGradient(0, -50 * s, 10, 0, -50 * s, 120 * s);
      ag.addColorStop(0, 'rgba(255,220,90,.35)'); ag.addColorStop(1, 'rgba(255,220,90,0)');
      ctx.fillStyle = ag; ctx.fillRect(-130 * s, -170 * s, 260 * s, 190 * s);
    }
    ctx.scale(s * (2 - squash), s * squash);
    flashT = M.hit;
    const tt = t + M.seed;
    outline(true);
    SHAPES[M.shape](M.color, tt);
    if (M.boss) {
      const top = -TOPS[M.shape] - 18 + (M.shape === 'bat' ? Math.sin(tt * 3) * 10 : M.shape === 'eye' ? Math.sin(tt * 2.2) * 9 : M.shape === 'ghost' ? Math.sin(tt * 2) * 8 : 0);
      const cg = ctx.createLinearGradient(0, top - 6, 0, top + 18); cg.addColorStop(0, '#fff1a0'); cg.addColorStop(1, '#d99a1c');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.moveTo(-26, top + 18); ctx.lineTo(-26, top); ctx.lineTo(-13, top + 10); ctx.lineTo(0, top - 6); ctx.lineTo(13, top + 10); ctx.lineTo(26, top); ctx.lineTo(26, top + 18); ctx.closePath(); fillOL();
      ctx.fillStyle = '#ff3a5a'; ellipse(0, top + 10, 4, 4);
    }
    outline(false);
    flashT = 0;
    ctx.restore();
  }

  function drawProjectiles(t) {
    for (const p of projs) {
      for (let j = 3; j >= 0; j--) {
        const k = Math.max(0, p.t / 0.45 - j * 0.06);
        const x0 = hero.x + 40, x = x0 + (MX - 40 - x0) * k;
        const y = GROUND - 90 - Math.sin(k * Math.PI) * 70 + k * 20;
        ctx.save(); ctx.translate(x, y); ctx.rotate(k * Math.PI * 4);
        drawShield(S.shields.right, 28, 34, t, false, (j ? 0.18 / j : 0.8) * (1 - k * 0.3));
        ctx.restore();
      }
    }
  }

  function impact(x, y, crit) {
    parts.push({ x, y, vx: 0, vy: 0, g: 0, life: 0, max: 0.28, type: 'ring', color: crit ? '#ffb14a' : '#ffffff', r0: 6, r1: crit ? 64 : 36 });
    if (crit) {
      parts.push({ x, y, vx: 0, vy: 0, g: 0, life: 0, max: 0.22, type: 'star', color: '#ffcf6a', size: 30 });
    }
  }
  function puff(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 70;
      parts.push({ x: x + Math.cos(a) * 20, y: y + Math.sin(a) * 10, vx: Math.cos(a) * sp, vy: -20 - Math.random() * 40, g: -20, life: 0, max: 0.5 + Math.random() * 0.3, type: 'smoke', color: '#ffffff', size: 12 + Math.random() * 10 });
    }
  }
  function starPath(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.22 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath();
  }

  function drawParticles() {
    for (const p of parts) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, a);
      if (p.type === 'coin') {
        const spin = Math.abs(Math.cos(p.life * 14));
        ctx.fillStyle = '#8a5a0a'; ellipse(p.x, p.y, p.size * spin + 1, p.size);
        ctx.fillStyle = '#ffd24a'; ellipse(p.x - 0.5, p.y - 0.5, Math.max(0.5, p.size * spin - 1), p.size - 1.5);
        ctx.fillStyle = '#fff6c0'; ellipse(p.x - 1.5 * spin, p.y - 2, 1.2 * spin + 0.3, 1.6);
      } else if (p.type === 'ring') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 5 * a + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * (1 - a * a), 0, Math.PI * 2); ctx.stroke();
      } else if (p.type === 'star') {
        ctx.fillStyle = p.color; starPath(p.x, p.y, p.size * (1.4 - a * 0.6)); ctx.fill();
      } else if (p.type === 'smoke') {
        ctx.globalAlpha = Math.max(0, a) * a * 0.3; ctx.fillStyle = p.color; ellipse(p.x, p.y, p.size * (1.6 - a * 0.6), p.size * (1.6 - a * 0.6));
      } else {
        ctx.fillStyle = p.color; ellipse(p.x, p.y, p.size * (p.type === 'puff' ? a : 1), p.size * (p.type === 'puff' ? a : 1));
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (const f of floats) {
      const k = f.life / f.max;
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      const sc = k < 0.12 ? 0.6 + (k / 0.12) * 0.4 : 1;
      ctx.font = `800 ${Math.round(f.size * sc)}px Nunito, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,10,30,.85)';
      ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---- Escudeiros na arena: ajudantes visíveis golpeando o monstro ----
  const SQUIRE_SPOTS = [[112, 40], [166, 30], [218, 44], [138, 12], [192, 8], [234, 18], [92, 60], [150, 62], [206, 66], [240, 56]];
  function drawSquire(x, y, s, t, ph, i) {
    const hit = ph < 0.35 ? Math.sin((ph / 0.35) * Math.PI) : 0;
    const bob = Math.abs(Math.sin(t * 3 + i * 1.7)) * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ellipse(0, 2, 22 * s, 5 * s);
    ctx.scale(-s, s); // virado para a esquerda, olhando o monstro
    ctx.translate(hit * 12, -bob);
    ctx.rotate(hit * 0.18);
    outline(true);
    ctx.fillStyle = '#4e3018'; rrect(-10, -17, 8, 17, 3); rrect(3, -17, 8, 17, 3);
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(-4, -44); ctx.quadraticCurveTo(-24, -30, -22, -14); ctx.lineTo(-10, -18); ctx.closePath(); fillOL();
    ctx.fillStyle = '#2f6fb3'; rrect(-13, -44, 27, 30, 9);
    noOL(() => { ctx.fillStyle = '#ffd24a'; ctx.fillRect(-13, -22, 27, 3); });
    ctx.fillStyle = '#f2c79b'; ellipse(3, -54, 11, 11);
    noOL(() => { ctx.fillStyle = '#1a1020'; ellipse(9, -54, 1.7, 2.4); });
    ctx.fillStyle = steel(-12, -68, 14, -52);
    ctx.beginPath(); ctx.arc(2, -56, 12.5, Math.PI, 0); ctx.lineTo(14.5, -53); ctx.lineTo(-10.5, -53); ctx.closePath(); fillOL();
    ctx.fillStyle = '#e04a3a';
    ctx.beginPath(); ctx.moveTo(0, -67); ctx.quadraticCurveTo(-12, -82, -24, -68); ctx.quadraticCurveTo(-12, -70, -5, -63); ctx.closePath(); fillOL();
    const px = 16 + hit * 12;
    limb(6, -40, px - 4, -32, '#2f6fb3', 7);
    ctx.fillStyle = steel(px - 10, -46, px + 10, -18); ellipse(px, -32, 10, 13);
    noOL(() => { ctx.fillStyle = '#ffd24a'; ellipse(px, -32, 3, 3); });
    outline(false);
    ctx.restore();
  }
  function drawSquires(t) {
    const n = Math.min(SQUIRE_SPOTS.length, acOn('arena'));
    if (!n) return;
    const rate = Math.min(3, acRate());
    // os de trás (menor y) primeiro
    const order = SQUIRE_SPOTS.slice(0, n).map((p, i) => [p, i]).sort((a, b) => a[0][1] - b[0][1]);
    for (const [[dx, dy], i] of order) {
      const ph = (t * rate + i * 0.37) % 1;
      drawSquire(MX + dx, GROUND + dy, 1, t, ph, i);
    }
  }

  function render(t) {
    // zera o estado do canvas (recortes/save pendentes) a cada quadro
    if (ctx.reset) ctx.reset(); else { ctx.globalAlpha = 1; }
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    if (shakeT > 0) ctx.translate((Math.random() - 0.5) * 14 * shakeT, (Math.random() - 0.5) * 10 * shakeT);
    const bi = biomeIndex(S.zone);
    if (bgCache.idx !== bi) buildBg(bi);
    ctx.drawImage(bgCache.canvas, -10, -10, W + 20, H + 20);
    drawAmbient(t, BIOMES[bi]);
    if (skillActive('furia')) { ctx.fillStyle = 'rgba(255,80,40,.08)'; ctx.fillRect(0, 0, W, H); }
    if (skillActive('ouro')) { ctx.fillStyle = 'rgba(255,210,74,.08)'; ctx.fillRect(0, 0, W, H); }
    for (const c of corpses) drawMonster(t, c);
    drawMonster(t, M);
    drawSquires(t);
    drawHero(t);
    drawProjectiles(t);
    drawParticles();
    if (!vignette) buildVignette();
    ctx.drawImage(vignette, 0, 0, W, H);
  }

  // ======================================================================
  // Laço principal
  // ======================================================================
  let lastTick = Date.now();
  function tick() {
    const now = Date.now();
    let dt = (now - lastTick) / 1000;
    lastTick = now;
    if (dt <= 0) return;
    if (dt > 5) {
      const r = bulkGains(Math.min(dt, OFFLINE_CAP));
      if (r.gold > 0) toast(`Em segundo plano: +${fmt(r.gold)} de ouro (${fmt(r.kills)} criaturas)`, 'gold');
      dt = 0.05;
    }
    update(dt);
  }

  let achTimer = 0;
  const acAcc = [];
  function workAutoclickers(dt) {
    const r = acRate();
    for (let i = 0; i < S.ac.owned; i++) {
      const t = S.ac.assign[i];
      if (!t || t === 'arena') continue;
      acAcc[i] = (acAcc[i] || 0) + r * dt;
      if (acAcc[i] < 1) continue;
      acAcc[i] = 0;
      if (t.startsWith('skill:')) useSkill(t.slice(6), true);
      else if (t.startsWith('buy:')) { const it = ITEMS.find((x) => x.key === t.slice(4)); if (it) buyItem(it, true); }
    }
  }

  function update(dt) {
    S.stats.playTime += dt;
    updateHero(dt);
    shakeT = Math.max(0, shakeT - dt * 1.5);
    critFlash = Math.max(0, critFlash - dt);
    if (!M) spawnMonster();
    M.spawn = Math.min(1, M.spawn + dt * 4);
    M.hit = Math.max(0, M.hit - dt * 5);
    if (M.dying > 0) {
      M.dying += dt;
      // o corpo continua a animação de morte enquanto a próxima criatura surge
      if (M.dying > 0.35) { M.hit = 0; corpses.push(M); if (corpses.length > 4) corpses.shift(); spawnMonster(); }
    } else {
      const d = dps();
      if (d > 0 && M.spawn >= 0.5) { dpsAcc += Math.min(d * dt, M.hp); damage(d * dt, true); }
      autoAcc += (autoClicks() + acOn('arena') * acRate()) * dt;
      while (autoAcc >= 1) { autoAcc -= 1; attack(true); }
      if (M.boss && M.dying === 0 && M.spawn >= 1) {
        if (!skillActive('muralha')) M.time -= dt;
        if (M.time <= 0) bossFail();
      }
    }
    for (const c of corpses) c.dying += dt;
    corpses = corpses.filter((c) => c.dying < DEATH_T);
    workAutoclickers(dt);
    achTimer += dt;
    if (achTimer > 1) { achTimer = 0; checkAchievements(); }
    dpsTimer += dt;
    if (dpsTimer >= 1) {
      if (dpsAcc > 0 && S.settings.numbers) addFloat(MX + 60 + Math.random() * 40, GROUND - 40 - Math.random() * 30, '-' + fmt(dpsAcc), '#9fd8ff', 16);
      dpsAcc = 0; dpsTimer = 0;
    }
    projTimer += dt;
    if (rawDps() > 0 && projTimer > 0.8) { projTimer = 0; projs.push({ t: 0 }); }
    for (const p of projs) {
      p.t += dt;
      if (p.t >= 0.45 && !p.done) { p.done = true; if (M && !M.dying) { M.hit = Math.max(M.hit, 0.5); sparks(MX - 30, GROUND - 80, '#bfe8ff', 4); parts.push({ x: MX - 30, y: GROUND - 80, vx: 0, vy: 0, g: 0, life: 0, max: 0.22, type: 'ring', color: '#bfe8ff', r0: 4, r1: 26 }); } }
    }
    projs = projs.filter((p) => !p.done);
    for (const p of parts) {
      p.life += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.floor && p.y > p.floor) { p.y = p.floor; p.vy *= -0.4; p.vx *= 0.6; }
    }
    parts = parts.filter((p) => p.life < p.max);
    for (const f of floats) { f.life += dt; f.y -= 55 * dt; }
    floats = floats.filter((f) => f.life < f.max);
  }

  let tAnim = 0, lastFrame = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    tAnim += dt;
    tick();
    render(tAnim);
    updateHud();
    requestAnimationFrame(frame);
  }

  // ======================================================================
  // Interface
  // ======================================================================
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const setText = (e, v) => { if (e.textContent !== v) e.textContent = v; };
  let shopDirty = true, zonesDirty = true, hudDirty = true, acDirty = true, ghostP = 1, ghostMon = null;

  function toast(msg, kind) {
    const t = el('div', 'toast' + (kind ? ' ' + kind : ''));
    t.textContent = msg;
    const box = $('toasts');
    box.appendChild(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 3200);
  }

  function modal(title, bodyHTML, buttons) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = bodyHTML;
    const act = $('modalActions');
    act.innerHTML = '';
    for (const b of buttons) {
      const btn = el('button', 'btn ' + (b.cls || ''), b.label);
      btn.addEventListener('click', () => { if (b.onClick && b.onClick() === false) return; closeModal(); });
      act.appendChild(btn);
    }
    $('modal').hidden = false;
    const first = act.querySelector('button:last-child');
    if (first) first.focus();
  }
  function closeModal() { $('modal').hidden = true; }

  // ---- HUD da arena e topo ----
  function updateHud() {
    setText($('gold'), fmt(S.gold));
    setText($('dps'), fmt(dps()));
    setText($('clickdmg'), fmt(clickDmg()));
    setText($('souls'), fmt(S.souls));
    setText($('gems'), fmt(S.gems));
    if (M) {
      setText($('mName'), M.name);
      $('mName').className = 'mname' + (M.boss ? ' boss' : '') + (M.chest ? ' chest' : '') + (M.final ? ' final' : '');
      const p = Math.max(0, M.hp / M.maxHp);
      if (M !== ghostMon) { ghostMon = M; ghostP = 1; }
      ghostP = p >= ghostP ? p : Math.max(p, ghostP - 0.006 - (ghostP - p) * 0.06);
      $('mHpFill').style.width = (p * 100).toFixed(1) + '%';
      $('mHpGhost').style.width = (ghostP * 100).toFixed(1) + '%';
      setText($('mHpText'), `${fmt(Math.max(0, Math.ceil(M.hp)))} / ${fmt(Math.ceil(M.maxHp))}`);
      const bt = $('bossTimer');
      if (M.boss) {
        bt.hidden = false;
        $('btFill').style.width = (Math.max(0, M.time / (bossTime() * (M.final ? 2 : 1))) * 100).toFixed(1) + '%';
        const frozen = skillActive('muralha');
        bt.classList.toggle('frozen', frozen);
        setText($('btText'), `${frozen ? '❄' : '⏱'} ${Math.max(0, M.time).toFixed(1).replace('.', ',')}s`);
      } else bt.hidden = true;
    }
    const z = S.zone;
    setText($('zoneTitle'), `Zona ${z}`);
    setText($('biomeName'), '· ' + biomeOf(z).name);
    let prog;
    if (z < S.maxZone) prog = 'Zona concluída ✓ (farmando)';
    else if (isBoss(z)) prog = '☠ Chefe da zona!';
    else prog = `Criaturas: ${S.zoneKills}/${KILLS_PER_ZONE}`;
    setText($('zoneProgress'), prog);
    $('hint').classList.toggle('hide', introClicks >= 6 || S.stats.clicks > 20);
    if (zonesDirty) renderZones();
    updateSkills();
  }

  function renderZones() {
    zonesDirty = false;
    const list = $('zoneList');
    list.innerHTML = '';
    const count = window.innerWidth < 420 ? 3 : window.innerWidth < 620 ? 5 : 7;
    let start = Math.max(1, S.zone - Math.floor(count / 2));
    for (let z = start; z < start + count; z++) {
      const b = el('button', 'zone');
      b.textContent = z;
      if (isBoss(z)) b.classList.add('boss');
      if (z === S.zone) b.classList.add('current');
      if (z > S.maxZone) { b.classList.add('locked'); b.disabled = true; }
      b.title = `Zona ${z} — ${biomeOf(z).name}`;
      b.addEventListener('click', () => setZone(z));
      list.appendChild(b);
    }
    $('zprev').disabled = S.zone <= 1;
    $('znext').disabled = S.zone >= S.maxZone;
    $('autoAdv').checked = S.autoAdvance;
  }

  // ---- habilidades ----
  const skillEls = {};
  function buildSkills() {
    const box = $('skills');
    SKILLS.forEach((sk, i) => {
      const b = el('button', 'skill', `<span class="skey">${SKILL_KEYS[i]}</span><span class="sbadge"><span class="sicon">${sk.icon}</span><span class="scd"></span><span class="stime"></span></span><span class="sname">${sk.name}</span>`);
      b.addEventListener('click', () => useSkill(sk.id));
      b.dataset.ac = 'skill:' + sk.id;
      box.appendChild(b);
      skillEls[sk.id] = { b, cd: b.querySelector('.scd'), time: b.querySelector('.stime') };
    });
  }
  function updateSkills() {
    const now = clock();
    for (const sk of SKILLS) {
      const r = skillEls[sk.id];
      const locked = S.maxZone < sk.unlock;
      const s = S.skills[sk.id];
      const active = !locked && skillActive(sk.id);
      const ready = !locked && skillReady(sk.id);
      const cls = 'skill' + (locked ? ' locked' : active ? ' active' : ready ? ' ready' : '');
      if (r.b.className !== cls) r.b.className = cls;
      r.b.setAttribute('aria-disabled', String(locked || !ready));
      r.b.title = locked ? `${sk.name} — desbloqueia na zona ${sk.unlock}` : `${sk.name}: ${sk.desc} Recarga: ${fmtTime(sk.cd * cdMult())}. Atalho: tecla ${SKILL_KEYS[SKILLS.indexOf(sk)]}`;
      if (locked) { r.cd.style.setProperty('--p', '0%'); setText(r.time, `Zona ${sk.unlock}`); continue; }
      if (active) { r.cd.style.setProperty('--p', '0%'); setText(r.time, Math.ceil((s.until - now) / 1000) + 's'); }
      else if (!ready) {
        const left = (s.ready - now) / 1000;
        r.cd.style.setProperty('--p', ((left / (sk.cd * cdMult())) * 100).toFixed(1) + '%');
        setText(r.time, fmtTime(left));
      } else { r.cd.style.setProperty('--p', '0%'); setText(r.time, ''); }
    }
  }

  // ---- loja ----
  function shieldSVG(level) {
    const t = tierOf(level);
    return `<svg viewBox="0 0 60 72"><defs><linearGradient id="sg${level}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(t.c, 0.35)}"/><stop offset=".5" stop-color="${t.c}"/><stop offset="1" stop-color="${shade(t.c, -0.3)}"/></linearGradient></defs>` +
      `<path d="M4 10 Q4 4 10 4 H50 Q56 4 56 10 V34 Q56 56 30 68 Q4 56 4 34 Z" fill="url(#sg${level})" stroke="${t.r}" stroke-width="4" ${t.glow ? `style="filter:drop-shadow(0 0 4px ${t.glow})"` : ''}/>` +
      (level >= 2 ? `<circle cx="30" cy="30" r="9" fill="${t.r}"/><circle cx="30" cy="30" r="4" fill="${shade(t.c, 0.45)}"/>` : `<path d="M20 30 L30 40 L40 30" fill="none" stroke="${t.r}" stroke-width="3"/>`) + '</svg>';
  }

  const ITEMS = [];
  function bulkItem(def, panel, effect) {
    return {
      panel, def, bulk: true, currency: 'gold', key: def.id,
      unlocked: () => S.maxZone >= def.unlock,
      level: () => lvl(def.id),
      max: def.max || Infinity,
      icon: () => def.icon,
      title: () => def.name,
      desc: () => def.desc,
      effect,
      info() {
        const l = lvl(def.id), room = (def.max || Infinity) - l;
        if (room <= 0) return { n: 0, cost: Infinity, maxed: true };
        let n = S.buyMode === 'max' ? Math.min(room, maxAffordable(def.base, def.growth, l, S.gold)) : Math.min(room, S.buyMode);
        if (n < 1) n = 1;
        return { n, cost: costBulk(def.base, def.growth, l, n) };
      },
      buy(n) { S.trainings[def.id] = lvl(def.id) + n; },
    };
  }
  function msText(l) { const nm = nextMilestone(l); return ` · <span class="ms">Nv ${nm}: ×${BAL.ms25}</span>`; }

  function buildItems() {
    for (const t of TRAININGS) {
      ITEMS.push(bulkItem(t, 'treinos', () => {
        const l = lvl(t.id);
        if (t.type === 'click') {
          const val = (1 + trainPower(t, l)) * shieldMult(S.shields.left) * globalMult();
          return `Golpe: ${fmt(val)} · +${fmt(t.per * milestone(l) * shieldMult(S.shields.left) * globalMult())}/nível` + msText(l);
        }
        const mult = shieldMult(S.shields.right) * globalMult();
        return `DPS: ${fmt(trainPower(t, l) * mult)} · +${fmt(t.per * milestone(l) * mult)}/nível` + msText(l);
      }));
    }
    const attrEffects = {
      precisao: () => `Crítico: ${pct(Math.min(0.5, 0.01 * lvl('precisao')))}`,
      impacto: () => `Dano crítico: ×${fmt(critMult())}`,
      ganancia: () => `Ouro: ×${fmt(Math.pow(1.15, lvl('ganancia')))}`,
      sinergia: () => `Golpe +${lvl('sinergia')}% do DPS (+${fmt(baseDps() * 0.01 * lvl('sinergia'))})`,
    };
    for (const a of ATTRS) ITEMS.push(bulkItem(a, 'atributos', attrEffects[a.id]));

    for (const side of ['left', 'right']) {
      ITEMS.push({
        panel: 'escudos', currency: 'gold', key: 'shield-' + side, unlocked: () => true, level: () => S.shields[side], max: Infinity,
        icon: () => shieldSVG(S.shields[side]), iconKey: () => S.shields[side],
        title: () => (side === 'left' ? 'Escudo Esquerdo' : 'Escudo Direito') + ' · ' + tierName(S.shields[side]),
        desc: () => side === 'left' ? 'O escudo de golpear. Multiplica o dano por clique.' : 'O escudo espectral. Multiplica todo o DPS.',
        effect: () => { const l = S.shields[side]; return `${side === 'left' ? 'Golpe' : 'DPS'} ×${fmt(shieldMult(l))} → <span class="ms">${tierName(l + 1)}: ×${fmt(shieldMult(l + 1))}</span>`; },
        info: () => ({ n: 1, cost: shieldCost(side) }),
        label: () => 'Forjar',
        buy() { S.shields[side]++; toast(`🔨 ${side === 'left' ? 'Escudo Esquerdo' : 'Escudo Direito'} forjado em ${tierName(S.shields[side])}!`, 'gold'); },
      });
    }
    for (const r of RELICS) {
      ITEMS.push({
        panel: 'reliquias', currency: 'souls', key: 'relic-' + r.id, unlocked: () => S.stats.prestiges > 0 || S.souls > 0, level: () => rl(r.id), max: r.max || Infinity,
        icon: () => r.icon, title: () => r.name, desc: () => r.desc,
        effect: () => {
          const l = rl(r.id);
          switch (r.id) {
            case 'egide': return `Dano ×${fmt(1 + 0.25 * l)}`;
            case 'bolsa': return `Ouro ×${fmt(1 + 0.2 * l)}`;
            case 'mao': return `Cada Escudeiro: ${fmt(acRate())} toques/s`;
            case 'pressa': return `Recarga ${l * 4}% mais rápida`;
            case 'ampulheta': return `Tempo contra chefes: ${bossTime()}s`;
            case 'ferreiro': return `Forja ${l * 4}% mais barata`;
            case 'tesouro': return `Chance de baú: ${pct(chestChance())}`;
          }
          return '';
        },
        info: () => { const l = rl(r.id); if (l >= (r.max || Infinity)) return { n: 0, cost: Infinity, maxed: true }; return { n: 1, cost: r.cost(l) }; },
        label: () => 'Comprar',
        buy() { S.relics[r.id] = rl(r.id) + 1; },
      });
    }
  }

  function buildShopUI() {
    for (const it of ITEMS) {
      const root = el('div', 'item p-' + it.panel);
      root.innerHTML = `<div class="item-icon"></div><div class="item-body"><div class="item-title"><span class="tname"></span><span class="lvl"></span></div><div class="item-desc"></div><div class="item-effect"></div>${it.bulk ? '<div class="item-prog"><i></i></div>' : ''}</div><button class="buy${it.currency === 'souls' ? ' souls' : ''}"><span class="bl"></span><span class="bc"></span></button>`;
      it.els = {
        root, icon: root.querySelector('.item-icon'), name: root.querySelector('.tname'), lvl: root.querySelector('.lvl'),
        desc: root.querySelector('.item-desc'), effect: root.querySelector('.item-effect'), btn: root.querySelector('.buy'),
        bl: root.querySelector('.bl'), bc: root.querySelector('.bc'), prog: root.querySelector('.item-prog i'),
      };
      it.els.btn.addEventListener('click', () => buyItem(it));
      root.dataset.ac = 'buy:' + it.key;
      $('panel-' + it.panel).appendChild(root);
    }
    // cartões extras
    const harmonyCard = el('div', 'card', '');
    harmonyCard.id = 'harmonyCard';
    $('panel-escudos').prepend(harmonyCard);
    const prest = el('div', 'card prestige', '');
    prest.id = 'prestigeCard';
    $('panel-reliquias').prepend(prest);
    const relInfo = el('div', 'card', '<p>Relíquias são compradas com <span class="hl-soul">Égides</span>. Lembre-se: cada Égide guardada também dá <b>+10% de dano</b>, então gastar reduz esse bônus.</p>');
    relInfo.id = 'relicInfo';
    prest.after(relInfo);
  }

  function buyItem(it, auto) {
    if (!it.unlocked()) return;
    const inf = it.info();
    if (inf.maxed || inf.n < 1) return;
    const wallet = it.currency === 'souls' ? S.souls : S.gold;
    if (wallet < inf.cost) return;
    if (it.currency === 'souls') S.souls -= inf.cost; else S.gold -= inf.cost;
    it.buy(inf.n);
    if (it.els) {
      const r = it.els.root;
      r.classList.remove('bought'); void r.offsetWidth; r.classList.add('bought');
    }
    if (!auto) { Sfx.init(); Sfx.buy(); }
    shopDirty = true;
    if (!auto && it.els) refreshShop();
  }

  function refreshShop() {
    shopDirty = false;
    const affordable = {};
    const shownLocked = {};
    for (const it of ITEMS) {
      const e = it.els;
      const unlocked = it.unlocked();
      if (!unlocked) {
        // mostra só o próximo item bloqueado de cada painel
        if (it.panel === 'reliquias' || shownLocked[it.panel]) { e.root.hidden = true; continue; }
        shownLocked[it.panel] = true;
        e.root.hidden = false;
        e.root.classList.add('locked'); e.root.classList.remove('ac-ready');
        if (e.icon.dataset.k !== 'lock') { e.icon.textContent = '🔒'; e.icon.dataset.k = 'lock'; }
        setText(e.name, '???');
        setText(e.lvl, '');
        setText(e.desc, `Desbloqueia ao alcançar a zona ${it.def.unlock}.`);
        e.effect.innerHTML = '';
        continue;
      }
      e.root.hidden = false;
      e.root.classList.remove('locked');
      const key = it.iconKey ? 'k' + it.iconKey() : 'static';
      if (e.icon.dataset.k !== key) { e.icon.innerHTML = it.icon(); e.icon.dataset.k = key; }
      setText(e.name, it.title());
      const l = it.level();
      setText(e.lvl, it.panel === 'escudos' ? `Forja ${l}` : `Nv ${l}${it.max !== Infinity ? '/' + it.max : ''}`);
      setText(e.desc, it.desc());
      if (e.prog) {
        const capped = it.max !== Infinity && l >= it.max;
        const w = (capped ? 100 : ((l % 25) / 25) * 100).toFixed(0) + '%';
        if (e.prog.style.width !== w) e.prog.style.width = w;
      }
      const eff = it.effect();
      if (e.effect.dataset.v !== eff) { e.effect.innerHTML = eff; e.effect.dataset.v = eff; }
      const inf = it.info();
      const wallet = it.currency === 'souls' ? S.souls : S.gold;
      if (inf.maxed) {
        e.btn.disabled = true; e.btn.classList.add('maxed'); e.root.classList.remove('ac-ready');
        setText(e.bl, ''); setText(e.bc, 'Máximo');
      } else {
        e.btn.classList.remove('maxed');
        const can = wallet >= inf.cost;
        e.btn.disabled = !can;
        // borda amarela: há um Escudeiro neste item e já dá para comprar
        e.root.classList.toggle('ac-ready', can && acOn('buy:' + it.key) > 0);
        if (can) affordable[it.panel] = true;
        const label = it.label ? it.label() : (S.buyMode === 'max' ? `Máx ×${inf.n}` : `Treinar ×${inf.n}`);
        setText(e.bl, label);
        setText(e.bc, fmt(inf.cost) + (it.currency === 'souls' ? ' Égide' + (inf.cost > 1 ? 's' : '') : ''));
      }
    }
    // cartão de harmonia
    const L = S.shields.left, R = S.shields.right;
    $('harmonyCard').innerHTML = `<p><b>Harmonia dos Escudos</b> — Flistaile luta melhor quando os dois escudos estão equilibrados: +15% de todo o dano para cada forja que os dois têm em comum.</p><p>Bônus atual: <b class="hl-gold">×${fmt(harmony())}</b> (${Math.min(L, R)} em comum)</p>`;
    // renascimento
    const gain = soulsFor(S.maxZone);
    const pc = $('prestigeCard');
    const html = S.maxZone >= PRESTIGE_ZONE
      ? `<p><b>Renascer</b> — Flistaile recomeça na zona 1, perdendo ouro, treinos e escudos, mas ganha Égides permanentes.</p><p>Você ganharia <span class="big">+${fmt(gain)}</span> <span class="hl-soul">Égides</span> (bônus total passaria a ×${fmt(1 + 0.1 * (S.souls + gain))} de dano).</p><button class="btn soul" id="btnPrestige">Renascer agora</button>`
      : `<p><b>Renascer</b> — alcance a <b>zona ${PRESTIGE_ZONE}</b> para renascer e ganhar <span class="hl-soul">Égides</span>, que dão +10% de dano cada e compram relíquias.</p><p>Zona máxima desta jornada: <b>${S.maxZone}</b> / ${PRESTIGE_ZONE}</p>`;
    if (pc.dataset.v !== html) {
      pc.innerHTML = html; pc.dataset.v = html;
      const b = $('btnPrestige');
      if (b) b.addEventListener('click', confirmPrestige);
    }
    $('relicInfo').hidden = !(S.stats.prestiges > 0 || S.souls > 0);
    if (S.maxZone >= PRESTIGE_ZONE && gain > 0) affordable.reliquias = true;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('has-buy', !!affordable[b.dataset.tab]));
  }

  function confirmPrestige() {
    const gain = soulsFor(S.maxZone);
    modal('Renascer?', `<p>Flistaile voltará à zona 1. Ouro, treinos, atributos e escudos serão perdidos.</p><p>Você mantém relíquias e estatísticas e recebe <span class="hl-soul">+${fmt(gain)} Égides</span>.</p>`, [
      { label: 'Cancelar' },
      { label: 'Renascer', cls: 'soul', onClick: prestige },
    ]);
  }

  // ---- estatísticas ----
  function renderStats() {
    const rows = [
      ['Tempo de jogo', fmtTime(S.stats.playTime)],
      ['Zona atual', S.zone],
      ['Zona máxima (jornada)', S.maxZone],
      ['Zona máxima (de todas)', S.stats.maxZoneEver],
      ['Criaturas derrotadas', fmt(S.stats.kills)],
      ['Chefes derrotados', fmt(S.stats.bosses)],
      ['Baús Vivos abertos', fmt(S.stats.chests)],
      ['Golpes dados (cliques)', fmt(S.stats.clicks)],
      ['Ouro total coletado', fmt(S.stats.goldTotal)],
      ['Renascimentos', S.stats.prestiges],
      ['Égides ganhas no total', fmt(S.stats.soulsTotal)],
      ['Multiplicador global de dano', '×' + fmt(globalMult())],
      ['Chance de crítico', pct(critChance())],
      ['Dano crítico', '×' + fmt(critMult())],
      ['Multiplicador de ouro', '×' + fmt(goldMult())],
      ['Escudeiros', `${S.ac.owned}/${AC_COSTS.length} (${fmt(acRate())} toques/s cada)`],
      ['Gemas ganhas no total', fmt(S.stats.gemsTotal)],
      ['Conquistas', `${achCount()}/${ACH.length}`],
      ['Chefe final', S.stats.finalBeaten ? 'Derrotado 👑' : `Zona ${FINAL_ZONE}`],
    ];
    const html = '<div class="card"><dl class="stat-list">' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl></div>';
    const p = $('panel-stats');
    if (p.dataset.v !== html) { p.innerHTML = html; p.dataset.v = html; }
  }

  // ---- opções ----
  function buildOptions() {
    const p = $('panel-opcoes');
    p.innerHTML = `
      <div class="card"><div class="opt"><span>Sons</span><label class="toggle"><input type="checkbox" id="optSound"><span class="track"><span class="thumb"></span></span></label></div></div>
      <div class="card"><div class="opt"><span>Números de dano</span><label class="toggle"><input type="checkbox" id="optNumbers"><span class="track"><span class="thumb"></span></span></label></div></div>
      <div class="card"><p>O progresso é salvo automaticamente neste navegador a cada 10 segundos. Use exportar/importar para levar seu save para outro aparelho.</p>
        <div class="btn-row"><button class="btn primary" id="optSave">Salvar agora</button><button class="btn" id="optExport">Exportar</button><button class="btn" id="optImport">Importar</button></div></div>
      <div class="card"><p>Apaga todo o progresso, incluindo Égides e relíquias.</p><button class="btn danger" id="optReset">Apagar progresso</button></div>
      <div class="card"><p><b>Como jogar</b></p><p>Clique na arena para golpear: o botão esquerdo do mouse usa o escudo esquerdo, o direito usa o escudo direito, e no crítico Flistaile golpeia com os dois. Derrote ${KILLS_PER_ZONE} criaturas para liberar a próxima zona; a cada 5 zonas há um chefe com tempo limite. Gaste ouro em treinos (DPS automático), atributos e forje seus dois escudos. Na zona ${PRESTIGE_ZONE}, renasça para ganhar Égides.</p><p>Chefes derrotados pela primeira vez dão 💎 gemas. Com elas você contrata Escudeiros: arraste cada um até o monstro, uma habilidade ou um botão de compra e ele fica apertando ali. Clique num Escudeiro para recolhê-lo.</p><p>Derrote o Devorador de Mundos na zona ${FINAL_ZONE} para concluir a história — a jornada continua depois.</p><p>Atalhos: teclas 1 a 9 e 0 usam habilidades; ← e → trocam de zona.</p></div>`;
    p.querySelectorAll('input').forEach((i) => i.setAttribute('autocomplete', 'off'));
    $('optSound').checked = S.settings.sound;
    $('optNumbers').checked = S.settings.numbers;
    $('optSound').addEventListener('change', (e) => { S.settings.sound = e.target.checked; save(); });
    $('optNumbers').addEventListener('change', (e) => { S.settings.numbers = e.target.checked; save(); });
    $('optSave').addEventListener('click', () => { save(); toast('Jogo salvo!'); });
    $('optExport').addEventListener('click', () => {
      modal('Exportar save', '<p>Copie o texto abaixo e guarde em um lugar seguro.</p><textarea class="save" id="exportBox" readonly></textarea>', [
        { label: 'Copiar', cls: 'primary', onClick: () => { const b = $('exportBox'); b.select(); try { navigator.clipboard.writeText(b.value); toast('Copiado!'); } catch (e) { document.execCommand('copy'); } return false; } },
        { label: 'Fechar' },
      ]);
      $('exportBox').value = exportSave();
    });
    $('optImport').addEventListener('click', () => {
      modal('Importar save', '<p>Cole o texto exportado. O progresso atual será substituído.</p><textarea class="save" id="importBox"></textarea>', [
        { label: 'Cancelar' },
        { label: 'Importar', cls: 'primary', onClick: () => {
          try { importSave($('importBox').value); afterStateChange(); toast('Save importado!'); }
          catch (e) { toast('Texto de save inválido.', 'bad'); return false; }
        } },
      ]);
    });
    $('optReset').addEventListener('click', () => {
      modal('Apagar tudo?', '<p>Todo o progresso será perdido para sempre, inclusive Égides e relíquias. Isso não pode ser desfeito.</p>', [
        { label: 'Cancelar' },
        { label: 'Apagar tudo', cls: 'danger', onClick: () => { S = defaultState(); S.seenIntro = true; save(); afterStateChange(); toast('Progresso apagado.'); } },
      ]);
    });
  }

  function afterStateChange() {
    spawnMonster();
    shopDirty = true; zonesDirty = true; acDirty = true;
    $('optSound').checked = S.settings.sound;
    $('optNumbers').checked = S.settings.numbers;
    syncBuyMode();
    refreshShop();
  }

  // ---- escudeiros (auto clickers arrastáveis) ----
  let drag = null, suppressClick = false;
  const AC_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5c3-4 9-2 10 2-3-1-7 0-10 2z" fill="#e04a3a" stroke="#1b1426" stroke-width="1.5" stroke-linejoin="round"/><path d="M5 16a11 11 0 0 1 22 0v3H5z" fill="#dfe6ee" stroke="#1b1426" stroke-width="2"/><path d="M5 19h22v3a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="#97a3b3" stroke="#1b1426" stroke-width="2"/><rect x="10" y="19.5" width="12" height="3" rx="1.2" fill="#1b1426"/><circle cx="16" cy="13" r="2" fill="#ffd24a" stroke="#1b1426" stroke-width="1"/></svg>';
  function acTargetName(t) {
    if (t === 'arena') return 'golpeando o monstro';
    if (t.startsWith('skill:')) { const sk = SKILLS.find((s) => s.id === t.slice(6)); return sk ? `usando ${sk.name}` : ''; }
    if (t.startsWith('buy:')) { const it = ITEMS.find((x) => x.key === t.slice(4)); return it ? `comprando ${it.title().split(' · ')[0]}` : ''; }
    return '';
  }
  function renderAC() {
    acDirty = false;
    document.querySelectorAll('.ac-pin').forEach((p) => p.remove());
    const tray = $('acTokens');
    tray.innerHTML = '';
    const rate = acRate();
    for (let i = 0; i < S.ac.owned; i++) {
      const t = S.ac.assign[i];
      const tok = el('div', t ? 'ac-pin' : 'ac-token', AC_SVG);
      tok.dataset.i = i;
      tok.style.setProperty('--tap', (1 / rate).toFixed(3) + 's');
      tok.title = t ? `Escudeiro ${acTargetName(t)}. Arraste para mover ou clique para recolher.` : 'Escudeiro livre: arraste até o monstro, uma habilidade ou um botão de compra.';
      tok.addEventListener('pointerdown', startDrag);
      if (!t) { tray.appendChild(tok); continue; }
      const host = t === 'arena' ? $('arenaPins') : document.querySelector(`[data-ac="${t}"]`);
      if (host) host.appendChild(tok); else { S.ac.assign[i] = null; tray.appendChild(tok); }
    }
    const c = acNextCost();
    const btn = $('acBuy');
    btn.hidden = c === Infinity;
    btn.disabled = S.gems < c;
    btn.innerHTML = `+ Escudeiro <b>💎 ${c}</b>`;
    setText($('acCount'), `${S.ac.owned}/${AC_COSTS.length}`);
    $('acHint').hidden = S.ac.owned > 0 && S.ac.assign.some((x) => x);
    setText($('acHint'), S.ac.owned === 0 ? 'Derrote chefes para ganhar 💎 gemas e contratar Escudeiros (auto clickers).' : 'Arraste um Escudeiro até o monstro, uma habilidade ou um botão de compra.');
  }
  function startDrag(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const src = e.currentTarget;
    const ghost = el('div', 'ac-ghost', AC_SVG);
    document.body.appendChild(ghost);
    drag = { i: Number(src.dataset.i), ghost, x0: e.clientX, y0: e.clientY, moved: false, fromPin: src.classList.contains('ac-pin') };
    ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
  }
  function dropTarget(e) {
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    return hit ? hit.closest('[data-ac]') : null;
  }
  function clearHover() { document.querySelectorAll('.ac-hover').forEach((x) => x.classList.remove('ac-hover')); }
  function onDragMove(e) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) { drag.moved = true; document.body.classList.add('ac-dragging'); }
    drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
    clearHover();
    if (drag.moved) { const t = dropTarget(e); if (t) t.classList.add('ac-hover'); }
  }
  function onDragEnd(e) {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
    clearHover();
    document.body.classList.remove('ac-dragging');
    const d = drag; drag = null;
    if (!d) return;
    d.ghost.remove();
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 60);
    if (!d.moved) {
      if (d.fromPin) { S.ac.assign[d.i] = null; toast('🧤 Escudeiro de volta à reserva.'); }
      else toast('Arraste o Escudeiro até o monstro, uma habilidade ou um botão de compra.');
      acDirty = true;
      return;
    }
    const t = e.type === 'pointerup' ? dropTarget(e) : null;
    S.ac.assign[d.i] = t ? t.dataset.ac : null;
    if (t) toast(`🧤 Escudeiro ${acTargetName(t.dataset.ac)}.`);
    acDirty = true;
    Sfx.init(); Sfx.buy();
  }

  // ---- conquistas ----
  const PLURAL = { zona: 'zonas', criatura: 'criaturas', chefe: 'chefes', golpe: 'golpes', renascimento: 'renascimentos', 'baú': 'baús', forja: 'forjas', escudeiro: 'escudeiros', habilidade: 'habilidades', 'nível': 'níveis' };
  function achLeft(n, unit) {
    if (unit === 'ouro') return `faltam ${fmt(n)} de ouro`;
    const one = n > 0 && n < 2;
    return `falta${one ? '' : 'm'} ${fmt(n)} ${one ? unit : PLURAL[unit] || unit}`;
  }
  function renderAch() {
    const n = achCount();
    const html = `<div class="card"><p><b>${n}/${ACH.length}</b> conquistas. Cada uma dá +3% de todo o dano — bônus atual <b class="hl-gold">+${n * 3}%</b>.</p></div><div class="ach-grid">` +
      ACH.map((a) => {
        const ok = !!S.achievements[a.id];
        let prog = '';
        if (!ok) {
          const cur = Math.max(0, Math.min(a.cur(), a.goal));
          const p = Math.min(100, (cur / a.goal) * 100);
          prog = `<div class="ach-bar"><i style="width:${p.toFixed(1)}%"></i></div><small class="ach-left">${fmt(cur)} / ${fmt(a.goal)} · ${achLeft(a.goal - cur, a.unit)}</small>`;
        }
        return `<div class="ach${ok ? ' ok' : ''}"><span class="ach-i">${ok ? a.icon : '🔒'}</span><div class="ach-body"><b>${a.name}</b><small>${a.desc}${a.gems ? ` · 💎 ${a.gems}` : ''}</small>${prog}</div></div>`;
      }).join('') + '</div>';
    const p = $('panel-conquistas');
    if (p.dataset.v !== html) { p.innerHTML = html; p.dataset.v = html; }
  }

  // ---- final da história ----
  function showEnding() {
    Sfx.skill();
    modal('O Devorador caiu!', `<p>Com um último golpe dos dois escudos, Flistaile parte o olho do <b>Devorador de Mundos</b>. As estrelas voltam a brilhar sobre Égide.</p><p>A história termina aqui — mas o Abismo é infinito, e os escudos de Flistaile ainda podem ficar mais fortes.</p><p class="credits">Flistaile · um jogo de Galorak<br>Obrigado por jogar!</p>`, [
      { label: 'Continuar a jornada', cls: 'primary' },
    ]);
  }

  // ---- abas e modo de compra ----
  let activeTab = 'treinos';
  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + tab));
    $('buyMode').classList.toggle('hidden', !(tab === 'treinos' || tab === 'atributos'));
    if (tab === 'stats') renderStats();
    if (tab === 'conquistas') renderAch();
  }
  function syncBuyMode() {
    document.querySelectorAll('#buyMode button').forEach((b) => b.classList.toggle('active', String(S.buyMode) === b.dataset.mode));
  }

  function bindUI() {
    // botão esquerdo = escudo esquerdo, botão direito = escudo direito (no toque, alterna)
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); Sfx.init();
      const side = e.pointerType === 'touch' ? undefined : e.button === 2 ? 'R' : e.button === 0 ? 'L' : null;
      if (side === null) return;
      attack(false, side);
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    $('zprev').addEventListener('click', () => setZone(S.zone - 1));
    $('znext').addEventListener('click', () => setZone(S.zone + 1));
    $('autoAdv').addEventListener('change', (e) => {
      S.autoAdvance = e.target.checked;
      if (S.autoAdvance && S.zone < S.maxZone) { S.zone = S.maxZone; spawnMonster(); }
      zonesDirty = true;
    });
    document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
    document.querySelectorAll('#buyMode button').forEach((b) => b.addEventListener('click', () => {
      S.buyMode = b.dataset.mode === 'max' ? 'max' : Number(b.dataset.mode);
      syncBuyMode(); refreshShop();
    }));
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (!$('modal').hidden) { if (e.key === 'Escape') closeModal(); return; }
      const si = SKILL_KEYS.indexOf(e.key);
      if (si >= 0) useSkill(SKILLS[si].id);
      else if (e.key === 'ArrowLeft') setZone(S.zone - 1);
      else if (e.key === 'ArrowRight') setZone(S.zone + 1);
    });
    $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
    $('acBuy').addEventListener('click', buyAutoclicker);
    document.addEventListener('click', (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; } }, true);
    window.addEventListener('resize', () => { resize(); zonesDirty = true; });
    window.addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  }

  // ======================================================================
  // Início
  // ======================================================================
  function start() {
    load();
    buildItems();
    buildShopUI();
    buildSkills();
    buildOptions();
    bindUI();
    syncBuyMode();
    setTab('treinos');
    resize();
    spawnMonster();
    refreshShop();
    renderAC();
    checkAchievements();

    // progresso offline
    const away = (Date.now() - (S.lastSave || Date.now())) / 1000;
    if (S.seenIntro && away > 60) {
      const secs = Math.min(away, OFFLINE_CAP);
      const r = bulkGains(secs);
      if (r.gold > 0) {
        modal('Bem-vindo de volta!', `<p>Você ficou fora por <b>${fmtTime(away)}</b>${away > OFFLINE_CAP ? ' (máximo de 12h contado)' : ''}.</p><p>Enquanto isso, os escudos espectrais de Flistaile derrotaram <b>${fmt(r.kills)}</b> criaturas e coletaram <span class="hl-gold">${fmt(r.gold)} de ouro</span>.</p>`, [{ label: 'Continuar', cls: 'primary' }]);
      }
    }
    if (!S.seenIntro) {
      modal('Flistaile', `<p>Nas terras de Égide vive <b>Flistaile</b>, o guardião que não empunha espada: ele carrega <b>dois escudos</b>, um em cada braço, e com eles esmaga qualquer criatura.</p><p>Clique na arena para golpear, colete ouro, treine, forje seus escudos e avance pelas zonas até o Abismo Eterno.</p>`, [
        { label: 'Começar a aventura', cls: 'primary', onClick: () => { S.seenIntro = true; save(); Sfx.init(); } },
      ]);
    }

    setInterval(tick, 100);
    setInterval(() => {
      refreshShop();
      if (acDirty && !drag) renderAC();
      else if (!drag) { const b = $('acBuy'); b.disabled = S.gems < acNextCost(); }
      if (activeTab === 'stats') renderStats();
      if (activeTab === 'conquistas') renderAch();
    }, 250);
    setInterval(save, 10000);
    requestAnimationFrame(frame);
  }

  if (window.FL_SIM) {
    // Ganchos para o simulador de balanceamento (tools/sim.html)
    window.FL = {
      BAL, TRAININGS, ATTRS, RELICS, SKILLS, ACH, AC_COSTS, AC_BASE_RATE, FINAL_ZONE, PRESTIGE_ZONE, KILLS_PER_ZONE,
      defaultState, get S() { return S; }, set S(v) { S = v; }, setClock(f) { clock = f; },
      monsterHP, baseGold, isBoss, baseDps, baseClick, critChance, critMult, goldMult, shieldCost, soulsFor, costBulk,
      maxAffordable, bossTime, acRate, achMult, cdMult, lvl, rl, trainPower, milestone, shieldMult, globalMult, harmony, chestChance,
    };
  } else start();
})();
