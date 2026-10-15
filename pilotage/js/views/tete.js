// 09 · Ce qui tourne dans ma tête : déposer une pensée en un geste, la qualifier ensuite seulement si j'en ai envie.
// Une pensée peut devenir une tâche ou un projet, toujours après validation.
import { h, eyebrow, modal, confirmDialog, toast } from '../ui.js';
import { all, get, create, update, remove } from '../store.js';
import { projects } from '../data.js';
import { today, longDate } from '../dates.js';
import { state } from '../state.js';

const TYPES = [
    { id: 'idee', label: 'idée' },
    { id: 'inquietude', label: 'inquiétude' },
    { id: 'emotion', label: 'émotion' },
    { id: 'decision', label: 'décision' },
];
const NEEDS = [
    { id: 'action', label: 'une action à faire' },
    { id: 'attendre', label: 'peut attendre' },
    { id: 'exprimer', label: 'j\'avais juste besoin de l\'exprimer' },
];
const STATES = [
    { id: 'tete', label: 'en tête' },
    { id: 'apaisee', label: 'apaisées' },
    { id: 'archivee', label: 'archivées' },
    { id: 'tout', label: 'tout' },
];
const labelOf = (list, id) => (list.find((x) => x.id === id) || {}).label;
const hour = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`; };
const stateOf = (p) => (p.archived ? 'archivee' : p.calm ? 'apaisee' : 'tete');

function selectOf(list, value, label, none) {
    const sel = h('select', { class: 'field', 'aria-label': label }, h('option', { value: '' }, none), list.map((x) => h('option', { value: x.id }, x.label)));
    sel.value = value || '';
    return sel;
}

// ---------- Relier à une tâche ou à un projet (après validation) ----------
function toTaskDialog(p) {
    return modal((box, close) => {
        const title = h('input', { class: 'field', value: (p.nextAction || p.text).slice(0, 140), 'aria-label': 'intitulé de la tâche' });
        const due = h('input', { class: 'field date', type: 'date', value: today(), 'aria-label': 'deadline' });
        const project = h('select', { class: 'field', 'aria-label': 'projet' }, h('option', { value: '' }, 'aucun · perso'),
            projects((x) => x.status !== 'archive').map((x) => h('option', { value: x.id }, x.name)));
        box.append(h('form', {
            class: 'stack',
            onsubmit: (ev) => {
                ev.preventDefault();
                if (!title.value.trim()) { title.focus(); return; }
                if (!due.value) { due.focus(); return; }
                const t = create('task', { title: title.value.trim(), due: due.value, done: false, order: Date.now() / 1e10, ...(project.value ? { projectId: project.value } : { brand: 'perso' }) });
                update(p.id, { taskId: t.id, need: 'action' });
                toast('la tâche est créée.');
                close(true);
            },
        },
        h('h2', null, 'en faire une tâche\u00a0?'),
        h('p', { class: 'small muted' }, 'Elle apparaîtra dans ta to-do et ton calendrier à la date choisie. Rien n\'est créé sans ton clic sur « créer la tâche ».'),
        h('label', { class: 'field-label' }, 'la tâche', title),
        h('div', { class: 'two' }, h('label', { class: 'field-label' }, 'deadline', due), h('label', { class: 'field-label' }, 'projet', project)),
        h('div', { class: 'modal-actions' },
            h('button', { type: 'button', class: 'btn ghost', onclick: () => close(null) }, 'annuler'),
            h('button', { type: 'submit', class: 'btn primary' }, 'créer la tâche'))));
    }, { label: 'en faire une tâche' });
}

function toProjectDialog(p) {
    return modal((box, close) => {
        const name = h('input', { class: 'field', value: (p.nextAction || p.text).split('\n')[0].slice(0, 80), 'aria-label': 'nom du projet' });
        box.append(h('form', {
            class: 'stack',
            onsubmit: (ev) => {
                ev.preventDefault();
                if (!name.value.trim()) { name.focus(); return; }
                const pr = create('project', {
                    name: name.value.trim().replace(/\.$/, ''), type: '', brand: 'perso', status: 'idee',
                    order: Date.now() / 1e10, concept: p.text, keywords: [], moodboard: [], palette: [], ideas: [], notes: '', docs: [], cover: null,
                });
                update(p.id, { projectId: pr.id });
                toast('le projet est créé, dans tes idées.');
                close(true);
            },
        },
        h('h2', null, 'en faire un projet\u00a0?'),
        h('p', { class: 'small muted' }, 'Il sera rangé dans tes idées de projets (marque perso), avec ta pensée comme concept. Rien n\'est créé sans ton clic sur « créer le projet ».'),
        h('label', { class: 'field-label' }, 'nom du projet', name),
        h('div', { class: 'modal-actions' },
            h('button', { type: 'button', class: 'btn ghost', onclick: () => close(null) }, 'annuler'),
            h('button', { type: 'submit', class: 'btn primary' }, 'créer le projet'))));
    }, { label: 'en faire un projet' });
}

// ---------- Modifier une pensée ----------
function thoughtDialog(p) {
    return modal((box, close) => {
        const text = h('textarea', { class: 'field', rows: 5, 'aria-label': 'ma pensée' });
        text.value = p.text;
        const type = selectOf(TYPES, p.type, 'ce que c\'est', 'pas précisé');
        const need = selectOf(NEEDS, p.need, 'ce dont j\'ai besoin', 'pas précisé');
        const next = h('input', { class: 'field', value: p.nextAction || '', placeholder: 'facultatif : un tout petit pas', 'aria-label': 'prochaine petite action' });
        box.append(h('form', {
            class: 'stack',
            onsubmit: (ev) => {
                ev.preventDefault();
                if (!text.value.trim()) { text.focus(); return; }
                update(p.id, { text: text.value.trim(), type: type.value || null, need: need.value || null, nextAction: next.value.trim() });
                close(true);
            },
        },
        h('h2', null, 'ma pensée.'),
        eyebrow(`${longDate(p.date)} · ${hour(p.createdAt)}`),
        text,
        h('div', { class: 'two' }, h('label', { class: 'field-label' }, 'c\'est plutôt', type), h('label', { class: 'field-label' }, 'j\'ai besoin de', need)),
        h('label', { class: 'field-label' }, 'prochaine petite action', next),
        h('div', { class: 'modal-actions' },
            h('button', {
                type: 'button', class: 'btn ghost danger-text push-left',
                onclick: async () => { close(null); if (await confirmDialog('Cette pensée sera supprimée.')) remove(p.id); },
            }, 'supprimer'),
            h('button', { type: 'button', class: 'btn ghost', onclick: () => close(null) }, 'annuler'),
            h('button', { type: 'submit', class: 'btn primary' }, 'enregistrer'))));
    }, { label: 'ma pensée' });
}

function linkLine(p) {
    const task = p.taskId && get(p.taskId);
    const project = p.projectId && get(p.projectId);
    const links = [];
    if (task) links.push(h('a', { class: 'link', href: task.projectId ? `#/projet/${task.projectId}` : '#/calendrier' }, `→ tâche : ${task.title}`));
    if (project) links.push(h('a', { class: 'link', href: `#/projet/${project.id}` }, `→ projet : ${project.name}`));
    return links.length ? h('div', { class: 'thought-links small' }, links) : null;
}

