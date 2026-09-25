'use strict';

/* Системная диктовка через клавиатуру Android + более гибкое распознавание дат.
   Ничего не отправляет наружу: текст вводится обычной клавиатурой телефона. */
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

    // На Android клавиатура откроется после фокуса.
    // Пользователь нажимает микрофон уже на самой клавиатуре.
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

  // Добавляем кнопку в карточку клиента.
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

  // Добавляем кнопку в запись приёма.
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

  // Более гибкая нормализация дат после системной диктовки.
  function normalizeDateAfterLabel(text, labelPattern) {
    return String(text || '').replace(
      new RegExp(
        '(' + labelPattern + '\\s*[:—-]?\\s*)' +
        '(\\d{2})[\\s./-]?(\\d{2})[\\s./-]?(\\d{4})',
        'gi'
      ),
      function (_, prefix, dd, mm, yyyy) {
        return prefix + dd + '.' + mm + '.' + yyyy;
      }
    );
  }

  function normalizePatientDates(text) {
    return normalizeDateAfterLabel(
      text,
      'дата\\s+рождения|родил(?:ся|ась)'
    );
  }

  function normalizeVisitDates(text) {
    return normalizeDateAfterLabel(
      text,
      'дата(?:\\s+при[её]ма|\\s+процедуры)?'
    );
  }

  if (window.Dictation && typeof window.Dictation.extractPatient === 'function') {
    const originalExtractPatient = window.Dictation.extractPatient;
    window.Dictation.extractPatient = function (text) {
      return originalExtractPatient(normalizePatientDates(text));
    };
  }

  if (window.Dictation && typeof window.Dictation.extract === 'function') {
    const originalExtract = window.Dictation.extract;
    window.Dictation.extract = function (text) {
      return originalExtract(normalizeVisitDates(text));
    };
  }
})();
