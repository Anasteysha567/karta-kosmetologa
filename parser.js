'use strict';
// Conservative, local extraction. No clinical inference and no drug substitution.
(function(root){
 const words={ноль:0,нуль:0,один:1,одна:1,одно:1,одну:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10,одиннадцать:11,двенадцать:12,тринадцать:13,четырнадцать:14,пятнадцать:15,шестнадцать:16,семнадцать:17,восемнадцать:18,девятнадцать:19,двадцать:20,тридцать:30,сорок:40,пятьдесят:50,шестьдесят:60,семьдесят:70,восемьдесят:80,девяносто:90,сто:100,двести:200,триста:300,четыреста:400,пятьсот:500,шестьсот:600,семьсот:700,восемьсот:800,девятьсот:900,первое:1,первого:1,второе:2,второго:2,третье:3,третьего:3,четвертое:4,четвертого:4,пятое:5,пятого:5,шестое:6,шестого:6,седьмое:7,седьмого:7,восьмое:8,восьмого:8,девятое:9,девятого:9,десятое:10,десятого:10,одиннадцатое:11,одиннадцатого:11,двенадцатое:12,двенадцатого:12,тринадцатое:13,тринадцатого:13,четырнадцатое:14,четырнадцатого:14,пятнадцатое:15,пятнадцатого:15,шестнадцатое:16,шестнадцатого:16,семнадцатое:17,семнадцатого:17,восемнадцатое:18,восемнадцатого:18,девятнадцатое:19,девятнадцатого:19,двадцатое:20,двадцатого:20,тридцатое:30,тридцатого:30};
 function numeric(s){
   s=s.toLowerCase().replace(/ё/g,'е');
   // Spoken years first; preserve all decimals exactly, without rounding.
   s=s.replace(/(?:одна\s+)?тысяча\s+девятьсот\s*/g,'1900 ').replace(/две тысячи\s*/g,'2000 ');
   const tokens=s.split(/(\s+|[,;:\n])/);let out=[];
   for(let i=0;i<tokens.length;i++){
     let t=tokens[i];if(Object.hasOwnProperty.call(words,t)){
       let n=words[t],last=n,j=i+1;
       while(j+1<tokens.length&&/^\s+$/.test(tokens[j])&&Object.hasOwnProperty.call(words,tokens[j+1])){
         let k=words[tokens[j+1]];
         if((last>=100&&k<100)||(last>=20&&last<100&&k>0&&k<10)){n+=k;last=k;j+=2;}else break;
       }
       out.push(String(n));i=j-1;
     }else out.push(t);
   }
   return out.join('').replace(/(1900|2000)\s+(\d{1,2})(?!\d)/g,(_,base,n)=>String(Number(base)+Number(n)))
    .replace(/(\d+)\s+(?:целая|целых|целое)\s+(\d+)\s+(десятых|сотых|тысячных)/g,(_,a,b,u)=>a+','+b.padStart(u==='тысячных'?3:u==='сотых'?2:1,'0'))
    .replace(/(\d+)\s+(?:запятая|точка)\s+(\d+(?:\s+\d)*)/g,(_,a,b)=>a+','+b.replace(/\s/g,''))
    .replace(/(?<![\d,])(\d)\s+десятых/g,'0,$1').replace(/(?<![\d,])(\d{1,2})\s+сотых/g,(_,n)=>'0,'+n.padStart(2,'0'));
 }
 const months=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
 function dateValid(y,m,d){let a=new Date(Date.UTC(y,m-1,d));return a.getUTCFullYear()===y&&a.getUTCMonth()===m-1&&a.getUTCDate()===d;}
 function extract(text){
  const raw=text.trim(),s=numeric(raw),warnings=[];let result={raw,warnings};
  const types=[];if(/ботулинотерап|ботокс|диспорт|ксеомин|релатокс|ботулотокс/.test(s))types.push('Ботулинотерапия');if(/филлер|контурн\S*\s+пластик/.test(s))types.push('Введение филлера');if(/биоревитализац/.test(s))types.push('Биоревитализация');
  if(types.length===1)result.type=types[0];if(types.length>1)warnings.push('Упомянуто несколько процедур. Добавьте отдельные строки и распределите препараты и количества вручную.');
  const dateRe=/(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})/g;let dm,dateMatches=[];
  while((dm=dateRe.exec(s)))dateMatches.push({d:+dm[1],m:+dm[2],y:+dm[3]});
  const named=new RegExp('(\\d{1,2})\\s+('+months.join('|')+')\\s+(20\\d{2})','g');
  while((dm=named.exec(s)))dateMatches.push({d:+dm[1],m:months.indexOf(dm[2])+1,y:+dm[3]});
  if(dateMatches.length===1){let a=dateMatches[0];if(dateValid(a.y,a.m,a.d))result.date=`${a.y}-${String(a.m).padStart(2,'0')}-${String(a.d).padStart(2,'0')}`;else warnings.push('Некорректная дата. Укажите дату вручную.');}
  if(dateMatches.length>1)warnings.push('В диктовке несколько дат: укажите отдельно дату процедуры и контрольного визита.');
  const amounts=[...s.matchAll(/(?<![\d,.])(\d+(?:[,.]\d+)?)\s*(миллилитр(?:а|ов)?|мл|единиц(?:а|ы|у)?|ед\.?)(?=$|[\s,;.!])/g)].filter(m=>!/[\d,.]\s*$/.test(s.slice(0,m.index)));
  if(amounts.length===1&&types.length<=1){result.amount=amounts[0][1].replace('.',',');result.unit=/мл|миллилитр/.test(amounts[0][2])?'мл':'ед.';}
  if(amounts.length>1)warnings.push('Распознано несколько количеств. Общий объём и распределение по зонам проверьте вручную.');
  // Only explicitly labelled names. No guesses or fuzzy correction.
  let drug=raw.match(/(?:препарат|название препарата|филлер)\s*[:—-]?\s+(.+?)(?=\s+(?:объем|объём|количество|всего|зона|область|серия|срок|ввела|введено|дозировка)|[,;\n]|$)/i);
  if(drug&&drug[1].trim()&&!/^\d/.test(drug[1])&&drug[1].length<100)result.drug=drug[1].trim();
  let zone=raw.match(/(?:зона|область|куда)\s*[:—-]?\s+(.+?)(?=\s+(?:препарат|количество|объем|объём|серия|срок|наблюдения|контроль)|[;\n]|$)/i);
  if(zone)result.zone=zone[1].trim();
  let series=raw.match(/серия\s*[:—-]?\s+(.+?)(?=\s+(?:срок|зона|препарат|наблюдения|контроль)|[,;\n]|$)/i);if(series)result.batch=series[1].trim();
  if(!result.amount)warnings.push('Количество не заполнено автоматически. Проверьте число и единицу измерения.');
  if(!result.drug)warnings.push('Укажите точное название и вариант препарата.');
  warnings.push('Проверьте все поля по диктовке. Названия препаратов и числа могут распознаваться с ошибками.');
  return result;
 }
 function extractPatient(text){
  const raw=text.trim(),s=numeric(raw),warnings=[];let result={raw,warnings};
  const name=raw.match(/(?:фио|ф\.и\.о\.?|пациентка?|клиентка?)\s*[:—-]?\s+(.+?)(?=[.,;]?\s+(?:дата\s+рождения|родил(?:ся|ась)|телефон|номер\s+телефона|примечание|заметка|важные\s+сведения)|[;\n]|$)/i);
  if(name){const value=name[1].trim().replace(/[.,]+$/,'');if(/^[А-ЯЁа-яё-]+(?:\s+[А-ЯЁа-яё-]+){1,3}$/.test(value))result.name=value;}
  const birthPart=s.match(/(?:дата\s+рождения|родил(?:ся|ась))\s*[:—-]?\s+(.+?)(?=[.,;]?\s+(?:телефон|номер\s+телефона|примечание|заметка|важные\s+сведения)|[;\n]|$)/i);
  if(birthPart){
   const part=birthPart[1];let match=part.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/),d,m,y;
   if(match){d=+match[1];m=+match[2];y=+match[3];}
   else{const named=part.match(new RegExp('(\\d{1,2})\\s+('+months.join('|')+')\\s+(\\d{4})','i'));if(named){d=+named[1];m=months.indexOf(named[2].toLowerCase())+1;y=+named[3];}}
   if(d&&dateValid(y,m,d))result.birth=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;else warnings.push('Дата рождения не распознана или некорректна. Введите её вручную в формате ДД.ММ.ГГГГ.');
  }
  const phone=s.match(/(?:телефон|номер\s+телефона)\s*[:—-]?\s*(\+?\d[\d\s()\-]{8,}\d)(?=[.,;]?\s+(?:примечание|заметка|важные\s+сведения)|[;\n]|$)/i);
  if(phone){const value=phone[1].replace(/\s+/g,' ').trim();const digits=value.replace(/\D/g,'');if(digits.length>=10&&digits.length<=15)result.phone=value;}
  const notes=raw.match(/(?:примечание|заметка|важные\s+сведения)\s*[:—-]?\s+(.+)$/i);if(notes&&notes[1].trim())result.notes=notes[1].trim();
  if(!result.name)warnings.push('ФИО не заполнено автоматически. Произнесите «ФИО …» и обязательно проверьте написание.');
  if(!result.birth)warnings.push('Проверьте дату рождения и введите её как ДД.ММ.ГГГГ.');
  if(!result.phone)warnings.push('Телефон не распознан. Проверьте цифры вручную.');
  warnings.push('Перед сохранением сверьте каждое поле с первичными сведениями пациента.');
  return result;
 }
 root.Dictation={extract,extractPatient,numeric,dateValid};
})(typeof window!=='undefined'?window:globalThis);
