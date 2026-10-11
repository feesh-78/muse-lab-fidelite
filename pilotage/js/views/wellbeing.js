// 07 · Bien-être : rempli chaque jour en moins d'une minute. Aucun score, aucune série, aucun reproche.
import { h, eyebrow, img, modal, confirmDialog, closeBtn, dropzone } from '../ui.js';
import { get, create, update, deleteFile, uid } from '../store.js';
import { today, addDays, fromKey, toKey, longDate, dayNum, fullDate } from '../dates.js';
import { state } from '../state.js';

export const MOODS = ['rayonnante', 'bien', 'calme', 'fatiguée', 'à plat'];
const MOVES = ['danse', 'pilates', 'stretching', 'marche', 'repos'];
const RITUALS = ['bain', 'soin du corps', 'tirage de tarot', 'journal', 'lecture', 'soirée sans écran'];
const GLASSES = 8;
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const dayId = (key) => `day-${key}`;
export const getDay = (key) => get(dayId(key)) || { id: null, date: key, moves: [], rituals: [], water: 0, photos: [] };
function setDay(key, patch, opts) {
    const id = dayId(key);
    if (get(id)) update(id, patch, opts);
    else create('day', { id, date: key, moves: [], rituals: [], water: 0, photos: [], ...patch }, opts);
}
const toggleIn = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function choiceChips(options, isOn, onPick, label, accent = true) {
    return h('div', { class: 'chips', role: 'group', 'aria-label': label }, options.map((o) => h('button', {
        type: 'button', class: `chip${isOn(o) ? (accent ? ' on cherry' : ' on') : ''}`, 'aria-pressed': String(isOn(o)), onclick: () => onPick(o),
    }, o)));
}

// Petit bloc « comment je me sens » (accueil mobile)
export function moodQuick() {
    const t = today();
    const d = getDay(t);
    return h('section', { class: 'card', 'aria-labelledby': 'm-bien' },
        h('div', { class: 'section-head' }, h('h2', { id: 'm-bien' }, 'comment je me sens.'), h('a', { href: '#/bien-etre', class: 'link' }, 'ouvrir')),
        choiceChips(MOODS, (m) => d.mood === m, (m) => setDay(t, { mood: d.mood === m ? null : m }), 'mon humeur du jour'),
        dropzone({ label: '+ mes photos du jour', cls: 'compact', onFiles: (refs) => addPhotos(t, refs) }));
}

function addPhotos(key, refs) {
    setDay(key, { photos: [...getDay(key).photos, ...refs.map(({ ref }) => ({ id: uid(), ref }))] });
}

