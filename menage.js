// The Muse Lab — Suivi du jour
// Une seule page : ménage, heures, réassort et transmission, enregistrés d'un coup avec « Enregistrer le suivi ».
// Données partagées via Supabase (tables menage_items, menage_checks, menage_heures, menage_achats, menage_notes).

// Email prévenu quand un produit manque.
// Envoi via FormSubmit (formsubmit.co, gratuit, sans serveur) : au tout premier envoi, FormSubmit envoie
// un email « Activate Form » à cette adresse ; tant que le lien n'est pas cliqué, aucun email n'est transmis.
const NOTIFY_EMAIL = 'team@themuselab.fr';
const NOTIFY_ENDPOINT = `https://formsubmit.co/ajax/${NOTIFY_EMAIL}`;

// Personnes qui font le ménage. Les noms déjà présents dans l'historique restent affichés dans les récapitulatifs.
const PEOPLE = ['Kalie', 'Valériane', 'Maryse'];
const STUDIOS = ['78', '92'];
const REFRESH_MS = 30000;
const MAX_HOURS = 12;

// Les éléments de réassort sont stockés dans menage_items avec list = 'checklist'
const LIST_MENAGE = 'menage';
const LIST_RESTOCK = 'checklist';

// ---------- Dates (AAAA-MM-JJ, heure locale) ----------
function toKey(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}
function addDays(key, n) {
    const d = fromKey(key);
    d.setDate(d.getDate() + n);
    return toKey(d);
}
const today = () => toKey(new Date());
function monthRange(month) {
    const [y, m] = month.split('-').map(Number);
    return [`${month}-01`, toKey(new Date(y, m, 0))];
}

// ---------- Mémoire locale (préférences de l'appareil uniquement) ----------
function stored(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function store(key, value) {
    try { localStorage.setItem(key, value); } catch { /* navigation privée */ }
}

const savedPerson = stored('ml_person', '') || stored('ml_who', '');

const state = {
    view: 'suivi',
    studio: stored('ml_studio', '78'),
    person: PEOPLE.includes(savedPerson) ? savedPerson : '',
    day: today(),
    month: today().slice(0, 7),
    editing: false,
    loaded: false,
    notesReady: true,
    heuresReady: true,
    // Données enregistrées
    items: [],
    checks: [],
    hoursDay: [],
    notes: [],
    achats: [],
    monthChecks: [],
    monthNotes: [],
    heuresMonth: [],
    lastMenage: null,
    // Saisie en cours (non enregistrée)
    draft: { checked: new Set(), hours: 0, needs: [], bought: new Set(), note: '' },
    save: { kind: '', text: '' },
};

// ---------- Éléments ----------
const $ = (id) => document.getElementById(id);
const toastEl = $('toast');

// ---------- Utilitaires ----------
function formatHours(h) {
    const minutes = Math.round(Number(h) * 60);
    const rest = minutes % 60;
    return `${Math.floor(minutes / 60)}h${rest ? String(rest).padStart(2, '0') : ''}`;
}
function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function formatDay(key, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
    return fromKey(key).toLocaleDateString('fr-FR', opts);
}
function shortDay(key) {
    return formatDay(key, { weekday: 'short', day: 'numeric', month: 'short' });
}
function relativeDay(key) {
    const t = today();
    if (key === t) return "Aujourd'hui";
    if (key === addDays(t, -1)) return 'Hier';
    if (key === addDays(t, 1)) return 'Demain';
    return '';
}
const norm = (s) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// « Réassort eau » -> « Eau »
function productName(label) {
    const name = label.replace(/^r[ée]assort\s*/i, '').trim() || label;
    return name.charAt(0).toUpperCase() + name.slice(1);
}

let toastTimer;
function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

const ICONS = {
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
    up: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg>',
    down: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
    pen: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

function iconBtn(icon, title, onClick, extraClass = '') {
    const b = el('button', `icon-btn ${extraClass}`.trim());
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = ICONS[icon];
    b.addEventListener('click', onClick);
    return b;
}

// 42P01 / PGRST205 = table inexistante
function isMissingTable(error) {
    return Boolean(error) && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || ''));
}
// Supabase renvoie { data, error } : on transforme l'erreur en exception
async function must(request) {
    const { data, error } = await request;
    if (error) throw error;
    return data;
}

// ---------- Listes ----------
const menageItems = () => state.items.filter((i) => i.list === LIST_MENAGE);
const restockItems = () => state.items.filter((i) => i.list === LIST_RESTOCK);
const isFuture = () => state.day > today();
const pendingAchats = () => state.achats.filter((a) => !a.fait);
const personHours = () => state.hoursDay
    .filter((h) => h.person === state.person)
    .reduce((sum, h) => sum + Number(h.hours), 0);

