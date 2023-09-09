import { loadResourceAsJson, loadResourceAsString } from '../../../spec-util';
import { CharacterFetters } from '../../../../src/shared/types/genshin/fetter-types';
import { preloadFromFetters } from '../../../../src/frontend/pages/generic/vo-tool/vo-app-preload';

const characterFetters: CharacterFetters = loadResourceAsJson('Nahida_Fetters.json');

const result = preloadFromFetters(characterFetters, 'combat', 'EN', 'EN');

console.log(result);