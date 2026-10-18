// Turno fra i popup dell'apertura (2026-10-18): il popup dei premi di login
// "tiene" il cancello finché non è chiuso; la Ruota lo aspetta prima di aprirsi,
// così non compaiono due finestre una sopra l'altra.
let gate = Promise.resolve();
export function holdGate(maxMs = 20000) {
  let release;
  gate = new Promise((r) => { release = r; });
  const t = setTimeout(() => release(), maxMs); // rete di sicurezza: mai bloccare la Ruota
  return () => { clearTimeout(t); release(); };
}
export const waitGate = () => gate;
