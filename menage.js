// The Muse Lab — Ménage & Réassort
// Données partagées via Supabase (voir menage-setup.sql et menage-notes.sql)

// Email qui reçoit les demandes d'achat.
// Envoi via FormSubmit (gratuit, sans serveur) : au tout premier envoi,
// FormSubmit envoie un email d'activation à cette adresse — il suffit de cliquer dessus une fois.
const NOTIFY_EMAIL = 'team@themuselab.fr';
const NOTIFY_ENDPOINT = `https://formsubmit.co/ajax/${NOTIFY_EMAIL}`;

const REFRESH_MS = 30000;

// Personnes qui font le ménage (ajoutez un prénom ici si besoin)
const PEOPLE = ['Kalie', 'Valériane'];
const STUDIOS = ['78', '92'];

// ---------- Dates (format AAAA-MM-JJ, heure locale) ----------
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

const TABS = ['menage', 'heures', 'calendrier', 'achats'];
const savedTab = localStorage.getItem('ml_tab');

const state = {
    tab: TABS.includes(savedTab) ? savedTab : 'menage',
    studio: localStorage.getItem('ml_studio') || '78',
    who: localStorage.getItem('ml_who') || '',
    day: today(),
    month: today().slice(0, 7),
    editing: false,
    notesReady: true,
    heuresReady: true,
    person: localStorage.getItem('ml_person') || PEOPLE[0],
    hoursInput: 2,
    heuresDay: [],
    heuresMonth: [],
    items: [],
    checks: [],
    notes: [],
    prevNotes: [],
    achats: [],
    monthChecks: [],
    monthNotes: [],
    lastMenage: null,
};

// ---------- Éléments ----------
const $ = (id) => document.getElementById(id);
const taskList = $('taskList');
const listPanel = $('listPanel');
const calendarPanel = $('calendarPanel');
const heuresPanel = $('heuresPanel');
const achatsPanel = $('achatsPanel');
const addForm = $('addForm');
const addInput = $('addInput');
const editToggle = $('editToggle');
const whoInput = $('whoInput');
const toastEl = $('toast');

// ---------- Utilitaires ----------
function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function formatDateTime(iso) {
    return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function formatDay(key, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
    return fromKey(key).toLocaleDateString('fr-FR', opts);
}
function relativeDay(key) {
    const t = today();
    if (key === t) return "Aujourd'hui";
    if (key === addDays(t, -1)) return 'Hier';
    if (key === addDays(t, 1)) return 'Demain';
    return '';
}

// 1.5 -> « 1h30 »
function formatHours(h) {
    const minutes = Math.round(Number(h) * 60);
    const rest = minutes % 60;
    return `${Math.floor(minutes / 60)}h${rest ? String(rest).padStart(2, '0') : ''}`;
}

function monthRange(month) {
    const [y, m] = month.split('-').map(Number);
    return [`${month}-01`, toKey(new Date(y, m, 0))];
}

let toastTimer;
function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
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

// 42P01 = table inexistante : un script SQL n'a pas encore été exécuté
function isMissingTable(error) {
    return error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || ''));
}

function handleError(error) {
    console.error(error);
    if (isMissingTable(error)) $('setupNotice').hidden = false;
    else toast('Erreur de connexion, réessayez.');
}

// ---------- Chargement ----------
const menageIds = () => state.items.filter((i) => i.list === 'menage').map((i) => i.id);

async function loadNotes() {
    const [dayNotes, prev] = await Promise.all([
        supabase.from('menage_notes').select('*').eq('day', state.day).eq('studio', state.studio).order('created_at'),
        supabase.from('menage_notes').select('*').lt('day', state.day).eq('studio', state.studio)
            .order('day', { ascending: false }).order('created_at', { ascending: false }).limit(3),
    ]);
    const error = dayNotes.error || prev.error;
    if (error) {
        if (isMissingTable(error)) {
            state.notesReady = false;
            state.notes = [];
            state.prevNotes = [];
            return;
        }
        throw error;
    }
    state.notesReady = true;
    state.notes = dayNotes.data;
    state.prevNotes = prev.data;
}

