/*
 * Brazilian Portuguese build of ../app.js (same logic, translated strings).
 *
 * Encrypted Notebook (web) — a diary that is encrypted on the device, plus a guided
 * process for breaking an entry into individual thoughts and working each one
 * through David Hoffmeister's Instrument for Peace.
 *
 * The notebook document (diary text + reflections) is JSON, encrypted with
 * NBCrypto before it is written anywhere: to a .enc file, or to localStorage as
 * the optional "browser copy". The password itself is never stored.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const DRAFT_KEY = 'enb.draft.v1';
  const PREFS_KEY = 'enb.prefs.v1';
  const FILE_TYPE = { description: 'Caderno criptografado', accept: { 'application/octet-stream': ['.enc'] } };
  const FIELD_KEYS = ['A', 'B', 'C1', 'C2', 'D', 'E'];
  const LAST_STEP = Instrument.steps.length; // steps 1..12; LAST_STEP + 1 is insights
  const INSIGHTS = LAST_STEP + 1;

  const state = {
    doc: emptyDoc(),
    session: null, // derived keys, held in memory only
    fileName: null, // null until saved/opened; see fileLabel()
    fileHandle: null,
    dirty: false,
    view: 'diary',
    activeId: null,
    selection: '',
    gen: 0, // bumped whenever the loaded notebook changes, so stale async writes are dropped
  };

  let prefs = { browserCopy: true };
  let draftTimer = null;
  let draftPending = false;

  function emptyDoc() {
    return { app: 'encrypted-notebook', version: 2, text: '', reflections: [] };
  }

  // New notebooks are named after the day they're saved, e.g. diario_do_perdao_2026-10-23.enc
  function fileLabel() {
    if (state.fileName) return state.fileName;
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `diario_do_perdao_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.enc`;
  }

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  // ---------- small DOM helpers ----------

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'value') el.value = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
    }
    return el;
  }

  function autosize(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }

  function autoTextarea(attrs, onInput) {
    const ta = h('textarea', { rows: 1, ...attrs });
    ta.addEventListener('input', () => { autosize(ta); onInput(ta.value); });
    requestAnimationFrame(() => autosize(ta));
    return ta;
  }

  function toast(message, kind) {
    const t = h('div', { class: 'toast ' + (kind || '') }, message);
    $('toasts').append(t);
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3700);
  }

  const plaintextOnly = (() => {
    try {
      const d = document.createElement('div');
      d.contentEditable = 'plaintext-only';
      return d.contentEditable === 'plaintext-only';
    } catch (e) {
      return false;
    }
  })();

  // ---------- dialogs ----------

  /**
   * Password prompt. With `verify`, the dialog stays open until verify(password)
   * resolves, showing its error otherwise; its result is returned as `result`.
   */
  function askPassword({ title, message = '', confirm = false, verify }) {
    return new Promise((resolve) => {
      const d = $('pwDialog');
      const form = $('pwForm');
      $('pwTitle').textContent = title;
      $('pwMessage').textContent = message;
      $('pwError').textContent = '';
      $('pwInput').value = '';
      $('pwConfirm').value = '';
      $('pwInput').autocomplete = confirm ? 'new-password' : 'current-password';
      $('pwConfirmRow').hidden = !confirm;
      $('pwOk').disabled = false;
      let result;

      async function onSubmit(e) {
        if (e.submitter && e.submitter.value === 'cancel') return;
        e.preventDefault();
        const pw = $('pwInput').value;
        if (!pw) return;
        if (confirm && pw !== $('pwConfirm').value) {
          $('pwError').textContent = 'As senhas não coincidem.';
          return;
        }
        if (verify) {
          $('pwOk').disabled = true;
          $('pwError').textContent = 'Processando…';
          try {
            result = await verify(pw);
          } catch (err) {
            $('pwError').textContent = err.name !== 'DecryptError' ? err.message || String(err)
              : err.code === 'invalid-file' ? 'Este arquivo não é um caderno criptografado válido.'
              : 'Senha incorreta, ou o arquivo está danificado.';
            $('pwOk').disabled = false;
            $('pwInput').select();
            return;
          }
        }
        d.close('ok');
      }

      function onClose() {
        form.removeEventListener('submit', onSubmit);
        const ok = d.returnValue === 'ok';
        const out = ok ? { password: $('pwInput').value, result } : null;
        $('pwInput').value = '';
        $('pwConfirm').value = '';
        resolve(out);
      }

      form.addEventListener('submit', onSubmit);
      d.addEventListener('close', onClose, { once: true });
      d.returnValue = '';
      d.showModal();
      $('pwInput').focus();
    });
  }

  /** Buttons: [{ label, value, primary?, danger? }]. Resolves to the value, or null if dismissed/cancelled. */
  function choose(title, message, buttons) {
    return new Promise((resolve) => {
      const d = $('choiceDialog');
      $('choiceTitle').textContent = title;
      $('choiceMessage').textContent = message;
      $('choiceButtons').replaceChildren(
        ...buttons.map((b) => h('button', { value: b.value, class: b.primary ? 'primary' : b.danger ? 'danger' : null }, b.label))
      );
      d.returnValue = '';
      d.addEventListener('close', () => resolve(d.returnValue && d.returnValue !== 'cancel' ? d.returnValue : null), { once: true });
      d.showModal();
    });
  }

  // ---------- notebook document ----------

  function parseDoc(plaintext, format) {
    if (format === 'v2') {
      try {
        const d = JSON.parse(plaintext);
        if (d && d.app === 'encrypted-notebook') {
          return { ...emptyDoc(), ...d, text: String(d.text || ''), reflections: Array.isArray(d.reflections) ? d.reflections : [] };
        }
      } catch (e) { /* not ours: treat as plain text */ }
    }
    return { ...emptyDoc(), text: plaintext };
  }

  function loadDoc(doc, { session = null, fileName = null, handle = null, dirty = false } = {}) {
    state.gen++;
    state.doc = doc;
    state.session = session;
    state.fileName = fileName;
    state.fileHandle = handle;
    state.dirty = dirty;
    const last = doc.reflections[doc.reflections.length - 1];
    state.activeId = last ? last.id : null;
    $('editor').value = doc.text;
    refreshChrome();
    renderReflect();
  }

  function markDirty() {
    state.dirty = true;
    refreshChrome();
    scheduleDraft();
  }

  function refreshChrome() {
    $('fileName').textContent = fileLabel();
    $('dirty').hidden = !state.dirty;
    const s = $('cryptoStatus');
    if (!state.session) {
      s.textContent = 'Ainda não criptografado — Salve para definir uma senha';
      s.className = 'crypto-status warn';
    } else {
      s.textContent = 'Criptografado · AES-256';
      s.className = 'crypto-status ok';
    }
    const words = (state.doc.text.match(/\S+/g) || []).length;
    $('wordCount').textContent = words === 1 ? '1 palavra' : `${words} palavras`;
    document.title = (state.dirty ? '• ' : '') + fileLabel().replace(/\.enc$/, '') + ' — Caderno Criptografado';
  }

  // ---------- encrypted browser copy ----------

  function loadPrefs() {
    try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch (e) { /* defaults */ }
  }

  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
  }

  function readDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
      return d && d.file ? d : null;
    } catch (e) {
      return null;
    }
  }

  function forgetDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
  }

  function scheduleDraft() {
    if (!state.session || !prefs.browserCopy) return;
    draftPending = true;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(writeDraft, 1000);
  }

  async function writeDraft() {
    clearTimeout(draftTimer);
    if (!state.session || !prefs.browserCopy) { draftPending = false; return; }
    const gen = state.gen;
    try {
      const file = await NBCrypto.seal(state.session, JSON.stringify(state.doc));
      if (gen !== state.gen) return;
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        name: fileLabel(), dirty: state.dirty, savedAt: Date.now(), file,
      }));
    } catch (e) {
      console.warn('Could not keep the browser copy', e);
    }
    if (gen === state.gen) draftPending = false;
  }

  function showBanner() {
    const d = readDraft();
    if (!d) { $('banner').hidden = true; return; }
    const when = new Date(d.savedAt).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
    $('bannerText').textContent = `Uma cópia criptografada de “${d.name}” de ${when} está guardada neste navegador` +
      (d.dirty ? ' (ela tem alterações ainda não salvas em um arquivo).' : '.');
    $('banner').hidden = false;
  }

  async function resumeDraft() {
    const d = readDraft();
    if (!d) { showBanner(); return; }
    if (!(await okToDiscard({ ignoreDraft: true }))) return;
    const r = await askPassword({
      title: `Desbloquear ${d.name}`,
      message: 'Desbloqueie a cópia criptografada guardada neste navegador.',
      verify: (pw) => NBCrypto.unlock(d.file, pw),
    });
    if (!r) return;
    const { session, plaintext } = r.result;
    loadDoc(parseDoc(plaintext, 'v2'), { session, fileName: d.name, dirty: !!d.dirty });
    $('banner').hidden = true;
    toast('Caderno desbloqueado');
  }

  // ---------- files ----------

  async function okToDiscard({ ignoreDraft = false } = {}) {
    if (state.dirty) {
      const c = await choose('Alterações não salvas', `Salvar as alterações em “${fileLabel()}” antes?`, [
        { label: 'Cancelar', value: 'cancel' },
        { label: 'Descartar', value: 'discard', danger: true },
        { label: 'Salvar', value: 'save', primary: true },
      ]);
      if (c === 'save') return save(false);
      return c === 'discard';
    }
    const d = !ignoreDraft && !$('banner').hidden && readDraft();
    if (d && d.dirty) {
      const c = await choose('Substituir a cópia do navegador?',
        `A cópia criptografada de “${d.name}” neste navegador tem alterações que nunca foram salvas em um arquivo. Continuar irá substituí-la.`, [
          { label: 'Cancelar', value: 'cancel' },
          { label: 'Substituir', value: 'go', danger: true },
        ]);
      return c === 'go';
    }
    return true;
  }

  function pickFileFallback() {
    return new Promise((resolve) => {
      const input = $('fileInput');
      input.value = '';
      input.onchange = () => resolve(input.files[0] || null);
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  async function openFile() {
    if (!(await okToDiscard())) return;
    let file;
    let handle = null;
    if (window.showOpenFilePicker) {
      try {
        [handle] = await window.showOpenFilePicker({ types: [FILE_TYPE] });
        file = await handle.getFile();
      } catch (e) {
        if (e.name === 'AbortError') return;
        throw e;
      }
    } else {
      file = await pickFileFallback();
      if (!file) return;
    }
    const text = await file.text();
    if (!NBCrypto.detect(text)) {
      toast(`“${file.name}” não é um arquivo de caderno criptografado.`, 'error');
      return;
    }
    const r = await askPassword({ title: `Desbloquear ${file.name}`, verify: (pw) => NBCrypto.unlock(text, pw) });
    if (!r) return;
    const { session, plaintext, format } = r.result;
    // Older (Fernet) notebooks are re-saved in the stronger format; dirty so that happens on next save.
    session.format = 'v2';
    loadDoc(parseDoc(plaintext, format), { session, fileName: file.name, handle, dirty: format === 'fernet' });
    $('banner').hidden = true;
    writeDraft();
    toast(format === 'fernet' ? 'Caderno antigo aberto — Salve para atualizar a criptografia' : 'Caderno desbloqueado');
  }

  async function writeFile(text, saveAs) {
    if (window.showSaveFilePicker) {
      try {
        const handle = (!saveAs && state.fileHandle) ||
          await window.showSaveFilePicker({ suggestedName: fileLabel(), types: [FILE_TYPE] });
        const w = await handle.createWritable();
        await w.write(text);
        await w.close();
        state.fileHandle = handle;
        state.fileName = handle.name;
        return true;
      } catch (e) {
        if (e.name === 'AbortError') return false;
        throw e;
      }
    }
    // Browsers without the File System Access API: download the encrypted file.
    const url = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
    const a = h('a', { href: url, download: fileLabel() });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  }

  async function save(saveAs) {
    if (!state.session || saveAs) {
      const r = await askPassword({
        title: state.session ? 'Salvar como' : 'Defina uma senha',
        message: 'Esta senha criptografa o caderno. Ela não pode ser recuperada — sem ela, o caderno não pode ser aberto.',
        confirm: true,
        verify: (pw) => NBCrypto.createSession(pw),
      });
      if (!r) return false;
      state.session = r.result;
      if (saveAs) state.fileHandle = null;
    }
    const gen = state.gen;
    const fileText = await NBCrypto.seal(state.session, JSON.stringify(state.doc));
    if (!(await writeFile(fileText, saveAs)) || gen !== state.gen) return false;
    state.dirty = false;
    refreshChrome();
    writeDraft();
    toast('Criptografado e salvo');
    return true;
  }

  async function newNotebook() {
    if (!(await okToDiscard())) return;
    loadDoc(emptyDoc());
    $('banner').hidden = true;
    setView('diary');
    $('editor').focus();
  }

  async function lock() {
    if (state.session && prefs.browserCopy) {
      await writeDraft();
    } else if (!(await okToDiscard())) {
      return;
    }
    loadDoc(emptyDoc());
    setView('diary');
    showBanner();
    toast('Bloqueado');
  }

  // ---------- diary view ----------

  function insertDate() {
    const ed = $('editor');
    const stamp = new Date().toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
    const before = ed.value.slice(0, ed.selectionStart);
    const lead = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
    ed.setRangeText(`${lead}— ${stamp} —\n`, ed.selectionStart, ed.selectionEnd, 'end');
    ed.dispatchEvent(new Event('input'));
    ed.focus();
  }

  // Views: diary, reflect, emotions, beliefs. Each tab has data-view and its section is `${view}View`.
  function setView(view) {
    if (view !== 'diary' && state.view === 'diary') {
      const ed = $('editor');
      state.selection = ed.value.slice(ed.selectionStart, ed.selectionEnd).trim();
    }
    state.view = view;
    document.querySelectorAll('.tabs [data-view]').forEach((tab) => {
      const on = tab.dataset.view === view;
      tab.setAttribute('aria-selected', String(on));
      $(`${tab.dataset.view}View`).hidden = !on;
    });
    if (view === 'reflect') renderReflect();
    window.scrollTo({ top: 0 });
  }

  // The Emotions and Beliefs tabs: fixed reference lists from lists.js.
  function renderReference(view, data) {
    $(`${view}View`).replaceChildren(h('div', { class: 'card reference' },
      h('h2', null, data.title),
      h('p', { class: 'muted' }, data.intro),
      h('div', { class: data.style === 'chips' ? 'ref-groups chips' : 'ref-groups' }, data.groups.map((g) =>
        h('section', { class: 'ref-group' },
          h('h3', null, g.name),
          h('ul', null, g.items.map((item) => h('li', null, item))))))));
  }

  // ---------- thoughts ----------

  function splitThoughts(text) {
    const out = [];
    for (const para of text.split(/\n+/)) {
      if (/^\s*—.*—\s*$/.test(para)) continue; // date stamps
      for (const piece of para.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)/g) || []) {
        const s = piece.trim();
        if (s.length > 1 && /[\p{L}\p{N}]/u.test(s)) out.push(s);
      }
    }
    return out;
  }

  function newThought(text) {
    return {
      id: uid(), text, include: true, status: 'pending', step: 0, choice: null,
      ws: { A: text, B: '', C1: '', C2: '', D: '', E: '', insights: '' },
    };
  }

  function newReflection(source) {
    const r = { id: uid(), created: new Date().toISOString(), stage: 'source', source: source || '', thoughts: [], current: 0 };
    state.doc.reflections.push(r);
    state.activeId = r.id;
    markDirty();
    renderReflect();
  }

  const activeReflection = () => state.doc.reflections.find((r) => r.id === state.activeId) || null;
  const included = (r) => r.thoughts.filter((t) => t.include && t.text.trim());

  function reflectionTitle(r) {
    const base = (r.thoughts[0] && r.thoughts[0].text) || r.source.trim() || 'Nova reflexão';
    return base.length > 52 ? base.slice(0, 50).trimEnd() + '…' : base;
  }

  function go(r, changes) {
    Object.assign(r, changes);
    markDirty();
    renderReflect();
    $('reflectMain').scrollTop = 0;
    window.scrollTo({ top: 0 });
  }

  function nextPending(r, fromIndex) {
    const list = r.thoughts;
    for (let k = 1; k <= list.length; k++) {
      const i = (fromIndex + k) % list.length;
      const t = list[i];
      if (t.include && t.text.trim() && t.status !== 'done') return i;
    }
    return -1;
  }

  // ---------- reflect view ----------

  function renderReflect() {
    renderReflectionList();
    const main = $('reflectMain');
    const r = activeReflection();
    if (!r) { main.replaceChildren(renderWelcome()); return; }
    const render = { source: renderSource, thoughts: renderThoughts, work: renderWork, summary: renderSummary }[r.stage] || renderSource;
    main.replaceChildren(render(r));
  }

  function renderReflectionList() {
    const list = $('reflectionList');
    list.replaceChildren(...state.doc.reflections.slice().reverse().map((r) => {
      const inc = included(r);
      const done = inc.filter((t) => t.status === 'done').length;
      const date = new Date(r.created).toLocaleDateString('pt-BR', { dateStyle: 'medium' });
      return h('li', { class: r.id === state.activeId ? 'active' : null },
        h('button', { class: 'reflection-item', onclick: () => { state.activeId = r.id; renderReflect(); } },
          h('span', { class: 'reflection-title' }, reflectionTitle(r)),
          h('span', { class: 'muted small' }, inc.length ? `${date} · ${done}/${inc.length} trabalhados` : date)));
    }));
  }

  function renderWelcome() {
    return h('div', { class: 'card welcome' },
      h('h2', null, 'Trabalhe seus pensamentos'),
      h('p', null, 'Este guia ajuda você a olhar para uma entrada do diário, dividi-la em pensamentos individuais e levar cada pensamento pelo Instrumento para a Paz de David Hoffmeister — rastreando um transtorno até a crença na mente, para que ela possa ser liberada.'),
      h('ol', { class: 'how' },
        h('li', null, h('strong', null, 'Escolha'), ' um trecho do seu diário.'),
        h('li', null, h('strong', null, 'Divida'), ' em um pensamento por cartão.'),
        h('li', null, h('strong', null, 'Trabalhe'), ' cada pensamento: os Níveis da Mente e depois os doze passos do Instrumento.'),
        h('li', null, h('strong', null, 'Revise'), ' seus insights. Tudo é salvo criptografado junto com o seu caderno.')),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => newReflection(state.selection) }, state.selection ? 'Começar com o texto selecionado' : 'Começar uma reflexão')));
  }

  function stageHeader(r, n, title, text) {
    return [
      h('div', { class: 'stage-row' },
        h('span', { class: 'stage-num' }, `${n} / 3`),
        h('button', { class: 'link danger-link', onclick: () => deleteReflection(r) }, 'Excluir reflexão')),
      h('h2', null, title),
      text ? h('p', { class: 'muted' }, text) : null,
    ];
  }

  async function deleteReflection(r) {
    const c = await choose('Excluir esta reflexão?', `“${reflectionTitle(r)}” e suas folhas de exercício serão removidas do caderno.`, [
      { label: 'Cancelar', value: 'cancel' },
      { label: 'Excluir', value: 'delete', danger: true },
    ]);
    if (c !== 'delete') return;
    state.doc.reflections = state.doc.reflections.filter((x) => x !== r);
    const last = state.doc.reflections[state.doc.reflections.length - 1];
    state.activeId = last ? last.id : null;
    markDirty();
    renderReflect();
  }

  // Stage 1: choose the passage.
  function renderSource(r) {
    const ta = h('textarea', { class: 'source', placeholder: 'Cole ou digite o trecho que você quer olhar…', value: r.source });
    const breakBtn = h('button', { class: 'primary', disabled: !r.source.trim() }, 'Dividir em pensamentos →');
    ta.addEventListener('input', () => { r.source = ta.value; breakBtn.disabled = !ta.value.trim(); markDirty(); });
    const fill = (text) => { ta.value = text; ta.dispatchEvent(new Event('input')); };

    breakBtn.addEventListener('click', async () => {
      if (r.thoughts.some((t) => t.status === 'done' || t.step > 0)) {
        const c = await choose('Recomeçar os pensamentos?', 'Dividir o trecho novamente substitui os pensamentos atuais e suas folhas de exercício.', [
          { label: 'Manter os pensamentos atuais', value: 'keep', primary: true },
          { label: 'Substituí-los', value: 'replace', danger: true },
        ]);
        if (c === 'keep') { go(r, { stage: 'thoughts' }); return; }
        if (c !== 'replace') return;
      }
      go(r, { stage: 'thoughts', thoughts: splitThoughts(r.source).map(newThought), current: 0 });
    });

    return h('div', { class: 'card' },
      stageHeader(r, 1, 'Escolha o que olhar', 'Escolha uma entrada ou um trecho do seu diário. Olhe para ele com gentileza, sem julgar — o objetivo é apenas ver os pensamentos com clareza.'),
      h('div', { class: 'row' },
        h('button', { class: 'small', disabled: !state.selection, title: state.selection ? null : 'Selecione um texto na aba Diário primeiro', onclick: () => fill(state.selection) }, 'Usar texto selecionado'),
        h('button', { class: 'small', disabled: !state.doc.text.trim(), onclick: () => fill(lastEntry(state.doc.text)) }, 'Usar a última entrada'),
        h('button', { class: 'small', disabled: !state.doc.text.trim(), onclick: () => fill(state.doc.text.trim()) }, 'Usar o diário inteiro')),
      ta,
      h('div', { class: 'nav-row' }, h('span'), breakBtn));
  }

  // The text after the last date stamp, or the last paragraph block.
  function lastEntry(text) {
    const parts = text.split(/^\s*—.*—\s*$/m).map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : text.trim();
  }

  // Stage 2: one thought per card.
  function renderThoughts(r) {
    const list = h('ol', { class: 'thoughts' });
    const begin = h('button', { class: 'primary' });
    const updateBegin = () => {
      const n = included(r).length;
      begin.textContent = n === 1 ? 'Trabalhar 1 pensamento →' : `Trabalhar ${n} pensamentos →`;
      begin.disabled = n === 0;
    };

    const rerender = () => { markDirty(); $('reflectMain').replaceChildren(renderThoughts(r)); };

    r.thoughts.forEach((t, i) => {
      const ta = autoTextarea({ value: t.text, 'aria-label': `Pensamento ${i + 1}` }, (v) => { t.text = v; if (t.step === 0) t.ws.A = v; markDirty(); updateBegin(); });
      const check = h('input', { type: 'checkbox', checked: t.include, title: 'Trabalhar este pensamento', 'aria-label': 'Trabalhar este pensamento' });
      check.addEventListener('change', () => { t.include = check.checked; li.classList.toggle('excluded', !t.include); markDirty(); updateBegin(); });
      const li = h('li', { class: 'thought' + (t.include ? '' : ' excluded') + (t.status === 'done' ? ' done' : '') },
        h('label', { class: 'thought-check' }, check, h('span', { class: 'thought-num' }, i + 1)),
        ta,
        h('div', { class: 'thought-tools' },
          i > 0 ? h('button', { class: 'small', title: 'Juntar com o pensamento acima', onclick: () => {
            const prev = r.thoughts[i - 1];
            prev.text = `${prev.text} ${t.text}`.trim();
            if (prev.step === 0) prev.ws.A = prev.text;
            r.thoughts.splice(i, 1);
            rerender();
          } }, 'Juntar ↑') : null,
          h('button', { class: 'small', title: 'Dividir na posição do cursor', onclick: () => {
            const at = ta.selectionStart;
            const a = t.text.slice(0, at).trim();
            const b = t.text.slice(at).trim();
            if (!a || !b) { toast('Coloque o cursor dentro do pensamento, no ponto onde ele deve ser dividido.'); return; }
            t.text = a;
            if (t.step === 0) t.ws.A = a;
            r.thoughts.splice(i + 1, 0, newThought(b));
            rerender();
          } }, 'Dividir'),
          h('button', { class: 'small', title: 'Remover', onclick: () => { r.thoughts.splice(i, 1); rerender(); } }, 'Remover')));
      list.append(li);
    });

    updateBegin();
    begin.addEventListener('click', () => {
      const first = r.thoughts.findIndex((t) => t.include && t.text.trim() && t.status !== 'done');
      if (first < 0) { go(r, { stage: 'summary' }); return; }
      go(r, { stage: 'work', current: first });
    });

    return h('div', { class: 'card' },
      stageHeader(r, 2, 'Divida em pensamentos individuais',
        'Cada cartão deve conter um pensamento. Edite, junte, divida ou remova cartões até que soe verdadeiro. Desmarque os que você não quer trabalhar agora.'),
      r.thoughts.length ? list : h('p', { class: 'muted' }, 'Nenhum pensamento ainda.'),
      h('button', { class: 'small', onclick: () => { r.thoughts.push(newThought('')); rerender(); } }, '+ Adicionar um pensamento'),
      h('div', { class: 'nav-row' },
        h('button', { onclick: () => go(r, { stage: 'source' }) }, '← Voltar'),
        begin));
  }

  // Stage 3: the worksheet for one thought.
  function renderWork(r) {
    const t = r.thoughts[r.current];
    if (!t) { r.stage = 'thoughts'; return renderThoughts(r); }
    const inc = included(r);
    const pos = inc.indexOf(t) + 1;

    const dots = h('div', { class: 'dots', role: 'list' }, inc.map((x, k) =>
      h('button', {
        role: 'listitem',
        class: 'dot' + (x === t ? ' current' : '') + (x.status === 'done' ? ' done' : ''),
        title: `Pensamento ${k + 1}${x.status === 'done' ? ' (trabalhado)' : ''}`,
        'aria-label': `Pensamento ${k + 1}`,
        onclick: () => go(r, { current: r.thoughts.indexOf(x) }),
      })));

    const head = h('div', { class: 'work-head' },
      h('div', { class: 'stage-row' },
        h('span', { class: 'stage-num' }, `3 / 3 · Pensamento ${pos} de ${inc.length}`),
        h('span', { class: 'row' },
          h('button', { class: 'link', onclick: () => go(r, { stage: 'thoughts' }) }, 'Editar pensamentos'),
          h('button', { class: 'link', onclick: () => go(r, { stage: 'summary' }) }, 'Resumo'))),
      dots,
      h('blockquote', { class: 'thought-quote' }, t.text),
      stepper(r, t));

    let body;
    if (t.step === 0) body = renderLevels(r, t);
    else if (t.step === INSIGHTS) body = renderInsights(r, t);
    else body = renderStep(r, t);

    return h('div', { class: 'card work' }, head, body);
  }

  function stepper(r, t) {
    const labels = ['Níveis da Mente', ...Instrument.steps.map((_, i) => String(i + 1)), 'Insights'];
    return h('div', { class: 'stepper', 'aria-label': 'Progresso da folha de exercício' }, labels.map((label, i) =>
      h('button', {
        class: 'step-pip' + (i === t.step ? ' current' : '') + (i < t.step ? ' past' : '') + (i === 0 || i === INSIGHTS ? ' wide' : ''),
        title: i === 0 ? 'Níveis da Mente' : i === INSIGHTS ? 'Insights' : `Passo ${i}`,
        onclick: () => go(t, { step: i }),
      }, label)));
  }

  function renderLevels(r, t) {
    const diagram = levelsDiagram();
    const highlight = (level) => diagram.querySelectorAll('[data-level]').forEach((el) => el.classList.toggle('active', el.dataset.level === level));

    const fields = FIELD_KEYS.map((key) => {
      const f = Instrument.fields[key];
      const ta = autoTextarea({ value: t.ws[key], placeholder: f.hint, 'aria-label': f.label }, (v) => { t.ws[key] = v; markDirty(); });
      ta.addEventListener('focus', () => highlight(f.level));
      return h('label', { class: `field level-${f.level}` },
        h('span', { class: 'field-label' }, h('b', null, key + '. '), f.label),
        ta);
    });

    return h('div', null,
      h('details', { class: 'intro' },
        h('summary', null, 'Sobre o Instrumento para a Paz'),
        h('p', null, Instrument.intro)),
      h('h3', null, 'Níveis da Mente'),
      h('p', { class: 'muted' }, 'Qual é o seu transtorno agora? Responda a partir do pensamento acima. O campo A vem preenchido com o pensamento — ajuste-o para a situação, passada ou futura, de que ele trata.'),
      h('p', { class: 'muted small' }, 'Precisa de palavras para B ou D? Veja as abas ',
        h('button', { class: 'link', onclick: () => setView('emotions') }, 'Emoções'), ' e ',
        h('button', { class: 'link', onclick: () => setView('beliefs') }, 'Crenças'), '.'),
      h('div', { class: 'levels-grid' },
        h('div', { class: 'fields' }, fields),
        h('figure', { class: 'diagram' }, diagram, h('figcaption', { class: 'muted small' }, Instrument.levels.quote))),
      h('p', { class: 'desire' }, Instrument.levels.desire),
      h('p', { class: 'question' }, Instrument.levels.question),
      h('div', { class: 'choice-row' },
        h('button', { class: 'primary', onclick: () => go(t, { choice: 'peace', step: INSIGHTS }) }, 'Sim — aceito a paz agora'),
        h('button', { onclick: () => go(t, { choice: 'continue', step: 1 }) }, 'Sinto resistência — continuar com o Instrumento')),
      h('p', { class: 'muted small' }, Instrument.levels.resistance),
      skipRow(r, t));
  }

  function levelsDiagram() {
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs, text) => {
      const n = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      if (text) n.textContent = text;
      return n;
    };
    const svg = el('svg', { viewBox: '0 0 320 320', class: 'levels', role: 'img', 'aria-label': 'Níveis da Mente: percepção, emoção, pensamento, crença e, no centro, desejo ou oração' });
    const rings = [['perception', 'Percepção', 154], ['emotion', 'Emoção', 124], ['thought', 'Pensamento', 94], ['belief', 'Crença', 64], ['desire', '', 36]];
    for (const [level, label, radius] of rings) {
      const g = el('g', { 'data-level': level });
      g.append(el('circle', { cx: 160, cy: 160, r: radius, class: `ring ring-${level}` }));
      if (label) g.append(el('text', { x: 160, y: 160 - radius + 19, class: 'ring-label' }, label));
      svg.append(g);
    }
    const centre = svg.lastChild;
    centre.append(el('text', { x: 160, y: 157, class: 'ring-label small' }, 'Desejo'));
    centre.append(el('text', { x: 160, y: 171, class: 'ring-label small' }, 'ou Oração'));
    return svg;
  }

  function fillSpan(t, key) {
    const f = Instrument.fields[key];
    const span = h('span', {
      class: 'fill',
      contenteditable: plaintextOnly ? 'plaintext-only' : 'true',
      role: 'textbox',
      spellcheck: 'true',
      'data-field': key,
      'data-placeholder': f.optional ? `(${key} — opcional)` : `(${key})`,
      'aria-label': `${key}: ${f.label}`,
      title: `${key}: ${f.hint} — clique para ajustar`,
    });
    span.textContent = t.ws[key] || '';
    span.addEventListener('input', () => {
      const v = span.textContent;
      t.ws[key] = v;
      document.querySelectorAll(`.fill[data-field="${key}"]`).forEach((o) => { if (o !== span) o.textContent = v; });
      markDirty();
    });
    span.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); span.blur(); } });
    span.addEventListener('paste', (e) => {
      if (plaintextOnly) return;
      e.preventDefault();
      document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\s+/g, ' '));
    });
    return span;
  }

  function renderLine(t, raw) {
    const emph = raw.startsWith('!');
    const line = emph ? raw.slice(1) : raw;
    const parts = line.split(/\{(A|B|C1|C2|D|E)\}/);
    const solo = parts.length === 3 && !parts[0].trim() && !parts[2].trim();
    const p = h('p', { class: 'ws-line' + (emph ? ' emph' : '') + (solo ? ' solo' : '') + (line.length > 160 ? ' para' : '') });
    parts.forEach((part, i) => p.append(i % 2 ? fillSpan(t, part) : part));
    return p;
  }

  function renderStep(r, t) {
    const n = t.step;
    return h('div', { class: 'ws-step' },
      h('h3', null, `Passo ${n} de ${LAST_STEP}`),
      h('div', { class: 'ws-body' }, Instrument.steps[n - 1].map((line) => renderLine(t, line))),
      n === 1 ? h('p', { class: 'muted small' }, 'O texto em vermelho são as suas próprias respostas — clique em qualquer parte para ajustar. Leia cada passo devagar; deixe que seja uma disposição, e não uma atuação.') : null,
      h('div', { class: 'nav-row' },
        h('button', { onclick: () => go(t, { step: n - 1 }) }, '← Voltar'),
        h('button', { class: 'primary', onclick: () => go(t, { step: n + 1 }) }, n === LAST_STEP ? 'Insights →' : 'Próximo →')),
      skipRow(r, t));
  }

  function renderInsights(r, t) {
    const ta = autoTextarea({ class: 'insights', value: t.ws.insights, placeholder: 'O que você percebeu? O que é visto de modo diferente agora?' }, (v) => { t.ws.insights = v; markDirty(); });
    const next = nextPending(r, r.current);
    return h('div', null,
      h('h3', null, 'Insights'),
      t.choice === 'peace'
        ? h('p', { class: 'note' }, 'Você escolheu a paz nos Níveis da Mente. ',
          h('button', { class: 'link', onclick: () => go(t, { step: 1 }) }, 'Percorrer o Instrumento completo mesmo assim'))
        : null,
      h('p', { class: 'muted' }, Instrument.closing),
      ta,
      h('div', { class: 'nav-row' },
        h('button', { onclick: () => go(t, { step: t.choice === 'peace' ? 0 : LAST_STEP }) }, '← Voltar'),
        h('button', { class: 'primary', onclick: () => {
          t.status = 'done';
          const following = nextPending(r, r.current);
          if (following < 0) go(r, { stage: 'summary' });
          else go(r, { current: following });
          toast('Pensamento trabalhado');
        } }, next < 0 || next === r.current ? 'Concluir e ver o resumo ✓' : 'Concluir e ir ao próximo ✓')));
  }

  function skipRow(r, t) {
    const next = nextPending(r, r.current);
    if (next < 0 || next === r.current) return null;
    return h('div', { class: 'skip-row' },
      h('button', { class: 'link', onclick: () => go(r, { current: next }) }, 'Pular este pensamento por enquanto →'));
  }

  // Summary of the reflection.
  function renderSummary(r) {
    const inc = included(r);
    const done = inc.filter((t) => t.status === 'done').length;
    const items = inc.map((t) => h('li', { class: 'summary-item' + (t.status === 'done' ? ' done' : '') },
      h('blockquote', { class: 'thought-quote' }, t.text),
      t.ws.D ? h('p', null, h('span', { class: 'k' }, 'Crença questionada: '), t.ws.D) : null,
      t.ws.E ? h('p', null, h('span', { class: 'k' }, 'Desejo liberado: '), t.ws.E) : null,
      t.ws.insights ? h('p', null, h('span', { class: 'k' }, 'Insights: '), t.ws.insights) : null,
      h('div', { class: 'row' },
        h('span', { class: 'muted small' }, t.status === 'done' ? (t.choice === 'peace' ? 'Paz escolhida' : 'Trabalhado') : 'Ainda não trabalhado'),
        h('button', { class: 'link', onclick: () => { if (t.status === 'done') t.step = INSIGHTS; go(r, { stage: 'work', current: r.thoughts.indexOf(t) }); } },
          t.status === 'done' ? 'Revisar' : 'Trabalhar'))));

    return h('div', { class: 'card' },
      h('div', { class: 'stage-row' },
        h('span', { class: 'stage-num' }, `${done} de ${inc.length} trabalhados`),
        h('button', { class: 'link danger-link', onclick: () => deleteReflection(r) }, 'Excluir reflexão')),
      h('h2', null, done === inc.length && inc.length ? 'A paz de espírito é uma decisão presente' : 'Resumo'),
      h('ol', { class: 'summary' }, items),
      h('div', { class: 'nav-row' },
        h('button', { onclick: () => go(r, { stage: 'thoughts' }) }, '← Pensamentos'),
        h('span', { class: 'row' },
          h('button', { onclick: () => appendSummaryToDiary(r) }, 'Adicionar resumo ao diário'),
          h('button', { class: 'primary', onclick: () => setView('diary') }, 'Voltar ao diário'))));
  }

  function appendSummaryToDiary(r) {
    const stamp = new Date().toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
    const lines = [`— Reflexão, ${stamp} —`];
    for (const t of included(r)) {
      lines.push(`• ${t.text}`);
      if (t.ws.D) lines.push(`  Crença questionada: ${t.ws.D}`);
      if (t.ws.E) lines.push(`  Desejo liberado: ${t.ws.E}`);
      if (t.ws.insights) lines.push(`  Insights: ${t.ws.insights.replace(/\n+/g, ' ')}`);
    }
    const ed = $('editor');
    ed.value = ed.value.replace(/\s*$/, '') + (ed.value.trim() ? '\n\n' : '') + lines.join('\n') + '\n';
    ed.dispatchEvent(new Event('input'));
    setView('diary');
    ed.scrollTop = ed.scrollHeight;
    toast('Resumo adicionado ao diário');
  }

  // ---------- wiring ----------

  function run(fn) {
    return () => Promise.resolve(fn()).catch((e) => { console.error(e); toast(e.message || String(e), 'error'); });
  }

  function init() {
    if (!window.crypto || !window.crypto.subtle) {
      document.body.replaceChildren(h('div', { class: 'card fatal' },
        h('h2', null, 'Esta página precisa ser servida por HTTPS'),
        h('p', null, 'Os navegadores só permitem criptografia em páginas seguras. Abra por https://, http://localhost ou como arquivo local.')));
      return;
    }

    loadPrefs();
    $('optBrowserCopy').checked = prefs.browserCopy;
    $('sourceLink').href = Instrument.source.url;
    $('homeLink').href = Instrument.source.home;

    $('editor').addEventListener('input', () => { state.doc.text = $('editor').value; markDirty(); });
    $('btnDate').addEventListener('click', insertDate);
    $('btnNew').addEventListener('click', run(newNotebook));
    $('btnOpen').addEventListener('click', run(openFile));
    $('btnSave').addEventListener('click', run(() => save(false)));
    $('btnSaveAs').addEventListener('click', run(() => save(true)));
    $('btnLock').addEventListener('click', run(lock));
    $('btnResume').addEventListener('click', run(resumeDraft));
    $('btnForget').addEventListener('click', run(async () => {
      const c = await choose('Esquecer a cópia do navegador?', 'A cópia criptografada guardada neste navegador será apagada. Os arquivos que você salvou não são afetados.', [
        { label: 'Cancelar', value: 'cancel' },
        { label: 'Esquecer', value: 'forget', danger: true },
      ]);
      if (c !== 'forget') return;
      forgetDraft();
      showBanner();
    }));
    $('btnNewReflection').addEventListener('click', () => newReflection(state.selection));
    document.querySelectorAll('.tabs [data-view]').forEach((tab) => tab.addEventListener('click', () => setView(tab.dataset.view)));

    // Language flags: refresh the encrypted browser copy first so the other page can unlock it.
    document.querySelectorAll('.lang a').forEach((a) => a.addEventListener('click', async (e) => {
      e.preventDefault();
      if (a.getAttribute('aria-current') === 'page') return;
      if (state.session && prefs.browserCopy) await writeDraft();
      location.href = a.href;
    }));
    renderReference('emotions', Lists.emotions);
    renderReference('beliefs', Lists.beliefs);

    $('optBrowserCopy').addEventListener('change', () => {
      prefs.browserCopy = $('optBrowserCopy').checked;
      savePrefs();
      if (prefs.browserCopy) {
        writeDraft();
        toast(state.session ? 'Cópia criptografada guardada neste navegador' : 'Uma cópia será guardada assim que o caderno tiver uma senha');
      } else {
        forgetDraft();
        $('banner').hidden = true;
        toast('Cópia do navegador removida');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); run(() => save(e.shiftKey))(); }
      else if (k === 'o') { e.preventDefault(); run(openFile)(); }
    });

    window.addEventListener('beforeunload', (e) => {
      const covered = state.session && prefs.browserCopy && !draftPending;
      if (state.dirty && !covered) { e.preventDefault(); e.returnValue = ''; }
    });

    refreshChrome();
    renderReflect();
    showBanner();
    $('editor').focus();
  }

  init();
})();