// Les éléments « Réassort … » qui avaient été rangés dans la liste ménage retrouvent la liste réassort.
async function separateRestock(items) {
    const misplaced = items.filter((i) => i.list === LIST_MENAGE && /^r[ée]assort/i.test(i.label));
    if (!misplaced.length) return;
    let position = Math.max(0, ...items.filter((i) => i.list === LIST_RESTOCK).map((i) => i.position));
    for (const item of misplaced) {
        position += 1;
        const { error } = await supabase.from('menage_items').update({ list: LIST_RESTOCK, position }).eq('id', item.id);
        if (!error) {
            item.list = LIST_RESTOCK;
            item.position = position;
        }
    }
}

// ---------- Chargement ----------
async function loadOptional(request, flag) {
    const { data, error } = await request;
    if (error) {
        if (isMissingTable(error)) {
            state[flag] = false;
            return [];
        }
        throw error;
    }
    state[flag] = true;
    return data;
}

async function loadDay() {
    const [items, checks, achats, hoursDay, notes] = await Promise.all([
        must(supabase.from('menage_items').select('*').order('position').order('id')),
        must(supabase.from('menage_checks').select('*').eq('day', state.day).eq('studio', state.studio)),
        must(supabase.from('menage_achats').select('*').order('created_at', { ascending: false }).limit(100)),
        loadOptional(supabase.from('menage_heures').select('*').eq('day', state.day).eq('studio', state.studio).order('created_at'), 'heuresReady'),
        loadOptional(supabase.from('menage_notes').select('*').eq('studio', state.studio).lte('day', state.day)
            .order('day', { ascending: false }).order('created_at', { ascending: false }).limit(6), 'notesReady'),
    ]);
    await separateRestock(items);
    state.items = items.sort((a, b) => a.position - b.position || a.id - b.id);
    state.checks = checks;
    state.achats = achats;
    state.hoursDay = hoursDay;
    state.notes = notes;
}

async function loadMonth() {
    const [start, end] = monthRange(state.month);
    const ids = menageItems().map((i) => i.id);
    const [checks, notes, heures, last] = await Promise.all([
        must(supabase.from('menage_checks').select('item_id, day').eq('studio', state.studio).gte('day', start).lte('day', end)),
        state.notesReady ? loadOptional(supabase.from('menage_notes').select('day').eq('studio', state.studio).gte('day', start).lte('day', end), 'notesReady') : [],
        state.heuresReady ? loadOptional(supabase.from('menage_heures').select('day, studio, person, hours').gte('day', start).lte('day', end), 'heuresReady') : [],
        ids.length
            ? must(supabase.from('menage_checks').select('day').eq('studio', state.studio).in('item_id', ids).lte('day', today()).order('day', { ascending: false }).limit(1))
            : [],
    ]);
    state.monthChecks = checks;
    state.monthNotes = notes;
    state.heuresMonth = heures;
    state.lastMenage = last[0] ? last[0].day : null;
}

function resetDraft() {
    state.draft = {
        checked: new Set(state.checks.map((c) => c.item_id)),
        hours: personHours(),
        needs: [],
        bought: new Set(),
        note: '',
    };
    $('noteInput').value = '';
}

async function loadAll({ keepDraft = false } = {}) {
    try {
        await loadDay();
        if (state.view === 'calendrier') await loadMonth();
        $('setupNotice').hidden = true;
        state.loaded = true;
        if (!keepDraft) resetDraft();
        render();
    } catch (error) {
        console.error(error);
        $('setupNotice').hidden = false;
        setStatus('error', 'Connexion à la base impossible. Vérifiez internet puis rechargez la page.');
    }
}

// ---------- Brouillon ----------
function draftChanges() {
    const d = state.draft;
    const saved = new Set(state.checks.map((c) => c.item_id));
    const added = [...d.checked].filter((id) => !saved.has(id));
    const removed = state.checks.filter((c) => !d.checked.has(c.item_id));
    return {
        added,
        removed,
        hours: state.heuresReady && state.person && d.hours !== personHours(),
        needs: d.needs.length,
        bought: d.bought.size,
        note: d.note.trim().length > 0,
    };
}
function isDirty() {
    const c = draftChanges();
    return c.added.length > 0 || c.removed.length > 0 || c.hours || c.needs > 0 || c.bought > 0 || c.note;
}
function confirmLeave() {
    return !isDirty() || confirm('Le suivi n’est pas enregistré. Abandonner ces modifications ?');
}

// ---------- Statut d'enregistrement ----------
function setStatus(kind, text) {
    state.save = { kind, text };
    renderSaveBar();
}

