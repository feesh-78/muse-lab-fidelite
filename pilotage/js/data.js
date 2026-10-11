// Référentiels (marques, statuts) et calculs partagés entre les pages
import { all, get } from './store.js';
import { today } from './dates.js';

// Marques : filtre de l'accueil et étiquettes des tâches
export const BRANDS = [
    { id: 'muselab', label: 'the muse lab', bg: '#7A1014', fg: '#FFFFFF' },
    { id: 'velvet', label: 'velvet company', bg: '#D9B45A', fg: '#2A160C' },
    { id: 'feline', label: 'feline', bg: '#2A160C', fg: '#FBF4EA' },
    { id: 'heely', label: 'heely', bg: '#D9A078', fg: '#2A160C' },
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
        id: 'profile', name: 'maryse', fullName: 'maryse norah', tagline: 'creative director · pilotage',
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
    add('event', { id: 'e-1', title: 'tournage contenu · boulogne', date: '2026-10-12', calendar: 'muselab' });
    add('event', { id: 'e-2', title: 'point velvet company', date: '2026-10-14', calendar: 'velvet' });
    add('event', { id: 'e-3', title: 'planif de la semaine', date: '2026-10-18', calendar: 'perso' });
    return out;
}
