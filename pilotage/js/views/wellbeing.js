// 07 · Bien-être : rempli chaque jour en moins d'une minute. Aucun score, aucune série ; le récap du mois donne des petits conseils doux.
import { h, eyebrow, img, modal, confirmDialog, closeBtn, dropzone } from '../ui.js';
import { get, create, update, deleteFile, uid } from '../store.js';
import { today, addDays, fromKey, toKey, longDate, dayNum, fullDate, shortDate } from '../dates.js';
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

// Le soir (à partir de 19 h), un petit rappel tant que la journée bien-être n'est pas remplie
export function eveningReminder() {
    if (new Date().getHours() < 19) return null;
    const d = getDay(today());
    if (d.mood || d.water || d.moves.length || d.rituals.length) return null;
    return h('div', { class: 'evening-note', role: 'note' },
        h('strong', null, 'c\'est le soir. '), 'pense à remplir ton bien-être et à mettre à jour ta to-do. ',
        h('a', { href: '#/bien-etre', class: 'link' }, 'remplir mon bien-être'));
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

// Le jour rempli : aujourd'hui par défaut, ou un jour passé choisi avec les flèches (pour compléter la veille)
function dayNav(t) {
    const now = today();
    const move = (n) => { const next = addDays(t, n); state.wellDay = next >= now ? null : next; state.rerender(); };
    const label = t === now ? 'aujourd\'hui' : t === addDays(now, -1) ? 'hier' : shortDate(t);
    return h('div', { class: 'section-head wrap' },
        h('span', { class: 'arrows' },
            h('button', { type: 'button', class: 'arrow-btn', 'aria-label': 'jour précédent', onclick: () => move(-1) }, '←'),
            h('span', { class: 'eyebrow' }, `je remplis : ${label}`),
            h('button', { type: 'button', class: 'arrow-btn', 'aria-label': 'jour suivant', disabled: t >= now, onclick: () => move(1) }, '→')),
        t !== now ? h('button', { type: 'button', class: 'link plain small', onclick: () => { state.wellDay = null; state.rerender(); } }, 'revenir à aujourd\'hui') : null);
}

function today_() {
    const t = state.wellDay && state.wellDay < today() ? state.wellDay : today();
    const when = t === today() ? 'aujourd\'hui' : t === addDays(today(), -1) ? 'hier' : `le ${fromKey(t).getDate()}`;
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
    return h('div', { class: 'stack' }, dayNav(t), h('div', { class: 'split' },
        h('section', { class: 'card col-1', 'aria-labelledby': 'w-mood' },
            h('h2', { id: 'w-mood' }, `comment je me sens ${when}.`),
            choiceChips(MOODS, (m) => d.mood === m, (m) => setDay(t, { mood: d.mood === m ? null : m }), 'mon humeur du jour'),
            h('label', { class: 'field-label', for: 'w-note' }, 'un mot sur ma journée'), note),
        h('section', { class: 'card col-1', 'aria-labelledby': 'w-jour' },
            h('h2', { id: 'w-jour' }, `mon corps ${when}.`),
            h('div', { class: 'stack-sm' }, eyebrow('01 · j\'ai bougé'),
                choiceChips(MOVES, (m) => d.moves.includes(m), (m) => setDay(t, { moves: toggleIn(d.moves, m) }), 'mouvement du jour', false)),
            h('div', { class: 'stack-sm' }, h('div', { class: 'section-head' }, eyebrow('02 · mon eau'), eyebrow(`${d.water} verre${d.water > 1 ? 's' : ''} sur ${GLASSES}`)), glasses),
            h('div', { class: 'stack-sm' }, eyebrow('03 · un moment pour moi'),
                choiceChips(RITUALS, (r) => d.rituals.includes(r), (r) => setDay(t, { rituals: toggleIn(d.rituals, r) }), 'rituel du jour', false)),
            h('label', { class: 'stack-sm', for: 'w-sleep' }, eyebrow('04 · ma nuit, en heures'), sleep))));
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
                dropzone({ label: '+ ajouter des photos', onFiles: (refs) => { addPhotos(key, refs); draw(); } }),
                h('label', { class: 'field-label', for: 'ph-note' }, 'mon texte du jour'), note);
        };
        // Le même texte que « un mot sur ma journée » : un seul texte par jour, visible aux deux endroits
        const note = h('textarea', {
            id: 'ph-note', class: 'field', rows: 4, placeholder: 'ce que je veux garder de cette journée…',
            oninput: (e) => setDay(key, { note: e.target.value }, { quiet: true }),
        });
        note.value = getDay(key).note || '';
        box.classList.add('wide');
        draw();
    }, { label: 'photos du jour' }).then(() => state.rerender());
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
        const written = !!(d.note && d.note.trim());
        cells.push(h('button', {
            type: 'button', class: `ph-cell${has ? ' has' : ''}${key === t ? ' today' : ''}`, disabled: key > t && !has,
            'aria-label': `${longDate(key)}${has ? ` · ${d.photos.length} photo${d.photos.length > 1 ? 's' : ''}` : ''}${written ? ' · un texte' : ''}`,
            onclick: () => photosDialog(key),
        },
        has ? img(d.photos[0].ref, { alt: '' }) : null,
        h('span', { class: 'ph-num' }, String(i)),
        d.photos.length > 1 ? h('span', { class: 'ph-count' }, `${d.photos.length} photos`) : null,
        written ? h('span', { class: 'ph-note', 'aria-hidden': 'true' }, '✎') : null));
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

