// 02 · Tous mes projets
import { h, img, eyebrow, progressBar, modal } from '../ui.js';
import { create, update } from '../store.js';
import { BRANDS, STATUSES, brand, projects, progress, nextDeadline, num } from '../data.js';
import { dayMonth, shortDate } from '../dates.js';
import { state } from '../state.js';

// Fenêtre « + nouveau projet », accessible depuis toutes les pages
export function newProjectDialog() {
    return modal((box, close) => {
        const name = h('input', { class: 'field', placeholder: 'nom du projet', required: true, 'aria-label': 'nom du projet' });
        const type = h('input', { class: 'field', placeholder: 'type : event, campagne, marque…', 'aria-label': 'type de projet' });
        const brandSel = h('select', { class: 'field', 'aria-label': 'marque' }, BRANDS.map((b) => h('option', { value: b.id }, b.label)));
        const statusSel = h('select', { class: 'field', 'aria-label': 'statut' },
            h('option', { value: 'cours' }, 'en cours'), h('option', { value: 'idee' }, 'idée'));
        if (state.brandFilter !== 'tout') brandSel.value = state.brandFilter;
        box.append(h('form', {
            onsubmit: (e) => {
                e.preventDefault();
                if (!name.value.trim()) return;
                const p = create('project', {
                    name: name.value.trim().replace(/\.$/, ''), type: type.value.trim(), brand: brandSel.value, status: statusSel.value,
                    order: Date.now() / 1e10, concept: '', keywords: [], moodboard: [], palette: [], ideas: [], notes: '', docs: [], cover: null,
                });
                close(p);
                location.hash = `#/projet/${p.id}`;
            },
        },
        h('h2', null, 'nouveau projet.'),
        h('label', { class: 'field-label' }, 'nom', name),
        h('div', { class: 'two' }, h('label', { class: 'field-label' }, 'marque', brandSel), h('label', { class: 'field-label' }, 'statut', statusSel)),
        h('label', { class: 'field-label' }, 'type', type),
        h('div', { class: 'modal-actions' },
            h('button', { type: 'button', class: 'btn ghost', onclick: () => close(null) }, 'annuler'),
            h('button', { type: 'submit', class: 'btn primary' }, 'créer le projet'))));
    }, { label: 'nouveau projet' });
}

function cover(p) {
    if (p.cover) return img(p.cover, { class: 'cover', alt: `couverture du projet ${p.name}` });
    return h('span', { class: 'cover placeholder', style: { background: brand(p.brand).bg === '#D9B45A' || brand(p.brand).bg === '#D9A078' ? '#5A3418' : brand(p.brand).bg } }, 'image de couverture');
}

function projectCard(p, i) {
    const b = brand(p.brand);
    const pr = progress(p.id);
    const next = nextDeadline(p.id);
    const meta = [num(i), b.id === 'perso' ? null : b.label, p.type].filter(Boolean).join(' · ');
    let right = '';
    if (next) right = `prochaine deadline · ${dayMonth(next)}`;
    else if (p.keyDate) right = `${p.keyLabel || 'date clé'} · ${shortDate(p.keyDate)}`;
    return h('a', { href: `#/projet/${p.id}`, class: 'card project-card' },
        cover(p),
        h('span', { class: 'pc-body' },
            eyebrow(meta),
            h('span', { class: 'card-title big' }, `${p.name}.`),
            progressBar(pr.pct),
            h('span', { class: 'pc-foot' }, h('span', { class: 'nowrap' }, pr.total ? `${pr.done} tâche${pr.done > 1 ? 's' : ''} sur ${pr.total}` : 'to-do à remplir'), h('span', { class: 'nowrap' }, right))));
}

function ideaCard(p, i) {
    return h('a', { href: `#/projet/${p.id}`, class: 'card idea-card' },
        eyebrow([num(i), p.type].filter(Boolean).join(' · ')), h('span', { class: 'card-title big' }, `${p.name}.`));
}

export function renderProjects() {
    const active = projects((p) => p.status !== 'archive');
    const counts = {
        cours: active.filter((p) => p.status === 'cours').length,
        idee: active.filter((p) => p.status === 'idee').length,
        termine: active.filter((p) => p.status === 'termine').length,
    };
    const f = state.projectFilter;
    const show = (id) => f === 'tout' || f === id;
    const chip = (id, label) => h('button', {
        type: 'button', class: `chip${f === id ? ' on' : ''}`, 'aria-pressed': String(f === id),
        onclick: () => { state.projectFilter = id; state.rerender(); },
    }, label);
    const summary = [`${active.length} projet${active.length > 1 ? 's' : ''}`, `${counts.cours} en cours`, `${counts.idee} idée${counts.idee > 1 ? 's' : ''}`].join(' · ');
    const archived = projects((p) => p.status === 'archive');
    let n = 0;
    const section = (id, title, list, render, extra = []) => (show(id) ? h('section', { class: 'stack', 'aria-labelledby': `s-${id}` },
        h('h2', { id: `s-${id}` }, title),
        list.length || extra.length
            ? h('div', { class: 'grid-cards wide' }, list.map((p) => render(p, n++)), extra)
            : h('p', { class: 'empty' }, `aucun projet ${id === 'termine' ? 'terminé' : 'en cours'} pour l'instant.`)) : null);

    return h('div', { class: 'page' },
        h('header', { class: 'page-head' },
            h('div', { class: 'stack-sm' }, eyebrow(summary), h('h1', { class: 'title' }, 'tous mes projets.')),
            h('div', { class: 'chips', role: 'group', 'aria-label': 'filtrer par statut' }, chip('tout', 'tout'), STATUSES.map((s) => chip(s.id, s.label)))),
        section('cours', 'en cours.', active.filter((p) => p.status === 'cours'), projectCard),
        section('idee', 'idées.', active.filter((p) => p.status === 'idee'), ideaCard, [
            h('a', { href: '#/new-york', class: 'card idea-card cherry' }, eyebrow('mon objectif', 'gold'), h('span', { class: 'card-title big' }, 'new york.')),
            h('button', { type: 'button', class: 'dropzone idea-add', onclick: () => newProjectDialog() }, '+ nouveau projet'),
        ]),
        section('termine', 'terminés.', active.filter((p) => p.status === 'termine'), projectCard),
        archived.length && f === 'tout' ? h('details', { class: 'archives' },
            h('summary', null, `archivés · ${archived.length}`),
            h('div', { class: 'rows' }, archived.map((p) => h('div', { class: 'archive-row' },
                h('a', { href: `#/projet/${p.id}` }, `${p.name}.`),
                h('button', { type: 'button', class: 'btn ghost small', onclick: () => update(p.id, { status: 'cours' }) }, 'désarchiver'))))) : null);
}