function renderSaveBar() {
    const bar = $('saveBar');
    bar.hidden = state.view !== 'suivi';
    const statusEl = $('saveStatus');
    const btn = $('saveBtn');
    const dirty = state.loaded && isDirty();

    let { kind, text } = state.save;
    if (kind !== 'saving' && kind !== 'error' && dirty) {
        kind = 'dirty';
        text = '● Pas encore enregistré : appuyez sur « Enregistrer le suivi ».';
    }
    statusEl.className = `save-status${kind ? ` is-${kind}` : ''}`;
    statusEl.textContent = text;

    if (!state.loaded) {
        btn.disabled = true;
        btn.textContent = kind === 'error' ? 'Enregistrement impossible' : 'Chargement…';
    } else if (kind === 'saving') {
        btn.disabled = true;
        btn.textContent = 'Enregistrement…';
    } else {
        const hasData = state.checks.length || state.hoursDay.length || state.notes.some((n) => n.day === state.day);
        btn.disabled = !dirty;
        btn.textContent = dirty ? 'Enregistrer le suivi' : hasData ? '✓ Suivi enregistré pour ce jour' : 'Rien à enregistrer';
    }
}

// ---------- Rendu ----------
function render() {
    const inCalendar = state.view === 'calendrier';
    $('suiviView').hidden = inCalendar;
    $('calendarView').hidden = !inCalendar;
    $('viewTitle').textContent = inCalendar ? 'calendrier.' : 'suivi du jour.';
    $('viewToggleLabel').textContent = inCalendar ? 'Suivi du jour' : 'Calendrier';
    $('dateRow').hidden = inCalendar;
    $('personRow').hidden = inCalendar;

    document.querySelectorAll('#studioSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.studio === state.studio)));
    renderPeople();
    $('dayLabel').textContent = formatDay(state.day);
    $('dayTag').textContent = relativeDay(state.day) || "Revenir à aujourd'hui";
    $('todayBtn').disabled = state.day === today();

    if (inCalendar) {
        renderCalendar();
    } else {
        const future = isFuture();
        $('futureNotice').hidden = !future;
        ['blockMenage', 'blockHeures', 'blockReassort'].forEach((id) => $(id).classList.toggle('locked', future && !state.editing));
        renderMenage();
        renderHeures();
        renderReassort();
        renderNotes();
        $('editToggle').textContent = state.editing ? 'Terminer la modification des listes' : 'Modifier les listes';
        $('editHint').hidden = !state.editing;
    }
    renderSaveBar();
}

function renderPeople() {
    const seg = $('personSeg');
    seg.replaceChildren();
    PEOPLE.forEach((name) => {
        const b = el('button', '', name);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(name === state.person));
        b.addEventListener('click', () => choosePerson(name));
        seg.append(b);
    });
}

function renderMenage() {
    const list = $('menageList');
    list.replaceChildren();
    const items = menageItems();
    const savedChecks = new Map(state.checks.map((c) => [c.item_id, c]));
    const done = items.filter((i) => state.draft.checked.has(i.id)).length;
    $('menageCount').textContent = `${done} / ${items.length}`;
    $('allDone').hidden = state.editing || !items.length;
    $('allDone').textContent = done === items.length ? 'Tout décocher' : 'Tout est fait';
    $('addMenageForm').hidden = !state.editing;

    if (!items.length) list.append(el('li', 'empty', 'Aucune étape. Utilisez « Modifier les listes » pour en ajouter.'));
    items.forEach((item, index) => list.append(state.editing ? editRow(item, index, items) : taskRow(item, savedChecks.get(item.id))));
}

function taskRow(item, saved) {
    const li = el('li');
    const checked = state.draft.checked.has(item.id);
    const b = el('button', `task${checked ? ' done' : ''}`);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(checked));
    const tick = el('span', 'tick');
    tick.innerHTML = ICONS.check;
    const body = el('span', 'task-body');
    body.append(el('span', 'task-label', item.label));
    if (saved && checked) {
        body.append(el('span', 'task-meta', `Fait${saved.done_by ? ` par ${saved.done_by}` : ''} à ${formatTime(saved.done_at)}`));
    } else if (checked !== Boolean(saved)) {
        body.append(el('span', 'changed', checked ? 'à enregistrer' : 'sera décoché à l’enregistrement'));
    }
    b.append(tick, body);
    b.addEventListener('click', () => toggleChecked(item.id));
    li.append(b);
    return li;
}

function editRow(item, index, items) {
    const li = el('li', 'edit-row');
    const label = el('span', 'task-label', item.list === LIST_RESTOCK ? productName(item.label) : item.label);
    const up = iconBtn('up', 'Monter', () => moveItem(items, index, -1));
    const down = iconBtn('down', 'Descendre', () => moveItem(items, index, 1));
    up.disabled = index === 0;
    down.disabled = index === items.length - 1;
    li.append(label, iconBtn('pen', 'Renommer', () => startRename(li, item)), up, down,
        iconBtn('trash', 'Supprimer', () => deleteItem(item), 'danger'));
    return li;
}

