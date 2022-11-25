import { MwNode, MwParentNode, MwTemplateNode } from './mwTypes';
import util from 'util';
import { mwParse } from './mwParse';

async function dplTest() {
  const dplCall0 = `{{#DPL:
|mode=userformat
|uses=Template:Hidden Exploration Objectives Infobox
|category=Hidden Exploration Objectives
|category=Article Stubs¦Dialogue Stubs
|namespace=
|include = {Hidden Exploration Objectives Infobox}:type:region:area,{Stub}:1,{StubDialogue}:1
|table=class="article-table sortable",Name,Type,Region,Area,Stub,StubDialogue
|noresultsfooter=\\nNo Results
|tablesortcol=1
}}`;
  const dplCall1 = `{{#DPL:
|mode=userformat
|uses=Template:Recipe
|category=Processing
|namespace=
|include={Item Infobox¦Phantom rarity},{Recipe}:time

|listseparators={¦ class="article-table sortable alternating-colors-table" \\n!Icon\\n!Name\\n!Rarity\\n!Minutes to Process,\\n¦-\\n,,¦}
|secseparators=¦[[File:Item_%PAGE%.png|45x45px|link=%PAGE%]]\\n¦[[%PAGE%]]\\n¦,\\n,¦²{Array¦,¦;¦{item}¦&nbsp;/&nbsp;¦dedupe=1}²\\n
|multisecseparators=<\!-- multisecseparator for rarity (none) -->,<!-- multisecseparator for recipe time (semicolon) -->;
|ordermethod = sortkey

|resultsheader= Processing can be used to create '''%PAGES%''' Cooking Ingredients:\\n
|noresultsfooter=\\nNo Results
|allowcachedresults=true
}}`;

  const input = `Surrounding text${dplCall0} More <!-- a comment --> surrounding text ${dplCall1} Lorem ipsum.`;

  const result: MwParentNode = mwParse(input);
  console.log(util.inspect(result, false, null, true));

  const result0_str = result.parts.filter(x => x instanceof MwTemplateNode)[0].toString();
  const result1_str = result.parts.filter(x => x instanceof MwTemplateNode)[1].toString();
  console.log('Stringified same as input?', dplCall0 === result0_str);
  console.log('Stringified same as input?', dplCall1 === result1_str);
}

function basicTest() {
  const templateCall0 = `{{ SomeTemplate/SubTemplate

<\!-- testing-->
|param0
| character = [[Nahida]]
|language  =  en

<\!-- test comment -->
|foo = bar lorem ipsum|  param1  |test = {{Hydro}}
}}`;
  const templateCall1 = `{{Pyro}}`;

  const input = `Surrounding text${templateCall0} More <!-- a comment --> surrounding\n\n` +
    `text ${templateCall1} Lorem ipsum [https://www.google.com] asdf [https://www.bing.com link text]\n\n` +
    `asdf [[File:MyFile.png|thumb|30px|link=|alt=my alt text]].\n\n` +
    `Lorem ipsum <nowiki>test {{Anemo}} no [[wiki]] ''markup''</nowiki> test {{DISPLAYTITLE:foobar}}` +
    `{{ #if : thing|foo|bar}} testing {{subst:Name}} {{ns:1}} {{=}} {{!}} {{NAMESPACE}} {{NAMESPACE:MediaWiki}} {{#if}}`;

  const result: MwParentNode = mwParse(input);
  console.log(util.inspect(result, false, null, true));

  const result0_str = result.parts.filter(x => x instanceof MwTemplateNode)[0].toString();
  const result1_str = result.parts.filter(x => x instanceof MwTemplateNode)[1].toString();
  console.log('Input same as result.toString?', input === result.toString());
  console.log('  Template0.toString same as input?', templateCall0 === result0_str);
  console.log('  Template1.toString same as input?', templateCall1 === result1_str);

  console.log('-'.repeat(10).repeat(5));
  console.log(result.toString());
}

if (require.main === module) {
  (async () => {
    await basicTest();
  })();
}