function today_() {
    const t = today();
    const d = getDay(t);
    const note = h('textarea', {
        id: 'w-note', class: 'field', rows: 3, placeholder: 'ce que je ressens, ce dont j\'ai besoin…',
        oninput: (e) => setDay(t, { note: e.target.value }, { quiet: true }),
    });
    note.value = d.note || '';
    const sleep = h('input', {
        id: 'w-sleep', class: 'field pill sleep', type: 'text', inputmode: 'decimal', placeholder: 'heures', value: d.sleep ?? '',
        oninput: (e) => setDay(t, { sleep: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') }, { quiet: true }),
    });
    const glasses = h('div', { class: 'glasses', role: 'group', 'aria-label': 'verres d\'eau bus' },
        Array.from({ length: GLASSES }, (_, i) => h('button', {
            type: 'button', class: `glass${i < d.water ? ' full' : ''}`, 'aria-pressed': String(i < d.water), 'aria-label': `verre ${i + 1}`,
            onclick: () => setDay(t, { water: d.water === i + 1 ? i : i + 1 }),
        })));
    return h('div', { class: 'split' },
        h('section', { class: 'card col-1', 'aria-labelledby': 'w-mood' },
            h('h2', { id: 'w-mood' }, 'comment je me sens aujourd\'hui.'),
            choiceChips(MOODS, (m) => d.mood === m, (m) => setDay(t, { mood: d.mood === m ? null : m }), 'mon humeur du jour'),
            h('label', { class: 'field-label', for: 'w-note' }, 'un mot sur ma journée'), note),
        h('section', { class: 'card col-1', 'aria-labelledby': 'w-jour' },
            h('h2', { id: 'w-jour' }, 'mon corps aujourd\'hui.'),
            h('div', { class: 'stack-sm' }, eyebrow('01 · j\'ai bougé'),
                choiceChips(MOVES, (m) => d.moves.includes(m), (m) => setDay(t, { moves: toggleIn(d.moves, m) }), 'mouvement du jour', false)),
            h('div', { class: 'stack-sm' }, h('div', { class: 'section-head' }, eyebrow('02 · mon eau'), eyebrow(`${d.water} verre${d.water > 1 ? 's' : ''} sur ${GLASSES}`)), glasses),
            h('div', { class: 'stack-sm' }, eyebrow('03 · un moment pour moi'),
                choiceChips(RITUALS, (r) => d.rituals.includes(r), (r) => setDay(t, { rituals: toggleIn(d.rituals, r) }), 'rituel du jour', false)),
            h('label', { class: 'stack-sm', for: 'w-sleep' }, eyebrow('04 · ma nuit, en heures'), sleep)));
}

function week() {
    const t = today();
    const days = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
    const dot = (on, label) => h('span', { class: `wk-dot${on ? ' on' : ''}`, role: 'img', 'aria-label': label });
    const cells = [h('span')];
    days.forEach((d) => cells.push(h('span', { class: `eyebrow wk-head${d === t ? ' today' : ''}` }, dayNum(d))));
    const row = (label, render) => {
        cells.push(h('span', { class: 'wk-label' }, label));
        days.forEach((d) => cells.push(h('span', { class: 'wk-cell' }, render(getDay(d), d))));
    };
    row('mouvement', (d) => dot(d.moves.length > 0, d.moves.join(', ') || 'rien noté'));
    row('eau', (d) => (d.water ? h('span', { class: 'wk-num' }, `${d.water}/8`) : dot(false, 'rien noté')));
    row('moment pour moi', (d) => dot(d.rituals.length > 0, d.rituals.join(', ') || 'rien noté'));
    row('nuit', (d) => (d.sleep ? h('span', { class: 'wk-num' }, `${d.sleep} h`) : h('span', { class: 'muted' }, '–')));
    row('humeur', (d) => h('span', { class: d.mood ? 'wk-mood' : 'muted' }, d.mood || '–'));
    return h('section', { class: 'card', 'aria-labelledby': 'w-sem' },
        h('div', { class: 'section-head' }, h('h2', { id: 'w-sem' }, 'ma semaine.'), eyebrow('un rond plein = fait')),
        h('div', { class: 'wg-scroll' }, h('div', { class: 'week-wellbeing' }, cells)));
}

function photosDialog(key) {
    return modal((box, close) => {
        const draw = () => {
            const d = getDay(key);
            box.replaceChildren(
                h('div', { class: 'section-head' }, h('h2', null, `${fullDate(key)}.`), closeBtn('fermer', () => close(null))),
                d.photos.length ? h('div', { class: 'photo-grid' }, d.photos.map((p) => h('figure', { class: 'mood-item' },
                    img(p.ref, { alt: `photo du ${fullDate(key)}` }),
                    closeBtn('supprimer la photo', async () => {
                        if (!(await confirmDialog('Cette photo sera supprimée de ton calendrier photo.'))) return;
                        setDay(key, { photos: getDay(key).photos.filter((x) => x.id !== p.id) });
                        deleteFile(p.ref);
                        draw();
                    })))) : h('p', { class: 'empty' }, 'pas encore de photo ce jour-là.'),
                dropzone({ label: '+ ajouter des photos', onFiles: (refs) => { addPhotos(key, refs); draw(); } }));
        };
        box.classList.add('wide');
        draw();
    }, { label: 'photos du jour' });
}

function photoCalendar() {
    const anchor = state.photoMonth || today().slice(0, 7);
    const first = fromKey(`${anchor}-01`);
    const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    const t = today();
    const cells = Array.from({ length: lead }, () => h('div', { class: 'ph-cell empty' }));
    for (let i = 1; i <= daysIn; i++) {
        const key = toKey(new Date(first.getFullYear(), first.getMonth(), i));
        const d = getDay(key);
        const has = d.photos.length > 0;
        cells.push(h('button', {
            type: 'button', class: `ph-cell${has ? ' has' : ''}${key === t ? ' today' : ''}`, disabled: key > t && !has,
            'aria-label': `${longDate(key)}${has ? ` · ${d.photos.length} photo${d.photos.length > 1 ? 's' : ''}` : ''}`,
            onclick: () => photosDialog(key),
        },
        has ? img(d.photos[0].ref, { alt: '' }) : null,
        h('span', { class: 'ph-num' }, String(i)),
        d.photos.length > 1 ? h('span', { class: 'ph-count' }, `${d.photos.length} photos`) : null));
    }
    const move = (n) => { state.photoMonth = toKey(new Date(first.getFullYear(), first.getMonth() + n, 1)).slice(0, 7); state.rerender(); };
    return h('section', { class: 'stack', 'aria-labelledby': 'w-photo' },
        h('div', { class: 'section-head wrap' },
            h('h2', { id: 'w-photo' }, 'mon calendrier photo.'),
            h('span', { class: 'arrows' },
                h('button', { type: 'button', class: 'arrow-btn', 'aria-label': 'mois précédent', onclick: () => move(-1) }, '←'),
                h('span', { class: 'eyebrow' }, `${MOIS[first.getMonth()]} ${first.getFullYear()}`),
                h('button', { type: 'button', class: 'arrow-btn', 'aria-label': 'mois suivant', onclick: () => move(1) }, '→'))),
        dropzone({ label: '+ mes photos du jour', cls: 'compact', onFiles: (refs) => addPhotos(t, refs) }),
        h('div', { class: 'photo-cal' }, cells));
}

export function renderWellbeing() {
    return h('div', { class: 'page wellbeing' },
        h('header', { class: 'stack-sm' }, eyebrow(longDate(today())), h('h1', { class: 'title' }, 'prendre soin de moi.')),
        today_(),
        week(),
        photoCalendar());
}