function renderHeures() {
    const ready = state.heuresReady;
    $('heuresNotice').hidden = ready;
    $('hoursStepper').hidden = !ready;
    $('hoursQuick').hidden = !ready;
    const d = state.draft;
    $('hoursWho').textContent = state.person ? state.person : 'Choisissez qui vous êtes en haut';
    $('hoursValue').textContent = formatHours(d.hours);
    $('hoursMinus').disabled = d.hours <= 0;
    $('hoursPlus').disabled = d.hours >= MAX_HOURS;
    document.querySelectorAll('#hoursQuick .chip').forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.h) === d.hours)));

    const parts = [];
    const saved = personHours();
    if (state.person && saved && saved !== d.hours) parts.push(`Déjà enregistré : ${formatHours(saved)}.`);
    const others = {};
    state.hoursDay.filter((h) => h.person !== state.person).forEach((h) => { others[h.person] = (others[h.person] || 0) + Number(h.hours); });
    const list = Object.entries(others).map(([name, h]) => `${name} ${formatHours(h)}`);
    if (list.length) parts.push(`Aussi ce jour au ${state.studio} : ${list.join(' · ')}`);
    $('hoursOthers').textContent = parts.join(' ');
}

function renderReassort() {
    const list = $('restockList');
    list.replaceChildren();
    const items = restockItems();
    const pendingNames = new Set(pendingAchats().filter((a) => a.studio === state.studio).map((a) => norm(a.article)));
    const draftNames = new Set(state.draft.needs.map(norm));
    const savedChecks = new Map(state.checks.map((c) => [c.item_id, c]));
    $('addRestockForm').hidden = !state.editing;
    $('needForm').hidden = state.editing;

    if (!items.length && !state.editing) list.append(el('li', 'empty', 'Aucun produit suivi. « Modifier les listes » pour en ajouter.'));
    items.forEach((item, index) => {
        if (state.editing) {
            list.append(editRow(item, index, items));
            return;
        }
        const name = productName(item.label);
        const li = el('li', 'restock');
        const title = el('span', 'restock-name', name);
        const saved = savedChecks.get(item.id);
        if (saved && state.draft.checked.has(item.id)) {
            title.append(el('span', 'restock-meta', `remis${saved.done_by ? ` par ${saved.done_by}` : ''}`));
        }

        const okBtn = el('button', 'pill-btn ok', state.draft.checked.has(item.id) ? '✓ Remis' : 'Remis');
        okBtn.type = 'button';
        okBtn.setAttribute('aria-pressed', String(state.draft.checked.has(item.id)));
        okBtn.addEventListener('click', () => toggleChecked(item.id));

        const key = norm(name);
        const already = pendingNames.has(key);
        const drafted = draftNames.has(key);
        const needBtn = el('button', `pill-btn need${already ? ' already' : ''}`, already ? 'Signalé' : drafted ? '! Manque' : 'Manque');
        needBtn.type = 'button';
        needBtn.disabled = already;
        needBtn.setAttribute('aria-pressed', String(drafted));
        if (already) needBtn.title = 'Déjà dans la liste « À acheter »';
        needBtn.addEventListener('click', () => toggleNeed(name));

        li.append(title, okBtn, needBtn);
        list.append(li);
    });

    // À acheter : besoins déjà enregistrés (tous studios) + besoins en cours de saisie
    const pending = pendingAchats().sort((a, b) => (a.studio === state.studio ? -1 : 0) - (b.studio === state.studio ? -1 : 0));
    const pendingList = $('pendingList');
    pendingList.replaceChildren();
    state.draft.needs.forEach((article) => {
        const li = el('li', 'pending-item draft');
        const text = el('span', 'pending-text', article);
        text.append(el('small', '', `Studio ${state.studio} · à enregistrer`));
        li.append(text, iconBtn('close', 'Retirer', () => toggleNeed(article)));
        pendingList.append(li);
    });
    pending.forEach((a) => {
        const bought = state.draft.bought.has(a.id);
        const li = el('li', `pending-item${bought ? ' bought' : ''}`);
        const text = el('span', 'pending-text', `${a.article}${a.quantite ? ` · ${a.quantite}` : ''}`);
        text.append(el('small', '', `Studio ${a.studio} · ${shortDay(toKey(new Date(a.created_at)))}${a.demande_par ? ` · ${a.demande_par}` : ''}`));
        const btn = el('button', 'pill-btn ok', bought ? '✓ Acheté' : 'Acheté');
        btn.type = 'button';
        btn.setAttribute('aria-pressed', String(bought));
        btn.addEventListener('click', () => toggleBought(a.id));
        li.append(text, btn);
        pendingList.append(li);
    });
    $('pendingWrap').hidden = state.editing || (!pending.length && !state.draft.needs.length);

    const bought = state.achats.filter((a) => a.fait).slice(0, 8);
    const boughtList = $('boughtList');
    boughtList.replaceChildren();
    bought.forEach((a) => {
        const li = el('li', 'pending-item');
        const text = el('span', 'pending-text', a.article);
        text.append(el('small', '', `Studio ${a.studio} · signalé le ${shortDay(toKey(new Date(a.created_at)))}`));
        li.append(text);
        boughtList.append(li);
    });
    $('boughtWrap').hidden = state.editing || !bought.length;
}