// Récap du mois (le même mois que le calendrier photo) : quelques chiffres et des petits mots doux
const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
const one = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

function monthRecap() {
    const anchor = state.photoMonth || today().slice(0, 7);
    const first = fromKey(`${anchor}-01`);
    const t = today();
    const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const keys = Array.from({ length: daysIn }, (_, i) => toKey(new Date(first.getFullYear(), first.getMonth(), i + 1))).filter((k) => k <= t);
    // Seuls les jours où j'ai noté quelque chose comptent
    const days = keys.map(getDay).filter((d) => d.id && (d.mood || d.water || d.moves.length || d.rituals.length || d.sleep || d.photos.length || (d.note && d.note.trim())));
    const title = h('div', { class: 'section-head' }, h('h2', { id: 'w-recap' }, 'mon mois.'), eyebrow(`${MOIS[first.getMonth()]} ${first.getFullYear()}`));
    if (!days.length) {
        return h('section', { class: 'card', 'aria-labelledby': 'w-recap' }, title,
            h('p', { class: 'empty' }, keys.length ? 'rien de noté ce mois-ci pour l\'instant.' : 'ce mois n\'a pas encore commencé.'));
    }
    const n = days.length;
    const water = avg(days.map((d) => Number(d.water) || 0));
    const sleeps = days.map((d) => parseFloat(d.sleep)).filter((x) => x > 0);
    const sleep = avg(sleeps);
    const moved = days.filter((d) => d.moves.some((m) => m !== 'repos')).length;
    const rituals = days.filter((d) => d.rituals.length).length;
    const photos = days.filter((d) => d.photos.length).length;
    const written = days.filter((d) => d.note && d.note.trim()).length;
    const moodCount = {};
    days.forEach((d) => { if (d.mood) moodCount[d.mood] = (moodCount[d.mood] || 0) + 1; });
    const topMood = Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0];

    const notes = [];
    if (water && water < 6) notes.push(`tu n'as pas bu assez d'eau : ${one(water)} verres par jour en moyenne, vise ${GLASSES}.`);
    else if (water >= 6) notes.push(`belle hydratation : ${one(water)} verres par jour en moyenne.`);
    if (sleeps.length && sleep < 7) notes.push(`tes nuits sont courtes : ${one(sleep)} h en moyenne. essaie de te coucher un peu plus tôt.`);
    else if (sleeps.length) notes.push(`tu dors bien : ${one(sleep)} h en moyenne.`);
    if (moved / n < 0.3) notes.push('tu as peu bougé ce mois-ci : une marche ou un stretching, ça compte.');
    else notes.push(`tu as bougé ${moved} jour${moved > 1 ? 's' : ''} sur ${n} : continue comme ça.`);
    if (rituals / n < 0.3) notes.push('pense à t\'offrir plus de moments pour toi.');
    if ((moodCount['fatiguée'] || 0) + (moodCount['à plat'] || 0) > n / 2) notes.push('tu as souvent été fatiguée : ralentis un peu si tu peux.');

    const stat = (label, value) => h('div', { class: 'recap-stat' }, eyebrow(label), h('span', { class: 'stat' }, value));
    return h('section', { class: 'card', 'aria-labelledby': 'w-recap' }, title,
        h('div', { class: 'recap-stats' },
            stat('jours notés', `${n}`),
            stat('eau', water ? `${one(water)} verres / jour` : '–'),
            stat('nuit', sleeps.length ? `${one(sleep)} h` : '–'),
            stat('j\'ai bougé', `${moved} jour${moved > 1 ? 's' : ''}`),
            stat('moments pour moi', `${rituals}`),
            stat('humeur la plus fréquente', topMood ? topMood[0] : '–'),
            stat('photos et textes', `${photos} · ${written}`)),
        h('ul', { class: 'recap-notes' }, notes.map((x) => h('li', null, x))));
}

export function renderWellbeing() {
    return h('div', { class: 'page wellbeing' },
        h('header', { class: 'stack-sm' }, eyebrow(longDate(today())), h('h1', { class: 'title' }, 'prendre soin de moi.')),
        today_(),
        week(),
        monthRecap(),
        photoCalendar());
}
