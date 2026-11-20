// GTA VI trophy tracker: checklist saved in localStorage, with filters,
// a spoiler setting, export/import, a platinum roadmap and per-trophy guides.
// Data lives in data/trophies.json; this file only renders and tracks it.
const STORE_KEY = 'gta6-trophy-guide-earned-v1';
const SPOILER_KEY = 'gta6-trophy-guide-spoilers-v1';

const params = new URLSearchParams(location.search);
const demoMode = params.get('demo') === '1';
// Demo mode (for screenshots): a fixed sample of earned trophies, kept in
// memory only so a real player's saved progress is never touched.
const DEMO_EARNED = [1, 2, 3, 4, 5, 8, 14, 15, 17, 20, 33, 42, 52, 55];

const el = (id) => document.getElementById(id);
const listEl = el('trophyList');
const roadmapEl = el('roadmapList');

let data = null;
let earned = new Set();
let openGuide = null;

function loadSaved() {
  if (demoMode) return new Set(DEMO_EARNED);
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((n) => typeof n === 'number') : []);
  } catch {
    return new Set();
  }
}

function save() {
  if (demoMode) return;
  localStorage.setItem(STORE_KEY, JSON.stringify([...earned].sort((a, b) => a - b)));
}

function spoilersHidden() {
  if (params.get('spoilers') === 'off') return false;
  if (params.get('spoilers') === 'on') return true;
  const saved = localStorage.getItem(SPOILER_KEY);
  if (saved !== null) return saved === '1';
  return el('spoilers').checked;
}

function trophyHidden(t) {
  return t.spoiler && spoilersHidden() && !earned.has(t.id);
}

function gradeLabel(t) {
  return t.grade.charAt(0).toUpperCase() + t.grade.slice(1);
}

function sourceLink(key) {
  const s = data.sources[key];
  if (!s) return null;
  const a = document.createElement('a');
  a.href = s.url;
  a.textContent = s.name.split(' — ')[0];
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

function renderProgress() {
  const total = data.trophies.length;
  const n = earned.size;
  el('progressText').textContent = `${n} of ${total} earned`;
  el('progressPct').textContent = `${Math.round((n / total) * 100)}%`;
  el('progressFill').style.width = `${(n / total) * 100}%`;
  const byGrade = (g) => data.trophies.filter((t) => t.grade === g && earned.has(t.id)).length;
  const totals = (g) => data.trophies.filter((t) => t.grade === g).length;
  el('progressSub').textContent =
    `Platinum ${byGrade('platinum')}/${totals('platinum')} · Gold ${byGrade('gold')}/${totals('gold')} · ` +
    `Silver ${byGrade('silver')}/${totals('silver')} · Bronze ${byGrade('bronze')}/${totals('bronze')}`;
}

function matchesFilters(t) {
  const q = el('search').value.trim().toLowerCase();
  if (q) {
    const hay = `${t.name} ${t.description} ${t.guide} ${t.category}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (el('kind').value !== 'all' && t.kind !== el('kind').value) return false;
  if (el('grade').value !== 'all' && t.grade !== el('grade').value) return false;
  if (el('state').value === 'earned' && !earned.has(t.id)) return false;
  if (el('state').value === 'remaining' && earned.has(t.id)) return false;
  if (el('missableOnly').checked && !t.missable) return false;
  return true;
}

function renderList() {
  listEl.replaceChildren();
  const shown = data.trophies.filter(matchesFilters);
  el('countLine').textContent = `Showing ${shown.length} of ${data.trophies.length} trophies · ${earned.size} earned`;
  el('emptyNote').hidden = shown.length > 0;

  for (const t of shown) {
    const li = document.createElement('li');
    li.className = 'trophy' + (earned.has(t.id) ? ' earned' : '');
    const hidden = trophyHidden(t);

    const top = document.createElement('div');
    top.className = 'trophy-top';

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'trophy-check';
    box.checked = earned.has(t.id);
    box.setAttribute('aria-label', hidden ? `Mark hidden trophy ${t.id} as earned` : `Mark ${t.name} as earned`);
    box.addEventListener('change', () => {
      if (box.checked) earned.add(t.id);
      else earned.delete(t.id);
      save();
      renderAll();
    });
    top.append(box);

    const main = document.createElement('div');
    main.className = 'trophy-main';

    const name = document.createElement('h3');
    name.className = 'trophy-name';
    name.textContent = hidden ? `Hidden story trophy #${t.id}` : t.name;
    if (hidden) name.classList.add('hidden-name');
    const badge = document.createElement('span');
    badge.className = `grade-badge grade-${t.grade}`;
    badge.textContent = gradeLabel(t);
    name.append(badge);
    main.append(name);

    const desc = document.createElement('p');
    desc.className = 'trophy-desc';
    desc.textContent = hidden ? 'Hidden until earned — turn off “Hide story spoilers” to reveal it.' : t.description;
    main.append(desc);

    const tags = document.createElement('div');
    tags.className = 'trophy-tags';
    const tag = (text, cls) => {
      const s = document.createElement('span');
      s.className = 'tag' + (cls ? ` ${cls}` : '');
      s.textContent = text;
      tags.append(s);
    };
    if (!hidden) tag(t.category);
    if (t.missable) tag('⚠ Possibly missable', 'missable');
    if (t.spoiler) tag('Story spoiler', 'spoiler-tag');
    tag(`Roadmap stage ${t.stage}`);
    main.append(tags);

    if (!hidden) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'guide-toggle';
      const isOpen = openGuide === t.id;
      toggle.textContent = isOpen ? 'Hide guide ▲' : 'Show guide ▼';
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.addEventListener('click', () => {
        openGuide = isOpen ? null : t.id;
        renderList();
      });
      main.append(toggle);

      if (isOpen) {
        const guide = document.createElement('div');
        guide.className = 'guide';
        const h = document.createElement('h3');
        h.textContent = 'How to earn it';
        guide.append(h);
        const p = document.createElement('p');
        p.textContent = t.guide;
        guide.append(p);
        if (t.missable && t.missableNote) {
          const m = document.createElement('p');
          m.className = 'missable-note';
          m.textContent = `Missable warning: ${t.missableNote}`;
          guide.append(m);
        }
        const src = document.createElement('p');
        src.className = 'guide-sources';
        src.textContent = 'Sources consulted: ';
        for (const key of t.sources) {
          const link = sourceLink(key);
          if (link) src.append(link);
        }
        guide.append(src);
        main.append(guide);
      }
    }
    top.append(main);
    li.append(top);
    listEl.append(li);
  }
}

