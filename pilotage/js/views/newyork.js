// 06 · Objectif new york : compte à rebours, étapes datées, preuves de DA, budget du séjour, moodboard
import { h, eyebrow, confirmDialog, closeBtn, progressBar } from '../ui.js';
import { all, get, update } from '../store.js';
import { projects, byTaskOrder, euros, toNumber } from '../data.js';
import { today, daysBetween, fullDate } from '../dates.js';
import { moodboard, taskList, taskAdder } from '../components.js';
import { profile } from './home.js';
import { budget } from './budget.js';

const NY_LINES = [['vol', 'vol'], ['logement', 'logement'], ['surplace', 'sur place']];

function head(p) {
    const days = Math.max(0, daysBetween(today(), p.nyDate));
    const line = h('textarea', {
        class: 'ny-line-input', rows: 2, 'aria-label': 'mon projet là-bas', placeholder: 'ce que je vais faire là-bas…',
        oninput: (e) => update('profile', { nyLine: e.target.value }, { quiet: true }),
    });
    line.value = p.nyLine || '';
    return h('header', { class: 'card cherry ny-head' },
        h('div', { class: 'stack-sm ny-head-text' },
            h('label', { class: 'eyebrow gold ny-date' }, 'mon objectif · départ le ',
                h('input', { type: 'date', class: 'inline-input gold', value: p.nyDate, 'aria-label': 'date de départ', onchange: (e) => { if (e.target.value) update('profile', { nyDate: e.target.value }); } })),
            h('h1', { class: 'display' }, 'new york.'),
            line),
        h('div', { class: 'ny-head-count' }, h('span', { class: 'ny-count' }, `j-${days}.`), eyebrow('avant le départ', 'gold')));
}

function steps() {
    const tasks = all('task', (t) => t.goal === 'ny').sort((a, b) => (a.done - b.done) || byTaskOrder(a, b));
    return h('section', { class: 'card', 'aria-labelledby': 'n-todo' },
        h('h2', { id: 'n-todo' }, 'les étapes.'),
        h('p', { class: 'small muted' }, 'Chaque étape a sa deadline. Elle apparaît toute seule dans le calendrier.'),
        tasks.length ? taskList(tasks, { showBrand: false }) : h('p', { class: 'empty' }, 'pas encore d\'étape.'),
        taskAdder({ id: 'ny-task', placeholder: 'ajouter une étape…', fields: () => ({ goal: 'ny', brand: 'perso' }) }));
}

function proofs(p) {
    const ids = (p.nyProofs || []).filter((id) => get(id));
    const options = projects((x) => x.status !== 'archive' && !ids.includes(x.id));
    const pick = h('select', {
        class: 'field pill select', 'aria-label': 'ajouter une fiche projet',
        onchange: (e) => { if (e.target.value) update('profile', { nyProofs: [...ids, e.target.value] }); },
    }, h('option', { value: '' }, '+ ajouter une fiche projet'), options.map((x) => h('option', { value: x.id }, `${x.name}.`)));
    return h('section', { class: 'card', 'aria-labelledby': 'n-preuves' },
        h('h2', { id: 'n-preuves' }, 'mes preuves de DA.'),
        ids.length ? h('div', { class: 'rows' }, ids.map((id, i) => {
            const x = get(id);
            return h('div', { class: 'proof-row' },
                h('span', { class: 'num' }, String(i + 1).padStart(2, '0')),
                h('a', { href: `#/projet/${id}`, class: 'proof-name' }, x.name),
                h('a', { href: `#/projet/${id}`, class: 'link' }, 'voir la fiche'),
                closeBtn('retirer des preuves', async () => {
                    if (await confirmDialog(`« ${x.name} » sera retiré de tes preuves de DA (la fiche projet reste intacte).`, 'retirer')) update('profile', { nyProofs: ids.filter((y) => y !== id) });
                }));
        })) : h('p', { class: 'empty' }, 'choisis les fiches projet qui montrent ton travail.'),
        options.length ? pick : null);
}

// Relié à la jauge « new york » du budget perso : même objectif, même montant épargné
function stayBudget(p) {
    const b = budget();
    const goal = b.goals.find((g) => g.id === 'ny');
    const lines = p.nyBudget || {};
    const sum = NY_LINES.reduce((s, [k]) => s + toNumber(lines[k]), 0);
    const target = goal ? toNumber(goal.target) : sum;
    const saved = goal ? toNumber(goal.saved) : 0;
    const setGoal = (patch) => {
        const goals = b.goals.some((g) => g.id === 'ny')
            ? budget().goals.map((g) => (g.id === 'ny' ? { ...g, ...patch } : g))
            : [...budget().goals, { id: 'ny', name: 'new york', sub: fullDate(p.nyDate), target: 0, saved: 0, ...patch }];
        update('budget', { goals });
    };
    const setLine = (k, v) => {
        const next = { ...(profile().nyBudget || {}), [k]: v };
        update('profile', { nyBudget: next });
        setGoal({ target: NY_LINES.reduce((s, [key]) => s + toNumber(next[key]), 0) });
    };
    const money = (value, onSave, label) => h('span', { class: 'money' }, h('input', {
        class: 'money-input', inputmode: 'decimal', value: value ? String(value) : '', placeholder: '0', 'aria-label': label,
        onchange: (e) => onSave(toNumber(e.target.value)), onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
    }), '€');
    const pct = target ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    return h('section', { class: 'card', 'aria-labelledby': 'n-budget' },
        h('h2', { id: 'n-budget' }, 'le budget du séjour.'),
        h('div', { class: 'section-head' }, h('span', { class: 'small muted' }, 'mis de côté'),
            h('span', { class: 'gauge-amounts' }, money(saved, (v) => setGoal({ saved: v }), 'montant mis de côté'), h('span', { class: 'muted' }, `sur ${euros(target)}`))),
        progressBar(pct, true),
        h('div', { class: 'ny-lines' }, NY_LINES.map(([k, label]) => h('label', { class: 'ny-line-item' }, eyebrow(label), money(lines[k], (v) => setLine(k, v), `budget ${label}`)))),
        h('a', { href: '#/budget', class: 'link' }, 'voir la jauge dans mon budget perso'));
}

export function renderNewYork() {
    const p = profile();
    return h('div', { class: 'page newyork' },
        head(p),
        h('div', { class: 'split' },
            h('div', { class: 'col-1 stack' }, steps(), stayBudget(p)),
            h('div', { class: 'col-1 stack' }, proofs(p),
                h('section', { class: 'card', 'aria-labelledby': 'n-mood' },
                    h('h2', { id: 'n-mood' }, 'mon moodboard new york.'),
                    moodboard('profile', { field: 'nyMoodboard' })))));
}
