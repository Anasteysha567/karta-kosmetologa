'use strict';
/* Browser-only adapter. Android injects window.Native before this file runs. */
(function () {
  if (window.Native) return;
  window.__WEB_PREVIEW__ = true;
  const STORAGE_KEY = 'karta-kosmetologa-preview-v1';
  let recognition = null;

  function download(name, bytes, type) {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], {type});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function bytesToBase64(bytes) {
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
  }

  async function portableBackup(password) {
    const json = localStorage.getItem(STORAGE_KEY) || JSON.stringify({version:1,patients:[],visits:[],draft:null,settings:{intro:false,lastBackup:null}});
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'}, keyMaterial, {name:'AES-GCM',length:256}, false, ['encrypt']);
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, new TextEncoder().encode(json)));
    const data = new Uint8Array(1 + iv.length + encrypted.length);
    data[0] = iv.length; data.set(iv, 1); data.set(encrypted, 1 + iv.length);
    return JSON.stringify({format:'cosmetology-backup-v1',salt:bytesToBase64(salt),data:bytesToBase64(data)});
  }

  async function restoreBackup(file, password) {
    const envelope = JSON.parse(await file.text());
    if (envelope.format !== 'cosmetology-backup-v1') throw new Error('format');
    const data = base64ToBytes(envelope.data);
    const salt = base64ToBytes(envelope.salt);
    const ivLength = data[0];
    if (ivLength !== 12 || salt.length !== 32) throw new Error('format');
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'}, keyMaterial, {name:'AES-GCM',length:256}, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(1,13)}, key, data.slice(13));
    return new TextDecoder().decode(plain);
  }

  window.Native = {
    environment: 'web-preview',
    load() { return localStorage.getItem(STORAGE_KEY) || ''; },
    save(json) {
      try { JSON.parse(json); localStorage.setItem(STORAGE_KEY, json); return 'ok'; }
      catch (_) { return 'Не удалось сохранить тестовые данные в браузере.'; }
    },
    voice() {
      if (recognition) { recognition.stop(); return; }
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        window.nativeEvent('error', 'В этом браузере голосовой ввод не поддерживается. Введите учебный текст вручную или откройте проект в Chrome.');
        return;
      }
      recognition = new SpeechRecognition();
      recognition.lang = 'ru-RU';
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.onstart = () => window.nativeEvent('voiceStart', '');
      recognition.onresult = event => {
        let finalText = '', partial = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += text + ' '; else partial += text;
        }
        if (partial) window.nativeEvent('voicePartial', partial);
        if (finalText.trim()) window.nativeEvent('voiceText', finalText.trim());
      };
      recognition.onerror = () => window.nativeEvent('error', 'Браузер не смог распознать речь. Разрешите микрофон или введите текст вручную.');
      recognition.onend = () => { recognition = null; window.nativeEvent('voiceStop', ''); };
      recognition.start();
    },
    stopVoice() { if (recognition) recognition.stop(); },
    photo() {
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files && input.files[0]; if (!file) return;
        if (file.size > 5 * 1024 * 1024) { window.nativeEvent('error', 'Для веб-предпросмотра выберите фото до 5 МБ.'); return; }
        const reader = new FileReader();
        reader.onload = () => {
          const picture = new Image();
          picture.onload = () => {
            const scale = Math.min(1, 1600 / Math.max(picture.naturalWidth, picture.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
            canvas.getContext('2d').drawImage(picture, 0, 0, canvas.width, canvas.height);
            window.nativeEvent('photo', canvas.toDataURL('image/jpeg', 0.82));
          };
          picture.onerror = () => window.nativeEvent('error', 'Не удалось прочитать выбранное изображение.');
          picture.src = String(reader.result);
        };
        reader.onerror = () => window.nativeEvent('error', 'Не удалось прочитать выбранное изображение.');
        reader.readAsDataURL(file);
      };
      input.click();
    },
    exportCsv(csv) { download('procedures-preview.csv', csv, 'text/csv;charset=utf-8'); window.nativeEvent('exported', ''); },
    printHtml(html) {
      const win = window.open('', '_blank');
      if (!win) { window.nativeEvent('error', 'Разрешите всплывающие окна для печати тестового отчёта.'); return; }
      win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 250);
    },
    async backup(password) {
      try { download('karta-preview.karta', await portableBackup(password), 'application/octet-stream'); window.nativeEvent('exported', ''); }
      catch (_) { window.nativeEvent('error', 'Не удалось создать тестовую резервную копию.'); }
    },
    restore(password) {
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.karta,application/octet-stream';
      input.onchange = async () => {
        try { const file = input.files && input.files[0]; if (file) window.nativeEvent('restored', await restoreBackup(file, password)); }
        catch (_) { window.nativeEvent('error', 'Не удалось открыть копию: проверьте файл и пароль.'); }
      };
      input.click();
    },
    lock() { window.nativeEvent('error', 'Веб-предпросмотр не имитирует блокировку телефона.'); },
    quit() {},
  };
})();