async function loadMonth() {
    const [start, end] = monthRange(state.month);
    const [checks, notes, last] = await Promise.all([
        supabase.from('menage_checks').select('item_id, day').eq('studio', state.studio).gte('day', start).lte('day', end),
        state.notesReady
            ? supabase.from('menage_notes').select('day').eq('studio', state.studio).gte('day', start).lte('day', end)
            : Promise.resolve({ data: [] }),
        supabase.from('menage_checks').select('day').eq('studio', state.studio).in('item_id', menageIds())
            .lte('day', today()).order('day', { ascending: false }).limit(1),
    ]);
    const error = checks.error || last.error || (notes.error && !isMissingTable(notes.error) ? notes.error : null);
    if (error) throw error;
    state.monthChecks = checks.data;
    state.monthNotes = notes.data || [];
    state.lastMenage = last.data[0] ? last.data[0].day : null;
}

async function loadHeures() {
    const [start, end] = monthRange(state.month);
    const month = await supabase.from('menage_heures').select('*').gte('day', start).lte('day', end).order('created_at');
    if (month.error) {
        if (isMissingTable(month.error)) {
            state.heuresReady = false;
            state.heuresMonth = [];
            state.heuresDay = [];
            return;
        }
        throw month.error;
    }
    state.heuresReady = true;
    state.heuresMonth = month.data;
    state.heuresDay = month.data.filter((h) => h.day === state.day && h.studio === state.studio);
}

// L'ancienne liste « checklist » est fusionnée dans la liste ménage
async function mergeChecklist(items) {
    const old = items.filter((i) => i.list !== 'menage');
    if (!old.length) return;
    let position = Math.max(0, ...items.filter((i) => i.list === 'menage').map((i) => i.position));
    await Promise.all(old.map((item) => {
        item.list = 'menage';
        item.position = ++position;
        return supabase.from('menage_items').update({ list: 'menage', position: item.position }).eq('id', item.id);
    }));
}

async function loadAll() {
    try {
        const [items, checks, achats] = await Promise.all([
            supabase.from('menage_items').select('*').order('position').order('id'),
            supabase.from('menage_checks').select('*').eq('day', state.day).eq('studio', state.studio),
            supabase.from('menage_achats').select('*').order('created_at', { ascending: false }).limit(100),
        ]);
        const error = items.error || checks.error || achats.error;
        if (error) throw error;
        await mergeChecklist(items.data);
        state.items = items.data.sort((a, b) => a.position - b.position || a.id - b.id);
        state.checks = checks.data;
        state.achats = achats.data;
        await Promise.all([loadNotes(), loadHeures()]);
        if (state.tab === 'calendrier') await loadMonth();
        $('setupNotice').hidden = true;
        render();
    } catch (error) {
        handleError(error);
    }
}

// ---------- Rendu ----------
function render() {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === state.tab));
    document.querySelectorAll('.studio-btn').forEach((b) => b.classList.toggle('active', b.dataset.studio === state.studio));
    $('studioLabel').textContent = state.studio;
    document.querySelectorAll('.studio-inline').forEach((s) => { s.textContent = state.studio; });

    const titles = { menage: 'ménage.', heures: 'heures.', calendrier: 'calendrier.', achats: 'achats.' };
    $('heroTitle').textContent = titles[state.tab];

    const rel = relativeDay(state.day);
    $('dayLabel').textContent = formatDay(state.day);
    $('dayTag').textContent = rel;
    $('dayBarLabel').textContent = rel || formatDay(state.day, { weekday: 'short', day: 'numeric', month: 'short' });
    $('dayBarHint').textContent = state.day === today() ? '' : "Revenir à aujourd'hui";

    const isList = state.tab === 'menage';
    listPanel.hidden = !isList;
    heuresPanel.hidden = state.tab !== 'heures';
    calendarPanel.hidden = state.tab !== 'calendrier';
    achatsPanel.hidden = state.tab !== 'achats';
    $('dayBar').hidden = !(isList || state.tab === 'heures');

    const pending = state.achats.filter((a) => !a.fait).length;
    $('achatsBadge').hidden = pending === 0;
    $('achatsBadge').textContent = pending;

    if (isList) {
        renderList();
        renderNotes();
    } else if (state.tab === 'heures') {
        renderHeures();
    } else if (state.tab === 'calendrier') {
        renderCalendar();
    } else {
        renderAchats();
    }
}

