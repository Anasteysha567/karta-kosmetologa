'use strict';

/* Voice fix v2: mobile-friendly recognition with automatic restart
   and overlap-aware de-duplication of cumulative results. */
(function () {
  if (!window.Native || window.Native.environment !== 'web-preview') return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  let wanted = false;
  let restartTimer = null;
  let committed = '';

  function words(s) {
    return String(s || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  }

  function normWord(s) {
    return String(s || '').toLowerCase().replace(/[.,!?;:—–-]+/g, '');
  }

  function deltaText(nextText) {
    const next = words(nextText);
    if (!next.length) return '';

    const old = words(committed);
    if (!old.length) {
      committed = next.join(' ');
      return committed;
    }

    const oldNorm = old.map(normWord);
    const nextNorm = next.map(normWord);

    // If browser sends a cumulative phrase, emit only the new tail.
    let overlap = 0;
    const max = Math.min(oldNorm.length, nextNorm.length);
    for (let k = max; k >= 1; k--) {
      let ok = true;
      for (let i = 0; i < k; i++) {
        if (oldNorm[oldNorm.length - k + i] !== nextNorm[i]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        overlap = k;
        break;
      }
    }

    // Exact/cumulative repeat with no new words.
    if (overlap === next.length) return '';

    const tail = next.slice(overlap).join(' ').trim();

    if (tail) {
      committed = (committed + ' ' + tail).trim();
    }

    return tail;
  }

  function clearRestart() {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  function stop(notify) {
    wanted = false;
    clearRestart();

    const current = rec;
    rec = null;

    if (current) {
      current.onend = null;
      current.onerror = null;
      try { current.stop(); } catch (_) {}
    }

    if (notify) window.nativeEvent('voiceStop', '');
  }

  function startSession() {
    if (!wanted || rec) return;

    if (!SR) {
      wanted = false;
      window.nativeEvent(
        'error',
        'Голосовой ввод не поддерживается этим браузером. Откройте страницу в Chrome.'
      );
      return;
    }

    const r = new SR();
    rec = r;

    r.lang = 'ru-RU';
    r.interimResults = true;

    // On many Android devices continuous recognition is unstable.
    // Use short sessions and immediately restart them ourselves.
    r.continuous = false;
    r.maxAlternatives = 1;

    r.onstart = function () {
      window.nativeEvent('voiceStart', '');
    };

    r.onresult = function (event) {
      let partial = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result && result[0] ? result[0].transcript : '';

        if (result.isFinal) {
          const delta = deltaText(text);
          if (delta) window.nativeEvent('voiceText', delta);
        } else if (text) {
          partial += (partial ? ' ' : '') + text;
        }
      }

      if (partial.trim()) {
        window.nativeEvent('voicePartial', partial.trim());
      }
    };

    r.onerror = function (event) {
      const code = event && event.error ? event.error : '';

      // Common Android events after a pause: just restart.
      if (code === 'no-speech' || code === 'aborted' || code === 'network') {
        return;
      }

      if (code === 'not-allowed' || code === 'service-not-allowed') {
        stop(false);
        window.nativeEvent(
          'error',
          'Нет доступа к микрофону. Разрешите микрофон для этого сайта.'
        );
        return;
      }

      if (code === 'audio-capture') {
        stop(false);
        window.nativeEvent(
          'error',
          'Браузер не видит микрофон телефона.'
        );
        return;
      }
    };

    r.onend = function () {
      if (rec === r) rec = null;

      if (wanted) {
        clearRestart();
        restartTimer = setTimeout(function () {
          restartTimer = null;
          startSession();
        }, 120);
      } else {
        window.nativeEvent('voiceStop', '');
      }
    };

    try {
      r.start();
    } catch (_) {
      rec = null;
      if (wanted) {
        restartTimer = setTimeout(startSession, 300);
      }
    }
  }

  window.Native.voice = function () {
    if (wanted) {
      stop(true);
      return;
    }

    committed = '';
    wanted = true;
    startSession();
  };

  window.Native.stopVoice = function () {
    if (wanted || rec) stop(true);
  };
})();
