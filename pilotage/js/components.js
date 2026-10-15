// Composants partagés : moodboard, palette, liste de tâches
import { h, img, dropzone, sortable, grip, closeBtn, confirmDialog, datePill, tag, makeDroppable, toast } from './ui.js';
import { get, update, remove, create, deleteFile, uid } from './store.js';
import { taskBrand, num } from './data.js';
import { today } from './dates.js';

// ---------- Moodboard : images déposées, déplaçables, avec légende ----------
// owner : l'élément qui porte le champ (profil, projet…) ; field : nom du champ (par défaut "moodboard")
export function moodboard(ownerId, { field = 'moodboard', layout = 'mosaic', addLabel = 'dépose tes images ici, ou clique pour en choisir', extra = null } = {}) {
    const owner = get(ownerId);
    const images = owner[field] || [];
    const grid = h('div', { class: `mood-grid ${layout}` });
    images.forEach((m, i) => {
        const caption = h('input', {
            class: 'mood-caption', value: m.caption || '', placeholder: 'légende…', 'aria-label': 'légende de l\'image',
            oninput: (e) => {
                const list = get(ownerId)[field].map((x) => (x.id === m.id ? { ...x, caption: e.target.value } : x));
                update(ownerId, { [field]: list }, { quiet: true });
            },
        });
        grid.append(h('figure', { class: `mood-item${layout === 'mosaic' && i % 3 === 0 ? ' tall' : ''}`, 'data-sort-id': m.id },
            img(m.ref, { alt: m.caption || 'image du moodboard' }),
            grip('déplacer l\'image'),
            closeBtn('supprimer l\'image', async () => {
                if (!(await confirmDialog('Cette image sera retirée du moodboard.'))) return;
                update(ownerId, { [field]: get(ownerId)[field].filter((x) => x.id !== m.id) });
                deleteFile(m.ref);
            }),
            caption));
    });
    if (extra) grid.append(extra);
    const add = (refs) => update(ownerId, { [field]: [...(get(ownerId)[field] || []), ...refs.map(({ ref }) => ({ id: uid(), ref, caption: '' }))] });
    const zone = dropzone({ label: addLabel, onFiles: add, cls: layout === 'tiles' ? 'tile' : '' });
    if (layout === 'tiles') grid.append(zone);
    sortable(grid, (order) => {
        const list = get(ownerId)[field];
        update(ownerId, { [field]: order.map((id) => list.find((x) => x.id === id)).filter(Boolean) });
    });
    // On peut aussi lâcher des images directement sur la grille
    makeDroppable(grid, (files) => zone.handleFiles(files), 'image/*');
    return layout === 'tiles' ? grid : h('div', { class: 'stack' }, images.length ? grid : null, zone);
}

// ---------- Palette de couleurs ----------
export function palette(ownerId, { field = 'palette', compact = false } = {}) {
    const colors = get(ownerId)[field] || [];
    const save = (list) => update(ownerId, { [field]: list });
    const swatch = (c, i) => {
        const picker = h('input', {
            type: 'color', value: c.hex, 'aria-label': `modifier la couleur ${c.name || c.hex}`,
            onchange: (e) => save(colors.map((x, j) => (j === i ? { ...x, hex: e.target.value.toUpperCase() } : x))),
        });
        const dot = h('span', { class: 'swatch', style: { background: c.hex } }, picker);
        const del = closeBtn('retirer la couleur', async () => {
            if (await confirmDialog(`La couleur ${c.name || c.hex} sera retirée de la palette.`, 'retirer')) save(colors.filter((_, j) => j !== i));
        });
        if (compact) return h('span', { class: 'swatch-wrap', title: c.name || c.hex }, dot, del);
        const name = h('input', {
            class: 'swatch-name', value: c.name || '', placeholder: c.hex, 'aria-label': 'nom de la couleur',
            oninput: (e) => update(ownerId, { [field]: get(ownerId)[field].map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }, { quiet: true }),
        });
        return h('div', { class: 'swatch-row' }, dot, name, del);
    };
    const addBtn = h('label', { class: 'swatch add', title: 'ajouter une couleur' },
        h('span', { 'aria-hidden': 'true' }, '+'),
        h('input', { type: 'color', value: '#7A1014', 'aria-label': 'ajouter une couleur', onchange: (e) => save([...colors, { hex: e.target.value.toUpperCase(), name: '' }]) }));
    return h('div', { class: compact ? 'palette compact' : 'palette' }, colors.map(swatch), addBtn);
}

