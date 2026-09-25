// The Muse Lab — Ménage & Réassort
// Données partagées via Supabase (voir menage-setup.sql)

// Email qui reçoit les demandes d'achat.
// Envoi via FormSubmit (gratuit, sans serveur) : au tout premier envoi,
// FormSubmit envoie un email d'activation à cette adresse — il suffit de cliquer dessus une fois.
const NOTIFY_EMAIL = 'team@themuselab.fr';
const NOTIFY_ENDPOINT = `https://formsubmit.co/ajax/${NOTIFY_EMAIL}`;

const REFRESH_MS = 30000;

const state = {
    tab: localStorage.getItem('ml_tab') || 'menage',
    studio: localStorage.getItem('ml_studio') || '78',
    who: localStorage.getItem('ml_who') || '',
    editing: false,
    items: [],
    checks: [],
    achats: [],
};

// ---------- Éléments ----------
const $ = (id) => document.getElementById(id);
const taskList = $('taskList');
const listPanel = $('listPanel');
const achatsPanel = $('achatsPanel');
const addForm = $('addForm');
const addInput = $('addInput');
const editToggle = $('editToggle');
const whoInput = $('whoInput');
const toastEl = $('toast');

// ---------- Utilitaires ----------
function today() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso) {
    return new Date(iso).toLocaleString('fr-FR', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
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

function handleError(error) {
    console.error(error);
    // 42P01 = table inexistante : le script SQL n'a pas encore été exécuté
    if (error && (error.code === '42P01' || /does not exist|schema cache/i.test(error.message || ''))) {
        $('setupNotice').hidden = false;
    } else {
        toast('Erreur de connexion, réessayez.');
    }
}

// ---------- Chargement ----------
async function loadAll() {
    const [items, checks, achats] = await Promise.all([
        supabase.from('menage_items').select('*').order('position').order('id'),
        supabase.from('menage_checks').select('*').eq('day', today()).eq('studio', state.studio),
        supabase.from('menage_achats').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    const error = items.error || checks.error || achats.error;
    if (error) return handleError(error);

    $('setupNotice').hidden = true;
    state.items = items.data;
    state.checks = checks.data;
    state.achats = achats.data;
    render();
}

// ---------- Rendu ----------
function render() {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === state.tab));
    document.querySelectorAll('.studio-btn').forEach((b) => b.classList.toggle('active', b.dataset.studio === state.studio));
    $('studioLabel').textContent = state.studio;

    const titles = { menage: 'ménage.', checklist: 'checklist.', achats: 'achats.' };
    $('heroTitle').textContent = titles[state.tab];

    const isList = state.tab !== 'achats';
    listPanel.hidden = !isList;
    achatsPanel.hidden = isList;

    const pending = state.achats.filter((a) => !a.fait).length;
    $('achatsBadge').hidden = pending === 0;
    $('achatsBadge').textContent = pending;

    if (isList) renderList();
    else renderAchats();
}

function renderList() {
    const list = state.tab;
    const items = state.items.filter((i) => i.list === list);
    const checksByItem = new Map(state.checks.map((c) => [c.item_id, c]));

    listPanel.classList.toggle('editing', state.editing);
    editToggle.textContent = state.editing ? 'Terminer' : 'Modifier la liste';
    $('listEyebrow').textContent = list === 'menage' ? 'Étapes du ménage' : 'Checklist du jour';
    addInput.placeholder = list === 'menage' ? 'Ajouter une étape…' : 'Ajouter un point à vérifier…';
    $('checklistCta').hidden = list !== 'checklist';

    const done = items.filter((i) => checksByItem.has(i.id)).length;
    $('progressCount').textContent = `${done} / ${items.length}`;
    $('progressFill').style.width = items.length ? `${(done / items.length) * 100}%` : '0';
    document.querySelector('.progress-card').classList.toggle('complete', items.length > 0 && done === items.length);

    taskList.replaceChildren();
    if (!items.length) {
        taskList.append(el('li', 'empty', 'Aucune étape pour le moment. Ajoutez-en une ci-dessous.'));
        return;
    }

    items.forEach((item, index) => {
        const check = checksByItem.get(item.id);
        const li = el('li', `task${check ? ' done' : ''}`);

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
            iconBtn('pen', 'Renommer', () => startRename(li, body, item)),
            up,
            down,
            iconBtn('trash', 'Supprimer', () => deleteItem(item), 'danger'),
        );

        li.append(box, body, tools);
        taskList.append(li);
    });
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

// ---------- Actions : tâches ----------
async function toggleCheck(item, check) {
    if (check) {
        state.checks = state.checks.filter((c) => c.id !== check.id);
        render();
        const { error } = await supabase.from('menage_checks').delete().eq('id', check.id);
        if (error) handleError(error);
    } else {
        const row = { item_id: item.id, day: today(), studio: state.studio, done_by: state.who || null };
        const { data, error } = await supabase
            .from('menage_checks')
            .upsert(row, { onConflict: 'item_id,day,studio' })
            .select()
            .single();
        if (error) return handleError(error);
        state.checks = state.checks.filter((c) => c.item_id !== item.id).concat(data);
        render();
        const items = state.items.filter((i) => i.list === state.tab);
        if (items.every((i) => state.checks.some((c) => c.item_id === i.id))) toast('Tout est fait, merci ✨');
    }
}

async function addItem(label) {
    const items = state.items.filter((i) => i.list === state.tab);
    const position = items.length ? Math.max(...items.map((i) => i.position)) + 1 : 1;
    const { data, error } = await supabase
        .from('menage_items')
        .insert({ list: state.tab, label, position })
        .select()
        .single();
    if (error) return handleError(error);
    state.items.push(data);
    render();
    toast('Étape ajoutée');
}

function startRename(li, body, item) {
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
    const ids = state.items.filter((i) => i.list === state.tab).map((i) => i.id);
    const toDelete = state.checks.filter((c) => ids.includes(c.item_id));
    if (!toDelete.length) return;
    if (!confirm('Tout décocher pour aujourd\'hui ?')) return;
    state.checks = state.checks.filter((c) => !ids.includes(c.item_id));
    render();
    const { error } = await supabase.from('menage_checks').delete().in('id', toDelete.map((c) => c.id));
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
function setTab(tab) {
    state.tab = tab;
    state.editing = false;
    localStorage.setItem('ml_tab', tab);
    render();
}

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

$('achatForm').addEventListener('submit', submitAchat);
document.querySelectorAll('#quickPicks .chip').forEach((chip) => chip.addEventListener('click', () => {
    $('achatArticle').value = chip.textContent;
    $('achatQuantite').focus();
}));

$('todayLabel').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

// Synchronisation entre les téléphones de l'équipe
let lastDay = today();
setInterval(() => {
    if (document.hidden || state.editing) return;
    if (today() !== lastDay) {
        lastDay = today();
        $('todayLabel').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    loadAll();
}, REFRESH_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !state.editing) loadAll(); });

render();
loadAll();
