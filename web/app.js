/*
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
  const FILE_TYPE = { description: 'Encrypted notebook', accept: { 'application/octet-stream': ['.enc'] } };
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
    entryId: null, // open diary entry
    activeId: null, // open reflection
    selection: '',
    gen: 0, // bumped whenever the loaded notebook changes, so stale async writes are dropped
  };

  let prefs = { browserCopy: true };
  let draftTimer = null;
  let draftPending = false;

  // version 3: the diary is a list of dated entries (version 2 had a single `text`).
  function emptyDoc() {
    return { app: 'encrypted-notebook', version: 3, entries: [], reflections: [] };
  }

  const newEntry = (text = '') => ({ id: uid(), created: new Date().toISOString(), text });
  // Text from older notebooks has no date of its own.
  const importedEntry = (text) => ({ id: uid(), created: null, text: text.replace(/\s+$/, '') });

  // New notebooks are named after the day they're saved, e.g. forgiveness_diary_2026-10-23.enc
  function fileLabel() {
    if (state.fileName) return state.fileName;
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `forgiveness_diary_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.enc`;
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

  // Eye button inside a password field: shows or hides what was typed.
  function setReveal(btn, show) {
    btn.previousElementSibling.type = show ? 'text' : 'password';
    btn.setAttribute('aria-pressed', String(show));
    const label = show ? 'Hide password' : 'Show password';
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }

  const hidePasswords = () => document.querySelectorAll('#pwDialog .reveal').forEach((btn) => setReveal(btn, false));

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
      hidePasswords();
      let result;

      async function onSubmit(e) {
        if (e.submitter && e.submitter.value === 'cancel') return;
        e.preventDefault();
        const pw = $('pwInput').value;
        if (!pw) return;
        if (confirm && pw !== $('pwConfirm').value) {
          $('pwError').textContent = 'The passwords don’t match.';
          return;
        }
        if (verify) {
          $('pwOk').disabled = true;
          $('pwError').textContent = 'Working…';
          try {
            result = await verify(pw);
          } catch (err) {
            $('pwError').textContent = err.message || String(err);
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
        hidePasswords();
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
          const entries = Array.isArray(d.entries) ? d.entries : String(d.text || '').trim() ? [importedEntry(String(d.text))] : [];
          return { ...emptyDoc(), entries, reflections: Array.isArray(d.reflections) ? d.reflections : [] };
        }
      } catch (e) { /* not ours: treat as plain text */ }
    }
    return { ...emptyDoc(), entries: plaintext.trim() ? [importedEntry(plaintext)] : [] };
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
    const newest = sortedEntries()[0];
    state.entryId = newest ? newest.id : null;
    renderDiary();
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
      s.textContent = 'Not encrypted yet — Save to set a password';
      s.className = 'crypto-status warn';
    } else {
      s.textContent = 'Encrypted · AES-256';
      s.className = 'crypto-status ok';
    }
    const entry = currentEntry();
    const words = ((entry ? entry.text : '').match(/\S+/g) || []).length;
    $('wordCount').textContent = words === 1 ? '1 word' : `${words} words`;
    document.title = (state.dirty ? '• ' : '') + fileLabel().replace(/\.enc$/, '') + ' — Encrypted Notebook';
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
    const when = new Date(d.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    $('bannerText').textContent = `An encrypted copy of “${d.name}” from ${when} is kept in this browser` +
      (d.dirty ? ' (it has changes not yet saved to a file).' : '.');
    $('banner').hidden = false;
  }

  async function resumeDraft() {
    const d = readDraft();
    if (!d) { showBanner(); return; }
    if (!(await okToDiscard({ ignoreDraft: true }))) return;
    const r = await askPassword({
      title: `Unlock ${d.name}`,
      message: 'Unlock the encrypted copy kept in this browser.',
      verify: (pw) => NBCrypto.unlock(d.file, pw),
    });
    if (!r) return;
    const { session, plaintext } = r.result;
    loadDoc(parseDoc(plaintext, 'v2'), { session, fileName: d.name, dirty: !!d.dirty });
    $('banner').hidden = true;
    toast('Notebook unlocked');
  }

  // ---------- files ----------

  async function okToDiscard({ ignoreDraft = false } = {}) {
    if (state.dirty) {
      const c = await choose('Unsaved changes', `Save the changes to “${fileLabel()}” first?`, [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Discard', value: 'discard', danger: true },
        { label: 'Save', value: 'save', primary: true },
      ]);
      if (c === 'save') return save(false);
      return c === 'discard';
    }
    const d = !ignoreDraft && !$('banner').hidden && readDraft();
    if (d && d.dirty) {
      const c = await choose('Replace the browser copy?',
        `The encrypted copy of “${d.name}” in this browser has changes that were never saved to a file. Continuing will replace it.`, [
          { label: 'Cancel', value: 'cancel' },
          { label: 'Replace it', value: 'go', danger: true },
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
      toast(`“${file.name}” isn’t an encrypted notebook file.`, 'error');
      return;
    }
    const r = await askPassword({ title: `Unlock ${file.name}`, verify: (pw) => NBCrypto.unlock(text, pw) });
    if (!r) return;
    const { session, plaintext, format } = r.result;
    // Older (Fernet) notebooks are re-saved in the stronger format; dirty so that happens on next save.
    session.format = 'v2';
    loadDoc(parseDoc(plaintext, format), { session, fileName: file.name, handle, dirty: format === 'fernet' });
    $('banner').hidden = true;
    writeDraft();
    toast(format === 'fernet' ? 'Older notebook opened — Save to upgrade its encryption' : 'Notebook unlocked');
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
        title: state.session ? 'Save as' : 'Set a password',
        message: 'This password encrypts the notebook. It cannot be recovered — without it the notebook can’t be opened.',
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
    toast('Encrypted and saved');
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
    toast('Locked');
  }

  // ---------- diary view ----------

  const currentEntry = () => state.doc.entries.find((e) => e.id === state.entryId) || null;
  // Newest first; undated (imported) text last.
  const sortedEntries = () => state.doc.entries.slice().sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  // All entries, oldest first, for "Use whole diary".
  const wholeDiary = () => sortedEntries().reverse().map((e) => e.text.trim()).filter(Boolean).join('\n\n');

  function entryDate(e, dateStyle = 'full') {
    return e.created ? new Date(e.created).toLocaleString(undefined, { dateStyle, timeStyle: 'short' }) : 'Earlier notes';
  }

  // A notebook always has an entry open, so there is somewhere to type.
  function ensureEntry() {
    if (!state.doc.entries.length) state.doc.entries.push(newEntry());
    if (!currentEntry()) state.entryId = sortedEntries()[0].id;
  }

  function renderDiary() {
    ensureEntry();
    const e = currentEntry();
    $('entryDate').textContent = entryDate(e);
    if ($('editor').value !== e.text) $('editor').value = e.text;
    renderEntryList();
    refreshChrome();
  }

  function renderEntryList() {
    $('entryList').replaceChildren(...sortedEntries().map((e) => {
      const first = e.text.trim().split('\n')[0];
      const preview = !first ? 'Empty entry' : first.length > 60 ? first.slice(0, 58).trimEnd() + '…' : first;
      return h('li', { class: e.id === state.entryId ? 'active' : null },
        h('button', { class: 'reflection-item', onclick: () => { state.entryId = e.id; renderDiary(); $('editor').focus(); } },
          h('span', { class: 'muted small' }, entryDate(e, 'medium')),
          h('span', { class: 'reflection-title' + (first ? '' : ' muted') }, preview)));
    }));
  }

  function addEntry() {
    const cur = currentEntry();
    if (cur && !cur.text.trim()) {
      cur.created = new Date().toISOString(); // reuse a blank entry instead of piling them up
    } else {
      const e = newEntry();
      state.doc.entries.push(e);
      state.entryId = e.id;
    }
    markDirty();
    setView('diary');
    renderDiary();
    $('editor').focus();
  }

  async function deleteEntry() {
    const e = currentEntry();
    if (!e) return;
    if (e.text.trim()) {
      const c = await choose('Delete this entry?', `The entry from ${entryDate(e)} will be removed from the notebook.`, [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Delete', value: 'delete', danger: true },
      ]);
      if (c !== 'delete') return;
    }
    state.doc.entries = state.doc.entries.filter((x) => x !== e);
    state.entryId = null;
    markDirty();
    renderDiary();
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
    const base = (r.thoughts[0] && r.thoughts[0].text) || r.source.trim() || 'New reflection';
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
      const date = new Date(r.created).toLocaleDateString(undefined, { dateStyle: 'medium' });
      return h('li', { class: r.id === state.activeId ? 'active' : null },
        h('button', { class: 'reflection-item', onclick: () => { state.activeId = r.id; renderReflect(); } },
          h('span', { class: 'reflection-title' }, reflectionTitle(r)),
          h('span', { class: 'muted small' }, inc.length ? `${date} · ${done}/${inc.length} worked through` : date)));
    }));
  }

  function renderWelcome() {
    return h('div', { class: 'card welcome' },
      h('h2', null, 'Work through your thoughts'),
      h('p', null, 'This guides you through looking at a diary entry, breaking it into individual thoughts, and bringing each thought through David Hoffmeister’s Instrument for Peace — tracing an upset back to the belief in the mind, so it can be released.'),
      h('ol', { class: 'how' },
        h('li', null, h('strong', null, 'Choose'), ' a passage from your diary.'),
        h('li', null, h('strong', null, 'Break it down'), ' into one thought per card.'),
        h('li', null, h('strong', null, 'Work through'), ' each thought: the Levels of Mind, then the twelve steps of the Instrument.'),
        h('li', null, h('strong', null, 'Review'), ' your insights. Everything is saved encrypted with your notebook.')),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => newReflection(state.selection) }, state.selection ? 'Start with the selected text' : 'Start a reflection')));
  }

  function stageHeader(r, n, title, text) {
    return [
      h('div', { class: 'stage-row' },
        h('span', { class: 'stage-num' }, `${n} / 3`),
        h('button', { class: 'link danger-link', onclick: () => deleteReflection(r) }, 'Delete reflection')),
      h('h2', null, title),
      text ? h('p', { class: 'muted' }, text) : null,
    ];
  }

  async function deleteReflection(r) {
    const c = await choose('Delete this reflection?', `“${reflectionTitle(r)}” and its worksheets will be removed from the notebook.`, [
      { label: 'Cancel', value: 'cancel' },
      { label: 'Delete', value: 'delete', danger: true },
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
    const ta = h('textarea', { class: 'source', placeholder: 'Paste or type the passage you want to look at…', value: r.source });
    const breakBtn = h('button', { class: 'primary', disabled: !r.source.trim() }, 'Break into thoughts →');
    ta.addEventListener('input', () => { r.source = ta.value; breakBtn.disabled = !ta.value.trim(); markDirty(); });
    const fill = (text) => { ta.value = text; ta.dispatchEvent(new Event('input')); };

    breakBtn.addEventListener('click', async () => {
      if (r.thoughts.some((t) => t.status === 'done' || t.step > 0)) {
        const c = await choose('Start the thoughts over?', 'Breaking the passage down again replaces the current thoughts and their worksheets.', [
          { label: 'Keep current thoughts', value: 'keep', primary: true },
          { label: 'Replace them', value: 'replace', danger: true },
        ]);
        if (c === 'keep') { go(r, { stage: 'thoughts' }); return; }
        if (c !== 'replace') return;
      }
      go(r, { stage: 'thoughts', thoughts: splitThoughts(r.source).map(newThought), current: 0 });
    });

    return h('div', { class: 'card' },
      stageHeader(r, 1, 'Choose what to look at', 'Pick an entry or a passage from your diary. Look at it gently, without judging it — the aim is only to see the thoughts clearly.'),
      h('div', { class: 'row' },
        h('button', { class: 'small', disabled: !state.selection, title: state.selection ? null : 'Select text in the Diary tab first', onclick: () => fill(state.selection) }, 'Use selected text'),
        h('button', { class: 'small', disabled: !(currentEntry() && currentEntry().text.trim()), onclick: () => fill(currentEntry().text.trim()) }, 'Use current entry'),
        h('button', { class: 'small', disabled: !wholeDiary(), onclick: () => fill(wholeDiary()) }, 'Use whole diary')),
      ta,
      h('div', { class: 'nav-row' }, h('span'), breakBtn));
  }

  // Stage 2: one thought per card.
  function renderThoughts(r) {
    const list = h('ol', { class: 'thoughts' });
    const begin = h('button', { class: 'primary' });
    const updateBegin = () => {
      const n = included(r).length;
      begin.textContent = n === 1 ? 'Work through 1 thought →' : `Work through ${n} thoughts →`;
      begin.disabled = n === 0;
    };

    const rerender = () => { markDirty(); $('reflectMain').replaceChildren(renderThoughts(r)); };

    r.thoughts.forEach((t, i) => {
      const ta = autoTextarea({ value: t.text, 'aria-label': `Thought ${i + 1}` }, (v) => { t.text = v; if (t.step === 0) t.ws.A = v; markDirty(); updateBegin(); });
      const check = h('input', { type: 'checkbox', checked: t.include, title: 'Work on this thought', 'aria-label': 'Work on this thought' });
      check.addEventListener('change', () => { t.include = check.checked; li.classList.toggle('excluded', !t.include); markDirty(); updateBegin(); });
      const li = h('li', { class: 'thought' + (t.include ? '' : ' excluded') + (t.status === 'done' ? ' done' : '') },
        h('label', { class: 'thought-check' }, check, h('span', { class: 'thought-num' }, i + 1)),
        ta,
        h('div', { class: 'thought-tools' },
          i > 0 ? h('button', { class: 'small', title: 'Merge with the thought above', onclick: () => {
            const prev = r.thoughts[i - 1];
            prev.text = `${prev.text} ${t.text}`.trim();
            if (prev.step === 0) prev.ws.A = prev.text;
            r.thoughts.splice(i, 1);
            rerender();
          } }, 'Merge ↑') : null,
          h('button', { class: 'small', title: 'Split at the cursor', onclick: () => {
            const at = ta.selectionStart;
            const a = t.text.slice(0, at).trim();
            const b = t.text.slice(at).trim();
            if (!a || !b) { toast('Place the cursor inside the thought where it should split.'); return; }
            t.text = a;
            if (t.step === 0) t.ws.A = a;
            r.thoughts.splice(i + 1, 0, newThought(b));
            rerender();
          } }, 'Split'),
          h('button', { class: 'small', title: 'Remove', onclick: () => { r.thoughts.splice(i, 1); rerender(); } }, 'Remove')));
      list.append(li);
    });

    updateBegin();
    begin.addEventListener('click', () => {
      const first = r.thoughts.findIndex((t) => t.include && t.text.trim() && t.status !== 'done');
      if (first < 0) { go(r, { stage: 'summary' }); return; }
      go(r, { stage: 'work', current: first });
    });

    return h('div', { class: 'card' },
      stageHeader(r, 2, 'Break it into individual thoughts',
        'Each card should hold one thought. Edit, merge, split or remove cards until it reads true. Untick any you don’t want to work on now.'),
      r.thoughts.length ? list : h('p', { class: 'muted' }, 'No thoughts yet.'),
      h('button', { class: 'small', onclick: () => { r.thoughts.push(newThought('')); rerender(); } }, '+ Add a thought'),
      h('div', { class: 'nav-row' },
        h('button', { onclick: () => go(r, { stage: 'source' }) }, '← Back'),
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
        title: `Thought ${k + 1}${x.status === 'done' ? ' (worked through)' : ''}`,
        'aria-label': `Thought ${k + 1}`,
        onclick: () => go(r, { current: r.thoughts.indexOf(x) }),
      })));

    const head = h('div', { class: 'work-head' },
      h('div', { class: 'stage-row' },
        h('span', { class: 'stage-num' }, `3 / 3 · Thought ${pos} of ${inc.length}`),
        h('span', { class: 'row' },
          h('button', { class: 'link', onclick: () => go(r, { stage: 'thoughts' }) }, 'Edit thoughts'),
          h('button', { class: 'link', onclick: () => go(r, { stage: 'summary' }) }, 'Summary'))),
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
    const labels = ['Levels of Mind', ...Instrument.steps.map((_, i) => String(i + 1)), 'Insights'];
    return h('div', { class: 'stepper', 'aria-label': 'Worksheet progress' }, labels.map((label, i) =>
      h('button', {
        class: 'step-pip' + (i === t.step ? ' current' : '') + (i < t.step ? ' past' : '') + (i === 0 || i === INSIGHTS ? ' wide' : ''),
        title: i === 0 ? 'Levels of Mind' : i === INSIGHTS ? 'Insights' : `Step ${i}`,
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
        h('summary', null, 'About the Instrument for Peace'),
        h('p', null, Instrument.intro)),
      h('h3', null, 'Levels of Mind'),
      h('p', { class: 'muted' }, 'What is your upset right now? Answer from the thought above. A is filled in from the thought — adjust it to the situation, past or future, that it is about.'),
      h('p', { class: 'muted small' }, 'Need words for B or D? See the ',
        h('button', { class: 'link', onclick: () => setView('emotions') }, 'Emotions'), ' and ',
        h('button', { class: 'link', onclick: () => setView('beliefs') }, 'Beliefs'), ' tabs.'),
      h('div', { class: 'levels-grid' },
        h('div', { class: 'fields' }, fields),
        h('figure', { class: 'diagram' }, diagram, h('figcaption', { class: 'muted small' }, Instrument.levels.quote))),
      h('p', { class: 'desire' }, Instrument.levels.desire),
      h('p', { class: 'question' }, Instrument.levels.question),
      h('div', { class: 'choice-row' },
        h('button', { class: 'primary', onclick: () => go(t, { choice: 'peace', step: INSIGHTS }) }, 'Yes — I accept peace now'),
        h('button', { onclick: () => go(t, { choice: 'continue', step: 1 }) }, 'I feel resistance — continue with the Instrument')),
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
    const svg = el('svg', { viewBox: '0 0 320 320', class: 'levels', role: 'img', 'aria-label': 'Levels of Mind: perception, emotion, thought, belief, and at the centre desire or prayer' });
    const rings = [['perception', 'Perception', 154], ['emotion', 'Emotion', 124], ['thought', 'Thought', 94], ['belief', 'Belief', 64], ['desire', '', 36]];
    for (const [level, label, radius] of rings) {
      const g = el('g', { 'data-level': level });
      g.append(el('circle', { cx: 160, cy: 160, r: radius, class: `ring ring-${level}` }));
      if (label) g.append(el('text', { x: 160, y: 160 - radius + 19, class: 'ring-label' }, label));
      svg.append(g);
    }
    const centre = svg.lastChild;
    centre.append(el('text', { x: 160, y: 157, class: 'ring-label small' }, 'Desire'));
    centre.append(el('text', { x: 160, y: 171, class: 'ring-label small' }, 'or Prayer'));
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
      'data-placeholder': f.optional ? `(${key} — optional)` : `(${key})`,
      'aria-label': `${key}: ${f.label}`,
      title: `${key}: ${f.hint} — click to fine-tune`,
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
      h('h3', null, `Step ${n} of ${LAST_STEP}`),
      h('div', { class: 'ws-body' }, Instrument.steps[n - 1].map((line) => renderLine(t, line))),
      n === 1 ? h('p', { class: 'muted small' }, 'The red text is your own answers — click any of it to fine-tune. Read each step slowly; let it be a willingness rather than a performance.') : null,
      h('div', { class: 'nav-row' },
        h('button', { onclick: () => go(t, { step: n - 1 }) }, '← Back'),
        h('button', { class: 'primary', onclick: () => go(t, { step: n + 1 }) }, n === LAST_STEP ? 'Insights →' : 'Next →')),
      skipRow(r, t));
  }

  function renderInsights(r, t) {
    const ta = autoTextarea({ class: 'insights', value: t.ws.insights, placeholder: 'What did you notice? What is seen differently now?' }, (v) => { t.ws.insights = v; markDirty(); });
    const next = nextPending(r, r.current);
    return h('div', null,
      h('h3', null, 'Insights'),
      t.choice === 'peace'
        ? h('p', { class: 'note' }, 'You chose peace at the Levels of Mind. ',
          h('button', { class: 'link', onclick: () => go(t, { step: 1 }) }, 'Walk through the full Instrument anyway'))
        : null,
      h('p', { class: 'muted' }, Instrument.closing),
      ta,
      h('div', { class: 'nav-row' },
        h('button', { onclick: () => go(t, { step: t.choice === 'peace' ? 0 : LAST_STEP }) }, '← Back'),
        h('button', { class: 'primary', onclick: () => {
          t.status = 'done';
          const following = nextPending(r, r.current);
          if (following < 0) go(r, { stage: 'summary' });
          else go(r, { current: following });
          toast('Thought worked through');
        } }, next < 0 || next === r.current ? 'Complete & see summary ✓' : 'Complete & next thought ✓')));
  }

  function skipRow(r, t) {
    const next = nextPending(r, r.current);
    if (next < 0 || next === r.current) return null;
    return h('div', { class: 'skip-row' },
      h('button', { class: 'link', onclick: () => go(r, { current: next }) }, 'Skip this thought for now →'));
  }

  // Summary of the reflection.
  function renderSummary(r) {
    const inc = included(r);
    const done = inc.filter((t) => t.status === 'done').length;
    const items = inc.map((t) => h('li', { class: 'summary-item' + (t.status === 'done' ? ' done' : '') },
      h('blockquote', { class: 'thought-quote' }, t.text),
      t.ws.D ? h('p', null, h('span', { class: 'k' }, 'Belief questioned: '), t.ws.D) : null,
      t.ws.E ? h('p', null, h('span', { class: 'k' }, 'Desire let go of: '), t.ws.E) : null,
      t.ws.insights ? h('p', null, h('span', { class: 'k' }, 'Insights: '), t.ws.insights) : null,
      h('div', { class: 'row' },
        h('span', { class: 'muted small' }, t.status === 'done' ? (t.choice === 'peace' ? 'Peace chosen' : 'Worked through') : 'Not yet worked through'),
        h('button', { class: 'link', onclick: () => { if (t.status === 'done') t.step = INSIGHTS; go(r, { stage: 'work', current: r.thoughts.indexOf(t) }); } },
          t.status === 'done' ? 'Review' : 'Work through'))));

    return h('div', { class: 'card' },
      h('div', { class: 'stage-row' },
        h('span', { class: 'stage-num' }, `${done} of ${inc.length} worked through`),
        h('button', { class: 'link danger-link', onclick: () => deleteReflection(r) }, 'Delete reflection')),
      h('h2', null, done === inc.length && inc.length ? 'Peace of mind is a present decision' : 'Summary'),
      h('ol', { class: 'summary' }, items),
      h('div', { class: 'nav-row' },
        h('button', { onclick: () => go(r, { stage: 'thoughts' }) }, '← Thoughts'),
        h('span', { class: 'row' },
          h('button', { onclick: () => appendSummaryToDiary(r) }, 'Add summary to diary'),
          h('button', { class: 'primary', onclick: () => setView('diary') }, 'Back to diary'))));
  }

  // The summary becomes a new dated diary entry.
  function appendSummaryToDiary(r) {
    const lines = ['Reflection summary'];
    for (const t of included(r)) {
      lines.push(`• ${t.text}`);
      if (t.ws.D) lines.push(`  Belief questioned: ${t.ws.D}`);
      if (t.ws.E) lines.push(`  Desire let go of: ${t.ws.E}`);
      if (t.ws.insights) lines.push(`  Insights: ${t.ws.insights.replace(/\n+/g, ' ')}`);
    }
    const e = newEntry(lines.join('\n') + '\n');
    state.doc.entries.push(e);
    state.entryId = e.id;
    markDirty();
    setView('diary');
    renderDiary();
    toast('Summary added to the diary');
  }

  // ---------- wiring ----------

  function run(fn) {
    return () => Promise.resolve(fn()).catch((e) => { console.error(e); toast(e.message || String(e), 'error'); });
  }

  function init() {
    if (!window.crypto || !window.crypto.subtle) {
      document.body.replaceChildren(h('div', { class: 'card fatal' },
        h('h2', null, 'This page must be served over HTTPS'),
        h('p', null, 'Browsers only allow encryption on secure pages. Open it via https://, http://localhost, or as a local file.')));
      return;
    }

    loadPrefs();
    $('optBrowserCopy').checked = prefs.browserCopy;
    $('sourceLink').href = Instrument.source.url;
    $('homeLink').href = Instrument.source.home;

    $('editor').addEventListener('input', () => { currentEntry().text = $('editor').value; markDirty(); renderEntryList(); });
    $('btnNewEntry').addEventListener('click', addEntry);
    $('btnDeleteEntry').addEventListener('click', run(deleteEntry));
    document.querySelectorAll('#pwDialog .reveal').forEach((btn) => btn.addEventListener('click', () => setReveal(btn, btn.getAttribute('aria-pressed') !== 'true')));
    $('btnNew').addEventListener('click', run(newNotebook));
    $('btnOpen').addEventListener('click', run(openFile));
    $('btnSave').addEventListener('click', run(() => save(false)));
    $('btnSaveAs').addEventListener('click', run(() => save(true)));
    $('btnLock').addEventListener('click', run(lock));
    $('btnResume').addEventListener('click', run(resumeDraft));
    $('btnForget').addEventListener('click', run(async () => {
      const c = await choose('Forget the browser copy?', 'The encrypted copy kept in this browser will be deleted. Files you saved are not affected.', [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Forget it', value: 'forget', danger: true },
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
        toast(state.session ? 'Encrypted copy kept in this browser' : 'A copy will be kept once the notebook has a password');
      } else {
        forgetDraft();
        $('banner').hidden = true;
        toast('Browser copy removed');
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

    renderDiary();
    renderReflect();
    showBanner();
    $('editor').focus();
  }

  init();
})();