function renderRoadmap() {
  roadmapEl.replaceChildren();
  for (const stage of data.roadmap) {
    const li = document.createElement('li');
    li.className = 'roadmap-stage';
    const num = document.createElement('div');
    num.className = 'stage-num';
    num.textContent = String(stage.stage);
    li.append(num);
    const body = document.createElement('div');
    const h = document.createElement('h3');
    h.textContent = stage.title;
    body.append(h);
    const p = document.createElement('p');
    p.textContent = stage.text;
    body.append(p);
    const chips = document.createElement('div');
    chips.className = 'stage-trophies';
    for (const id of stage.trophies) {
      const t = data.trophies.find((x) => x.id === id);
      if (!t) continue;
      const s = document.createElement('span');
      s.className = 'tag' + (earned.has(id) ? ' done' : '');
      s.textContent = `${earned.has(id) ? '✓ ' : ''}${trophyHidden(t) ? `Hidden #${id}` : t.name}`;
      chips.append(s);
    }
    body.append(chips);
    li.append(body);
    roadmapEl.append(li);
  }
}

function renderSources() {
  const ul = el('sourceList');
  ul.replaceChildren();
  for (const s of Object.values(data.sources)) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = s.url;
    a.textContent = s.name;
    a.target = '_blank';
    a.rel = 'noopener';
    li.append(a);
    ul.append(li);
  }
}

function renderAll() {
  renderProgress();
  renderList();
  renderRoadmap();
}

function showView(view) {
  const roadmap = view === 'roadmap';
  el('roadmapView').hidden = !roadmap;
  el('trackerView').hidden = roadmap;
  el('viewRoadmap').classList.toggle('active', roadmap);
  el('viewTracker').classList.toggle('active', !roadmap);
  el('viewRoadmap').setAttribute('aria-pressed', String(roadmap));
  el('viewTracker').setAttribute('aria-pressed', String(!roadmap));
}

function exportProgress() {
  const blob = new Blob([JSON.stringify({ game: 'Grand Theft Auto VI', earned: [...earned].sort((a, b) => a - b) }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importProgress(file) {
  if (!file) return;
  const raw = JSON.parse(await file.text());
  const ids = Array.isArray(raw) ? raw : raw.earned;
  if (!Array.isArray(ids)) throw new Error('Not a progress file');
  const valid = new Set(data.trophies.map((t) => t.id));
  earned = new Set(ids.filter((n) => valid.has(n)));
  save();
  renderAll();
}

async function init() {
  data = await (await fetch('data/trophies.json')).json();
  earned = loadSaved();
  el('demoNote').hidden = !demoMode;
  if (params.get('spoilers')) el('spoilers').checked = spoilersHidden();
  // Deep links: a URL may pre-fill any filter, e.g. ?search=positive&open=28
  // opens one trophy's guide, and ?kind=story&spoilers=on shows masked story
  // trophies at the top of the list (used by the screenshots).
  for (const key of ['search', 'kind', 'grade', 'state']) {
    const value = params.get(key);
    if (value && el(key)) el(key).value = value;
  }
  if (params.get('missable') === '1') el('missableOnly').checked = true;
  el('spoilers').addEventListener('change', () => {
    localStorage.setItem(SPOILER_KEY, el('spoilers').checked ? '1' : '0');
    renderList();
  });
  for (const id of ['search', 'kind', 'grade', 'state', 'missableOnly']) {
    el(id).addEventListener('input', renderList);
    el(id).addEventListener('change', renderList);
  }
  el('viewTracker').addEventListener('click', () => showView('tracker'));
  el('viewRoadmap').addEventListener('click', () => showView('roadmap'));
  el('export').addEventListener('click', exportProgress);
  el('import').addEventListener('change', async (e) => {
    try { await importProgress(e.target.files[0]); }
    catch { alert('That file is not a trophy-progress export.'); }
    e.target.value = '';
  });
  el('reset').addEventListener('click', () => {
    if (confirm('Clear all earned trophies?')) {
      earned = new Set();
      save();
      renderAll();
    }
  });
  if (params.get('view') === 'roadmap') showView('roadmap');
  const open = Number(params.get('open'));
  if (open) openGuide = open;
  renderSources();
  renderAll();
}

init();
