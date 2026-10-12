// 03 · Calendrier : vue mois et vue semaine, 4 calendriers + contenus à poster + deadlines de to-do
import { h, eyebrow, modal, confirmDialog, toast } from '../ui.js';
import { create, update, remove, singleton, get } from '../store.js';
import { CALENDARS, LAYERS, calendarOf, calendarItems, nextBigEvent, weekStart } from '../data.js';
import { today, addDays, fromKey, toKey, dayNum, shortDate, daysBetween } from '../dates.js';
import { state } from '../state.js';
import { postDialog } from './social.js';
import { icloud, isConnected, targetOf, saveEvent, deleteEvent, errorText } from '../icloud.js';
import { connectionsDialog } from './connexions.js';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

const prefs = () => singleton('profile');
const hidden = () => prefs().hiddenCalendars || [];

// ---------- Fenêtres d'ajout et de modification ----------
// Un rendez-vous vit dans l'outil, ou dans l'agenda iCloud quand son calendrier y est relié
export function eventDialog(event, date = today()) {
    const fromICloud = event?.source === 'icloud';
    const e = event
        ? { ...event, repeat: fromICloud ? (event.weekly ? 'weekly' : null) : event.repeat }
        : { title: '', date, time: '', calendar: 'perso', repeat: null, big: false };
    return modal((box, close) => {
        const title = h('input', { class: 'field', placeholder: 'intitulé', value: e.title, required: true, 'aria-label': 'intitulé' });
        const day = h('input', { class: 'field', type: 'date', value: e.date, required: true, 'aria-label': 'date' });
        const time = h('input', { class: 'field', type: 'time', value: e.time || '', 'aria-label': 'heure' });
        const cal = h('select', { class: 'field', 'aria-label': 'calendrier', onchange: () => showWhere() }, CALENDARS.map((c) => h('option', { value: c.id }, c.label)));
        cal.value = e.calendar;
        const weekly = h('input', { type: 'checkbox', checked: e.repeat === 'weekly' });
        const big = h('input', { type: 'checkbox', checked: !!e.big });
        const where = h('p', { class: 'small muted icloud-where' });
        const error = h('p', { class: 'login-error', role: 'alert' });
        const submit = h('button', { type: 'submit', class: 'btn primary' }, event ? 'enregistrer' : 'ajouter');
        function showWhere() {
            const target = targetOf(cal.value);
            const name = target && (icloud.status.calendars || []).find((c) => c.url === target)?.name;
            where.textContent = target ? `synchronisé avec ton agenda iCloud « ${name || 'iCloud'} »` : (isConnected() ? 'gardé dans l\'outil (ce calendrier n\'est relié à aucun agenda iCloud)' : '');
        }
        showWhere();
        const busy = (on) => { box.querySelectorAll('button').forEach((b) => { b.disabled = on; }); };
        box.append(h('form', {
            onsubmit: async (ev) => {
                ev.preventDefault();
                if (!title.value.trim() || !day.value) return;
                const fields = { title: title.value.trim(), date: day.value, time: time.value, calendar: cal.value, repeat: weekly.checked ? 'weekly' : null, big: big.checked };
                const target = targetOf(fields.calendar);
                error.textContent = '';
                busy(true);
                try {
                    if (target) {
                        await saveEvent(fields, fromICloud ? event : null);
                        if (event && !fromICloud) remove(event.id);
                    } else {
                        if (fromICloud) await deleteEvent(event);
                        if (event && !fromICloud) update(event.id, fields); else create('event', fields);
                    }
                    close(true);
                } catch (err) {
                    console.error(err);
                    busy(false);
                    if (!event && (err.code === 'offline' || err.status >= 500)) {
                        // Rien n'est perdu : la date reste dans l'outil
                        create('event', fields);
                        toast('iCloud injoignable : la date est gardée dans l\'outil');
                        close(true);
                    } else error.textContent = errorText(err);
                }
            },
        },
        h('h2', null, event ? 'modifier la date.' : 'ajouter une date.'),
        h('label', { class: 'field-label' }, 'intitulé', title),
        h('div', { class: 'two' }, h('label', { class: 'field-label' }, 'date', day), h('label', { class: 'field-label' }, 'heure', time)),
        h('label', { class: 'field-label' }, 'calendrier', cal),
        where,
        h('label', { class: 'check-line' }, weekly, 'chaque semaine'),
        h('label', { class: 'check-line' }, big, 'grand rendez-vous (compte à rebours)'),
        fromICloud && event.recurring ? h('p', { class: 'small muted' }, 'rendez-vous répété : les changements s\'appliquent à toute la série.') : null,
        error,
        h('div', { class: 'modal-actions' },
            event ? h('button', {
                type: 'button', class: 'btn ghost danger-text push-left',
                onclick: async () => {
                    close(null);
                    const all = event.repeat === 'weekly' || event.recurring;
                    const msg = `« ${event.title} » sera supprimé du calendrier${all ? ', toutes répétitions comprises' : ''}${fromICloud ? ', et de ton agenda iCloud' : ''}.`;
                    if (!(await confirmDialog(msg))) return;
                    if (!fromICloud) { remove(event.id); return; }
                    try { await deleteEvent(event); } catch (err) { toast(errorText(err)); }
                },
            }, 'supprimer') : null,
            h('button', { type: 'button', class: 'btn ghost', onclick: () => close(null) }, 'annuler'),
            submit)));
    }, { label: 'date du calendrier' });
}