function thoughtCard(p) {
    const tags = [labelOf(TYPES, p.type), labelOf(NEEDS, p.need)].filter(Boolean);
    const st = stateOf(p);
    return h('article', { class: `card thought${st !== 'tete' ? ` ${st}` : ''}` },
        h('div', { class: 'section-head' },
            eyebrow(`${longDate(p.date)} · ${hour(p.createdAt)}${st === 'apaisee' ? ' · apaisée' : st === 'archivee' ? ' · archivée' : ''}`),
            h('button', { type: 'button', class: 'link plain small', onclick: () => thoughtDialog(p) }, 'modifier')),
        h('p', { class: 'thought-text' }, p.text),
        tags.length ? h('div', { class: 'chips' }, tags.map((t) => h('span', { class: 'chip small static' }, t))) : null,
        p.nextAction ? h('p', { class: 'small' }, h('strong', null, 'prochaine petite action · '), p.nextAction) : null,
        linkLine(p),
        h('div', { class: 'thought-actions' },
            st === 'tete' ? h('button', { type: 'button', class: 'btn small', onclick: () => update(p.id, { calm: true }) }, 'c\'est apaisé') : null,
            st === 'apaisee' ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => update(p.id, { calm: false }) }, 'ça revient') : null,
            st !== 'archivee' ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => update(p.id, { archived: true }) }, 'archiver')
                : h('button', { type: 'button', class: 'btn ghost small', onclick: () => update(p.id, { archived: false }) }, 'désarchiver'),
            !p.taskId && st !== 'archivee' ? h('button', { type: 'button', class: 'link plain small', onclick: () => toTaskDialog(p) }, 'en faire une tâche') : null,
            !p.projectId && st !== 'archivee' ? h('button', { type: 'button', class: 'link plain small', onclick: () => toProjectDialog(p) }, 'en faire un projet') : null));
}

