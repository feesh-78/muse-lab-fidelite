// 01 · Accueil : ce que je vois en ouvrant l'outil
import { h, img, eyebrow, sectionHead, progressBar, pickFiles, makeDroppable, toast } from '../ui.js';
import { singleton, all, update, uploadFile } from '../store.js';
import { FILTER_BRANDS, brand, projects, progress, todayTasks, taskBrand, num, DEFAULT_PALETTE, calendarItems, handle } from '../data.js';
import { openItem } from './calendar.js';
import { moodQuick, eveningReminder } from './wellbeing.js';
import { postDialog } from './social.js';
import { today, addDays, longDate, dayNum, dayMonth, daysBetween, fullDate } from '../dates.js';
import { moodboard, palette, taskList, taskAdder } from '../components.js';
import { state } from '../state.js';

export function profile() {
    return singleton('profile', { name: 'maryse', fullName: 'maryse norah', moodboard: [], palette: DEFAULT_PALETTE.map((c) => ({ ...c })), nyDate: '2027-03-17', nyLine: 'un mois de prospection' });
}

export function nyCard({ small = false } = {}) {
    const p = profile();
    const days = Math.max(0, daysBetween(today(), p.nyDate));
    return h('a', { href: '#/new-york', class: `ny-card${small ? ' small' : ''}` },
        h('span', { class: 'ny-text' },
            eyebrow('mon objectif', 'gold'),
            h('span', { class: 'ny-title' }, 'new york.'),
            h('span', { class: 'ny-line' }, `départ le ${fullDate(p.nyDate)}${!small && p.nyLine ? ` · ${p.nyLine}` : ''}`)),
        h('span', { class: 'ny-count' }, `j-${days}.`));
}

// Filtre par marque : s'applique à la to-do, à la semaine et aux projets
const matches = (brandId) => state.brandFilter === 'tout' || brandId === state.brandFilter;

function brandFilter() {
    const btn = (id, label) => h('button', {
        type: 'button', class: `chip${state.brandFilter === id ? ' on' : ''}`, 'aria-pressed': String(state.brandFilter === id),
        onclick: () => { state.brandFilter = id; state.rerender(); },
    }, label);
    return h('div', { class: 'chips', role: 'group', 'aria-label': 'filtrer par marque' }, btn('tout', 'tout'), FILTER_BRANDS.map((b) => btn(b.id, b.label)));
}

function photo(p) {
    const change = async (files) => {
        const file = files?.[0];
        if (!file) return;
        try { update('profile', { photo: await uploadFile(file) }); } catch { toast('envoi impossible, vérifie ta connexion'); }
    };
    const el = p.photo
        ? h('button', { type: 'button', class: 'hero-photo', 'aria-label': 'changer ma photo', onclick: async () => change(await pickFiles()) },
            img(p.photo, { alt: `photo de ${p.name}` }), h('span', { class: 'photo-change' }, 'changer'))
        : h('button', { type: 'button', class: 'hero-photo empty', onclick: async () => change(await pickFiles()) }, h('span', null, '+ dépose ta photo'));
    makeDroppable(el, change, 'image/*');
    return el;
}

function todo() {
    const tasks = todayTasks().filter((t) => matches(taskBrand(t).id));
    const done = tasks.filter((t) => t.done).length;
    const projectOptions = projects((p) => p.status !== 'archive' && p.status !== 'termine');
    const assign = h('select', { class: 'field pill select', 'aria-label': 'marque ou projet' },
        h('optgroup', { label: 'marque' }, [...FILTER_BRANDS, brand('perso')].map((b) => h('option', { value: `brand:${b.id}` }, b.label))),
        projectOptions.length ? h('optgroup', { label: 'projet' }, projectOptions.map((p) => h('option', { value: `project:${p.id}` }, `${p.name}.`))) : null);
    assign.value = state.brandFilter !== 'tout' ? `brand:${state.brandFilter}` : 'brand:perso';
    return h('section', { class: 'card todo-card', 'aria-labelledby': 't-todo' },
        sectionHead('ma to-do.', eyebrow(`aujourd'hui · ${done} / ${tasks.length}`), { id: 't-todo' }),
        tasks.length ? taskList(tasks) : h('p', { class: 'empty' }, 'rien d\'urgent aujourd\'hui. profite.'),
        taskAdder({
            id: 'home-task', placeholder: 'ajouter une tâche…', defaultDue: today(), extra: assign,
            fields: () => {
                const [type, id] = assign.value.split(':');
                return type === 'project' ? { projectId: id } : { brand: id };
            },
        }));
}

