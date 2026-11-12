// 05 · Budget perso : uniquement mon argent personnel. Des visuels et de gros chiffres, jamais un tableau seul.
import { h, eyebrow, modal, confirmDialog, closeBtn } from '../ui.js';
import { singleton, update, uid } from '../store.js';
import { euros, toNumber } from '../data.js';
import { today, addDays, fromKey, toKey, longDate } from '../dates.js';

const CATEGORIES = ['logement', 'abonnements', 'assurances', 'transport', 'crédit', 'santé', 'autre'];
const RING_COLORS = ['#7A1014', '#D9B45A', '#5A3418', '#D9A078', '#7A5A40', '#2A160C', '#DCC9B0'];
const WEEKS_PER_MONTH = 52 / 12;

export const budget = () => singleton('budget', { lifePerWeek: 0, savingPerWeek: 0, accounts: [], debits: [], goals: [], paid: {} });
const save = (patch) => update('budget', patch);
const daysInMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

// « Payé » : coché pour un passage précis (la date du jour où il tombe), par exemple « 2026-10-25:id » ou « 2026-10-19:virement »
const paidKey = (dateKey, what) => `${dateKey}:${what}`;
const isPaid = (b, dateKey, what) => !!(b.paid && b.paid[paidKey(dateKey, what)]);
function setPaid(dateKey, what, on) {
    const paid = { ...(budget().paid || {}) };
    if (on) paid[paidKey(dateKey, what)] = true; else delete paid[paidKey(dateKey, what)];
    save({ paid });
}
function payCheck(b, dateKey, what, label) {
    return h('input', {
        type: 'checkbox', class: 'pay-check', checked: isPaid(b, dateKey, what), 'aria-label': `${label} : payé`,
        onchange: (e) => setPaid(dateKey, what, e.target.checked),
    });
}
// Le jour où un prélèvement tombe dans un mois donné (un « 31 » passe le dernier jour des mois courts)
const occurrence = (debit, monthKey) => {
    const first = fromKey(`${monthKey}-01`);
    return toKey(new Date(first.getFullYear(), first.getMonth(), Math.min(Number(debit.day) || 1, daysInMonth(first))));
};
function debitLine(b, x, dateKey, { showDay = false } = {}) {
    const paid = isPaid(b, dateKey, x.id);
    return h('div', { class: `debit-line${paid ? ' paid' : ''}` },
        payCheck(b, dateKey, x.id, x.label),
        h('button', { type: 'button', class: 'debit-row', onclick: () => debitDialog(x) },
            showDay ? h('span', { class: 'debit-day' }, `le ${fromKey(dateKey).getDate()}`) : null,
            h('span', { class: 'debit-label' }, x.label), h('span', { class: 'small muted' }, paid ? 'payé' : x.category), h('strong', null, euros(x.amount))));
}

// Le prélèvement tombe-t-il ce jour-là ? (un « 31 » passe le dernier jour des mois courts)
function debitsOn(key, debits) {
    const d = fromKey(key);
    return debits.filter((x) => Math.min(Number(x.day) || 1, daysInMonth(d)) === d.getDate());
}

export function nextMonday(key = today()) {
    const d = fromKey(key);
    const shift = (8 - d.getDay()) % 7;
    return addDays(key, shift);
}

// Le calcul du lundi : prélèvements de la semaine + ma vie + mon épargne − ce qui est déjà sur mon compte
export function mondayTransfer(b = budget(), monday = nextMonday()) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const weekDebits = days.flatMap((d) => debitsOn(d, b.debits).map((x) => ({ ...x, date: d })));
    const debits = weekDebits.reduce((s, x) => s + toNumber(x.amount), 0);
    const life = toNumber(b.lifePerWeek);
    const saving = toNumber(b.savingPerWeek);
    const main = b.accounts.find((a) => a.main) || b.accounts[0];
    const balance = main ? toNumber(main.balance) : 0;
    const total = Math.max(0, debits + life + saving - balance);
    return { monday, weekDebits, debits, life, saving, balance, main, total, gross: debits + life + saving };
}

