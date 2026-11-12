// 08 · Moi, en dehors du travail : ce qui me plaît, sans en faire un projet. Aucun score, aucune date imposée.
import { h, eyebrow, modal, confirmDialog, toast } from '../ui.js';
import { all, create, update, remove } from '../store.js';
import { euros, toNumber } from '../data.js';
import { shortDate } from '../dates.js';
import { state } from '../state.js';

export const RUBRICS = [
    { id: 'envies', title: 'mes envies.', label: 'mes envies', intro: 'activités, expériences, sorties et voyages que j\'aimerais essayer.', empty: 'rien ici pour l\'instant. une envie, même toute petite, a sa place.', placeholder: 'un cours de céramique, un week-end à la mer…' },
    { id: 'apprendre', title: 'ce que j\'aimerais apprendre.', label: 'apprendre', intro: 'compétences, langues ou défis personnels.', empty: 'qu\'est-ce qui te rend curieuse ? note-le quand ça te vient.', placeholder: 'l\'italien, la poterie, nager le crawl…' },
    { id: 'liens', title: 'mes liens.', label: 'mes liens', intro: 'les personnes que j\'aimerais voir ou appeler, les moments à organiser.', empty: 'à qui as-tu pensé récemment ? tu peux commencer par un prénom.', placeholder: 'appeler…, un dîner avec…' },
    { id: 'bonheurs', title: 'mes petits bonheurs.', label: 'petits bonheurs', intro: 'souvenirs, découvertes et moments que j\'ai aimés.', empty: 'garde ici les jolis moments, pour pouvoir y revenir.', placeholder: 'un café au soleil, une chanson découverte…' },
];
export const STATUSES = [
    { id: 'explorer', label: 'à explorer' },
    { id: 'cours', label: 'en cours' },
    { id: 'vecu', label: 'vécu' },
    { id: 'plus', label: 'plus envie' },
];
const statusLabel = (id) => (STATUSES.find((s) => s.id === id) || STATUSES[0]).label;
// Les petits bonheurs sont déjà vécus : c'est leur statut par défaut
const defaultStatus = (rubric) => (rubric === 'bonheurs' ? 'vecu' : 'explorer');

function envieDialog(envie, rubric = 'envies') {
    const e = envie || { title: '', rubric, status: defaultStatus(rubric), note: '', budget: '', date: '' };
    return modal((box, close) => {
        const title = h('input', { class: 'field', value: e.title, placeholder: (RUBRICS.find((r) => r.id === e.rubric) || RUBRICS[0]).placeholder, 'aria-label': 'titre' });
        const rubricSel = h('select', { class: 'field', 'aria-label': 'rubrique' }, RUBRICS.map((r) => h('option', { value: r.id }, r.label)));
        rubricSel.value = e.rubric;
        let status = e.status;
        const statusChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'statut' });
        const drawChips = () => statusChips.replaceChildren(...STATUSES.map((s) => h('button', {
            type: 'button', class: `chip${status === s.id ? ' on' : ''}`, 'aria-pressed': String(status === s.id),
            onclick: () => { status = s.id; drawChips(); },
        }, s.label)));
        drawChips();
        const note = h('textarea', { class: 'field', rows: 3, placeholder: 'ce qui me donne envie, une idée, un lien…', 'aria-label': 'note' });
        note.value = e.note || '';
        const budget = h('input', { class: 'field', inputmode: 'decimal', value: e.budget || '', placeholder: 'facultatif', 'aria-label': 'budget' });
        const date = h('input', { class: 'field date', type: 'date', value: e.date || '', 'aria-label': 'date (facultative)' });
        box.append(h('form', {
            class: 'stack',
            onsubmit: (ev) => {
                ev.preventDefault();
                if (!title.value.trim()) { title.focus(); return; }
                const fields = {
                    title: title.value.trim().replace(/\.$/, ''), rubric: rubricSel.value, status,
                    note: note.value.trim(), budget: budget.value.trim() ? toNumber(budget.value) : '', date: date.value || '',
                };
                if (envie) update(envie.id, fields); else create('envie', fields);
                close(true);
            },
        },
        h('h2', null, envie ? 'mon envie.' : 'nouvelle envie.'),
        h('label', { class: 'field-label' }, 'titre', title),
        h('div', { class: 'stack-sm' }, eyebrow('statut'), statusChips),
        h('label', { class: 'field-label' }, 'note libre', note),
        h('div', { class: 'two' },
            h('label', { class: 'field-label' }, 'rubrique', rubricSel),
            h('label', { class: 'field-label' }, 'budget (€)', budget)),
        h('label', { class: 'field-label' }, 'date, si j\'en ai une', date),
        h('div', { class: 'modal-actions' },
            envie ? h('button', {
                type: 'button', class: 'btn ghost danger-text push-left',
                onclick: async () => { close(null); if (await confirmDialog(`« ${envie.title} » sera supprimée.`)) remove(envie.id); },
            }, 'supprimer') : null,
            h('button', { type: 'button', class: 'btn ghost', onclick: () => close(null) }, 'annuler'),
            h('button', { type: 'submit', class: 'btn primary' }, envie ? 'enregistrer' : 'ajouter'))));
    }, { label: 'envie' });
}

