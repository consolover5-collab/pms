import fs from 'fs';

function injectDict(file, lang) {
  let content = fs.readFileSync(file, 'utf8');
  let newEntries = `  "err_network_error": "${lang === 'en' ? 'Network error' : 'Ошибка сети'}",\n`;
  
  let insertPos = content.lastIndexOf('}');
  let newContent = content.slice(0, insertPos) + newEntries + content.slice(insertPos);
  
  fs.writeFileSync(file, newContent);
  console.log('Updated ' + file);
}

injectDict('apps/web/src/lib/i18n/locales/en.ts', 'en');
injectDict('apps/web/src/lib/i18n/locales/ru.ts', 'ru');
