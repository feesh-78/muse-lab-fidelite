// 08 · Bucket list : une carte par envie, « c'est fait » la range dans « déjà vécu » avec la date
import { h, eyebrow, img, modal, confirmDialog, pickFiles, makeDroppable, toast } from '../ui.js';
import { all, get, create, update, remove, uploadFile, deleteFile } from '../store.js';
import { THEMES, themeLabel, projects, num } from '../data.js';
import { today, daysBetween, fromKey } from '../dates.js';
import { state } from '../state.js';
import { profile } from './home.js';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthYear = (key) => { const d = fromKey(key); return `${MOIS[d.getMonth()]} ${d.getFullYear()}`; };

function wishDialog(wish) {
    const w = wish || { title: '', theme: state.bucketTheme && state.bucketTheme !== 'tout' ? state.bucketTheme : 'voyages', projectId: null, ny: false };
    return modal((box, close) => {
        const title = h('input', { class: 'field', value: w.title, placeholder: 'ce que j\'ai envie de vivre', 'aria-label': 'mon envie' });
        const theme = h('select', { class: 'field', 'aria-label': 'thème' }, THEMES.map((t) => h('option', { value: t.id }, t.label)));
        theme.value = w.theme;
        const link = h('select', { class: 'field', 'aria-label': 'reliée à' },
            h('option', { value: '' }, 'rien'), h('option', { value: 'ny' }, 'mon objectif new york'),
            projects((p) => p.status !== 'archive').map((p) => h('option', { value: p.id }, `projet · ${p.name}.`)));
        link.value = w.ny ? 'ny' : w.projectId || '';
        box.append(h('form', {
            onsubmit: (e) => {
                e.preventDefault();
                if (!title.value.trim()) { title.focus(); return; }
                const fields = { title: title.value.trim().replace(/\.$/, ''), theme: theme.value, ny: link.value === 'ny', projectId: link.value && link.value !== 'ny' ? link.value : null };
                if (wish) update(wish.id, fields); else create('wish', { ...fields, done: false, image: null });
                close(true);
            },
        },
        h('h2', null, wish ? 'mon envie.' : 'nouvelle envie.'),
        h('label', { class: 'field-label' }, 'envie', title),
        h('div', { class: 'two' }, h('label', { class: 'field-label' }, 'thème', theme), h('label', { class: 'field-label' }, 'reliée à', link)),
        h('div', { class: 'modal-actions' },
            wish ? h('button', {
                type: 'button', class: 'btn ghost danger-text push-left',
                onclick: async () => {
                    close(null);
                    if (!(await confirmDialog(`L'envie « ${wish.title} » sera supprimée.`))) return;
                    if (wish.image) deleteFile(wish.image);
                    remove(wish.id);
                },
            }, 'supprimer') : null,
            h('button', { type: 'button', class: 'btn ghost', onclick: () => close(null) }, 'annuler'),
            h('button', { type: 'submit', class: 'btn primary' }, wish ? 'enregistrer' : 'ajouter'))));
    }, { label: 'envie' });
}

function wishCard(w, i) {
    const changeImage = async (files) => {
        const file = files?.[0];
        if (!file) return;
        try {
            const old = w.image;
            update(w.id, { image: await uploadFile(file) });
            if (old) deleteFile(old);
        } catch { toast('envoi impossible, vérifie ta connexion'); }
    };
    const project = w.projectId && get(w.projectId);
    const enRoute = w.ny || (project && project.status === 'cours');
    const pic = h('button', { type: 'button', class: `wish-img${w.image ? '' : ' empty'}`, 'aria-label': 'changer l\'image', onclick: async () => changeImage(await pickFiles()) },
        w.image ? img(w.image, { alt: w.title }) : h('span', null, `+ image · ${w.title}`));
    makeDroppable(pic, changeImage, 'image/*');
    let linkEl = null;
    if (w.ny) linkEl = h('a', { href: '#/new-york', class: 'link' }, `voir mon objectif · j-${Math.max(0, daysBetween(today(), profile().nyDate))}`);
    else if (project) linkEl = h('a', { href: `#/projet/${project.id}`, class: 'link' }, `voir la fiche · ${project.name}`);
    return h('article', { class: 'card wish-card' }, pic,
        h('div', { class: 'wish-body' },
            eyebrow([num(i), themeLabel(w.theme), enRoute ? 'en route' : null].filter(Boolean).join(' · ')),
            h('button', { type: 'button', class: 'wish-title', onclick: () => wishDialog(w) }, `${w.title}.`),
            linkEl,
            h('label', { class: 'check-line' }, h('input', { type: 'checkbox', onchange: () => update(w.id, { done: true, doneOn: today() }) }), 'c\'est fait')));
}

export function renderBucket() {
    const theme = state.bucketTheme || 'tout';
    const match = (w) => theme === 'tout' || w.theme === theme;
    const todo = all('wish', (w) => !w.done && match(w)).sort((a, b) => (b.ny - a.ny) || a.createdAt.localeCompare(b.createdAt));
    const done = all('wish', (w) => w.done && match(w)).sort((a, b) => (b.doneOn || '').localeCompare(a.doneOn || ''));
    const chip = (id, label) => h('button', { type: 'button', class: `chip${theme === id ? ' on' : ''}`, 'aria-pressed': String(theme === id), onclick: () => { state.bucketTheme = id; state.rerender(); } }, label);
    return h('div', { class: 'page bucket' },
        h('header', { class: 'page-head' },
            h('div', { class: 'stack-sm' }, eyebrow('tout ce que j\'ai envie de vivre'), h('h1', { class: 'title' }, 'ma bucket list.')),
            h('div', { class: 'chips', role: 'group', 'aria-label': 'filtrer par thème' }, chip('tout', 'tout'), THEMES.map((t) => chip(t.id, t.label)))),
        h('section', { class: 'stack', 'aria-labelledby': 'k-envie' },
            h('h2', { id: 'k-envie' }, 'ce que je veux vivre.'),
            h('div', { class: 'grid-cards wide' }, todo.map(wishCard),
                h('button', { type: 'button', class: 'dropzone idea-add wish-add', onclick: () => wishDialog(null) }, '+ ajouter une envie'))),
        h('section', { class: 'card', 'aria-labelledby': 'k-fait' },
            h('h2', { id: 'k-fait' }, 'déjà vécu.'),
            done.length ? h('div', { class: 'rows' }, done.map((w, i) => h('div', { class: 'task-row done-wish' },
                h('span', { class: 'num' }, num(i)),
                h('input', { type: 'checkbox', checked: true, 'aria-label': `remettre « ${w.title} » dans mes envies`, onchange: () => update(w.id, { done: false, doneOn: null }) }),
                h('button', { type: 'button', class: 'wish-done-title', onclick: () => wishDialog(w) }, w.title),
                // date modifiable : un sélecteur invisible est posé sur le mois affiché
                h('span', { class: 'date-pill done-pill' }, w.doneOn ? monthYear(w.doneOn) : 'date',
                    h('input', { type: 'date', value: w.doneOn || '', 'aria-label': 'date où je l\'ai vécu', onchange: (e) => { if (e.target.value) update(w.id, { doneOn: e.target.value }); } })))))
                : h('p', { class: 'empty' }, 'coche « c\'est fait » sur une envie : elle s\'affichera ici avec sa date.')));
}
