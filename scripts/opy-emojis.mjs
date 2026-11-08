#!/usr/bin/env node
// Gera preview/emojis.json a partir da base de emojis do Etnias antigo (plugin de emoticons do TinyMCE no tema WoWonder).
// Uso: node scripts/opy-emojis.mjs   → [[categoria, rótulo, [[emoji, palavras-chave], …]], …]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const source = resolve('public_html/themes/wowonder/javascript/tinymce/js/tinymce/plugins/emoticons/js/emojis.js');
const groups = [['people', 'Pessoas'], ['animals_and_nature', 'Natureza'], ['food_and_drink', 'Comida'], ['activity', 'Atividades'], ['travel_and_places', 'Viagens'], ['objects', 'Objetos'], ['symbols', 'Símbolos'], ['flags', 'Bandeiras']];
let table = null;
vm.runInNewContext(readFileSync(source, 'utf8'), { window: { tinymce: { Resource: { add: (_, data) => { table = data; } } } } });
if (!table) throw new Error('Base de emojis não encontrada em ' + source);
const out = groups.map(([id, label]) => [id, label, Object.entries(table).filter(([, v]) => v.category === id).map(([name, v]) => [v.char, `${name} ${v.keywords.join(' ')}`.replace(/_/g, ' ')])]);
writeFileSync(resolve('preview/emojis.json'), JSON.stringify(out));
console.log(out.map(([id, , list]) => `${id}: ${list.length}`).join(', '), '→ preview/emojis.json');
