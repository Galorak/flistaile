/* Simulador de balanceamento do Flistaile: usa as fórmulas reais de assets/game.js (window.FL). */
'use strict';
(() => {
  const F = window.FL;
  const BAL0 = Object.assign({}, F.BAL);

  function runSim(opts = {}) {
    Object.assign(F.BAL, BAL0, opts.bal || {});
    const CPS = opts.cps ?? 6;
    const MAX_T = (opts.hours ?? 140) * 3600;
    const STUCK = opts.stuck ?? 600; // segundos empacado antes de renascer
    F.setClock(() => 0);
    F.S = F.defaultState();
    let S = F.S;
    let t = 0, lastBurst = -1e9, stuckSince = null, runStart = 0, lastAdv = 0;
    const SLOW = opts.slow ?? 240; // renasce se uma zona demorar mais que isso
    const marks = {}, runs = [];
    const MARKS = [30, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
    const unlocked = (id) => S.maxZone >= F.SKILLS.find((s) => s.id === id).unlock;

    function clicksPerSec() { return CPS + S.ac.owned * F.acRate(); }
    function avgClickNoBuff(extraCrit = 0) {
      const c = Math.min(1, F.critChance() + extraCrit);
      return F.baseClick() * (1 - c + c * F.critMult());
    }
    // dano efetivo médio por segundo, com o efeito médio das habilidades ao longo da recarga
    function E() {
      const cdm = F.cdMult();
      let d = F.baseDps(), cps = clicksPerSec(), clickMul = 1, all = 1, crit = 0;
      if (unlocked('furia')) d *= 1 + (30 / (300 * cdm));
      if (unlocked('rajada')) cps += 10 * 30 / (420 * cdm);
      if (unlocked('falcao')) crit = 0.5 * 30 / (480 * cdm);
      if (unlocked('grito')) clickMul *= 1 + 2 * 30 / (600 * cdm);
      if (unlocked('ascensao')) all *= 1 + 4 * 30 / (1800 * cdm);
      return (d + cps * avgClickNoBuff(crit) * clickMul) * all;
    }
    // todas as habilidades de uma vez (usadas contra um chefe difícil)
    function burstDamage(seconds) {
      let d = F.baseDps(), cps = clicksPerSec(), clickMul = 1, all = 1, crit = 0, extra = 0;
      if (unlocked('furia')) d *= 2;
      if (unlocked('rajada')) cps += 10;
      if (unlocked('falcao')) crit = 0.5;
      if (unlocked('grito')) clickMul = 3;
      if (unlocked('ascensao')) all = 5;
      const ac = avgClickNoBuff(crit);
      if (unlocked('sismo')) extra = (F.baseDps() * 60 + F.baseClick() * 100);
      const burstSecs = Math.min(30, seconds);
      return ((d + cps * ac * clickMul) * burstSecs + (E() / all) * Math.max(0, seconds - 30) + extra) * all;
    }
    const goldAvgMul = () => 1 + F.chestChance() * (15 * 1 - 1);

    // ---- compras gananciosas ----
    function candidates() {
      const list = [];
      for (const tr of F.TRAININGS) {
        if (S.maxZone < tr.unlock) continue;
        const l = F.lvl(tr.id);
        list.push({ kind: 't', id: tr.id, n: 1, cost: F.costBulk(tr.base, tr.growth, l, 1) });
        const toMs = 25 - (l % 25);
        if (toMs > 1) list.push({ kind: 't', id: tr.id, n: toMs, cost: F.costBulk(tr.base, tr.growth, l, toMs) });
      }
      for (const a of F.ATTRS) {
        if (S.maxZone < a.unlock) continue;
        const l = F.lvl(a.id);
        if (a.max && l >= a.max) continue;
        list.push({ kind: 'a', id: a.id, n: 1, cost: F.costBulk(a.base, a.growth, l, 1) });
      }
      list.push({ kind: 's', id: 'left', cost: F.shieldCost('left') });
      list.push({ kind: 's', id: 'right', cost: F.shieldCost('right') });
      return list;
    }
    function apply(c, sign) {
      if (c.kind === 's') S.shields[c.id] += sign;
      else S.trainings[c.id] = F.lvl(c.id) + sign * c.n;
    }
    function buyGreedy() {
      for (let guard = 0; guard < 5000; guard++) {
        const e0 = E();
        let best = null, bestV = 0;
        for (const c of candidates()) {
          if (c.cost > S.gold) continue;
          let dv;
          if (c.id === 'ganancia') dv = e0 * 0.15 * 0.6;
          else { apply(c, 1); dv = E() - e0; apply(c, -1); }
          const v = dv / c.cost;
          if (v > bestV) { bestV = v; best = c; }
        }
        if (!best) return;
        S.gold -= best.cost;
        apply(best, 1);
      }
    }

    function addGems(n) { S.gems += n; S.stats.gemsTotal += n; }
    function checkAch() {
      for (const id of Object.keys(S.stats.skillUses)) void id;
      for (const sk of F.SKILLS) if (unlocked(sk.id)) S.stats.skillUses[sk.id] = 1;
      for (const a of F.ACH) {
        if (S.achievements[a.id] || !a.test()) continue;
        S.achievements[a.id] = true;
        addGems(a.gems);
      }
      while (S.gems >= F.acCost(S.ac.owned)) {
        S.gems -= F.acCost(S.ac.owned); S.ac.owned++; S.ac.assign.push('arena');
      }
    }

    function gainGold(g, kills) {
      g *= F.goldMult(false) * goldAvgMul();
      S.gold += g; S.stats.goldTotal += g; S.stats.kills += kills;
      S.stats.chests += kills * F.chestChance();
      { const exp = kills * F.chestChance() * 0.03; addGems(Math.floor(exp) + (Math.random() < exp % 1 ? 1 : 0)); }
    }
    const trace = [];
    function advance() {
      if (opts.trace && S.maxZone % 25 === 0) {
        trace.push(`z${S.maxZone} t=${(t / 60).toFixed(1)}m E/hp=${(E() / F.monsterHP(S.maxZone)).toExponential(2)} dps=${F.baseDps().toExponential(2)} click=${F.baseClick().toExponential(2)} shields=${S.shields.left}/${S.shields.right} lv=${JSON.stringify(S.trainings)}`);
      }
      const slowZone = t - lastAdv > SLOW;
      lastAdv = t;
      S.maxZone++; S.zone = S.maxZone; stuckSince = null;
      if (slowZone && F.soulsFor(S.maxZone) > 0 && S.maxZone < F.FINAL_ZONE - 5) { prestigeQueued = true; }
      if (S.maxZone > S.stats.maxZoneEver) {
        S.stats.maxZoneEver = S.maxZone;
        for (const m of MARKS) if (S.maxZone >= m && marks[m] === undefined) marks[m] = t;
      }
      checkAch();
    }

    function spendSouls() {
      const R = (id) => F.RELICS.find((r) => r.id === id);
      const tryBuy = (id, cap, frac) => {
        const r = R(id);
        while (F.rl(id) < Math.min(cap, r.max || Infinity)) {
          const c = r.cost(F.rl(id));
          if (c > S.souls * frac) break;
          S.souls -= c; S.relics[id] = F.rl(id) + 1;
        }
      };
      tryBuy('ampulheta', 10, 0.05);
      tryBuy('pressa', 15, 0.05);
      tryBuy('ferreiro', 15, 0.05);
      if (S.ac.owned) tryBuy('mao', 20, 0.05);
      tryBuy('tesouro', 10, 0.03);
      tryBuy('marcha', 5, 0.25);
      // Égide Ancestral só quando vale mais que guardar as Égides (+10% cada)
      for (let g = 0; g < 1e6; g++) {
        const L = F.rl('egide'), c = L + 1;
        if (c > S.souls) break;
        const gain = (1 + 0.25 * (L + 1)) / (1 + 0.25 * L);
        const loss = (1 + 0.1 * S.souls) / (1 + 0.1 * (S.souls - c));
        if (gain <= loss) break;
        S.souls -= c; S.relics.egide = L + 1;
      }
    }
    function prestige() {
      const gain = F.soulsFor(S.maxZone);
      runs.push({ start: runStart, end: t, maxZone: S.maxZone, souls: gain });
      const keep = {
        souls: S.souls + gain, relics: S.relics, gems: S.gems, ac: S.ac, achievements: S.achievements, settings: S.settings,
        stats: Object.assign({}, S.stats, { prestiges: S.stats.prestiges + 1, soulsTotal: S.stats.soulsTotal + gain }),
      };
      F.S = Object.assign(F.defaultState(), keep);
      S = F.S;
      spendSouls();
      runStart = t; stuckSince = null; lastAdv = t; prestigeQueued = false;
      checkAch();
    }

    let finalAt = null, prestigeQueued = false, gemsAtFinal = null, acAtFinal = null;
    while (t < MAX_T) {
      if (prestigeQueued) prestige();
      buyGreedy();
      const z = S.maxZone;
      const hp = F.monsterHP(z);
      const e = E();
      S.stats.clicks += CPS; // aproximação: cliques contam por passo
      if (!F.isBoss(z)) {
        const tk = hp / e + 0.475;
        t += KILLS(tk);
        gainGold(F.baseGold(z) * F.killsPerZone(), F.killsPerZone());
        S.stats.clicks += CPS * F.killsPerZone() * tk;
        advance();
        continue;
      }
      const final = z === F.FINAL_ZONE;
      const hpB = hp * (final ? F.BAL.finalHp : F.BAL.bossHp);
      const limit = F.bossTime() * (final ? 2 : 1);
      const tk = hpB / e;
      const burstReady = t - lastBurst >= 600 * F.cdMult();
      const limitBurst = limit + (unlocked('muralha') ? 15 : 0);
      if (tk <= limit || (burstReady && burstDamage(limitBurst) >= hpB)) {
        if (tk > limit) lastBurst = t;
        t += Math.min(tk, limitBurst) + 0.475;
        gainGold(F.baseGold(z) * (final ? 100 : 6), 1);
        S.stats.bosses++;
        if (z > S.stats.gemZone) { S.stats.gemZone = z; addGems(final ? 10 : 1); }
        if (final && !S.stats.finalBeaten) { S.stats.finalBeaten = true; finalAt = t; checkAch(); gemsAtFinal = S.stats.gemsTotal; acAtFinal = S.ac.owned; }
        advance();
        if (finalAt !== null && opts.stopAtFinal !== false) break;
        continue;
      }
      // empacou: farma a zona anterior
      if (stuckSince === null) stuckSince = t;
      const hpPrev = F.monsterHP(z - 1);
      const kr = Math.min(4, 1 / (hpPrev / e + 0.475));
      const dt = 30;
      gainGold(F.baseGold(z - 1) * kr * dt, kr * dt);
      t += dt;
      if (t - stuckSince > STUCK && F.soulsFor(S.maxZone) > 0) prestige();
    }
    function KILLS(tk) { return F.killsPerZone() * tk; }

    const h = (s) => (s / 3600).toFixed(1) + 'h';
    const lines = [];
    lines.push(`Robô: ${CPS} cliques/s · BAL ${JSON.stringify(F.BAL)}`);
    lines.push(`Tempo simulado: ${h(t)} · renascimentos: ${runs.length} · escudeiros: ${S.ac.owned} (no chefe final: ${acAtFinal}) · gemas totais: ${S.stats.gemsTotal} (no chefe final: ${gemsAtFinal}) · Botas: ${F.rl('marcha')} · conquistas: ${Object.keys(S.achievements).length}/${F.ACH.length}`);
    lines.push('Zona → tempo total: ' + MARKS.map((m) => `${m}: ${marks[m] !== undefined ? h(marks[m]) : '—'}`).join(' · '));
    lines.push(`Chefe final: ${finalAt !== null ? h(finalAt) : 'não alcançado'}`);
    lines.push('Jornadas (início→fim, zona máx, Égides):');
    runs.slice(0, 8).forEach((r, i) => lines.push(`  #${i + 1}: ${h(r.start)}→${h(r.end)} z${r.maxZone} +${r.souls}`));
    if (runs.length > 8) {
      lines.push('  ...');
      runs.slice(-4).forEach((r, i) => lines.push(`  #${runs.length - 3 + i}: ${h(r.start)}→${h(r.end)} z${r.maxZone} +${r.souls}`));
    }
    return { text: lines.join('\n'), marks, finalAt, runs: runs.length, trace };
  }

  window.runSim = runSim;
  const btn = document.getElementById('run');
  if (btn) btn.addEventListener('click', () => {
    let o = {};
    try { o = JSON.parse(document.getElementById('opts').value || '{}'); } catch (e) { alert('JSON inválido'); return; }
    document.getElementById('out').textContent = 'Simulando...';
    setTimeout(() => { document.getElementById('out').textContent = runSim(o).text; }, 20);
  });
})();
