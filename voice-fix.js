'use strict';

/* Исправление голосового ввода для мобильных браузеров:
   1) автоматически перезапускает распознавание, если браузер сам остановил сессию;
   2) не добавляет один и тот же финальный фрагмент несколько раз подряд. */
(function () {
  if (!window.Native || window.Native.environment !== 'web-preview') return;

  let recognition = null;
  let wanted = false;
  let restartTimer = null;
  let lastFinal = '';
  let lastFinalAt = 0;

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  function norm(text) {
    return String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[.,!?;:—–-]+/g, '')
      .replace(/\s+/g, ' ');
  }

  function clearRestart() {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  function emitFinal(text) {
    const clean = String(text || '').trim();
    if (!clean) return;

    const normalized = norm(clean);
    const now = Date.now();

    // Защита от типичного мобильного дубля одного и того же фрагмента.
    if (
      normalized &&
      normalized === lastFinal &&
      now - lastFinalAt < 5000
    ) {
      return;
    }

    lastFinal = normalized;
    lastFinalAt = now;
    window.nativeEvent('voiceText', clean);
  }

  function stop(notify) {
    wanted = false;
    clearRestart();

    const current = recognition;
    recognition = null;

    if (current) {
      current.onend = null;
      try { current.stop(); } catch (_) {}
    }

    if (notify) window.nativeEvent('voiceStop', '');
  }

  function start() {
    if (!wanted || recognition) return;

    if (!SpeechRecognition) {
      wanted = false;
      window.nativeEvent(
        'error',
        'В этом браузере голосовой ввод не поддерживается. Откройте страницу в Chrome.'
      );
      return;
    }

    const rec = new SpeechRecognition();
    recognition = rec;

    rec.lang = 'ru-RU';
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    const sentIndexes = new Set();

    rec.onstart = function () {
      window.nativeEvent('voiceStart', '');
    };

    rec.onresult = function (event) {
      let partial = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text =
          result && result[0] ? result[0].transcript : '';

        if (result.isFinal) {
          if (!sentIndexes.has(i)) {
            sentIndexes.add(i);
            emitFinal(text);
          }
        } else {
          partial += (partial ? ' ' : '') + text;
        }
      }

      if (partial.trim()) {
        window.nativeEvent('voicePartial', partial.trim());
      }
    };

    rec.onerror = function (event) {
      const code = event && event.error ? event.error : '';

      // В мобильном Chrome эти события часто возникают при короткой паузе.
      // Не считаем их окончанием диктовки: onend запустит новую сессию.
      if (code === 'no-speech' || code === 'aborted') return;

      if (code === 'not-allowed' || code === 'service-not-allowed') {
        stop(false);
        window.nativeEvent(
          'error',
          'Нет доступа к микрофону. Разрешите микрофон для этого сайта в настройках браузера.'
        );
        return;
      }

      if (code === 'audio-capture') {
        stop(false);
        window.nativeEvent(
          'error',
          'Браузер не видит микрофон. Проверьте разрешение на микрофон.'
        );
        return;
      }

      stop(false);
      window.nativeEvent(
        'error',
        'Голосовой ввод прервался. Нажмите микрофон ещё раз.'
      );
    };

    rec.onend = function () {
      if (recognition === rec) recognition = null;

      // Если пользователь сам не нажал «Остановить»,
      // продолжаем слушать после автоматической остановки браузера.
      if (wanted) {
        clearRestart();
        restartTimer = setTimeout(function () {
          restartTimer = null;
          start();
        }, 250);
      } else {
        window.nativeEvent('voiceStop', '');
      }
    };

    try {
      rec.start();
    } catch (_) {
      recognition = null;
      if (wanted) {
        clearRestart();
        restartTimer = setTimeout(function () {
          restartTimer = null;
          start();
        }, 400);
      }
    }
  }

  window.Native.voice = function () {
    if (wanted) {
      stop(true);
      return;
    }

    wanted = true;
    lastFinal = '';
    lastFinalAt = 0;
    start();
  };

  window.Native.stopVoice = function () {
    if (wanted || recognition) stop(true);
  };
})();
