'use strict';
/* Non-destructive extension of the existing cosmetology web app. */
(function(){
let month=today().slice(0,7), chosen=today();
const originalProcedureForm=procedureForm;
procedureForm=function(p,i){return originalProcedureForm(p,i)
 .replace(/<h3>Процедура \d+<\/h3>/,'<h3>Процедура</h3>')
 .replace(/<button[^>]*data-action="removeProcedure"[^>]*>[\s\S]*?<\/button>/g,'')
 .replace(/<div class="grid2"><div class="field"><label[^>]*>Серия<\/label>[\s\S]*?<\/div><div class="field"><label[^>]*>Годен до<\/label>[\s\S]*?<\/div><\/div>/g,'');};
const originalVisitForm=visitForm;
visitForm=function(){const html=originalVisitForm();return html
 .replace(/<div class="actions"><button[^>]*data-action="addProcedure"[^>]*>[\s\S]*?<\/button><\/div>/g,'')
 .replace('Назначенный контрольный визит','Дата следующего приёма')
 .replace('Русская речь · без интернета · до 3 минут','Русская речь · разрешите микрофон в браузере');};
const originalVisitPage=visitPage;
visitPage=function(){return originalVisitPage().replace(/<div><dt>Серия<\/dt><dd>[\s\S]*?<\/dd><\/div>/g,'').replace(/<div><dt>Годен до<\/dt><dd>[\s\S]*?<\/dd><\/div>/g,'').replace('Контрольный визит:','Следующий приём:');};
const originalVisitCard=visitCard;
visitCard=function(v){return originalVisitCard(v).replace('Контроль:','Следующий приём:');};
const originalNav=nav;
nav=function(){return originalNav().replace('</nav>','<button data-action="calendarOpen" class="'+(page==='calendar'?'active':'')+'">'+icon('clock')+'Календарь</button></nav>');};
function calendar(){const [y,m]=month.split('-').map(Number),offset=(new Date(y,m-1,1).getDay()+6)%7,days=new Date(y,m,0).getDate();const records=db.visits.filter(v=>v.control&&patient(v.patientId));const count=d=>records.filter(v=>v.control===d).length;const move=n=>{const d=new Date(y,m-1+n,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');};const dayButtons=Array.from({length:offset},()=>'<span></span>').concat(Array.from({length:days},(_,i)=>{const d=month+'-'+String(i+1).padStart(2,'0');return '<button data-action="calendarDay" data-day="'+d+'" class="cal-day '+(d===chosen?'chosen ':'')+(count(d)?'has-visit':'')+'">'+(i+1)+(count(d)?'<small>'+count(d)+'</small>':'')+'</button>';})).join('');const visits=records.filter(v=>v.control===chosen);return '<h1>Календарь приёмов</h1><p class="subtitle">Даты следующих приёмов из сохранённых карточек.</p><div class="card"><div class="cal-head"><button class="btn outline" data-action="calendarMonth" data-month="'+move(-1)+'">‹</button><strong>'+new Date(y,m-1,1).toLocaleDateString('ru-RU',{month:'long',year:'numeric'})+'</strong><button class="btn outline" data-action="calendarMonth" data-month="'+move(1)+'">›</button></div><div class="cal-grid">'+['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(v=>'<span class="cal-week">'+v+'</span>').join('')+dayButtons+'</div></div><div class="section-label"><span>На '+dateFmt(chosen)+'</span></div>'+(visits.length?visits.map(v=>'<div class="card"><h3>'+esc(patient(v.patientId).name)+'</h3><p class="hint">'+esc(v.procedures.map(p=>p.type).join(', '))+'</p><div class="actions">'+btn('Карточка клиента','patient','small outline','data-id="'+esc(v.patientId)+'"')+btn('Прошлый приём','visit','small outline','data-id="'+esc(v.id)+'"')+'</div></div>').join(''):'<div class="empty"><p>На этот день нет записей.</p></div>')+'<p class="hint">Календарь показывает запланированные даты, но не подтверждает запись клиента и не отправляет напоминаний.</p>';}
const originalRender=render;
render=function(){if(page!=='calendar'){originalRender();return;}$('#app').innerHTML='<main class="shell"><div class="topline"><div class="brand">'+icon('note')+' Карта косметолога</div><span class="offline">Веб-предпросмотр</span></div>'+calendar()+'</main>'+nav();};
document.addEventListener('click',function(e){const el=e.target.closest('[data-action]');if(!el)return;const action=el.dataset.action;if(!['calendarOpen','calendarMonth','calendarDay'].includes(action))return;e.preventDefault();e.stopImmediatePropagation();if(action==='calendarOpen'){stopVoice();flushDraft();closeModal();page='calendar';}if(action==='calendarMonth'){month=el.dataset.month;chosen=month+'-01';}if(action==='calendarDay')chosen=el.dataset.day;render();window.scrollTo(0,0);},true);
})();
