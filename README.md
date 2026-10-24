# Encrypted Notebook

A private diary that is encrypted on your own device, with a guided way to work through
what you wrote using David Hoffmeister's **Instrument for Peace**.

- `web/`: the web app. It's a self-contained static site with no server code and no
  Python; deploy this folder.
- `tests/`: crypto tests, including two-way compatibility with notebooks made by the
  original Python desktop app (`encrypted_notebook.py`, not part of this repository).

## What the web app does

**Diary.** A list of dated entries, newest first. **+ New entry** starts one with today's date
and time at the top. Notebooks from before entries existed open as a single "Earlier notes"
entry. **Save** encrypts the whole notebook and writes a `.enc` file; **Open** decrypts one.
The eye button in the password box shows what you typed. The password is never stored or sent anywhere. The page's Content
Security Policy blocks all network requests, so nothing can leave the page.

- In Chrome/Edge, Save writes back to the same file. In Firefox, Safari and on phones,
  each Save downloads the encrypted file.
- *Keep an encrypted copy in this browser* (on by default) autosaves an encrypted copy to
  the browser's local storage, so closing the tab doesn't lose work. **Lock** clears the
  page, and **Unlock** brings the notebook back. Turn the option off on shared computers.
- The web app doesn't need Python. Old files from `encrypted_notebook.py` still open, and
  the next Save re-encrypts them in the stronger web format. After that, only the web app
  can open them.

**Instrument for Peace.** A three-stage guided process:

1. **Choose** a passage: the selected text, the latest entry, or the whole diary.
2. **Break it down** into one thought per card. The text is split by sentence, and you can
   merge, split, edit, remove or untick cards.
3. **Work through** each thought with the Instrument for Peace:
   - *Levels of Mind*: A (situation), B (feelings), C1/C2 (blame/fear), D (belief in lack)
     and E (desire). A diagram highlights the level you're answering. Then comes the
     question "Are you willing to offer this desire to the Holy Spirit now…?"
   - If you feel resistance, continue through the 12 steps of the Instrument. Your answers
     appear in red and can be edited in place, as on the original form.
   - *Insights*: write what you noticed, then move on to the next thought.

**Byron Katie's Worksheet.** A guided version of the Judge-Your-Neighbor Worksheet from
*The Work of Byron Katie*:

1. **The situation:** who it's with, and one specific time and place (it can be taken from
   the open diary entry).
2. **The six statements**, one screen each, in Katie's sentence frames with her examples.
   The app shows the sentence each answer will be questioned as.
3. **Inquiry:** each statement goes through the four questions. Answering "No" to "Is it
   true?" skips to question 3. Then come the turnarounds (to the self, to the other, to the
   opposite) with room for three examples each. Statement 6 gets "I am willing…" and "I look
   forward to…" pre-filled.

The summary can be added to the diary as a new entry. Worksheets are saved in the
encrypted notebook. The worksheet wording lives in `web/katie.js` and `web/pt-BR/katie.js`;
the Portuguese version uses the official *Formulário Julgue Seu Próximo*.

**Emotions** and **Beliefs** are reference lists to help put words to field B (grouped
upsetting emotions) and field D (common beliefs in lack about self, others and the world).
The Levels of Mind page links to both. The lists live in `web/lists.js` and
`web/pt-BR/lists.js`, so you can edit them freely.

The summary shows each thought with the belief questioned, the desire let go of, and your
insights. *Add summary to diary* appends it to your diary text. Reflections are saved
inside the encrypted notebook.

## Português (Brasil)

`web/pt-BR/` is the Brazilian Portuguese version. It's deployed with the English one, at
`https://<your-site>/pt-BR/`. The US and Brazil flags in the top bar switch between the two. Unsaved work carries over through the encrypted browser copy; unlock it on the other page.

- It uses the same encryption (`web/crypto.js`), stylesheet and file format, so a `.enc`
  file saved in one language opens in the other. New files are named
  `diario_do_perdao_YYYY-MM-DD.enc`.
- `pt-BR/app.js` is the English `app.js` with its interface text translated. If you change
  `web/app.js`, make the same change in `pt-BR/app.js`.
- I found no official Portuguese version of the Instrument for Peace, so the worksheet in
  `pt-BR/instrument.js` is an unofficial translation. "Upset" follows the Portuguese edition
  of *Um Curso em Milagres*, lesson 5 ("transtornado"). The ACIM quote (T-20.VIII.1.2) is
  my own translation, not the published Portuguese text. Have a Portuguese-speaking ACIM
  student check it before sharing it widely.

## Run it locally

Open `web/index.html` in a browser. Or serve the folder:

```
cd web
python -m http.server 8000      # then visit http://localhost:8000
```

## Deploy it on the internet

Browsers only allow the encryption API on HTTPS, which all of these hosts provide:

- **Netlify from GitHub:** Add new site → Import an existing project → GitHub → pick this repository. `netlify.toml` already sets the publish folder to `web` with no build command, so just click Deploy. Every push then redeploys automatically.
- **Netlify (no account setup beyond sign-in):** go to https://app.netlify.com/drop and drag
  the `web` folder onto the page. The `_headers` file adds security headers automatically.
- **Cloudflare Pages:** Create → Pages → *Upload assets* → upload the `web` folder. It also
  reads `_headers`.
- **GitHub Pages:** put the contents of `web/` in a repository, then open Settings → Pages →
  *Deploy from a branch*. GitHub Pages ignores `_headers`, but the CSP `<meta>` tag in
  `index.html` still applies.

**Security notes**

- If you forget the password, the notebook can't be recovered.
- Encryption: PBKDF2-SHA256 with 600,000 iterations and a random salt, then AES-256-GCM,
  all done in the browser through WebCrypto. Use a long password.
- A hosted web app is only as trustworthy as its host: whoever can change the deployed files
  could change the code. Deploy from an account you control, and keep your `.enc` files
  backed up somewhere else.
- The worksheet text belongs to David Hoffmeister / Living Miracles
  ([original PDF](https://livingmiraclescenter.org/doc/instrument-for-peace.pdf)). It's free
  for personal use. If you publish the app for other people, ask Living Miracles first.
- The Judge-Your-Neighbor Worksheet and its Portuguese edition are ©Byron Katie
  International, Inc., and "The Work of Byron Katie" is a registered trademark
  ([thework.com](https://thework.com/instruction-the-work-byron-katie/)). Katie offers the
  worksheet free to download. If you publish the app for other people, check their terms first.

## Tests

```
node tests/crypto.test.js
```

The test needs a Python with the `cryptography` package. Set `PYTHON` to its path if the
default `python` doesn't have it.