// Une tâche sans projet (perso, marque) se modifie directement ici
export function taskDialog(task) {
    return modal((box, close) => {
        const title = h('input', { class: 'field', value: task.title, 'aria-label': 'intitulé' });
        const due = h('input', { class: 'field', type: 'date', value: task.due, 'aria-label': 'deadline' });
        box.append(h('form', {
            onsubmit: (e) => {
                e.preventDefault();
                if (!title.value.trim() || !due.value) return;
                update(task.id, { title: title.value.trim(), due: due.value });
                close(true);
            },
        },
        h('h2', null, 'la tâche.'),
        h('label', { class: 'field-label' }, 'intitulé', title),
        h('label', { class: 'field-label' }, 'deadline', due),
        h('div', { class: 'modal-actions' },
            h('button', { type: 'button', class: 'btn ghost', onclick: () => { update(task.id, { done: true, doneOn: today() }); close(true); } }, 'c\'est fait'),
            h('button', { type: 'submit', class: 'btn primary' }, 'enregistrer'))));
    }, { label: 'tâche' });
}

export function openItem(it) {
    if (it.type === 'event') eventDialog(it.ref);
    else if (it.type === 'project') location.hash = `#/projet/${it.ref.id}`;
    else if (it.type === 'ny') location.hash = '#/new-york';
    else if (it.type === 'post') postDialog(it.ref);
    else if (it.type === 'task') {
        if (it.ref.projectId && get(it.ref.projectId)) location.hash = `#/projet/${it.ref.projectId}`;
        else if (it.ref.goal === 'ny') location.hash = '#/new-york';
        else taskDialog(it.ref);
    }
}

// Pastille d'un élément daté, à la couleur de son calendrier
export function itemChip(it, { withTime = false, compact = false } = {}) {
    const style = it.cal ? { background: it.cal.bg, color: it.cal.fg } : null;
    return h('button', {
        type: 'button', class: `cal-chip ${it.type}`, style, title: it.title,
        onclick: (e) => { e.stopPropagation(); openItem(it); },
    }, withTime && it.time ? h('span', { class: 'chip-time' }, it.time) : null, compact && it.short ? it.short : it.title);
}

// ---------- Page ----------
function toggles() {
    const off = hidden();
    const flip = (id) => update('profile', { hiddenCalendars: off.includes(id) ? off.filter((x) => x !== id) : [...off, id] });
    const line = (id, label, swatch) => h('label', { class: 'cal-toggle' },
        h('input', { type: 'checkbox', checked: !off.includes(id), onchange: () => flip(id) }), swatch, label);
    return h('div', { class: 'cal-toggles', role: 'group', 'aria-label': 'calendriers affichés' },
        CALENDARS.map((c) => line(c.id, c.label, h('span', { class: 'cal-swatch', style: { background: c.bg } }))),
        line('posts', LAYERS[0].label, h('span', { class: 'cal-swatch posts' })),
        line('deadlines', LAYERS[1].label, h('span', { class: 'cal-swatch deadlines' })));
}

function monthView(anchor) {
    const first = fromKey(anchor.slice(0, 7) + '-01');
    const start = weekStart(toKey(first));
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const end = addDays(weekStart(toKey(last)), 6);
    const items = calendarItems(start, end, { hidden: hidden() });
    const byDay = groupByDay(items);
    const t = today();
    const month = first.getMonth();
    const cells = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
        const list = byDay[d] || [];
        const out = fromKey(d).getMonth() !== month;
        const selected = state.mobile && state.calSelected === d;
        cells.push(h('div', {
            class: `cal-cell${out ? ' out' : ''}${selected ? ' selected' : ''}`,
            onclick: () => {
                if (state.mobile) { state.calSelected = d; state.rerender(); } else eventDialog(null, d);
            },
        },
        h('span', { class: `cal-num${d === t ? ' today' : ''}` }, String(fromKey(d).getDate())),
        state.mobile
            ? h('span', { class: 'cal-dots' }, list.slice(0, 4).map((it) => h('span', { class: `cal-dot ${it.type}`, style: it.cal ? { background: it.cal.bg } : null })))
            : [list.slice(0, 3).map((it) => itemChip(it, { compact: true })), list.length > 3 ? h('span', { class: 'cal-more' }, `+ ${list.length - 3}`) : null]));
    }
    return h('div', { class: 'card cal-month' },
        h('div', { class: 'cal-grid head' }, JOURS.map((j) => h('div', { class: 'eyebrow' }, j))),
        h('div', { class: 'cal-grid' }, cells));
}

