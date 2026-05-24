// Node script to fetch all communes for Île-de-France departments and write mapping postalCode -> [commune names]
// Usage: node tools/fetch-idf-communes.js

const fs = require('fs');
const path = require('path');

const DEPS = ['75','77','78','91','92','93','94','95'];
const OUT = path.join(__dirname, '..', 'public', 'data', 'idf-postal-to-communes.json');

async function fetchJson(url){
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

(async () => {
  try {
    const map = {};
    for (const dep of DEPS) {
      console.log('Fetching department', dep);
      const url = `https://geo.api.gouv.fr/communes?codeDepartement=${dep}&fields=nom,code,codesPostaux&format=json&geometry=`;
      const data = await fetchJson(url);
      for (const c of data) {
        if (Array.isArray(c.codesPostaux)) {
          for (const cp of c.codesPostaux) {
            if (!map[cp]) map[cp] = [];
            if (!map[cp].includes(c.nom)) map[cp].push(c.nom);
          }
        }
      }
    }
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(map, null, 2), 'utf8');
    console.log('Wrote', OUT);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