function envieCard(e) {
    const meta = [statusLabel(e.status), e.budget !== '' && e.budget != null ? euros(e.budget) : null, e.date ? shortDate(e.date) : null].filter(Boolean).join(' · ');
    return h('button', { type: 'button', class: `card envie-card status-${e.status}`, onclick: () => envieDialog(e) },
        eyebrow(meta),
        h('span', { class: 'card-title' }, e.title),
        e.note ? h('span', { class: 'small muted envie-note' }, e.note) : null);
}

function quickAdd() {
    const input = h('input', { id: 'moi-quick', class: 'field pill', placeholder: 'une envie, une personne, un truc à apprendre…', 'aria-label': 'ajouter rapidement une envie', autocomplete: 'off' });
    const rubricSel = h('select', { class: 'field pill', 'aria-label': 'rubrique' }, RUBRICS.map((r) => h('option', { value: r.id }, r.label)));
    rubricSel.value = state.moiRubric || 'envies';
    rubricSel.addEventListener('change', () => { state.moiRubric = rubricSel.value; });
    return h('section', { class: 'card cherry moi-hero', 'aria-labelledby': 'moi-q' },
        h('h2', { id: 'moi-q' }, 'qu\'est-ce qui me ferait plaisir en ce moment\u00a0?'),
        h('form', {
            class: 'adder',
            onsubmit: (ev) => {
                ev.preventDefault();
                const text = input.value.trim();
                if (!text) { input.focus(); return; }
                create('envie', { title: text.replace(/\.$/, ''), rubric: rubricSel.value, status: defaultStatus(rubricSel.value), note: '', budget: '', date: '' });
                toast('c\'est noté.');
                requestAnimationFrame(() => document.getElementById('moi-quick')?.focus());
            },
        }, input, rubricSel, h('button', { type: 'submit', class: 'btn gold' }, 'ajouter')));
}

export function renderMoi() {
    const f = state.moiStatus || 'tout';
    const chip = (id, label) => h('button', {
        type: 'button', class: `chip${f === id ? ' on' : ''}`, 'aria-pressed': String(f === id),
        onclick: () => { state.moiStatus = id; state.rerender(); },
    }, label);
    const order = { cours: 0, explorer: 1, vecu: 2, plus: 3 };
    const list = all('envie').filter((e) => f === 'tout' || e.status === f)
        .sort((a, b) => (order[a.status] ?? 1) - (order[b.status] ?? 1) || (b.createdAt || '').localeCompare(a.createdAt || ''));
    return h('div', { class: 'page moi' },
        h('header', { class: 'page-head' },
            h('div', { class: 'stack-sm' }, eyebrow('rien que pour moi, à mon rythme'), h('h1', { class: 'title' }, 'moi, en dehors du travail.')),
            h('div', { class: 'chips', role: 'group', 'aria-label': 'filtrer par statut' }, chip('tout', 'tout'), STATUSES.map((s) => chip(s.id, s.label)))),
        quickAdd(),
        h('div', { class: 'moi-grid' }, RUBRICS.map((r) => {
            const items = list.filter((e) => (e.rubric || 'envies') === r.id);
            return h('section', { class: 'card stack', 'aria-labelledby': `moi-${r.id}` },
                h('div', { class: 'section-head' }, h('h2', { id: `moi-${r.id}` }, r.title),
                    h('button', { type: 'button', class: 'link plain', onclick: () => envieDialog(null, r.id) }, '+ ajouter')),
                h('p', { class: 'small muted' }, r.intro),
                items.length ? h('div', { class: 'envie-list' }, items.map(envieCard))
                    : h('p', { class: 'empty' }, f === 'tout' ? r.empty : 'rien avec ce statut ici.'));
        })));
}