function week() {
    // Tout ce qui est daté dans les 7 prochains jours : rendez-vous, deadlines, dates clés, contenus
    const itemBrand = (it) => {
        if (it.type === 'task') return taskBrand(it.ref).id;
        if (it.type === 'project') return it.ref.brand;
        if (it.type === 'event') return it.ref.calendar;
        if (it.type === 'post') return it.ref.account === 'velvet' ? 'velvet' : 'perso';
        return 'perso';
    };
    const rows = calendarItems(addDays(today(), 1), addDays(today(), 7)).filter((it) => matches(itemBrand(it)));
    return h('section', { class: 'card', 'aria-labelledby': 't-sem' },
        h('h2', { id: 't-sem' }, 'cette semaine.'),
        rows.length
            ? h('div', { class: 'rows' }, rows.slice(0, 7).map((r) => h('button', { type: 'button', class: 'week-row', onclick: () => openItem(r) }, h('span', { class: 'week-day' }, dayNum(r.date)), h('span', null, r.title))))
            : h('p', { class: 'empty' }, 'rien de prévu cette semaine.'),
        h('a', { href: '#/calendrier', class: 'btn self-start' }, 'voir le calendrier'));
}

function toPost() {
    const posts = all('post', (p) => p.date === today() && p.stage !== 'publie');
    return h('section', { class: 'card', 'aria-labelledby': 't-post' },
        h('h2', { id: 't-post', class: 'h-small' }, 'à poster aujourd\'hui.'),
        posts.length
            ? posts.map((p) => h('button', { type: 'button', class: 'post-line', onclick: () => postDialog(p) }, h('span', null, `${p.format || 'post'} · ${p.title}${p.time ? ` · ${p.time.replace(':', 'h')}` : ''}`), h('span', { class: 'muted' }, handle(p.account))))
            : h('p', { class: 'empty' }, 'rien de programmé aujourd\'hui.'),
        h('a', { href: '#/social', class: 'link' }, 'ouvrir social media'));
}

function projectCards() {
    const list = projects((p) => p.status === 'cours' && matches(p.brand));
    return h('section', { class: 'stack', 'aria-labelledby': 't-proj' },
        sectionHead(state.mobile ? 'mes projets.' : 'projets en cours.', h('a', { href: '#/projets', class: 'link' }, 'tout voir'), { id: 't-proj' }),
        list.length
            ? h('div', { class: 'grid-cards' }, list.map((p, i) => {
                const pr = progress(p.id);
                const meta = [num(i), p.type, p.keyDate ? dayMonth(p.keyDate) : null].filter(Boolean).join(' · ');
                return h('a', { href: `#/projet/${p.id}`, class: 'card project-mini' },
                    p.cover && state.mobile ? img(p.cover, { class: 'mini-cover', alt: '' }) : null,
                    h('span', { class: 'mini-body' },
                        eyebrow(meta),
                        h('span', { class: 'card-title' }, `${p.name}.`),
                        progressBar(pr.pct),
                        h('span', { class: 'small muted' }, pr.total ? `${pr.done} tâche${pr.done > 1 ? 's' : ''} sur ${pr.total}` : 'to-do à remplir')));
            }))
            : h('p', { class: 'empty' }, 'aucun projet en cours pour cette marque.'));
}

export function renderHome() {
    const p = profile();
    const date = longDate(today());
    const mood = h('section', { class: 'stack', 'aria-labelledby': 't-mood' },
        sectionHead('mon moodboard.', eyebrow('ce qui m\'inspire en ce moment', 'hide-mobile'), { id: 't-mood' }),
        moodboard('profile', {
            layout: 'tiles',
            addLabel: state.mobile ? '+ ajouter une image depuis mon téléphone' : '+ déposer une image',
            extra: h('div', { class: 'palette-card' }, eyebrow('ma palette'), palette('profile')),
        }));
    return h('div', { class: 'page home' },
        eveningReminder(),
        h('section', { class: 'hero', 'aria-labelledby': 't-hello' },
            photo(p),
            h('div', { class: 'hero-side' },
                h('div', { class: 'stack-sm' },
                    eyebrow(date, 'hide-mobile'),
                    h('h1', { id: 't-hello', class: 'display' }, `bonjour ${p.name}.`),
                    brandFilter()),
                nyCard({ small: state.mobile }))),
        h('div', { class: 'split' },
            h('div', { class: 'col-3' }, todo()),
            h('div', { class: 'col-2 stack' }, week(), toPost())),
        mood,
        projectCards(),
        state.mobile ? moodQuick() : null);
}
