import '../../loadenv';
import { pathToFileURL } from 'url';
import commandLineArgs, { OptionDefinition as ArgsOptionDefinition } from 'command-line-args';
import commandLineUsage, { OptionDefinition as UsageOptionDefinition } from 'command-line-usage';
import chalk from 'chalk';
import { getStarRailDataFilePath } from '../../loadenv';
import { closeKnex } from '../../util/db';
import { importNormalize, importPlainTextMap } from '../import_file_util';
import { normStarRailText } from '../../domain/hsr/starRailText';
import fs from 'fs';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const optionDefinitions: (ArgsOptionDefinition & UsageOptionDefinition)[] = [
      {name: 'normalize', type: Boolean, description: 'Normalizes the JSON files.'},
      {name: 'plaintext', type: Boolean, description: 'Creates the PlainTextMap files.'},
      {name: 'help', type: Boolean, description: 'Display this usage guide.'},
    ];

    const options = commandLineArgs(optionDefinitions);

    if (!Object.keys(options).length) {
      console.warn(chalk.yellow('\nNot enough arguments.'));
      options.help = true;
    }

    if (Object.keys(options).length > 1) {
      console.warn(chalk.red('\nAll arguments are mutually exclusive.'));
      options.help = true;
    }

    if (options.help) {
      const usage = commandLineUsage([
        {
          header: 'Star Rail Data Files Importer',
          content: 'Imports Star Rail Data json into other supporting files.'
        },
        {
          header: 'Options',
          optionList: optionDefinitions
        }
      ])
      console.log(usage);
      return;
    }

    if (options.normalize) {
      const textMapCN = getStarRailDataFilePath('./TextMap/TextMapCN.json');
      if (fs.existsSync(textMapCN)) {
        fs.renameSync(textMapCN, getStarRailDataFilePath('./TextMap/TextMapCHS.json'));
        console.log('Moved TextMapCN.json to TextMapCHS.json');
      }
      await importNormalize(getStarRailDataFilePath('./ExcelOutput'), [], true);
    }
    if (options.plaintext) {
      await importPlainTextMap(getStarRailDataFilePath, normStarRailText);
    }

    await closeKnex();
  })();
}