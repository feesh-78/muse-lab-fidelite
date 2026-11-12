// Référentiels (marques, statuts) et calculs partagés entre les pages
import { all, get } from './store.js';
import { today, addDays, fromKey, toKey } from './dates.js';
import { eventsBetween } from './icloud.js';

// Marques : filtre de l'accueil et étiquettes des tâches
export const BRANDS = [
    { id: 'muselab', label: 'the muse lab', bg: '#7A1014', fg: '#FFFFFF' },
    { id: 'velvet', label: 'velvet company', bg: '#D9B45A', fg: '#2A160C' },
    { id: 'feline', label: 'feline', bg: '#2A160C', fg: '#FBF4EA' },
    { id: 'heely', label: 'heely', bg: '#D9A078', fg: '#2A160C' },
    { id: 'creative', label: 'creative direction', bg: '#2A160C', fg: '#D9B45A' },
    { id: 'perso', label: 'perso', bg: '#5A3418', fg: '#FFFFFF' },
];
export const FILTER_BRANDS = BRANDS.filter((b) => b.id !== 'perso');
export const brand = (id) => BRANDS.find((b) => b.id === id) || BRANDS[BRANDS.length - 1];

export const STATUSES = [
    { id: 'cours', label: 'en cours' },
    { id: 'idee', label: 'idées' },
    { id: 'termine', label: 'terminés' },
];
export const statusLabel = (id) => ({ cours: 'en cours', idee: 'idée', termine: 'terminé', archive: 'archivé' }[id] || id);

// Couleurs des post-it, dans l'ordre
export const POSTIT_COLORS = [
    { bg: '#D9B45A', fg: '#2A160C' },
    { bg: '#2A160C', fg: '#FBF4EA' },
    { bg: '#D9A078', fg: '#2A160C' },
    { bg: '#7A1014', fg: '#FFFFFF' },
];

export const DEFAULT_PALETTE = [
    { hex: '#7A1014', name: 'cerise' },
    { hex: '#5A3418', name: 'chocolat' },
    { hex: '#D9B45A', name: 'or' },
    { hex: '#FBF4EA', name: 'crème' },
];