function moneyInput(value, onSave, { label, cls = '' } = {}) {
    return h('input', {
        class: `money-input ${cls}`, type: 'text', inputmode: 'decimal', value: value ? String(value) : '', placeholder: '0', 'aria-label': label,
        onchange: (e) => onSave(toNumber(e.target.value)),
        onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
    });
}

function debitDialog(debit) {
    const b = budget();
    const x = debit || { label: '', amount: '', day: 1, accountId: (b.accounts.find((a) => a.main) || b.accounts[0] || {}).id, category: 'abonnements' };
    return modal((box, close) => {
        const label = h('input', { class: 'field', value: x.label, placeholder: 'loyer, téléphone…', 'aria-label': 'libellé' });
        const amount = h('input', { class: 'field', inputmode: 'decimal', value: x.amount, placeholder: 'montant en €', 'aria-label': 'montant' });
        const day = h('input', { class: 'field', type: 'number', min: 1, max: 31, value: x.day, 'aria-label': 'jour du mois' });
        const account = h('select', { class: 'field', 'aria-label': 'compte' }, b.accounts.map((a) => h('option', { value: a.id }, a.name)));
        account.value = x.accountId || '';
        const category = h('select', { class: 'field', 'aria-label': 'catégorie' }, CATEGORIES.map((c) => h('option', { value: c }, c)));
        category.value = x.category || 'autre';
        box.append(h('form', {
            onsubmit: (e) => {
                e.preventDefault();
                if (!label.value.trim()) { label.focus(); return; }
                const fields = { label: label.value.trim(), amount: toNumber(amount.value), day: Math.min(31, Math.max(1, parseInt(day.value, 10) || 1)), accountId: account.value, category: category.value };
                const list = budget().debits;
                save({ debits: debit ? list.map((d) => (d.id === debit.id ? { ...d, ...fields } : d)) : [...list, { id: uid(), ...fields }] });
                close(true);
            },
        },
        h('h2', null, debit ? 'le prélèvement.' : 'nouveau prélèvement.'),
        h('label', { class: 'field-label' }, 'libellé', label),
        h('div', { class: 'two' }, h('label', { class: 'field-label' }, 'montant', amount), h('label', { class: 'field-label' }, 'jour du mois', day)),
        h('div', { class: 'two' }, h('label', { class: 'field-label' }, 'compte', account), h('label', { class: 'field-label' }, 'catégorie', category)),
        h('div', { class: 'modal-actions' },
            debit ? h('button', {
                type: 'button', class: 'btn ghost danger-text push-left',
                onclick: async () => { close(null); if (await confirmDialog(`Le prélèvement « ${debit.label} » sera supprimé.`)) save({ debits: budget().debits.filter((d) => d.id !== debit.id) }); },
            }, 'supprimer') : null,
            h('button', { type: 'button', class: 'btn ghost', onclick: () => close(null) }, 'annuler'),
            h('button', { type: 'submit', class: 'btn primary' }, debit ? 'enregistrer' : 'ajouter'))));
    }, { label: 'prélèvement' });
}

// Montant au centime près (4,95 €, 11,90 €), là où le détail compte
const exactEuros = (v) => {
    const n = toNumber(v);
    return `${n.toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).replace(/\u202f|\u00a0/g, ' ')} €`;
};
// Le détail des prélèvements de la semaine : une ligne par prélèvement, avec sa date et son montant
function weekDebitLines(r) {
    return h('ul', { class: 'week-debits' }, r.weekDebits.map((x) => h('li', null,
        h('span', null, `${x.label} · le ${fromKey(x.date).getDate()}`), h('strong', null, exactEuros(x.amount)))));
}