function renderList() {
    const items = state.items;
    const checksByItem = new Map(state.checks.map((c) => [c.item_id, c]));
    const future = state.day > today();

    listPanel.classList.toggle('editing', state.editing);
    editToggle.textContent = state.editing ? 'Terminer' : 'Modifier la liste';
    $('resetDay').textContent = state.day === today() ? "Tout décocher pour aujourd'hui" : 'Tout décocher pour ce jour';

    const done = items.filter((i) => checksByItem.has(i.id)).length;
    $('progressCount').textContent = `${done} / ${items.length}`;
    $('progressFill').style.width = items.length ? `${(done / items.length) * 100}%` : '0';
    document.querySelector('.progress-card').classList.toggle('complete', items.length > 0 && done === items.length);

    taskList.replaceChildren();
    if (future) {
        taskList.append(el('li', 'future-hint', 'Ce jour n’est pas encore arrivé : les cases se cochent le jour même. Vous pouvez déjà laisser une transmission ci-dessous.'));
    }
    if (!items.length) {
        taskList.append(el('li', 'empty', 'Aucune étape pour le moment. Ajoutez-en une ci-dessous.'));
        return;
    }

    items.forEach((item, index) => {
        const check = checksByItem.get(item.id);
        const li = el('li', `task${check ? ' done' : ''}${future ? ' locked' : ''}`);

        const box = el('button', 'task-check');
        box.type = 'button';
        box.setAttribute('aria-label', check ? 'Décocher' : 'Cocher');
        box.innerHTML = ICONS.check;
        box.addEventListener('click', () => toggleCheck(item, check));

        const body = el('div', 'task-body');
        body.append(el('div', 'task-label', item.label));
        if (check) {
            const by = check.done_by ? ` par ${check.done_by}` : '';
            body.append(el('div', 'task-meta', `Fait à ${formatTime(check.done_at)}${by}`));
        }
        body.addEventListener('click', () => { if (!state.editing) toggleCheck(item, check); });

        const tools = el('div', 'task-tools');
        const up = iconBtn('up', 'Monter', () => moveItem(items, index, -1));
        const down = iconBtn('down', 'Descendre', () => moveItem(items, index, 1));
        up.disabled = index === 0;
        down.disabled = index === items.length - 1;
        tools.append(
            iconBtn('pen', 'Renommer', () => startRename(body, item)),
            up,
            down,
            iconBtn('trash', 'Supprimer', () => deleteItem(item), 'danger'),
        );

        li.append(box, body, tools);
        taskList.append(li);
    });
}

function noteItem(note, withDay) {
    const li = el('li', 'note');
    li.append(el('div', 'note-text', note.text));
    const when = withDay ? `${formatDay(note.day, { weekday: 'short', day: 'numeric', month: 'short' })} · ` : '';
    li.append(el('div', 'note-meta', `${when}${formatTime(note.created_at)}${note.author ? ` · ${note.author}` : ''}`));
    return li;
}

function renderNotes() {
    $('notesNotice').hidden = state.notesReady;
    $('noteForm').hidden = !state.notesReady;

    const list = $('notesList');
    list.replaceChildren();
    if (state.notesReady && !state.notes.length) {
        list.append(el('li', 'empty', 'Aucune transmission pour ce jour.'));
    }
    state.notes.forEach((note) => {
        const li = noteItem(note, false);
        li.append(iconBtn('trash', 'Supprimer', () => deleteNote(note), 'danger'));
        list.append(li);
    });

    // Les dernières infos laissées les jours précédents, pour que la prochaine équipe les voie
    const prev = $('prevNotesList');
    prev.replaceChildren();
    $('prevNotesWrap').hidden = !state.prevNotes.length;
    state.prevNotes.forEach((note) => {
        const li = noteItem(note, true);
        li.title = 'Aller à ce jour';
        li.addEventListener('click', () => goToDay(note.day));
        prev.append(li);
    });
}

