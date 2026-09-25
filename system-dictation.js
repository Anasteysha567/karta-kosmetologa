'use strict';

/* Системная диктовка через клавиатуру Android + устойчивый разбор карточки клиента. */
(function () {
  function focusForSystemDictation(selector) {
    const field = document.querySelector(selector);
    if (!field) return;

    field.focus({preventScroll:false});
    try {
      const end = field.value.length;
      field.setSelectionRange(end, end);
    } catch (_) {}

    field.scrollIntoView({behavior:'smooth', block:'center'});

    const note = document.createElement('div');
    note.className = 'notice system-dictation-note';
    note.textContent = 'Клавиатура открыта. Нажмите значок микрофона на клавиатуре телефона и продиктуйте текст.';
    field.parentElement?.appendChild(note);
    setTimeout(() => note.remove(), 4500);
  }

  function systemButton(label, selector) {
    return '<div class="actions system-dictation-action">' +
      '<button class="btn secondary full" type="button" data-system-dictation="' +
      selector.replace(/"/g, '&quot;') + '">' +
      '🎙️ ' + label +
      '</button></div>';
  }

  if (typeof patientModalHtml === 'function') {
    const originalPatientModalHtml = patientModalHtml;
    patientModalHtml = function () {
      let html = originalPatientModalHtml();
      html = html.replace(
        /(<textarea[^>]*data-path="patient\.voiceText"[\s\S]*?<\/textarea>)/,
        '$1' + systemButton('Продиктовать через клавиатуру телефона', '[data-path="patient.voiceText"]')
      );
      return html;
    };
  }

  if (typeof visitForm === 'function') {
    const originalVisitForm = visitForm;
    visitForm = function () {
      let html = originalVisitForm();
      html = html.replace(
        /(<textarea[^>]*data-path="transcript"[\s\S]*?<\/textarea>)/,
        '$1' + systemButton('Продиктовать через клавиатуру телефона', '[data-path="transcript"]')
      );
      return html;
    };
  }

  document.addEventListener('click', function (event) {
    const button = event.target.closest('[data-system-dictation]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    focusForSystemDictation(button.dataset.systemDictation);
  }, true);

  const months = {
    'января':1,'февраля':2,'марта':3,'апреля':4,'мая':5,'июня':6,
    'июля':7,'августа':8,'сентября':9,'октября':10,'ноября':11,'декабря':12
  };

  function pad2(n){ return String(n).padStart(2,'0'); }

  function validDate(y,m,d){
    const x = new Date(Date.UTC(y,m-1,d));
    return x.getUTCFullYear()===y && x.getUTCMonth()===m-1 && x.getUTCDate()===d;
  }

  function normalizeSpaces(s){
    return String(s||'')
      .replace(/\u00a0/g,' ')
      .replace(/[“”«»]/g,'"')
      .replace(/\s+/g,' ')
      .trim();
  }

  function cleanName(s){
    return normalizeSpaces(s)
      .replace(/^[,:;.\s-]+|[,:;.\s-]+$/g,'')
      .replace(/\b(дата\s+рождения|телефон|номер\s+телефона|примечание)\b.*$/i,'')
      .trim();
  }

  function extractDateFromText(text){
    const s = normalizeSpaces(text).toLowerCase().replace(/ё/g,'е');

    let m = s.match(/(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{4})/);
    if (m) {
      const d=+m[1], mo=+m[2], y=+m[3];
      if (validDate(y,mo,d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
    }

    m = s.match(/\b(\d{2})\s+(\d{2})\s+(\d{4})\b/);
    if (m) {
      const d=+m[1], mo=+m[2], y=+m[3];
      if (validDate(y,mo,d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
    }

    m = s.match(/\b(\d{2})(\d{2})(\d{4})\b/);
    if (m) {
      const d=+m[1], mo=+m[2], y=+m[3];
      if (validDate(y,mo,d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
    }

    m = s.match(new RegExp('(\\d{1,2})\\s+(' + Object.keys(months).join('|') + ')\\s+(\\d{4})'));
    if (m) {
      const d=+m[1], mo=months[m[2]], y=+m[3];
      if (validDate(y,mo,d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
    }

    return '';
  }

  function sliceBetweenLabels(text, startLabel, nextLabels) {
    const s = normalizeSpaces(text);
    const start = new RegExp(startLabel + '\\s*[:—-]?\\s*', 'i');
    const m = start.exec(s);
    if (!m) return '';

    const after = s.slice(m.index + m[0].length);
    if (!nextLabels.length) return after.trim();

    const next = new RegExp('\\b(?:' + nextLabels.join('|') + ')\\b\\s*[:—-]?', 'i');
    const n = next.exec(after);
    return (n ? after.slice(0,n.index) : after).trim();
  }

  function robustExtractPatient(text) {
    const raw = normalizeSpaces(text);
    const warnings = [];
    const result = {raw, warnings};

    const namePart = sliceBetweenLabels(
      raw,
      '(?:фио|ф\\s*и\\s*о|ф\\.\\s*и\\.\\s*о\\.|пациент(?:ка)?|клиент(?:ка)?)',
      ['дата\\s+рождения','родил(?:ся|ась)','номер\\s+телефона','телефон','примечание','заметка']
    );
    const name = cleanName(namePart);
    if (name && /[А-ЯЁа-яёA-Za-z]/.test(name)) result.name = name;

    const birthPart = sliceBetweenLabels(
      raw,
      '(?:дата\\s+рождения|родил(?:ся|ась))',
      ['номер\\s+телефона','телефон','примечание','заметка']
    );
    const birth = extractDateFromText(birthPart || raw);
    if (birth) result.birth = birth;

    const phonePart = sliceBetweenLabels(
      raw,
      '(?:номер\\s+телефона|телефон)',
      ['примечание','заметка','важные\\s+сведения']
    );
    if (phonePart) {
      const digits = phonePart.replace(/\D/g,'');
      if (digits.length >= 10 && digits.length <= 15) {
        result.phone = phonePart.replace(/[^\d+()\-\s]/g,'').trim();
      }
    }

    const notes = sliceBetweenLabels(
      raw,
      '(?:примечание|заметка|важные\\s+сведения)',
      []
    );
    if (notes) result.notes = notes;

    if (!result.name) warnings.push('ФИО не распознано автоматически. Проверьте, что в тексте есть слово «ФИО».');
    if (!result.birth) warnings.push('Дата рождения не распознана. Можно говорить: «Дата рождения 15 января 1986 года» или «15 01 1986».');
    if (!result.phone) warnings.push('Телефон не распознан. Проверьте цифры вручную.');
    warnings.push('Перед сохранением обязательно проверьте все поля.');

    return result;
  }

  if (window.Dictation) {
    window.Dictation.extractPatient = robustExtractPatient;
  }
})();