function weekView(anchor) {
    const start = weekStart(anchor);
    const items = calendarItems(start, addDays(start, 6), { hidden: hidden() });
    const byDay = groupByDay(items);
    const t = today();
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = addDays(start, i);
        days.push(h('div', { class: `week-col${d === t ? ' today' : ''}` },
            h('button', { type: 'button', class: 'week-col-head', onclick: () => eventDialog(null, d), title: 'ajouter une date ce jour-là' },
                h('span', { class: 'eyebrow' }, JOURS[i]), h('span', { class: 'week-col-num' }, String(fromKey(d).getDate()))),
            h('div', { class: 'week-col-items' }, (byDay[d] || []).map((it) => itemChip(it, { withTime: true })))));
    }
    return h('div', { class: 'card week-grid' }, days);
}

function dayList(d) {
    const list = calendarItems(d, d, { hidden: hidden() });
    return h('section', { class: 'card stack-sm' },
        h('div', { class: 'section-head' }, h('h2', { class: 'h-small' }, `${shortDate(d)}.`),
            h('button', { type: 'button', class: 'btn small', onclick: () => eventDialog(null, d) }, '+ ajouter')),
        list.length ? h('div', { class: 'stack-sm' }, list.map((it) => itemChip(it, { withTime: true }))) : h('p', { class: 'empty' }, 'rien ce jour-là.'));
}

function upcoming() {
    const t = today();
    const list = calendarItems(t, addDays(t, 60), { hidden: hidden() }).slice(0, 6);
    const big = nextBigEvent();
    return h('aside', { class: 'stack cal-aside', 'aria-labelledby': 't-venir' },
        h('section', { class: 'card' },
            h('h2', { id: 't-venir' }, 'à venir.'),
            list.length ? h('div', { class: 'rows' }, list.map((it, i) => h('button', { type: 'button', class: 'upcoming-row', onclick: () => openItem(it) },
                eyebrow(`${String(i + 1).padStart(2, '0')} · ${shortDate(it.date)}${it.time ? ` · ${it.time}` : ''}`, 'cherry-text'),
                h('span', null, it.title)))) : h('p', { class: 'empty' }, 'rien de prévu.')),
        big ? h('button', { type: 'button', class: 'big-event', onclick: () => openItem(big) },
            eyebrow('prochain grand rendez-vous', 'gold'),
            h('span', { class: 'big-count' }, `j-${daysBetween(t, big.date)}.`),
            h('span', { class: 'big-title' }, big.title)) : null);
}

function groupByDay(items) {
    const map = {};
    items.forEach((it) => { (map[it.date] = map[it.date] || []).push(it); });
    return map;
}

export function renderCalendar() {
    const view = state.calView || 'mois';
    const anchor = state.calDate || today();
    const d = fromKey(anchor);
    const move = (n) => {
        if (view === 'mois') state.calDate = toKey(new Date(d.getFullYear(), d.getMonth() + n, 1));
        else state.calDate = addDays(anchor, 7 * n);
        state.rerender();
    };
    const ws = weekStart(anchor);
    const heading = view === 'mois'
        ? `${MOIS[d.getMonth()]} ${d.getFullYear()}.`
        : `semaine du ${dayNum(ws).split(' ')[1]} au ${shortDate(addDays(ws, 6)).replace(/^\S+ /, '')}.`;
    const chip = (id) => h('button', { type: 'button', class: `chip${view === id ? ' on' : ''}`, 'aria-pressed': String(view === id), onclick: () => { state.calView = id; state.rerender(); } }, id);
    if (state.mobile && !state.calSelected) state.calSelected = today();
    return h('div', { class: 'page calendar' },
        h('header', { class: 'page-head' },
            h('div', { class: 'stack-sm' }, eyebrow('tous les calendriers'),
                h('div', { class: 'cal-title-line' },
                    h('button', { type: 'button', class: 'arrow-btn', 'aria-label': 'précédent', onclick: () => move(-1) }, '←'),
                    h('h1', { class: 'title' }, heading),
                    h('button', { type: 'button', class: 'arrow-btn', 'aria-label': 'suivant', onclick: () => move(1) }, '→'))),
            h('div', { class: 'chips' },
                chip('mois'), chip('semaine'),
                h('button', { type: 'button', class: 'chip', onclick: () => { state.calDate = today(); state.calSelected = today(); state.rerender(); } }, 'aujourd\'hui'),
                h('button', { type: 'button', class: `chip${isConnected() ? ' on' : ''}`, onclick: () => connectionsDialog() }, isConnected() ? 'iCloud relié' : 'relier iCloud'),
                h('button', { type: 'button', class: 'btn primary', onclick: () => eventDialog(null, state.calSelected || today()) }, '+ ajouter une date'))),
        toggles(),
        h('div', { class: 'split cal-split' },
            h('div', { class: 'col-3 stack' }, view === 'mois' ? monthView(anchor) : weekView(anchor), state.mobile && view === 'mois' ? dayList(state.calSelected) : null),
            h('div', { class: 'col-2 cal-side' }, upcoming())));
}
