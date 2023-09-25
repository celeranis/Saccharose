import { getGenshinControl, loadGenshinVoiceItems } from '../../domain/genshin/genshinControl';
import { fetchCharacterFetters } from '../../domain/genshin/character/fetchCharacterFetters';
import fs from 'fs';
import chalk from 'chalk';

export async function importVoiceOvers() {
  await loadGenshinVoiceItems();

  const outDir = process.env.GENSHIN_DATA_ROOT;

  const ctrl = getGenshinControl();
  const allFetters = await fetchCharacterFetters(ctrl, true);

  fs.writeFileSync(outDir + '/VoiceOvers.json', JSON.stringify(allFetters, null, 2));
  console.log(chalk.blue('Done. Output written to: ' + outDir + '/VoiceOvers.json'));
}