function renderNotes() {
    $('notesNotice').hidden = state.notesReady;
    $('noteInput').hidden = !state.notesReady;
    const list = $('notesList');
    list.replaceChildren();
    state.notes.forEach((note) => {
        const li = el('li', `note${note.day === state.day ? ' today' : ''}`);
        const main = el('div', 'note-main');
        const when = note.day === state.day ? (relativeDay(note.day) || 'Ce jour') : shortDay(note.day);
        main.append(el('span', 'note-when', `${when}${note.author ? ` · ${note.author}` : ''}`));
        main.append(document.createTextNode(note.text));
        li.append(main, iconBtn('close', 'Supprimer cette transmission', () => deleteNote(note)));
        list.append(li);
    });
}

function renderCalendar() {
    const [y, m] = state.month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const offset = (first.getDay() + 6) % 7;
    $('monthLabel').textContent = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const ids = new Set(menageItems().map((i) => i.id));
    const menageDone = {};
    state.monthChecks.forEach((c) => { if (ids.has(c.item_id)) menageDone[c.day] = (menageDone[c.day] || 0) + 1; });
    const hoursByDay = {};
    let monthHours = 0;
    state.heuresMonth.filter((h) => h.studio === state.studio).forEach((h) => {
        hoursByDay[h.day] = (hoursByDay[h.day] || 0) + Number(h.hours);
        monthHours += Number(h.hours);
    });
    const notesByDay = {};
    state.monthNotes.forEach((n) => { notesByDay[n.day] = (notesByDay[n.day] || 0) + 1; });

    const grid = $('calGrid');
    grid.replaceChildren();
    for (let i = 0; i < offset; i++) grid.append(el('span', 'cal-day other'));
    let fullDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const key = toKey(new Date(y, m - 1, d));
        const count = menageDone[key] || 0;
        const full = ids.size > 0 && count >= ids.size;
        if (full) fullDays++;
        const cell = el('button', 'cal-day');
        cell.type = 'button';
        if (full) cell.classList.add('full');
        else if (count) cell.classList.add('part');
        if (key === today()) cell.classList.add('today');
        if (key === state.day) cell.classList.add('selected');
        cell.append(el('span', '', String(d)));
        const marks = el('span', 'cal-marks');
        if (hoursByDay[key]) marks.append(el('b', 'm-hours', formatHours(hoursByDay[key])));
        if (notesByDay[key]) marks.append(el('i', 'm-note'));
        cell.append(marks);
        const labels = [formatDay(key)];
        if (full) labels.push('ménage fait');
        else if (count) labels.push(`ménage ${count}/${ids.size}`);
        if (hoursByDay[key]) labels.push(`${formatHours(hoursByDay[key])} de ménage`);
        if (notesByDay[key]) labels.push('transmission');
        cell.setAttribute('aria-label', labels.join(', '));
        cell.addEventListener('click', () => openDay(key));
        grid.append(cell);
    }

    const summary = $('calSummary');
    summary.replaceChildren();
    const stat = (value, label) => {
        const s = el('div', 'stat');
        s.append(el('div', 'stat-value', value), el('div', 'stat-label', label));
        return s;
    };
    const last = state.lastMenage ? (relativeDay(state.lastMenage) || shortDay(state.lastMenage)) : '—';
    summary.append(
        stat(last, `Dernier ménage · ${state.studio}`),
        stat(String(fullDays), 'Ménages complets'),
        stat(formatHours(monthHours), `Heures · studio ${state.studio}`),
    );

    // Récapitulatif des heures : une ligne par personne, une colonne par studio
    const names = [...new Set(PEOPLE.concat(state.heuresMonth.map((h) => h.person)))];
    const totals = {};
    state.heuresMonth.forEach((h) => {
        const key = `${h.person}|${h.studio}`;
        totals[key] = (totals[key] || 0) + Number(h.hours);
    });
    const cell = (h) => el('td', '', h ? formatHours(h) : '—');
    const body = $('recapBody');
    body.replaceChildren();
    const colTotals = STUDIOS.map(() => 0);
    names.forEach((name) => {
        const tr = el('tr');
        tr.append(el('td', '', name));
        let rowTotal = 0;
        STUDIOS.forEach((studio, i) => {
            const h = totals[`${name}|${studio}`] || 0;
            rowTotal += h;
            colTotals[i] += h;
            tr.append(cell(h));
        });
        tr.append(cell(rowTotal));
        body.append(tr);
    });
    const total = el('tr', 'total');
    total.append(el('td', '', 'Total'));
    colTotals.forEach((h) => total.append(cell(h)));
    total.append(cell(colTotals.reduce((a, b) => a + b, 0)));
    body.append(total);
}