function transferCard(b) {
    const r = mondayTransfer(b);
    const pct = (v) => (r.gross ? (v / r.gross) * 100 : 0);
    const seg = (v, cls, label) => (v > 0 ? h('div', { class: `seg ${cls}`, style: { flexGrow: String(v) } }, pct(v) > 14 ? label : '') : null);
    return h('section', { class: 'card cherry transfer', 'aria-labelledby': 'b-lundi' },
        eyebrow(r.monday === today() ? `aujourd'hui · ${longDate(r.monday)}` : longDate(r.monday), 'gold'),
        h('h2', { id: 'b-lundi' }, 'à me verser ce lundi.'),
        h('div', { class: 'huge' }, euros(r.total)),
        r.gross ? h('div', { class: 'split-bar', role: 'img', 'aria-label': 'répartition : prélèvements, ma vie, mon épargne' },
            seg(r.debits, 'debits', 'prélèvements'), seg(r.life, 'life', 'ma vie'), seg(r.saving, 'saving', 'épargne'))
            : h('p', null, 'saisis ton budget de vie, ton épargne et tes prélèvements : le montant se calcule tout seul.'),
        h('div', { class: 'transfer-lines' },
            h('span', null, h('span', { class: 'key debits' }), 'prélèvements de la semaine · ', h('strong', null, exactEuros(r.debits))),
            r.weekDebits.length ? weekDebitLines(r) : null,
            h('span', null, h('span', { class: 'key life' }), 'ma vie de la semaine · ', h('strong', null, euros(r.life))),
            h('span', null, h('span', { class: 'key saving' }), 'mon épargne · ', h('strong', null, euros(r.saving))),
            h('span', { class: 'light' }, `moins ce qui est déjà sur ${r.main ? r.main.name : 'mon compte'} · `, h('strong', null, euros(r.balance)))));
}

// Ce mois-ci : ce qui est déjà payé et ce qui reste à passer (à cocher dans la liste)
function paidSummary(b) {
    const month = today().slice(0, 7);
    const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const total = b.debits.reduce((s, d) => s + toNumber(d.amount), 0);
    const done = b.debits.filter((d) => isPaid(b, occurrence(d, month), d.id)).reduce((s, d) => s + toNumber(d.amount), 0);
    return h('div', { class: 'paid-summary' },
        h('span', { class: 'progress' }, h('span', { style: { width: `${total ? Math.round((done / total) * 100) : 0}%` } })),
        h('span', { class: 'small' }, `${MOIS[fromKey(`${month}-01`).getMonth()]} · `, h('strong', null, `${euros(done)} payés`), ` · reste ${euros(total - done)} · coche ce qui est passé`));
}

function settingsCard(b) {
    return h('section', { class: 'card', 'aria-labelledby': 'b-regl' },
        h('h2', { id: 'b-regl', class: 'h-small' }, 'je saisis une fois.'),
        h('div', { class: 'big-inputs' },
            h('label', { class: 'big-input' }, eyebrow('ma vie par semaine'), h('span', { class: 'money' }, moneyInput(b.lifePerWeek, (v) => save({ lifePerWeek: v }), { label: 'budget de vie par semaine' }), '€')),
            h('label', { class: 'big-input' }, eyebrow('mon épargne par semaine'), h('span', { class: 'money' }, moneyInput(b.savingPerWeek, (v) => save({ savingPerWeek: v }), { label: 'épargne par semaine' }), '€'))),
        h('div', { class: 'section-head' }, eyebrow('mes prélèvements'), eyebrow(`${euros(b.debits.reduce((s, d) => s + toNumber(d.amount), 0))} / mois`)),
        b.debits.length ? paidSummary(b) : null,
        b.debits.length ? h('div', { class: 'rows' }, [...b.debits].sort((x, y) => x.day - y.day).map((d) => debitLine(b, d, occurrence(d, today().slice(0, 7)), { showDay: true })))
            : h('p', { class: 'empty' }, 'aucun prélèvement saisi.'),
        h('button', { type: 'button', class: 'btn self-start', onclick: () => debitDialog(null) }, '+ ajouter un prélèvement'));
}