function renderCalendar() {
    const [y, m] = state.month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const offset = (first.getDay() + 6) % 7; // lundi en premier

    $('monthLabel').textContent = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const ids = new Set(menageIds());
    const menageDone = {};
    state.monthChecks.forEach((c) => {
        if (ids.has(c.item_id)) menageDone[c.day] = (menageDone[c.day] || 0) + 1;
    });
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

    let menageDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const key = toKey(new Date(y, m - 1, d));
        const count = menageDone[key] || 0;
        const full = ids.size > 0 && count >= ids.size;
        if (full) menageDays++;

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
        if (notesByDay[key]) labels.push(`${notesByDay[key]} transmission(s)`);
        cell.setAttribute('aria-label', labels.join(', '));
        cell.addEventListener('click', () => goToDay(key, 'menage'));
        grid.append(cell);
    }

    const summary = $('calSummary');
    summary.replaceChildren();
    const stat = (value, label) => {
        const s = el('div', 'stat');
        s.append(el('div', 'stat-value', value), el('div', 'stat-label', label));
        return s;
    };
    const last = state.lastMenage
        ? (relativeDay(state.lastMenage) || formatDay(state.lastMenage, { weekday: 'short', day: 'numeric', month: 'short' }))
        : '—';
    summary.append(
        stat(last, 'Dernier ménage'),
        stat(String(menageDays), `Ménage${menageDays > 1 ? 's' : ''} complet${menageDays > 1 ? 's' : ''} ce mois`),
        stat(formatHours(monthHours), `Heures ce mois · studio ${state.studio}`),
    );
}