// ---------- Saisie ----------
// Toute nouvelle saisie remplace l'ancien message : le statut indique alors « pas encore enregistré »
function afterDraftChange() {
    if (state.save.kind === 'ok' || state.save.kind === 'error') state.save = { kind: '', text: '' };
    render();
}
function toggleChecked(id) {
    if (isFuture()) return;
    const set = state.draft.checked;
    if (set.has(id)) set.delete(id);
    else set.add(id);
    afterDraftChange();
}
function toggleAllMenage() {
    if (isFuture()) return;
    const items = menageItems();
    const all = items.every((i) => state.draft.checked.has(i.id));
    items.forEach((i) => (all ? state.draft.checked.delete(i.id) : state.draft.checked.add(i.id)));
    afterDraftChange();
}
function setHours(h) {
    if (isFuture()) return;
    state.draft.hours = Math.min(MAX_HOURS, Math.max(0, Math.round(h * 2) / 2));
    afterDraftChange();
}
function toggleNeed(article) {
    const key = norm(article);
    const needs = state.draft.needs;
    const index = needs.findIndex((n) => norm(n) === key);
    if (index >= 0) needs.splice(index, 1);
    else needs.push(article);
    afterDraftChange();
}
function addNeed(article) {
    const key = norm(article);
    if (pendingAchats().some((a) => a.studio === state.studio && norm(a.article) === key)) {
        toast(`« ${article} » est déjà dans la liste à acheter`);
        return;
    }
    if (!state.draft.needs.some((n) => norm(n) === key)) state.draft.needs.push(article);
    afterDraftChange();
}
function toggleBought(id) {
    const set = state.draft.bought;
    if (set.has(id)) set.delete(id);
    else set.add(id);
    afterDraftChange();
}

function choosePerson(name) {
    if (name === state.person) return;
    const changes = draftChanges();
    if (changes.hours && !confirm('Les heures saisies ne sont pas enregistrées. Changer de personne quand même ?')) return;
    state.person = name;
    store('ml_person', name);
    state.draft.hours = personHours();
    $('personSeg').classList.remove('needs-choice');
    afterDraftChange();
}

// ---------- Enregistrement ----------
async function notifyNeeds(rows) {
    const lines = rows.map((a) => `• ${a.article}`).join('\n');
    const response = await fetch(NOTIFY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
            _subject: `Réassort à prévoir — Studio ${state.studio} (${rows.length} produit${rows.length > 1 ? 's' : ''})`,
            _template: 'table',
            _captcha: 'false',
            Studio: state.studio,
            Date: formatDay(state.day),
            'Signalé par': state.person || '-',
            Produits: rows.map((a) => a.article).join(', '),
            message: lines,
        }),
    });
    let data = {};
    try { data = await response.json(); } catch { /* réponse non JSON */ }
    // FormSubmit répond 200 même quand le formulaire attend son activation : on lit « success »
    if (!response.ok || String(data.success) !== 'true') {
        throw new Error(data.message || `réponse ${response.status}`);
    }
}