// Jour ouvert dans « mon mois en un coup d'œil » (aujourd'hui par défaut)
let selectedDay = null;

function monthGlance(b) {
    const t = today();
    const first = fromKey(`${t.slice(0, 7)}-01`);
    if (!selectedDay || selectedDay.slice(0, 7) !== t.slice(0, 7)) selectedDay = t;
    const lead = (first.getDay() + 6) % 7;
    const detail = h('div', { class: 'mg-detail', 'aria-live': 'polite' }, dayDetail(b, selectedDay));
    const cells = Array.from({ length: lead }, () => h('span'));
    const buttons = [];
    for (let i = 1; i <= daysInMonth(first); i++) {
        const key = toKey(new Date(first.getFullYear(), first.getMonth(), i));
        const isMonday = fromKey(key).getDay() === 1;
        const ds = debitsOn(key, b.debits);
        const amount = ds.reduce((s, d) => s + toNumber(d.amount), 0);
        const btn = h('button', {
            type: 'button', class: `mg-cell${key === selectedDay ? ' selected' : ''}`, 'aria-pressed': String(key === selectedDay),
            'aria-label': [longDate(key), isMonday ? 'jour du virement' : '', ds.length ? `prélèvements ${euros(amount)}` : ''].filter(Boolean).join(', '),
            onclick: () => {
                selectedDay = key;
                buttons.forEach((x) => { const on = x === btn; x.classList.toggle('selected', on); x.setAttribute('aria-pressed', String(on)); });
                detail.replaceChildren(dayDetail(budget(), key));
            },
        },
        h('span', { class: `mg-day${isMonday ? ' monday' : ''}${key === t ? ' today' : ''}` }, String(i),
            ds.length ? h('span', { class: `mg-dot${ds.every((x) => isPaid(b, key, x.id)) ? ' paid' : ''}` }) : null),
        ds.length ? h('span', { class: 'mg-amount' }, euros(amount)) : null);
        buttons.push(btn);
        cells.push(btn);
    }
    const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return h('section', { class: 'card', 'aria-labelledby': 'b-mois' },
        h('div', { class: 'section-head' }, h('h2', { id: 'b-mois' }, 'mon mois en un coup d\'œil.'), eyebrow(MOIS[first.getMonth()])),
        h('div', { class: 'month-glance' }, ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map((j) => h('span', { class: 'eyebrow' }, j)), cells),
        h('div', { class: 'legend' },
            h('span', null, h('span', { class: 'legend-dot monday' }), 'le lundi, je me verse'),
            h('span', null, h('span', { class: 'legend-dot debit' }), 'un prélèvement passe'),
            h('span', null, h('span', { class: 'legend-dot paid' }), 'payé'),
            h('span', null, h('span', { class: 'legend-dot today' }), 'aujourd\'hui')),
        h('p', { class: 'small muted' }, 'clique sur un jour pour voir ce qui passe.'),
        detail);
}

// Le détail d'un jour : ce qui passe ce jour-là et, un lundi, le virement de la semaine qui commence
function dayDetail(b, key) {
    const d = fromKey(key);
    const ds = debitsOn(key, b.debits);
    const dayTotal = ds.reduce((s, x) => s + toNumber(x.amount), 0);
    const monday = addDays(key, -((d.getDay() + 6) % 7));
    const parts = [eyebrow(longDate(key))];
    if (d.getDay() === 1) {
        const r = mondayTransfer(b, key);
        const sunday = fromKey(addDays(key, 6));
        parts.push(h('div', { class: 'mg-transfer' },
            h('span', null, `à me verser pour la semaine du ${d.getDate()} au ${sunday.getDate()}`),
            h('strong', { class: 'mg-big' }, euros(r.gross)),
            h('span', { class: 'small' }, `prélèvements ${exactEuros(r.debits)} · ma vie ${euros(r.life)} · épargne ${euros(r.saving)}`),
            r.weekDebits.length ? weekDebitLines(r) : null,
            h('label', { class: 'check-line small' }, payCheck(b, key, 'virement', 'le virement de la semaine'), 'virement fait')));
    }
    parts.push(ds.length
        ? h('div', { class: 'rows' }, ds.map((x) => debitLine(b, x, key)),
        ds.length > 1 ? h('div', { class: 'debit-row mg-total' }, h('span', { class: 'debit-label' }, 'total du jour'), h('strong', null, euros(dayTotal))) : null)
        : h('p', { class: 'empty' }, 'aucun prélèvement ce jour-là.'));
    if (d.getDay() !== 1) parts.push(h('p', { class: 'small muted' }, `couvert par le virement du lundi ${fromKey(monday).getDate()}.`));
    return h('div', { class: 'stack-sm' }, parts);
}