function dropForm() {
    const area = h('textarea', {
        id: 'tete-text', class: 'field big-thought', rows: 5, placeholder: 'écris comme ça vient. personne d\'autre ne le lira.',
        'aria-label': 'ma pensée', oninput: (e) => { state.teteDraft = e.target.value; },
    });
    area.value = state.teteDraft || '';
    return h('section', { class: 'card stack', 'aria-labelledby': 'tete-q' },
        h('h2', { id: 'tete-q' }, 'qu\'est-ce qui prend de la place dans ta tête aujourd\'hui\u00a0?'),
        h('form', {
            class: 'stack',
            onsubmit: (ev) => {
                ev.preventDefault();
                const text = area.value.trim();
                if (!text) { area.focus(); return; }
                state.teteDraft = '';
                create('pensee', { text, date: today(), type: null, need: null, nextAction: '', calm: false, archived: false });
                toast('c\'est déposé. tu pourras y revenir quand tu veux.');
            },
        }, area, h('button', { type: 'submit', class: 'btn primary self-start' }, 'déposer ma pensée')));
}

export function renderTete() {
    const st = state.teteState || 'tete';
    const type = state.teteType || '';
    const need = state.teteNeed || '';
    const all_ = all('pensee');
    // La recherche redessine seulement la liste, pour ne pas perdre la frappe en cours
    const listBox = h('div', { class: 'stack' });
    const drawList = () => {
        const q = (state.teteQuery || '').trim().toLowerCase();
        const list = all_.filter((p) => (st === 'tout' || stateOf(p) === st) && (!type || p.type === type) && (!need || p.need === need)
            && (!q || `${p.text} ${p.nextAction || ''}`.toLowerCase().includes(q)))
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const filtered = q || type || need || st !== 'tete';
        listBox.replaceChildren(list.length ? h('div', { class: 'thought-list' }, list.map(thoughtCard))
            : h('p', { class: 'empty' }, filtered ? 'aucune pensée ne correspond. essaie un autre filtre.' : 'rien ne tourne pour l\'instant. tant mieux.'));
    };
    drawList();
    const chip = (id, label) => h('button', {
        type: 'button', class: `chip${st === id ? ' on' : ''}`, 'aria-pressed': String(st === id),
        onclick: () => { state.teteState = id; state.rerender(); },
    }, label);
    const search = h('input', {
        id: 'tete-search', class: 'field pill', type: 'search', placeholder: 'rechercher dans mes pensées…', value: state.teteQuery || '', 'aria-label': 'rechercher',
        oninput: (e) => { state.teteQuery = e.target.value; drawList(); },
    });
    const typeSel = selectOf(TYPES, type, 'filtrer par type', 'tous les types');
    typeSel.classList.add('pill');
    typeSel.addEventListener('change', () => { state.teteType = typeSel.value; state.rerender(); });
    const needSel = selectOf(NEEDS, need, 'filtrer par besoin', 'tous les besoins');
    needSel.classList.add('pill');
    needSel.addEventListener('change', () => { state.teteNeed = needSel.value; state.rerender(); });
    return h('div', { class: 'page tete' },
        h('header', { class: 'stack-sm' }, eyebrow('pour alléger ma charge mentale'), h('h1', { class: 'title' }, 'ce qui tourne dans ma tête.')),
        dropForm(),
        all_.length ? h('section', { class: 'stack', 'aria-labelledby': 'tete-list' },
            h('div', { class: 'section-head wrap' }, h('h2', { id: 'tete-list' }, 'mes pensées.'),
                h('div', { class: 'chips', role: 'group', 'aria-label': 'filtrer par état' }, STATES.map((s) => chip(s.id, s.label)))),
            h('div', { class: 'tete-filters' }, search, typeSel, needSel),
            listBox)
            : h('p', { class: 'empty' }, 'ici, tu peux tout déposer : une idée, un souci, une émotion, une décision à prendre. rien n\'est obligatoire, tu reviens quand tu veux.'));
}