async function saveSuivi() {
    if (!state.person) {
        $('personSeg').classList.add('needs-choice');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setStatus('error', 'Choisissez qui vous êtes (en haut, « Qui ? ») puis appuyez à nouveau sur « Enregistrer le suivi ».');
        return;
    }
    const changes = draftChanges();
    const d = state.draft;
    const failed = [];
    const saved = [];
    let emailNote = '';
    setStatus('saving', 'Enregistrement en cours…');

    // 1. Ménage et réassort remis
    if (changes.added.length || changes.removed.length) {
        try {
            if (changes.added.length) {
                await must(supabase.from('menage_checks').upsert(
                    changes.added.map((id) => ({ item_id: id, day: state.day, studio: state.studio, done_by: state.person })),
                    { onConflict: 'item_id,day,studio' },
                ));
            }
            if (changes.removed.length) {
                await must(supabase.from('menage_checks').delete().in('id', changes.removed.map((c) => c.id)));
            }
            saved.push('ménage');
        } catch (error) {
            console.error(error);
            failed.push('ménage');
        }
    }

    // 2. Heures : une seule ligne par personne, jour et studio
    if (changes.hours) {
        try {
            const rows = state.hoursDay.filter((h) => h.person === state.person);
            if (d.hours > 0 && rows.length) {
                await must(supabase.from('menage_heures').update({ hours: d.hours }).eq('id', rows[0].id));
                if (rows.length > 1) await must(supabase.from('menage_heures').delete().in('id', rows.slice(1).map((h) => h.id)));
            } else if (d.hours > 0) {
                await must(supabase.from('menage_heures').insert({ day: state.day, studio: state.studio, person: state.person, hours: d.hours }));
            } else if (rows.length) {
                await must(supabase.from('menage_heures').delete().in('id', rows.map((h) => h.id)));
            }
            saved.push('heures');
        } catch (error) {
            console.error(error);
            failed.push('heures');
        }
    }

    // 3. Produits manquants (sans doublon avec la liste à acheter)
    if (changes.needs) {
        const existing = new Set(pendingAchats().filter((a) => a.studio === state.studio).map((a) => norm(a.article)));
        const fresh = d.needs.filter((n) => !existing.has(norm(n)));
        try {
            if (fresh.length) {
                const rows = await must(supabase.from('menage_achats')
                    .insert(fresh.map((article) => ({ article, studio: state.studio, demande_par: state.person })))
                    .select());
                try {
                    await notifyNeeds(rows);
                    emailNote = ` Email envoyé à ${NOTIFY_EMAIL}.`;
                } catch (error) {
                    console.error(error);
                    emailNote = /activat/i.test(error.message)
                        ? ` ⚠ Email non envoyé : le formulaire FormSubmit attend son activation (lien « Activate Form » envoyé à ${NOTIFY_EMAIL}). Le besoin reste visible dans « À acheter ».`
                        : ` ⚠ Email non envoyé (${error.message}). Le besoin reste visible dans « À acheter ».`;
                }
            }
            d.needs = [];
            saved.push('réassort');
        } catch (error) {
            console.error(error);
            failed.push('produits manquants');
        }
    }

    // 4. Achats faits
    if (changes.bought) {
        try {
            await must(supabase.from('menage_achats').update({ fait: true }).in('id', [...d.bought]));
            d.bought = new Set();
            saved.push('achats');
        } catch (error) {
            console.error(error);
            failed.push('achats');
        }
    }

    // 5. Transmission
    if (changes.note) {
        try {
            await must(supabase.from('menage_notes').insert({ day: state.day, studio: state.studio, author: state.person, text: d.note.trim() }));
            d.note = '';
            $('noteInput').value = '';
            saved.push('transmission');
        } catch (error) {
            console.error(error);
            failed.push('transmission');
        }
    }

    // Relecture depuis la base pour confirmer ce qui est réellement enregistré
    try {
        await loadDay();
    } catch (error) {
        console.error(error);
        setStatus('error', '⚠ Impossible de relire la base : vérifiez la connexion. Les informations n’ont peut-être pas été enregistrées.');
        return;
    }
    const savedIds = new Set(state.checks.map((c) => c.item_id));
    const checksOk = savedIds.size === d.checked.size && [...d.checked].every((id) => savedIds.has(id));
    if (!checksOk && !failed.includes('ménage')) failed.push('ménage (vérification)');
    if (state.heuresReady && personHours() !== d.hours && !failed.includes('heures')) failed.push('heures (vérification)');

    const time = formatTime(new Date().toISOString());
    if (failed.length) {
        setStatus('error', `✕ Non enregistré : ${failed.join(', ')}.${saved.length ? ` Enregistré : ${saved.join(', ')}.` : ''} Vérifiez la connexion puis réessayez.${emailNote}`);
    } else {
        resetDraft();
        setStatus('ok', `✓ Suivi enregistré à ${time} (${saved.join(', ') || 'aucun changement'}).${emailNote}`);
    }
    render();
}

// ---------- Modification des listes (enregistrée immédiatement) ----------
async function addItem(list, label) {
    const items = state.items.filter((i) => i.list === list);
    const position = items.length ? Math.max(...items.map((i) => i.position)) + 1 : 1;
    try {
        const data = await must(supabase.from('menage_items').insert({ list, label, position }).select().single());
        state.items.push(data);
        render();
        toast('✓ Ajouté à la liste');
    } catch (error) {
        console.error(error);
        toast('✕ Erreur : non ajouté. Réessayez.');
    }
}

function startRename(li, item) {
    const input = el('input', 'edit-input');
    input.value = item.list === LIST_RESTOCK ? productName(item.label) : item.label;
    input.maxLength = 120;
    li.replaceChildren(input);
    input.focus();
    let done = false;
    const save = async () => {
        if (done) return;
        done = true;
        const label = input.value.trim();
        if (!label || label === item.label) return render();
        try {
            await must(supabase.from('menage_items').update({ label }).eq('id', item.id));
            item.label = label;
            toast('✓ Renommé');
        } catch (error) {
            console.error(error);
            toast('✕ Erreur : non renommé');
        }
        render();
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') { done = true; render(); }
    });
}

async function moveItem(items, index, delta) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    const reordered = items.slice();
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reordered.forEach((it, i) => { it.position = i + 1; });
    state.items.sort((x, y) => x.position - y.position || x.id - y.id);
    render();
    try {
        await Promise.all([a, b].map((it) => must(supabase.from('menage_items').update({ position: it.position }).eq('id', it.id))));
    } catch (error) {
        console.error(error);
        toast('✕ Erreur : ordre non enregistré');
    }
}