function ring(b) {
    const parts = {};
    b.debits.forEach((d) => { parts[d.category || 'autre'] = (parts[d.category || 'autre'] || 0) + toNumber(d.amount); });
    if (toNumber(b.lifePerWeek)) parts['ma vie'] = toNumber(b.lifePerWeek) * WEEKS_PER_MONTH;
    if (toNumber(b.savingPerWeek)) parts['épargne'] = toNumber(b.savingPerWeek) * WEEKS_PER_MONTH;
    const list = Object.entries(parts).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
    const total = list.reduce((s, [, v]) => s + v, 0);
    const C = 2 * Math.PI * 70;
    let offset = 0;
    const arcs = list.map(([, v], i) => {
        const len = (v / total) * C;
        const gap = list.length > 1 ? 3 : 0;
        const arc = `<circle cx="100" cy="100" r="70" stroke="${RING_COLORS[i % RING_COLORS.length]}" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-offset}"></circle>`;
        offset += len;
        return arc;
    }).join('');
    return h('section', { class: 'card', 'aria-labelledby': 'b-part' },
        h('h2', { id: 'b-part' }, 'où part mon argent.'),
        total ? h('div', { class: 'ring-wrap' },
            h('div', { class: 'ring', role: 'img', 'aria-label': `répartition de mon mois : ${list.map(([k, v]) => `${k} ${euros(v)}`).join(', ')}`, html: `<svg viewBox="0 0 200 200" width="220" height="220"><circle cx="100" cy="100" r="70" fill="none" stroke="#DCC9B0" stroke-width="30" opacity="0.4"></circle><g transform="rotate(-90 100 100)" fill="none" stroke-width="30">${arcs}</g></svg>` },
                h('span', { class: 'ring-center' }, eyebrow('ce mois'), h('span', { class: 'ring-total' }, euros(total)))),
            h('div', { class: 'ring-legend' }, list.map(([k, v], i) => h('div', { class: 'ring-line' },
                h('span', { class: 'legend-dot', style: { background: RING_COLORS[i % RING_COLORS.length] } }), h('span', null, k), h('strong', null, euros(v))))))
            : h('p', { class: 'empty' }, 'l\'anneau apparaît dès que tu as saisi un prélèvement ou ton budget de vie.'));
}