function renderHeures() {
    $('heuresNotice').hidden = state.heuresReady;
    $('heuresForm').hidden = !state.heuresReady;

    const picks = $('personPicks');
    picks.replaceChildren();
    PEOPLE.forEach((name) => {
        const b = el('button', `person-btn${name === state.person ? ' active' : ''}`, name);
        b.type = 'button';
        b.addEventListener('click', () => {
            state.person = name;
            localStorage.setItem('ml_person', name);
            renderHeures();
        });
        picks.append(b);
    });
    $('hoursValue').textContent = formatHours(state.hoursInput);
    document.querySelectorAll('#hoursQuick .chip').forEach((c) => {
        c.classList.toggle('active', Number(c.dataset.h) === state.hoursInput);
    });
    $('heuresHint').textContent = `${formatDay(state.day)} · Studio ${state.studio}`;

    const list = $('heuresDayList');
    list.replaceChildren();
    const dayTotal = state.heuresDay.reduce((sum, h) => sum + Number(h.hours), 0);
    $('heuresDayTotal').textContent = dayTotal ? `${formatHours(dayTotal)} · Studio ${state.studio}` : `Studio ${state.studio}`;
    if (state.heuresReady && !state.heuresDay.length) {
        list.append(el('li', 'empty', 'Aucune heure saisie pour ce jour.'));
    }
    state.heuresDay.forEach((h) => {
        const li = el('li', 'achat hour-entry');
        li.append(el('div', 'hour-value', formatHours(h.hours)));
        const main = el('div', 'achat-main');
        main.append(el('div', 'achat-title', h.person));
        if (h.note) main.append(el('div', 'achat-note', h.note));
        li.append(main, iconBtn('trash', 'Supprimer', () => deleteHeures(h), 'danger'));
        list.append(li);
    });

    // Récapitulatif du mois : une ligne par personne, une colonne par studio
    $('recapLabel').textContent = fromKey(`${state.month}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
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
    const tr = el('tr', 'total');
    tr.append(el('td', '', 'Total'));
    colTotals.forEach((h) => tr.append(cell(h)));
    tr.append(cell(colTotals.reduce((a, b) => a + b, 0)));
    body.append(tr);
}

function renderAchats() {
    const listEl = $('achatList');
    listEl.replaceChildren();
    const pending = state.achats.filter((a) => !a.fait).length;
    $('achatsCount').textContent = pending ? `${pending} en attente` : '';

    if (!state.achats.length) {
        listEl.append(el('li', 'empty', 'Rien à acheter pour le moment.'));
        return;
    }

    state.achats.forEach((a) => {
        const li = el('li', `achat${a.fait ? ' fait' : ''}`);
        const main = el('div', 'achat-main');
        const title = el('div', 'achat-title', a.article);
        if (a.quantite) title.append(el('span', 'achat-qty', ` · ${a.quantite}`));
        main.append(title);
        if (a.note) main.append(el('div', 'achat-note', a.note));
        const meta = el('div', 'achat-meta');
        meta.append(el('span', 'pill-studio', `Studio ${a.studio}`));
        meta.append(document.createTextNode(`${formatDateTime(a.created_at)}${a.demande_par ? ` · ${a.demande_par}` : ''}`));
        main.append(meta);

        const actions = el('div', 'achat-actions');
        const doneBtn = iconBtn('check', a.fait ? 'Marquer à acheter' : 'Marquer comme acheté', () => toggleAchat(a));
        actions.append(doneBtn, iconBtn('trash', 'Supprimer', () => deleteAchat(a), 'danger'));

        li.append(main, actions);
        listEl.append(li);
    });
}

// ---------- Navigation ----------
function goToDay(key, tab) {
    state.day = key;
    state.month = key.slice(0, 7);
    state.editing = false;
    if (tab) {
        state.tab = tab;
        localStorage.setItem('ml_tab', tab);
    }
    state.checks = [];
    state.notes = [];
    render();
    loadAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setTab(tab) {
    state.tab = tab;
    state.editing = false;
    localStorage.setItem('ml_tab', tab);
    render();
    if (tab === 'calendrier') loadAll();
}

// ---------- Actions : tâches ----------
async function toggleCheck(item, check) {
    if (state.day > today()) return toast('Ce jour n’est pas encore arrivé');
    if (check) {
        state.checks = state.checks.filter((c) => c.id !== check.id);
        render();
        const { error } = await supabase.from('menage_checks').delete().eq('id', check.id);
        if (error) handleError(error);
    } else {
        const row = { item_id: item.id, day: state.day, studio: state.studio, done_by: state.who || null };
        const { data, error } = await supabase
            .from('menage_checks')
            .upsert(row, { onConflict: 'item_id,day,studio' })
            .select()
            .single();
        if (error) return handleError(error);
        state.checks = state.checks.filter((c) => c.item_id !== item.id).concat(data);
        render();
        const items = state.items;
        if (items.every((i) => state.checks.some((c) => c.item_id === i.id))) toast('Tout est fait, merci ✨');
    }
}

async function addItem(label) {
    const items = state.items;
    const position = items.length ? Math.max(...items.map((i) => i.position)) + 1 : 1;
    const { data, error } = await supabase
        .from('menage_items')
        .insert({ list: 'menage', label, position })
        .select()
        .single();
    if (error) return handleError(error);
    state.items.push(data);
    render();
    toast('Étape ajoutée');
}

function startRename(body, item) {
    const input = el('input', 'task-edit-input');
    input.value = item.label;
    input.maxLength = 120;
    body.replaceChildren(input);
    input.focus();
    input.select();

    let saved = false;
    const save = async () => {
        if (saved) return;
        saved = true;
        const label = input.value.trim();
        if (!label || label === item.label) return render();
        item.label = label;
        render();
        const { error } = await supabase.from('menage_items').update({ label }).eq('id', item.id);
        if (error) handleError(error);
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') { saved = true; render(); }
    });
}

async function moveItem(items, index, delta) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const reordered = items.slice();
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reordered.forEach((it, i) => { it.position = i + 1; });
    state.items.sort((a, b) => a.position - b.position || a.id - b.id);
    render();
    const results = await Promise.all(
        [reordered[index], reordered[target]].map((it) =>
            supabase.from('menage_items').update({ position: it.position }).eq('id', it.id)),
    );
    const failed = results.find((r) => r.error);
    if (failed) handleError(failed.error);
}

async function deleteItem(item) {
    if (!confirm(`Supprimer « ${item.label} » de la liste ?`)) return;
    state.items = state.items.filter((i) => i.id !== item.id);
    render();
    const { error } = await supabase.from('menage_items').delete().eq('id', item.id);
    if (error) handleError(error);
}

async function resetDay() {
    const ids = state.items.map((i) => i.id);
    const toDelete = state.checks.filter((c) => ids.includes(c.item_id));
    if (!toDelete.length) return;
    if (!confirm('Tout décocher pour ce jour ?')) return;
    state.checks = state.checks.filter((c) => !ids.includes(c.item_id));
    render();
    const { error } = await supabase.from('menage_checks').delete().in('id', toDelete.map((c) => c.id));
    if (error) handleError(error);
}

// ---------- Actions : transmissions ----------
async function submitNote(e) {
    e.preventDefault();
    const text = $('noteInput').value.trim();
    if (!text) return;
    const submitBtn = $('noteSubmit');
    submitBtn.disabled = true;
    const { data, error } = await supabase
        .from('menage_notes')
        .insert({ day: state.day, studio: state.studio, author: state.who || null, text })
        .select()
        .single();
    submitBtn.disabled = false;
    if (error) return handleError(error);
    state.notes.push(data);
    $('noteInput').value = '';
    render();
    toast('Transmission enregistrée');
}

async function deleteNote(note) {
    if (!confirm('Supprimer cette transmission ?')) return;
    state.notes = state.notes.filter((n) => n.id !== note.id);
    render();
    const { error } = await supabase.from('menage_notes').delete().eq('id', note.id);
    if (error) handleError(error);
}

// ---------- Actions : heures ----------
function setHoursInput(h) {
    state.hoursInput = Math.min(12, Math.max(0.5, h));
    renderHeures();
}

async function submitHeures(e) {
    e.preventDefault();
    const submitBtn = $('heuresSubmit');
    submitBtn.disabled = true;
    const row = {
        day: state.day,
        studio: state.studio,
        person: state.person,
        hours: state.hoursInput,
        note: $('heuresNote').value.trim() || null,
    };
    const { data, error } = await supabase.from('menage_heures').insert(row).select().single();
    submitBtn.disabled = false;
    if (error) return handleError(error);
    if (data.day.slice(0, 7) === state.month) state.heuresMonth.push(data);
    state.heuresDay.push(data);
    $('heuresNote').value = '';
    render();
    toast(`${formatHours(data.hours)} enregistrées pour ${data.person}`);
}

async function deleteHeures(entry) {
    if (!confirm(`Supprimer ${formatHours(entry.hours)} de ${entry.person} ?`)) return;
    state.heuresDay = state.heuresDay.filter((h) => h.id !== entry.id);
    state.heuresMonth = state.heuresMonth.filter((h) => h.id !== entry.id);
    render();
    const { error } = await supabase.from('menage_heures').delete().eq('id', entry.id);
    if (error) handleError(error);
}

// ---------- Actions : achats ----------
async function sendAchatEmail(achat) {
    const lines = [
        `Article : ${achat.article}`,
        `Quantité : ${achat.quantite || '-'}`,
        `Studio : ${achat.studio}`,
        `Demandé par : ${achat.demande_par || '-'}`,
        `Note : ${achat.note || '-'}`,
    ];
    const response = await fetch(NOTIFY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
            _subject: `🛒 Achat à prévoir — ${achat.article} (Studio ${achat.studio})`,
            _template: 'table',
            _captcha: 'false',
            Article: achat.article,
            Quantité: achat.quantite || '-',
            Studio: achat.studio,
            'Demandé par': achat.demande_par || '-',
            Note: achat.note || '-',
            message: lines.join('\n'),
        }),
    });
    if (!response.ok) throw new Error(`Email non envoyé (${response.status})`);
}

async function submitAchat(e) {
    e.preventDefault();
    const article = $('achatArticle').value.trim();
    if (!article) return;
    const achat = {
        article,
        quantite: $('achatQuantite').value.trim() || null,
        note: $('achatNote').value.trim() || null,
        studio: state.studio,
        demande_par: state.who || null,
    };

    const submitBtn = $('achatSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi…';

    const { data, error } = await supabase.from('menage_achats').insert(achat).select().single();
    if (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer à l\'équipe';
        return handleError(error);
    }
    state.achats.unshift(data);
    $('achatForm').reset();
    render();

    try {
        await sendAchatEmail(achat);
        toast('Achat enregistré, email envoyé à l\'équipe');
    } catch (err) {
        console.error(err);
        toast('Achat enregistré (email non envoyé)');
    }
    submitBtn.disabled = false;
    submitBtn.textContent = 'Envoyer à l\'équipe';
}

async function toggleAchat(achat) {
    achat.fait = !achat.fait;
    render();
    const { error } = await supabase.from('menage_achats').update({ fait: achat.fait }).eq('id', achat.id);
    if (error) handleError(error);
}

async function deleteAchat(achat) {
    if (!confirm(`Supprimer « ${achat.article} » ?`)) return;
    state.achats = state.achats.filter((a) => a.id !== achat.id);
    render();
    const { error } = await supabase.from('menage_achats').delete().eq('id', achat.id);
    if (error) handleError(error);
}

// ---------- Évènements ----------
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.goto)));

document.querySelectorAll('.studio-btn').forEach((b) => b.addEventListener('click', () => {
    state.studio = b.dataset.studio;
    localStorage.setItem('ml_studio', state.studio);
    loadAll();
}));

whoInput.value = state.who;
whoInput.addEventListener('input', () => {
    state.who = whoInput.value.trim();
    localStorage.setItem('ml_who', state.who);
});

addForm.classList.add('visible');
addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const label = addInput.value.trim();
    if (!label) return;
    addInput.value = '';
    addItem(label);
});

editToggle.addEventListener('click', () => { state.editing = !state.editing; render(); });
$('resetDay').addEventListener('click', resetDay);
$('noteForm').addEventListener('submit', submitNote);
$('heuresForm').addEventListener('submit', submitHeures);
$('hoursMinus').addEventListener('click', () => setHoursInput(state.hoursInput - 0.5));
$('hoursPlus').addEventListener('click', () => setHoursInput(state.hoursInput + 0.5));
document.querySelectorAll('#hoursQuick .chip').forEach((c) => c.addEventListener('click', () => setHoursInput(Number(c.dataset.h))));

$('prevDay').addEventListener('click', () => goToDay(addDays(state.day, -1)));
$('nextDay').addEventListener('click', () => goToDay(addDays(state.day, 1)));
$('todayBtn').addEventListener('click', () => { if (state.day !== today()) goToDay(today()); });

function shiftMonth(delta) {
    const [y, m] = state.month.split('-').map(Number);
    state.month = toKey(new Date(y, m - 1 + delta, 1)).slice(0, 7);
    render();
    loadAll();
}
$('prevMonth').addEventListener('click', () => shiftMonth(-1));
$('nextMonth').addEventListener('click', () => shiftMonth(1));
$('hPrevMonth').addEventListener('click', () => shiftMonth(-1));
$('hNextMonth').addEventListener('click', () => shiftMonth(1));

// Glisser vers la gauche / la droite pour changer de jour (téléphone)
let touchStart = null;
[listPanel, heuresPanel].forEach((panel) => {
    panel.addEventListener('touchstart', (e) => {
        if (e.target.closest('input, textarea, table')) return;
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    panel.addEventListener('touchend', (e) => {
        if (!touchStart) return;
        const dx = e.changedTouches[0].clientX - touchStart.x;
        const dy = e.changedTouches[0].clientY - touchStart.y;
        touchStart = null;
        if (Math.abs(dx) > 70 && Math.abs(dy) < 40) goToDay(addDays(state.day, dx < 0 ? 1 : -1));
    }, { passive: true });
});

$('achatForm').addEventListener('submit', submitAchat);
document.querySelectorAll('#quickPicks .chip').forEach((chip) => chip.addEventListener('click', () => {
    $('achatArticle').value = chip.textContent;
    $('achatQuantite').focus();
}));

// Synchronisation entre les téléphones de l'équipe
let lastToday = today();
setInterval(() => {
    if (document.hidden || state.editing) return;
    // Après minuit, on suit le nouveau jour si l'écran affichait « aujourd'hui »
    if (today() !== lastToday) {
        if (state.day === lastToday) state.day = today();
        lastToday = today();
    }
    if (document.activeElement && document.activeElement.matches('textarea, input')) return;
    loadAll();
}, REFRESH_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !state.editing) loadAll(); });

render();
loadAll();