// ---------- Ligne de tâche ----------
function fitHeight(el) {
    if (!el.isConnected) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
}
// Les intitulés se recalculent quand la largeur change (rotation du téléphone, fenêtre redimensionnée)
window.addEventListener('resize', () => document.querySelectorAll('textarea.task-title').forEach(fitHeight));

export function taskRow(task, { index, showBrand = true, showNumber = true, sortableRow = true } = {}) {
    const b = taskBrand(task);
    const check = h('input', {
        type: 'checkbox', checked: task.done, 'aria-label': `terminer : ${task.title}`,
        onchange: (e) => update(task.id, { done: e.target.checked, doneOn: e.target.checked ? today() : null }),
    });
    // Zone de texte d'une ligne qui s'agrandit : les intitulés longs passent à la ligne au lieu d'être coupés
    const title = h('textarea', {
        class: 'task-title', rows: 1, 'aria-label': 'intitulé de la tâche',
        oninput: (e) => { e.target.value = e.target.value.replace(/\n/g, ' '); fitHeight(e.target); update(task.id, { title: e.target.value }, { quiet: true }); },
        onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } },
    });
    title.value = task.title;
    requestAnimationFrame(() => fitHeight(title));
    return h('div', { class: `task-row${task.done ? ' done' : ''}`, 'data-sort-id': task.id },
        sortableRow ? grip('déplacer la tâche') : null,
        showNumber ? h('span', { class: 'num' }, num(index)) : null,
        check, title,
        showBrand ? tag(b) : null,
        task.done ? h('span', { class: 'date-pill done-pill' }, 'fait') : datePill(task.due, (d) => update(task.id, { due: d })),
        closeBtn('supprimer la tâche', async () => {
            if (await confirmDialog(`La tâche « ${task.title} » sera supprimée partout (projet, accueil, calendrier).`)) remove(task.id);
        }));
}

export function taskList(tasks, opts = {}) {
    const list = h('div', { class: 'rows' }, tasks.map((t, i) => taskRow(t, { ...opts, index: i })));
    if (opts.sortableRow !== false) {
        sortable(list, (order) => order.forEach((id, i) => update(id, { order: i }, { quiet: true })));
    }
    return list;
}

// Formulaire d'ajout : chaque tâche a une deadline obligatoire
export function taskAdder({ id = 'new-task', fields = () => ({}), defaultDue = '', extra = null, placeholder = 'nouvelle tâche…' }) {
    const title = h('input', { id, class: 'field pill', placeholder, 'aria-label': 'nouvelle tâche', autocomplete: 'off' });
    const due = h('input', { id: `${id}-date`, class: 'field pill date', type: 'date', value: defaultDue, 'aria-label': 'deadline' });
    const submit = (e) => {
        e.preventDefault();
        const text = title.value.trim();
        if (!text) { title.focus(); return; }
        if (!due.value) { toast('choisis une deadline pour cette tâche'); due.focus(); due.showPicker?.(); return; }
        create('task', { title: text, due: due.value, done: false, order: Date.now() / 1e10, ...fields() });
        // la page se redessine : on garde le curseur dans le champ pour enchaîner
        requestAnimationFrame(() => document.getElementById(id)?.focus());
    };
    return h('form', { class: 'adder', onsubmit: submit }, title, extra, due, h('button', { type: 'submit', class: 'btn' }, 'ajouter'));
}
