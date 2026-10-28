import fs from 'node:fs';
import path from 'node:path';

// Banco de dados simples em um arquivo JSON. Suficiente para o protótipo;
// trocar por Postgres antes de ter jogadores de verdade.
export function openStore(file) {
  let data = { players: {}, tokens: {}, rooms: {} };
  if (file && fs.existsSync(file)) {
    data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  }
  let timer = null;
  return {
    data,
    save() {
      if (!file || timer) return;
      timer = setTimeout(() => {
        timer = null;
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const tmp = `${file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(data));
        fs.renameSync(tmp, file);
      }, 200);
    },
  };
}
