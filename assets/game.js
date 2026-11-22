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
    { id: 'arremesso', icon: '🛡️', name: 'Arremesso de Escudo', type: 'dps', base: 25, growth: 1.07, per: 3, unlock: 1,
      desc: 'Um escudo espectral é arremessado sozinho contra o inimigo.' },
    { id: 'giro', icon: '🌀', name: 'Escudo Giratório', type: 'dps', base: 600, growth: 1.072, per: 40, unlock: 3,
      desc: 'Os escudos giram ao redor de Flistaile cortando tudo.' },
    { id: 'eco', icon: '🔔', name: 'Eco do Impacto', type: 'dps', base: 2.5e4, growth: 1.075, per: 900, unlock: 8,
      desc: 'Cada pancada ecoa e golpeia de novo.' },
    { id: 'bastiao', icon: '🔥', name: 'Fúria do Bastião', type: 'dps', base: 1.5e6, growth: 1.08, per: 2.5e4, unlock: 15,
      desc: 'A defesa vira ataque: os escudos ardem em chamas.' },
    { id: 'tempestade', icon: '⛈️', name: 'Tempestade de Escudos', type: 'dps', base: 2e8, growth: 1.085, per: 8e5, unlock: 25,
      desc: 'Uma chuva de escudos de luz cai do céu.' },
    { id: 'cometa', icon: '☄️', name: 'Cometa de Égide', type: 'dps', base: 5e10, growth: 1.09, per: 3e7, unlock: 40,
      desc: 'Flistaile lança o escudo como um cometa.' },
    { id: 'eclipse', icon: '🌑', name: 'Eclipse Gêmeo', type: 'dps', base: 2e13, growth: 1.095, per: 1.5e9, unlock: 60,
      desc: 'Os dois escudos se unem e apagam o sol do inimigo.' },
  ];

  const ATTRS = [
    { id: 'precisao', icon: '🎯', name: 'Precisão', base: 150, growth: 1.55, max: 50, unlock: 1,
      desc: '+1% de chance de golpe crítico (máx. 50%).' },
    { id: 'impacto', icon: '💥', name: 'Impacto Esmagador', base: 400, growth: 1.6, unlock: 1,
      desc: '+50% de dano nos golpes críticos.' },
    { id: 'ganancia', icon: '💰', name: 'Ganância', base: 80, growth: 1.45, unlock: 1,
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
    { id: 'furia', icon: '⚔️', name: 'Fúria Dupla', dur: 15, cd: 120, unlock: 5, desc: 'DPS ×3 por 15s.' },
    { id: 'rajada', icon: '👊', name: 'Rajada', dur: 15, cd: 150, unlock: 10, desc: '10 golpes automáticos por segundo durante 15s.' },
    { id: 'falcao', icon: '🦅', name: 'Olho do Falcão', dur: 20, cd: 180, unlock: 15, desc: '+50% de chance de crítico por 20s.' },
    { id: 'ouro', icon: '🪙', name: 'Chuva de Ouro', dur: 30, cd: 400, unlock: 20, desc: 'Ouro ×3 por 30s.' },
    { id: 'sismo', icon: '💢', name: 'Impacto Sísmico', dur: 0, cd: 300, unlock: 35, desc: 'Causa de uma vez o equivalente a 30s de DPS + 50 golpes.' },
  ];

  const RELICS = [
    { id: 'egide', icon: '🏺', name: 'Égide Ancestral', desc: '+25% de todo o dano por nível.', cost: (l) => l + 1 },
    { id: 'bolsa', icon: '👝', name: 'Bolsa do Andarilho', desc: '+20% de ouro por nível.', cost: (l) => l + 1 },
    { id: 'mao', icon: '✋', name: 'Mão Incansável', desc: '+1 golpe automático por segundo.', cost: (l) => (l + 1) * 2, max: 20 },
    { id: 'ampulheta', icon: '⏳', name: 'Ampulheta de Bronze', desc: '+3s para derrotar chefes.', cost: (l) => Math.pow(2, l), max: 10 },
    { id: 'ferreiro', icon: '🔨', name: 'Bênção do Ferreiro', desc: 'Forjar escudos fica 4% mais barato.', cost: (l) => 2 + l * 2, max: 15 },
    { id: 'tesouro', icon: '🗝️', name: 'Faro de Tesouro', desc: '+1% de chance de aparecer um Baú Vivo.', cost: (l) => 3 + l, max: 10 },
  ];

  const BIOMES = [
    { name: 'Campos Verdejantes', sky: ['#7ec0ff', '#d6efff'], hills: ['#8fcf7a', '#6eb35a'], ground: '#5fa83c', dirt: '#7a5a34', fx: 'leaves', clouds: true, sun: '#fff6c0',
      monsters: [['Gosma', 'slime', '#6ad04a'], ['Cogumelo Raivoso', 'mushroom', '#d9473f'], ['Lobo Cinzento', 'beast', '#8a8f99']] },
    { name: 'Floresta Sombria', sky: ['#1e3a2e', '#5f8a66'], hills: ['#2f5a3a', '#244a2e'], ground: '#2f5a2a', dirt: '#3e2f22', fx: 'fireflies', moon: '#e8f5d0',
      monsters: [['Morcego Noturno', 'bat', '#5b3f7a'], ['Espírito do Bosque', 'ghost', '#9fe0c0'], ['Lobo Sombrio', 'beast', '#3e3a52']] },
    { name: 'Cavernas de Cristal', sky: ['#15142b', '#3a3670'], hills: ['#2c2a52', '#232145'], ground: '#4a4560', dirt: '#2f2b40', fx: 'sparkle', stars: true, crystals: true,
      monsters: [['Golem de Cristal', 'golem', '#7fd6ff'], ['Olho Errante', 'eye', '#c86bff'], ['Gosma Cristalina', 'slime', '#58e0e0']] },
    { name: 'Deserto Escaldante', sky: ['#f3a54e', '#ffe7a8'], hills: ['#e6b46a', '#d49a50'], ground: '#dcae62', dirt: '#b5823e', fx: 'dust', sun: '#fff1b0',
      monsters: [['Chacal de Areia', 'beast', '#c08a4a'], ['Múmia Errante', 'ghost', '#e8dcb5'], ['Golem de Arenito', 'golem', '#d2a35f']] },
    { name: 'Pântano Pútrido', sky: ['#3d4a32', '#8a9a66'], hills: ['#4f6038', '#3e4d2c'], ground: '#4a5a30', dirt: '#33301e', fx: 'spores',
      monsters: [['Gosma Tóxica', 'slime', '#9acd32'], ['Cogumelo Venenoso', 'mushroom', '#8a4fbf'], ['Olho do Lodo', 'eye', '#7aa83a']] },
    { name: 'Tundra Congelada', sky: ['#8fb9dc', '#eef7ff'], hills: ['#dbe9f5', '#c3d8ea'], ground: '#e9f3fb', dirt: '#9fb5c8', fx: 'snow', clouds: true,
      monsters: [['Lobo do Gelo', 'beast', '#cfe6f5'], ['Golem de Gelo', 'golem', '#9fd8ff'], ['Espectro Gélido', 'ghost', '#bfe8ff']] },
    { name: 'Cratera Vulcânica', sky: ['#2a0a08', '#a3361a'], hills: ['#4a1a12', '#33110c'], ground: '#3b2420', dirt: '#24130f', fx: 'embers', lava: true,
      monsters: [['Gosma de Magma', 'slime', '#ff6a1a'], ['Morcego Ígneo', 'bat', '#ff4a2a'], ['Golem de Obsidiana', 'golem', '#3a2f45']] },
    { name: 'Ruínas Celestes', sky: ['#6f7fff', '#ffd6f5'], hills: ['#c8bfff', '#b0a6f0'], ground: '#cfc8ec', dirt: '#9a90c8', fx: 'motes', clouds: true,
      monsters: [['Olho Celestial', 'eye', '#ffd84a'], ['Guardião Alado', 'bat', '#f0f0ff'], ['Espírito Astral', 'ghost', '#c9a8ff']] },
    { name: 'Abismo Eterno', sky: ['#05030d', '#2a0f3d'], hills: ['#1a0a2a', '#12061f'], ground: '#1a0f26', dirt: '#0d0714', fx: 'void', stars: true,
      monsters: [['Devorador', 'beast', '#6a1a8a'], ['Olho do Vazio', 'eye', '#ff2a6a'], ['Sombra Primordial', 'ghost', '#4a3a7a']] },
  ];
  const biomeIndex = (z) => Math.floor((z - 1) / 10) % BIOMES.length;
  const biomeOf = (z) => BIOMES[biomeIndex(z)];

  // ======================================================================
  // Estado
  // ======================================================================
  function defaultState() {
    return {
      v: 1,
      gold: 0,
      zone: 1,
      maxZone: 1,
      zoneKills: 0,
      autoAdvance: true,
      trainings: {},
      shields: { left: 0, right: 0 },
      relics: {},
      souls: 0,
      skills: {},
      buyMode: 1,
      settings: { sound: true, numbers: true },
      stats: { clicks: 0, kills: 0, bosses: 0, goldTotal: 0, prestiges: 0, maxZoneEver: 1, playTime: 0, soulsTotal: 0, chests: 0, startedAt: Date.now() },
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
  const lvl = (id) => S.trainings[id] || 0;
  const rl = (id) => S.relics[id] || 0;
  const milestone = (l) => Math.pow(2, Math.floor(l / 25)) * Math.pow(2, Math.floor(l / 100));
  const nextMilestone = (l) => (Math.floor(l / 25) + 1) * 25;
  const shieldMult = (l) => Math.pow(1.8, l);
  const harmony = () => 1 + 0.15 * Math.min(S.shields.left, S.shields.right);
  const globalMult = () => (1 + 0.1 * S.souls) * (1 + 0.25 * rl('egide')) * harmony();
  const trainPower = (t, l) => t.per * l * milestone(l);

  function monsterHP(z) { return Math.ceil(10 * Math.pow(1.47, z - 1) * (z > 100 ? Math.pow(1.03, z - 100) : 1)); }
  function baseGold(z) { return Math.max(1, Math.ceil(monsterHP(z) / 5.5)); }
  const isBoss = (z) => z % 5 === 0;

  function rawDps() { let s = 0; for (const t of TRAININGS) if (t.type === 'dps') s += trainPower(t, lvl(t.id)); return s; }
  function baseDps() { return rawDps() * shieldMult(S.shields.right) * globalMult(); }
  function dps() { return baseDps() * (skillActive('furia') ? 3 : 1); }
  function clickDmg() {
    return (1 + trainPower(TRAININGS[0], lvl('forca'))) * shieldMult(S.shields.left) * globalMult() + baseDps() * 0.01 * lvl('sinergia');
  }
  function critChance() { return Math.min(0.5, 0.01 * lvl('precisao')) + (skillActive('falcao') ? 0.5 : 0); }
  function critMult() { return 3 + 0.5 * lvl('impacto'); }
  function goldMult(withBuff = true) { return Math.pow(1.15, lvl('ganancia')) * (1 + 0.2 * rl('bolsa')) * (withBuff && skillActive('ouro') ? 3 : 1); }
  function autoClicks() { return rl('mao') + (skillActive('rajada') ? 10 : 0); }
  function bossTime() { return BOSS_TIME + 3 * rl('ampulheta'); }
  function chestChance() { return 0.015 + 0.01 * rl('tesouro'); }
  function shieldCost(side) {
    const l = S.shields[side];
    return (side === 'left' ? 80 : 300) * Math.pow(10, l) * (1 - 0.04 * rl('ferreiro'));
  }
  function soulsFor(z) { return z < PRESTIGE_ZONE ? 0 : Math.floor(Math.pow(z - 20, 1.5) / 3); }
  function costBulk(base, g, l, n) { return base * Math.pow(g, l) * (Math.pow(g, n) - 1) / (g - 1); }
  function maxAffordable(base, g, l, gold) {
    const first = base * Math.pow(g, l);
    if (gold < first) return 0;
    return Math.floor(Math.log(gold * (g - 1) / first + 1) / Math.log(g));
  }
  function avgClick() { const c = critChance(); return clickDmg() * (1 - Math.min(1, c) + Math.min(1, c) * critMult()); }

  // ======================================================================
  // Habilidades
  // ======================================================================
  function skillActive(id) { const s = S.skills[id]; return !!s && s.until > Date.now(); }
  function skillReady(id) { const s = S.skills[id]; return !s || s.ready <= Date.now(); }
  function useSkill(id) {
    const sk = SKILLS.find((s) => s.id === id);
    if (!sk || S.maxZone < sk.unlock || !skillReady(id)) return;
    const now = Date.now();
    S.skills[id] = { until: now + sk.dur * 1000, ready: now + sk.cd * 1000 };
    Sfx.skill();
    if (id === 'sismo') {
      shakeT = 0.6;
      if (M && !M.dying) {
        const d = baseDps() * 30 + clickDmg() * 50;
        addFloat(MX, GROUND - 170, fmt(d), '#ffb14a', 34);
        burst(MX, GROUND - 60, '#ffb14a', 30);
        damage(d, false);
      }
    }
    toast(`${sk.icon} ${sk.name}!`);
  }

  // ======================================================================
  // Monstros e combate
  // ======================================================================
  let M = null;
  function spawnMonster() {
    const z = S.zone;
    const boss = isBoss(z);
    const chest = !boss && Math.random() < chestChance();
    const b = biomeOf(z);
    const cycle = Math.floor((z - 1) / (10 * BIOMES.length));
    let spec;
    if (chest) spec = ['Baú Vivo', 'chest', '#b07a3a'];
    else if (boss) spec = b.monsters[Math.floor(z / 5) % 3];
    else spec = b.monsters[Math.floor(Math.random() * 3)];
    let name = spec[0];
    if (boss) name += z % 10 === 0 ? ' Soberano' : ' Colossal';
    if (cycle > 0) name += ' ' + roman(cycle + 1);
    const hp = monsterHP(z) * (boss ? 7 : 1) * (chest ? 0.5 : 1);
    M = {
      name, shape: spec[1], color: spec[2], boss, chest, hp, maxHp: hp,
      gold: baseGold(z) * (boss ? 6 : 1) * (chest ? 15 : 1),
      size: boss ? 1.4 : 0.9 + Math.random() * 0.2,
      hit: 0, dying: 0, spawn: 0, time: boss ? bossTime() : 0, seed: Math.random() * 10,
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
    burst(MX, GROUND - 60 * M.size, M.color, M.boss ? 30 : 16);
    coins(MX, GROUND - 60, M.boss || M.chest ? 14 : 6);
    addFloat(MX, GROUND - 130 * M.size - 20, '+' + fmt(g), '#ffd24a', M.boss || M.chest ? 28 : 22);
    Sfx.coin();
    if (M.boss) toast(`☠ ${M.name} derrotado!`, 'gold');
    if (M.chest) toast(`🗝️ Baú Vivo! +${fmt(g)} de ouro`, 'gold');
    if (S.zone === S.maxZone) {
      if (M.boss) unlockNext();
      else if (++S.zoneKills >= KILLS_PER_ZONE) unlockNext();
    }
    hudDirty = true;
  }

  function unlockNext() {
    S.maxZone++;
    S.zoneKills = 0;
    if (S.maxZone > S.stats.maxZoneEver) S.stats.maxZoneEver = S.maxZone;
    if (S.autoAdvance) S.zone = S.maxZone;
    for (const sk of SKILLS) if (sk.unlock === S.maxZone) toast(`Nova habilidade: ${sk.icon} ${sk.name}`, 'gold');
    for (const t of TRAININGS) if (t.unlock === S.maxZone && t.unlock > 1) toast(`Novo treino: ${t.icon} ${t.name}`);
    for (const a of ATTRS) if (a.unlock === S.maxZone && a.unlock > 1) toast(`Novo atributo: ${a.icon} ${a.name}`);
    if (S.maxZone === PRESTIGE_ZONE) toast('✨ Renascimento liberado na aba Relíquias!', 'gold');
    if ((S.maxZone - 1) % 10 === 0) toast(`Você chegou a: ${biomeOf(S.maxZone).name}`);
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

  function attack(auto) {
    if (!auto) { S.stats.clicks++; if (introClicks < 6) introClicks++; }
    if (!M || M.dying > 0 || M.spawn < 0.5) { if (!auto) hero.attack = 1; return; }
    const crit = Math.random() < critChance();
    const d = clickDmg() * (crit ? critMult() : 1);
    if (!auto || hero.attack < 0.3) hero.attack = 1;
    const fx = MX + (Math.random() - 0.5) * 80, fy = GROUND - 110 * M.size - Math.random() * 40;
    if (crit) addFloat(fx, fy, 'CRÍTICO ' + fmt(d), '#ff9a3c', 26);
    else if (!auto || Math.random() < 0.35) addFloat(fx, fy, fmt(d), '#ffffff', auto ? 16 : 20);
    sparks(MX - 40 * M.size, GROUND - 70 * M.size, crit ? '#ffb14a' : '#fff6c0', crit ? 10 : 5);
    if (!auto || Math.random() < 0.3) impact(MX - 40 * M.size, GROUND - 75 * M.size, crit);
    if (!auto || Math.random() < 0.3) Sfx.hit(crit);
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
    const eff = baseDps() + rl('mao') * avgClick();
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
      stats: Object.assign({}, S.stats, { prestiges: S.stats.prestiges + 1, soulsTotal: S.stats.soulsTotal + gain }),
    };
    S = Object.assign(defaultState(), keep);
    save();
    spawnMonster();
    shopDirty = true; zonesDirty = true;
    toast(`✨ Flistaile renasceu com +${gain} Égides!`, 'gold');
    Sfx.skill();
  }

  // ======================================================================
  // Efeitos visuais
  // ======================================================================
  const hero = { attack: 0 };
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
  const cv = document.getElementById('cv');
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
  function drawHero(t) {
    const atk = hero.attack > 0 ? Math.sin((1 - hero.attack) * Math.PI) : 0;
    const lunge = atk * 58;
    const br = Math.sin(t * 2.6);
    ctx.save();
    ctx.translate(HX + lunge, GROUND);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ellipse(0, 2, 50 - atk * 8, 10);
    outline(true);
    const wave = Math.sin(t * 4) * 6 + atk * 16;
    // capa
    const cg = ctx.createLinearGradient(-10, -100, -50, -20);
    cg.addColorStop(0, '#e0483c'); cg.addColorStop(1, '#7a1a16');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.moveTo(-10, -100 + br);
    ctx.quadraticCurveTo(-38 - wave, -66, -52 - wave, -16);
    ctx.quadraticCurveTo(-38 - wave * 0.6, -24, -28, -16);
    ctx.quadraticCurveTo(-20, -56, -2, -96 + br); ctx.closePath(); fillOL();
    // braço e escudo de trás (mão direita)
    limb(-6, -90 + br, -22, -100 - atk * 6, '#24507f', 10);
    ctx.save(); ctx.translate(-34, -104 - atk * 8 + br); ctx.rotate(-0.3 - atk * 0.25); drawShield(S.shields.right, 50, 62, t, true); ctx.restore();
    // pernas
    const step = atk * 12;
    for (const lx of [-11, 9 + step]) {
      ctx.fillStyle = '#3b3f5c'; rrect(lx - 6, -50, 13, 38, 4);
      ctx.fillStyle = steel(lx - 6, -34, lx + 7, -24); ellipse(lx + 0.5, -30, 7.5, 6);
      ctx.fillStyle = '#6b4426'; rrect(lx - 8, -14, 21, 14, 4);
      ctx.fillStyle = '#3e2a18'; ctx.fillRect(lx - 7, -4, 19, 3);
    }
    ctx.save(); ctx.translate(0, br * 0.8);
    // saia da túnica
    ctx.fillStyle = '#2f6fb3';
    ctx.beginPath(); ctx.moveTo(-21, -62); ctx.lineTo(21, -62); ctx.lineTo(25, -40); ctx.quadraticCurveTo(0, -34, -25, -40); ctx.closePath(); fillOL();
    ctx.fillStyle = '#ffd24a'; ctx.fillRect(-22, -43, 44, 2.5);
    // peitoral
    ctx.fillStyle = steel(-22, -106, 22, -58); rrect(-21, -106, 42, 48, 12);
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-12, -100); ctx.quadraticCurveTo(-16, -84, -10, -70); ctx.stroke();
    ctx.strokeStyle = '#c8891c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-7, -90); ctx.lineTo(1, -83); ctx.lineTo(9, -90); ctx.moveTo(-7, -82); ctx.lineTo(1, -75); ctx.lineTo(9, -82); ctx.stroke();
    // cinto
    ctx.fillStyle = '#5a3a22'; rrect(-23, -63, 46, 9, 3);
    ctx.fillStyle = '#ffd24a'; rrect(-5, -64.5, 10, 11, 2);
    // cabeça
    ctx.fillStyle = '#f2c79b'; ellipse(6, -119, 15, 16);
    outline(false);
    ctx.fillStyle = '#e9a37e'; ellipse(14, -110, 4, 2.5);
    ctx.fillStyle = '#fff'; ellipse(13, -119, 3.4, 3.8);
    ctx.fillStyle = '#20263a'; ellipse(14, -118.5, 2, 2.6);
    ctx.fillStyle = '#fff'; ellipse(13.4, -119.6, 0.7, 0.7);
    ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(9, -125 + atk * 1.5); ctx.lineTo(17, -123.5 - atk); ctx.stroke();
    outline(true);
    // elmo
    ctx.fillStyle = steel(-14, -142, 22, -112);
    ctx.beginPath(); ctx.arc(5, -121, 20, Math.PI * 1.02, Math.PI * 2); ctx.lineTo(25, -118); ctx.lineTo(-15, -118); ctx.closePath(); fillOL();
    ctx.fillStyle = '#8e99a8'; rrect(-17, -124, 44, 6, 2);
    ctx.fillStyle = steel(12, -124, 18, -104); rrect(12, -124, 6, 20, 2);
    outline(false);
    ctx.fillStyle = '#ffd24a'; ellipse(-10, -121, 1.6, 1.6); ellipse(0, -121, 1.6, 1.6); ellipse(20, -121, 1.6, 1.6);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ellipse(-4, -134, 6, 2.5, -0.4);
    outline(true);
    // penacho
    const pg = ctx.createLinearGradient(0, -150, -36, -120);
    pg.addColorStop(0, '#ff6a4a'); pg.addColorStop(1, '#a8221a');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.moveTo(2, -140); ctx.quadraticCurveTo(-24 - wave * 0.5, -158, -38 - wave * 0.6, -126); ctx.quadraticCurveTo(-18, -138, -2, -132); ctx.closePath(); fillOL();
    // ombreira
    ctx.fillStyle = steel(2, -106, 24, -88); ellipse(12, -98, 13, 9, -0.2);
    ctx.restore();
    // braço da frente + escudo principal (mão esquerda)
    limb(12, -90 + br, 30 + atk * 16, -78 - atk * 4, '#2f6fb3', 11);
    ctx.save(); ctx.translate(38 + atk * 22, -74 - atk * 4); ctx.rotate(0.06 + atk * 0.4); drawShield(S.shields.left, 60, 74, t, false); ctx.restore();
    outline(false);
    ctx.restore();
  }

  // ---- monstros ----
  let flashT = 0;
  const fc = (c) => (flashT > 0 ? mix(c, '#ffffff', flashT * 0.75) : c);
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
  const TOPS = { slime: 100, mushroom: 108, beast: 104, bat: 160, golem: 160, ghost: 160, eye: 165, chest: 96 };
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

  function drawMonster(t) {
    if (!M) return;
    const die = M.dying > 0 ? Math.min(1, M.dying / 0.35) : 0;
    const appear = M.spawn;
    const pop = appear < 1 ? 1 + Math.sin(appear * Math.PI) * 0.12 : 1;
    const s = M.size * (0.3 + 0.7 * appear) * pop * (1 - die * 0.6);
    const shake = M.hit * 6;
    const squash = 1 - M.hit * 0.08;
    ctx.save();
    ctx.translate(MX + (Math.random() - 0.5) * shake + M.hit * 8, GROUND);
    ctx.globalAlpha = (1 - die) * Math.min(1, appear * 1.5);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ellipse(0, 2, 64 * s, 11 * s);
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
    if (die) ctx.rotate(die * 0.5);
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
        const x = HX + 40 + (MX - 40 - HX - 40) * k;
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
      parts.push({ x, y, vx: 0, vy: 0, g: 0, life: 0, max: 0.22, type: 'star', color: '#fff3c0', size: 30 });
      critFlash = 0.16;
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

  function render(t) {
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    if (shakeT > 0) ctx.translate((Math.random() - 0.5) * 14 * shakeT, (Math.random() - 0.5) * 10 * shakeT);
    const bi = biomeIndex(S.zone);
    if (bgCache.idx !== bi) buildBg(bi);
    ctx.drawImage(bgCache.canvas, -10, -10, W + 20, H + 20);
    drawAmbient(t, BIOMES[bi]);
    if (skillActive('furia')) { ctx.fillStyle = 'rgba(255,80,40,.08)'; ctx.fillRect(0, 0, W, H); }
    if (skillActive('ouro')) { ctx.fillStyle = 'rgba(255,210,74,.08)'; ctx.fillRect(0, 0, W, H); }
    drawMonster(t);
    drawHero(t);
    drawProjectiles(t);
    drawParticles();
    if (!vignette) buildVignette();
    ctx.drawImage(vignette, 0, 0, W, H);
    if (critFlash > 0) { ctx.fillStyle = `rgba(255,240,200,${critFlash * 0.6})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
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

  function update(dt) {
    S.stats.playTime += dt;
    hero.attack = Math.max(0, hero.attack - dt * 4.5);
    shakeT = Math.max(0, shakeT - dt * 1.5);
    critFlash = Math.max(0, critFlash - dt);
    if (!M) spawnMonster();
    M.spawn = Math.min(1, M.spawn + dt * 4);
    M.hit = Math.max(0, M.hit - dt * 5);
    if (M.dying > 0) {
      M.dying += dt;
      if (M.dying > 0.35) spawnMonster();
    } else {
      const d = dps();
      if (d > 0 && M.spawn >= 0.5) { dpsAcc += Math.min(d * dt, M.hp); damage(d * dt, true); }
      autoAcc += autoClicks() * dt;
      while (autoAcc >= 1) { autoAcc -= 1; attack(true); }
      if (M.boss && M.dying === 0 && M.spawn >= 1) { M.time -= dt; if (M.time <= 0) bossFail(); }
    }
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
  let shopDirty = true, zonesDirty = true, hudDirty = true, ghostP = 1, ghostMon = null;

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
    if (M) {
      setText($('mName'), M.name);
      $('mName').className = 'mname' + (M.boss ? ' boss' : '') + (M.chest ? ' chest' : '');
      const p = Math.max(0, M.hp / M.maxHp);
      if (M !== ghostMon) { ghostMon = M; ghostP = 1; }
      ghostP = p >= ghostP ? p : Math.max(p, ghostP - 0.006 - (ghostP - p) * 0.06);
      $('mHpFill').style.width = (p * 100).toFixed(1) + '%';
      $('mHpGhost').style.width = (ghostP * 100).toFixed(1) + '%';
      setText($('mHpText'), `${fmt(Math.max(0, Math.ceil(M.hp)))} / ${fmt(M.maxHp)}`);
      const bt = $('bossTimer');
      if (M.boss) {
        bt.hidden = false;
        $('btFill').style.width = (Math.max(0, M.time / bossTime()) * 100).toFixed(1) + '%';
        setText($('btText'), `⏱ ${Math.max(0, M.time).toFixed(1).replace('.', ',')}s`);
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
      const b = el('button', 'skill', `<span class="skey">${i + 1}</span><span class="sbadge"><span class="sicon">${sk.icon}</span><span class="scd"></span><span class="stime"></span></span><span class="sname">${sk.name}</span>`);
      b.addEventListener('click', () => useSkill(sk.id));
      box.appendChild(b);
      skillEls[sk.id] = { b, cd: b.querySelector('.scd'), time: b.querySelector('.stime') };
    });
  }
  function updateSkills() {
    const now = Date.now();
    for (const sk of SKILLS) {
      const r = skillEls[sk.id];
      const locked = S.maxZone < sk.unlock;
      const s = S.skills[sk.id];
      const active = !locked && skillActive(sk.id);
      const ready = !locked && skillReady(sk.id);
      r.b.className = 'skill' + (locked ? ' locked' : active ? ' active' : ready ? ' ready' : '');
      r.b.disabled = locked || !ready;
      r.b.title = locked ? `${sk.name} — desbloqueia na zona ${sk.unlock}` : `${sk.name}: ${sk.desc} Recarga: ${fmtTime(sk.cd)}. Atalho: tecla ${SKILLS.indexOf(sk) + 1}`;
      if (locked) { r.cd.style.setProperty('--p', '0%'); setText(r.time, `Zona ${sk.unlock}`); continue; }
      if (active) { r.cd.style.setProperty('--p', '0%'); setText(r.time, Math.ceil((s.until - now) / 1000) + 's'); }
      else if (!ready) {
        const left = (s.ready - now) / 1000;
        r.cd.style.setProperty('--p', ((left / sk.cd) * 100).toFixed(1) + '%');
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
      panel, def, bulk: true, currency: 'gold',
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
  function msText(l) { const nm = nextMilestone(l); return ` · <span class="ms">Nv ${nm}: ×2</span>`; }

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
        panel: 'escudos', currency: 'gold', unlocked: () => true, level: () => S.shields[side], max: Infinity,
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
        panel: 'reliquias', currency: 'souls', unlocked: () => S.stats.prestiges > 0 || S.souls > 0, level: () => rl(r.id), max: r.max || Infinity,
        icon: () => r.icon, title: () => r.name, desc: () => r.desc,
        effect: () => {
          const l = rl(r.id);
          switch (r.id) {
            case 'egide': return `Dano ×${fmt(1 + 0.25 * l)}`;
            case 'bolsa': return `Ouro ×${fmt(1 + 0.2 * l)}`;
            case 'mao': return `${l} golpe(s)/s`;
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

  function buyItem(it) {
    if (!it.unlocked()) return;
    const inf = it.info();
    if (inf.maxed || inf.n < 1) return;
    const wallet = it.currency === 'souls' ? S.souls : S.gold;
    if (wallet < inf.cost) return;
    if (it.currency === 'souls') S.souls -= inf.cost; else S.gold -= inf.cost;
    it.buy(inf.n);
    const r = it.els.root;
    r.classList.remove('bought'); void r.offsetWidth; r.classList.add('bought');
    Sfx.init(); Sfx.buy();
    shopDirty = true;
    refreshShop();
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
        e.root.classList.add('locked');
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
        e.btn.disabled = true; e.btn.classList.add('maxed');
        setText(e.bl, ''); setText(e.bc, 'Máximo');
      } else {
        e.btn.classList.remove('maxed');
        const can = wallet >= inf.cost;
        e.btn.disabled = !can;
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
      ['Golpes automáticos/s', autoClicks()],
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
      <div class="card"><p><b>Como jogar</b></p><p>Clique na arena para golpear com o escudo. Derrote ${KILLS_PER_ZONE} criaturas para liberar a próxima zona; a cada 5 zonas há um chefe com tempo limite. Gaste ouro em treinos (DPS automático), atributos e forje seus dois escudos. Na zona ${PRESTIGE_ZONE}, renasça para ganhar Égides.</p><p>Atalhos: teclas 1 a 5 usam habilidades; ← e → trocam de zona.</p></div>`;
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
    shopDirty = true; zonesDirty = true;
    $('optSound').checked = S.settings.sound;
    $('optNumbers').checked = S.settings.numbers;
    syncBuyMode();
    refreshShop();
  }

  // ---- abas e modo de compra ----
  let activeTab = 'treinos';
  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + tab));
    $('buyMode').classList.toggle('hidden', !(tab === 'treinos' || tab === 'atributos'));
    if (tab === 'stats') renderStats();
  }
  function syncBuyMode() {
    document.querySelectorAll('#buyMode button').forEach((b) => b.classList.toggle('active', String(S.buyMode) === b.dataset.mode));
  }

  function bindUI() {
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); Sfx.init(); attack(false); });
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
      const n = Number(e.key);
      if (n >= 1 && n <= SKILLS.length) useSkill(SKILLS[n - 1].id);
      else if (e.key === 'ArrowLeft') setZone(S.zone - 1);
      else if (e.key === 'ArrowRight') setZone(S.zone + 1);
    });
    $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
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
    setInterval(() => { refreshShop(); if (activeTab === 'stats') renderStats(); }, 250);
    setInterval(save, 10000);
    requestAnimationFrame(frame);
  }

  start();
})();
