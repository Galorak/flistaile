/* Roda o simulador fora da página principal (Web Worker), para testar várias combinações. */
self.window = self;
self.FL_SIM = true;
self.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
importScripts('../assets/game.js?' + Date.now(), 'sim.js?' + Date.now());
self.onmessage = (e) => {
  const { name, opts } = e.data;
  const t0 = Date.now();
  const r = self.runSim(opts);
  self.postMessage({ name, text: r.text, marks: r.marks, finalAt: r.finalAt, ms: Date.now() - t0 });
};