function accounts(b) {
    const set = (id, patch) => save({ accounts: budget().accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
    const text = (a, field, placeholder, cls) => h('input', {
        class: `inline-input ${cls}`, value: a[field] || '', placeholder, 'aria-label': placeholder,
        onchange: (e) => set(a.id, { [field]: e.target.value.trim() }),
    });
    return h('section', { class: 'stack', 'aria-labelledby': 'b-comptes' },
        h('div', { class: 'section-head' }, h('h2', { id: 'b-comptes' }, 'mes comptes.'),
            h('button', { type: 'button', class: 'link plain', onclick: () => save({ accounts: [...budget().accounts, { id: uid(), name: 'nouveau compte', bank: '', balance: 0, main: !budget().accounts.length }] }) }, '+ ajouter un compte')),
        h('div', { class: 'grid-cards' }, b.accounts.map((a) => h('div', { class: `card account${a.main ? ' main' : ''}` },
            h('div', { class: 'section-head' },
                h('span', { class: 'stack-xs' }, text(a, 'name', 'nom du compte', 'eyebrow'), text(a, 'bank', 'banque', 'small')),
                closeBtn('supprimer le compte', async () => {
                    if (await confirmDialog(`Le compte « ${a.name} » sera supprimé.`)) save({ accounts: budget().accounts.filter((x) => x.id !== a.id) });
                })),
            h('span', { class: 'money big' }, moneyInput(a.balance, (v) => set(a.id, { balance: v }), { label: `solde de ${a.name}`, cls: 'big' }), '€'),
            h('label', { class: 'check-line small' }, h('input', {
                type: 'radio', name: 'main-account', checked: !!a.main,
                onchange: () => save({ accounts: budget().accounts.map((x) => ({ ...x, main: x.id === a.id })) }),
            }), 'compte où je me verse')))));
}

function goals(b) {
    const set = (id, patch) => save({ goals: budget().goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
    return h('section', { class: 'card', 'aria-labelledby': 'b-epargne' },
        h('div', { class: 'section-head' }, h('h2', { id: 'b-epargne' }, 'où j\'en suis dans mon épargne.'),
            h('button', { type: 'button', class: 'link plain', onclick: () => save({ goals: [...budget().goals, { id: uid(), name: 'nouvel objectif', sub: '', target: 0, saved: 0 }] }) }, '+ objectif')),
        h('div', { class: 'gauges' }, b.goals.map((g) => {
            const pct = g.target ? Math.min(100, Math.round((toNumber(g.saved) / toNumber(g.target)) * 100)) : 0;
            return h('div', { class: `gauge-card${g.id === 'ny' ? ' ny' : ''}` },
                h('span', { class: 'gauge', role: 'img', 'aria-label': `${g.name} : ${pct} %` }, h('span', { style: { height: `${pct}%` } }), h('span', { class: 'gauge-pct' }, `${pct} %`)),
                h('span', { class: 'gauge-info' },
                    g.id === 'ny' ? h('a', { href: '#/new-york', class: 'card-title' }, 'new york.')
                        : h('input', { class: 'inline-input card-title', value: g.name, 'aria-label': 'nom de l\'objectif', onchange: (e) => set(g.id, { name: e.target.value.trim() }) }),
                    h('input', { class: 'inline-input small muted', value: g.sub || '', placeholder: 'échéance, raison…', 'aria-label': 'précision', onchange: (e) => set(g.id, { sub: e.target.value }) }),
                    h('span', { class: 'gauge-amounts' },
                        h('span', { class: 'money' }, moneyInput(g.saved, (v) => set(g.id, { saved: v }), { label: 'épargné' }), '€'),
                        h('span', { class: 'muted' }, 'sur'),
                        h('span', { class: 'money' }, moneyInput(g.target, (v) => set(g.id, { target: v }), { label: 'objectif' }), '€'))),
                g.id === 'ny' ? null : closeBtn('supprimer l\'objectif', async () => {
                    if (await confirmDialog(`L'objectif « ${g.name} » sera supprimé.`)) save({ goals: budget().goals.filter((x) => x.id !== g.id) });
                }));
        })));
}

export function renderBudget() {
    const b = budget();
    const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const d = fromKey(today());
    return h('div', { class: 'page budget' },
        h('header', { class: 'stack-sm' }, eyebrow(`${MOIS[d.getMonth()]} ${d.getFullYear()} · rien que pour moi`), h('h1', { class: 'title' }, 'mon budget perso.')),
        h('div', { class: 'split' },
            h('div', { class: 'col-3 stack' }, transferCard(b), ring(b)),
            h('div', { class: 'col-2 stack' }, monthGlance(b), settingsCard(b))),
        accounts(b),
        goals(b));
}