async function deleteItem(item) {
    if (!confirm(`Retirer « ${item.label} » de la liste ? L’historique déjà coché est supprimé avec.`)) return;
    try {
        await must(supabase.from('menage_items').delete().eq('id', item.id));
        state.items = state.items.filter((i) => i.id !== item.id);
        state.draft.checked.delete(item.id);
        toast('✓ Retiré de la liste');
    } catch (error) {
        console.error(error);
        toast('✕ Erreur : non retiré');
    }
    render();
}

async function deleteNote(note) {
    if (!confirm('Supprimer cette transmission ?')) return;
    try {
        await must(supabase.from('menage_notes').delete().eq('id', note.id));
        state.notes = state.notes.filter((n) => n.id !== note.id);
        toast('✓ Transmission supprimée');
    } catch (error) {
        console.error(error);
        toast('✕ Erreur : transmission non supprimée');
    }
    render();
}

// ---------- Navigation ----------
function goToDay(key) {
    if (key === state.day || !confirmLeave()) return;
    state.day = key;
    state.month = key.slice(0, 7);
    state.save = { kind: '', text: '' };
    state.loaded = false;
    render();
    loadAll();
}

function openDay(key) {
    state.view = 'suivi';
    if (key === state.day) {
        render();
        window.scrollTo({ top: 0 });
        return;
    }
    goToDay(key);
    window.scrollTo({ top: 0 });
}

function chooseStudio(studio) {
    if (studio === state.studio || !confirmLeave()) return;
    state.studio = studio;
    store('ml_studio', studio);
    state.save = { kind: '', text: '' };
    state.loaded = false;
    render();
    loadAll();
}

function toggleView() {
    if (state.view === 'suivi') {
        state.view = 'calendrier';
        state.month = state.day.slice(0, 7);
        render();
        loadAll({ keepDraft: true });
    } else {
        state.view = 'suivi';
        render();
    }
    window.scrollTo({ top: 0 });
}

function shiftMonth(delta) {
    const [y, m] = state.month.split('-').map(Number);
    state.month = toKey(new Date(y, m - 1 + delta, 1)).slice(0, 7);
    loadAll({ keepDraft: true });
}

// ---------- Évènements ----------
$('viewToggle').addEventListener('click', toggleView);
document.querySelectorAll('#studioSeg button').forEach((b) => b.addEventListener('click', () => chooseStudio(b.dataset.studio)));
$('prevDay').addEventListener('click', () => goToDay(addDays(state.day, -1)));
$('nextDay').addEventListener('click', () => goToDay(addDays(state.day, 1)));
$('todayBtn').addEventListener('click', () => goToDay(today()));
$('prevMonth').addEventListener('click', () => shiftMonth(-1));
$('nextMonth').addEventListener('click', () => shiftMonth(1));

$('allDone').addEventListener('click', toggleAllMenage);
$('hoursMinus').addEventListener('click', () => setHours(state.draft.hours - 0.5));
$('hoursPlus').addEventListener('click', () => setHours(state.draft.hours + 0.5));
document.querySelectorAll('#hoursQuick .chip').forEach((c) => c.addEventListener('click', () => setHours(Number(c.dataset.h))));

$('needForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const value = $('needInput').value.trim();
    if (!value) return;
    $('needInput').value = '';
    addNeed(value.charAt(0).toUpperCase() + value.slice(1));
});
$('noteInput').addEventListener('input', (e) => {
    state.draft.note = e.target.value;
    if (state.save.kind === 'ok' || state.save.kind === 'error') state.save = { kind: '', text: '' };
    renderSaveBar();
});

$('editToggle').addEventListener('click', () => { state.editing = !state.editing; render(); });
$('addMenageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const label = $('addMenageInput').value.trim();
    if (!label) return;
    $('addMenageInput').value = '';
    addItem(LIST_MENAGE, label);
});
$('addRestockForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const label = $('addRestockInput').value.trim();
    if (!label) return;
    $('addRestockInput').value = '';
    addItem(LIST_RESTOCK, label.charAt(0).toUpperCase() + label.slice(1));
});

$('saveBtn').addEventListener('click', saveSuivi);

window.addEventListener('beforeunload', (e) => {
    if (state.loaded && isDirty()) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// Mise à jour entre les téléphones de l'équipe (seulement quand rien n'est en cours de saisie)
let lastToday = today();
setInterval(() => {
    if (document.hidden || state.editing || state.save.kind === 'saving' || isDirty()) return;
    if (today() !== lastToday) {
        if (state.day === lastToday) state.day = today();
        lastToday = today();
    }
    loadAll();
}, REFRESH_MS);
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !state.editing && !isDirty() && state.save.kind !== 'saving') loadAll();
});

render();
loadAll();