// ---------- Projets et tâches ----------
export const projects = (filter) => all('project', filter).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt));
export const projectTasks = (projectId) => all('task', (t) => t.projectId === projectId).sort(byTaskOrder);
export function byTaskOrder(a, b) {
    return (a.order ?? 0) - (b.order ?? 0) || (a.due || '').localeCompare(b.due || '') || a.createdAt.localeCompare(b.createdAt);
}
export function taskBrand(task) {
    const p = task.projectId && get(task.projectId);
    return brand(p ? p.brand : task.brand);
}
export function progress(projectId) {
    const list = projectTasks(projectId);
    const done = list.filter((t) => t.done).length;
    return { done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
}
export function nextDeadline(projectId) {
    const next = projectTasks(projectId).filter((t) => !t.done && t.due).sort((a, b) => a.due.localeCompare(b.due))[0];
    return next ? next.due : null;
}
// Numéro d'affichage "01", "02"…
export const num = (i) => String(i + 1).padStart(2, '0');

// Tâches de l'accueil : deadline aujourd'hui ou dépassée (et celles cochées aujourd'hui, pour voir le chemin parcouru)
export function todayTasks() {
    const t = today();
    return all('task', (task) => task.due && task.due <= t && (!task.done || task.doneOn === t)).sort(byTaskOrder);
}

// ---------- Contenu de départ (repris des maquettes, modifiable et supprimable) ----------
export function seedItems() {
    const now = new Date().toISOString();
    const out = [];
    const add = (kind, fields) => { out.push({ createdAt: now, ...fields, kind }); return fields.id; };
    let order = 0;
    const project = (id, fields) => add('project', { id, order: order++, concept: '', keywords: [], moodboard: [], palette: [], ideas: [], notes: '', docs: [], cover: null, ...fields });
    let tOrder = 0;
    const task = (title, due, fields = {}) => add('task', { id: `t-${out.length}`, title, due, done: false, order: tOrder++, ...fields });

    add('profile', {
        id: 'profile', seedVersion: SEED_VERSION, name: 'maryse', fullName: 'maryse norah', tagline: 'creative director · pilotage',
        photo: null, moodboard: [], palette: DEFAULT_PALETTE.map((c) => ({ ...c })),
        nyDate: '2027-03-17', nyLine: 'un mois de prospection',
    });

    project('p-dark', { name: 'dark feminine', brand: 'muselab', type: 'event', status: 'cours', keyDate: '2026-10-31', keyLabel: 'soirée' });
    project('p-feline', {
        name: 'feline', brand: 'feline', type: 'programme signature', status: 'cours', palette: DEFAULT_PALETTE.map((c) => ({ ...c })),
        keywords: ['sensual movement', 'image', 'astro', 'shooting', 'film', 'luxe'],
        ideas: [{ id: 'i-1', text: 'la journée feline comme preuve de DA événementielle pour new york' }],
    });
    project('p-heely', { name: 'heely', brand: 'heely', type: 'marque de talons', status: 'cours', keyDate: '2026-11-15', keyLabel: 'lancement' });
    project('p-shoot', { name: 'shoot expérience', brand: 'muselab', type: 'concept', status: 'cours', keyDate: '2027-01-15', keyLabel: 'lancement' });
    project('p-olive', { name: 'the olive hour', brand: 'feline', type: 'soirée pilote', status: 'cours', keyDate: '2026-10-24', keyLabel: 'soirée' });
    project('p-velvet', { name: 'campagne velvet show', brand: 'velvet', type: 'campagne', status: 'cours', keyDate: '2026-10-24', keyLabel: 'shooting' });
    project('p-goodsign', { name: 'the good sign', brand: 'perso', type: 'marque lifestyle', status: 'idee' });
    project('p-escape', { name: 'the muse escape', brand: 'muselab', type: 'retraite', status: 'idee' });

    const done = (d) => ({ done: true, doneOn: d });
    // Accueil du jour
    task('planif de la semaine', '2026-10-11', { brand: 'perso', ...done('2026-10-11') });
    task('story cours du jour + pass', '2026-10-11', { brand: 'muselab', ...done('2026-10-11') });
    task('post déroulé soirée dark feminine', '2026-10-11', { projectId: 'p-dark' });
    task('trouver les danseuses du show heels', '2026-10-11', { projectId: 'p-velvet' });
    task('moodboard shooting feline', '2026-10-11', { projectId: 'p-feline' });
    task('valider le visuel de lancement heely', '2026-10-11', { projectId: 'p-heely' });
    // dark feminine : 6 sur 10
    ['choisir le lieu', 'valider le thème', 'créer le visuel', 'ouvrir la billetterie', 'briefer l\'équipe', 'story d\'annonce']
        .forEach((t, i) => task(t, `2026-10-0${i + 1}`, { projectId: 'p-dark', ...done(`2026-10-0${i + 1}`) }));
    task('playlist de la soirée', '2026-10-20', { projectId: 'p-dark' });
    task('déco et bougies', '2026-10-24', { projectId: 'p-dark' });
    task('récap et remerciements', '2026-11-02', { projectId: 'p-dark' });
    // feline : 2 sur 8
    task('choisir le nom', '2026-10-02', { projectId: 'p-feline', ...done('2026-10-02') });
    task('poser les mots-clés', '2026-10-05', { projectId: 'p-feline', ...done('2026-10-05') });
    task('finir le moodboard du shooting', '2026-10-16', { projectId: 'p-feline' });
    task('réserver le lieu', '2026-10-23', { projectId: 'p-feline' });
    task('écrire le déroulé de l\'expérience', '2026-10-30', { projectId: 'p-feline' });
    task('trouver le photographe-vidéaste', '2026-10-27', { projectId: 'p-feline' });
    task('fixer le prix', '2026-11-06', { projectId: 'p-feline' });
    // heely : 4 sur 8
    ['nom et logo', 'choix des modèles', 'premier prototype', 'tarifs'].forEach((t, i) => task(t, `2026-09-${10 + i * 5}`, { projectId: 'p-heely', ...done(`2026-09-${10 + i * 5}`) }));
    task('shooting produit', '2026-10-22', { projectId: 'p-heely' });
    task('page de lancement', '2026-11-05', { projectId: 'p-heely' });
    task('liste des influenceuses', '2026-11-10', { projectId: 'p-heely' });
    // shoot expérience : 1 sur 8
    task('écrire le concept', '2026-10-01', { projectId: 'p-shoot', ...done('2026-10-01') });
    ['trouver le studio', 'devis photographe', 'moodboard lumière', 'stylisme', 'maquillage', 'page de réservation', 'premières clientes']
        .forEach((t, i) => task(t, `2026-${i < 3 ? '11' : '12'}-${String(5 + i * 3).padStart(2, '0')}`, { projectId: 'p-shoot' }));

    // Rendez-vous (affichés dans « cette semaine », gérés dans le calendrier)
    seedLater(add, task);
    return out;
}

// ---------- Étapes 2 à 5 : calendrier, social media, budget, new york, bucket list ----------
export const SEED_VERSION = 2;

function seedLater(add, task) {
    // Rendez-vous
    add('event', { id: 'e-1', title: 'tournage contenu · boulogne', date: '2026-10-12', time: '10:00', calendar: 'muselab' });
    add('event', { id: 'e-2', title: 'point velvet company', date: '2026-10-14', time: '14:30', calendar: 'velvet' });
    add('event', { id: 'e-3', title: 'planif de la semaine', date: '2026-10-04', calendar: 'perso', repeat: 'weekly' });
    add('event', { id: 'e-4', title: 'dark feminine — halloween night', date: '2026-10-31', time: '20:00', calendar: 'muselab', big: true });
    add('event', { id: 'e-5', title: 'shooting velvet show', date: '2026-10-24', calendar: 'velvet' });
    // Contenus
    const post = (id, title, format, account, stage, date = null, time = null) => add('post', { id, title, format, account, stage, date, time, caption: '', hashtags: [], projectId: null });
    post('s-1', 'coulisses d\'une direction artistique', 'reel', 'perso', 'idee');
    post('s-2', 'annonce the olive hour', 'story', 'perso', 'idee');
    post('s-3', 'avant / après d\'un shooting', 'post', 'perso', 'idee');
    post('s-4', 'teaser feline', 'reel', 'perso', 'tourner', '2026-10-13');
    post('s-5', 'teaser velvet show', 'reel', 'velvet', 'tourner', '2026-10-15');
    post('s-6', 'mon objectif new york', 'post', 'perso', 'montage');
    post('s-7', 'invitation the olive hour', 'post', 'velvet', 'programme', '2026-10-12', '18:00');
    post('s-8', 'mon portfolio de DA', 'carrousel', 'perso', 'programme', '2026-10-15');
    post('s-9', 'coulisses de shooting', 'reel', 'perso', 'publie', '2026-10-11');
    add('social', { id: 'social', handles: { perso: '@moncompte', velvet: '@velvetcompany' } });
    // Budget : à compléter avec mes vrais chiffres
    add('budget', {
        id: 'budget', lifePerWeek: 0, savingPerWeek: 0,
        accounts: [
            { id: 'a-1', name: 'compte courant', bank: '', balance: 0, main: true },
            { id: 'a-2', name: 'compte épargne', bank: '', balance: 0 },
        ],
        debits: [],
        goals: [
            { id: 'ny', name: 'new york', sub: '17 mars 2027', target: 0, saved: 0 },
            { id: 'g-2', name: 'mon matelas', sub: 'sécurité', target: 0, saved: 0 },
        ],
    });
    // Objectif new york : étapes datées
    ['prendre l\'aller simple', 'réserver le logement', 'préparer mon portfolio de DA', 'lister les rendez-vous à décrocher']
        .forEach((t, i) => task(t, ['2026-11-15', '2026-12-15', '2027-01-15', '2027-02-01'][i], { id: `ny-${i}`, goal: 'ny', brand: 'perso' }));
    task('prendre le billet retour', '2026-12-01', { id: 'ny-4', goal: 'ny', brand: 'perso' });
    // Bucket list
    add('wish', { id: 'w-1', title: 'vivre un mois à new york', theme: 'voyages', ny: true, done: false, image: null });
    add('wish', { id: 'w-2', title: 'miami', theme: 'voyages', done: false, image: null });
    add('wish', { id: 'w-3', title: 'travailler aux états-unis', theme: 'carriere', done: false, image: null });
    add('wish', { id: 'w-4', title: 'ouvrir mon premier studio de danse', theme: 'carriere', done: true, doneOn: '2025-02-01', image: null });
}

// Complète une base créée avant l'ajout des nouvelles pages, sans toucher à ce qui existe
export function missingSeed(existing) {
    const now = new Date().toISOString();
    const out = [];
    const add = (kind, fields) => { if (!existing.has(fields.id)) out.push({ createdAt: now, ...fields, kind }); return fields.id; };
    let n = 0;
    const task = (title, due, fields = {}) => add('task', { title, due, done: false, order: 500 + n++, ...fields });
    seedLater(add, task);
    return out;
}

// Calendriers (couleurs reprises des maquettes)
export const CALENDARS = [
    { id: 'muselab', label: 'the muse lab', bg: '#7A1014', fg: '#FFFFFF' },
    { id: 'velvet', label: 'velvet company', bg: '#D9B45A', fg: '#2A160C' },
    { id: 'creative', label: 'creative direction', bg: '#2A160C', fg: '#FBF4EA' },
    { id: 'perso', label: 'perso', bg: '#D9A078', fg: '#2A160C' },
];
export const LAYERS = [
    { id: 'posts', label: 'contenu à poster' },
    { id: 'deadlines', label: 'deadlines de to-do' },
];
export const calendarOf = (id) => CALENDARS.find((c) => c.id === id) || CALENDARS[3];
// Marque d'un projet → calendrier où s'affichent ses dates clés
export const brandCalendar = (b) => ({ muselab: 'muselab', velvet: 'velvet', perso: 'perso' }[b] || 'creative');

export const FORMATS = ['reel', 'post', 'story', 'carrousel'];
export const STAGES = [
    { id: 'idee', label: 'idées' },
    { id: 'tourner', label: 'à tourner' },
    { id: 'montage', label: 'montage' },
    { id: 'programme', label: 'programmé' },
    { id: 'publie', label: 'publié' },
];
export const stageLabel = (id) => ({ idee: 'idée', tourner: 'à tourner', montage: 'montage', programme: 'programmé', publie: 'publié' }[id] || id);
export function handle(account) {
    const s = get('social');
    return (s && s.handles && s.handles[account]) || (account === 'velvet' ? '@velvetcompany' : '@moncompte');
}

export const THEMES = [
    { id: 'voyages', label: 'voyages' },
    { id: 'experiences', label: 'expériences' },
    { id: 'carriere', label: 'carrière' },
    { id: 'pourmoi', label: 'pour moi' },
];
export const themeLabel = (id) => (THEMES.find((t) => t.id === id) || { label: id || '' }).label;

// Montants en euros, sans centimes : "1 240 €"
const EUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const euros = (n) => EUR.format(Math.round(Number(n) || 0)).replace(/\u202f|\u00a0/g, ' ');
export const toNumber = (v) => {
    const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
};

// ---------- Tout ce qui est daté, pour le calendrier et l'accueil ----------
// Retourne des entrées { date, time, title, type, color, ref } entre deux dates incluses
export function calendarItems(from, to, { hidden = [], loadICloud = true } = {}) {
    const out = [];
    const inRange = (d) => d && d >= from && d <= to;
    const show = (id) => !hidden.includes(id);
    for (const e of all('event')) {
        if (!show(e.calendar)) continue;
        const cal = calendarOf(e.calendar);
        const push = (date) => out.push({ date, time: e.time || '', title: e.title, type: 'event', cal, big: !!e.big, ref: e });
        if (e.repeat === 'weekly') {
            if (!e.date || e.date > to) continue;
            let d = e.date;
            const gap = Math.max(0, Math.floor((fromKey(from) - fromKey(d)) / 86400000 / 7));
            d = addDays(d, gap * 7);
            for (; d <= to; d = addDays(d, 7)) if (d >= from && d >= e.date && !(e.until && d > e.until)) push(d);
        } else if (inRange(e.date)) push(e.date);
    }
    // Rendez-vous des agendas iCloud reliés (lus en arrière-plan, la page se redessine à leur arrivée)
    for (const e of eventsBetween(from, to, { load: loadICloud })) {
        if (show(e.calendar)) out.push({ date: e.date, time: e.time || '', end: e.endTime || '', title: e.title, type: 'event', cal: calendarOf(e.calendar), big: !!e.big, ref: e });
    }
    for (const p of all('project', (x) => x.status !== 'archive' && inRange(x.keyDate))) {
        const calId = brandCalendar(p.brand);
        if (show(calId)) out.push({ date: p.keyDate, time: '', title: `${p.name}${p.keyLabel ? ` · ${p.keyLabel}` : ''}`, type: 'project', cal: calendarOf(calId), ref: p });
    }
    if (show('deadlines')) {
        for (const t of all('task', (x) => !x.done && inRange(x.due))) out.push({ date: t.due, time: '', title: `deadline · ${t.title}`, short: t.title, type: 'task', ref: t });
    }
    if (show('posts')) {
        for (const p of all('post', (x) => inRange(x.date))) out.push({ date: p.date, time: p.time || '', title: `${p.format} · ${p.title}`, short: p.title, type: 'post', ref: p });
    }
    const pr = get('profile');
    if (pr && pr.nyDate && inRange(pr.nyDate) && show('perso')) out.push({ date: pr.nyDate, time: '', title: 'départ pour new york', type: 'ny', cal: calendarOf('perso'), big: true, ref: pr });
    return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99'));
}

// Prochain grand rendez-vous : un rendez-vous marqué « grand », ou le départ pour new york
export function nextBigEvent() {
    const t = today();
    return calendarItems(t, addDays(t, 730), { loadICloud: false }).find((x) => x.big) || null;
}

// Semaine du lundi au dimanche contenant une date
export function weekStart(key) {
    const d = fromKey(key);
    const shift = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - shift);
    return toKey(d);
}
