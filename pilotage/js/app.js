// Squelette de l'application : connexion, menu, navigation entre les pages, sauvegarde automatique
import { h, toast, modal } from './ui.js';
import * as store from './store.js';
import { state } from './state.js';
import { today, shortDate } from './dates.js';
import { renderHome, profile } from './views/home.js';
import { renderProjects, newProjectDialog } from './views/projects.js';
import { renderProject } from './views/project.js';
import { renderCalendar } from './views/calendar.js';
import { renderSocial } from './views/social.js';
import { renderBudget } from './views/budget.js';
import { renderNewYork } from './views/newyork.js';
import { renderWellbeing } from './views/wellbeing.js';
import { renderBucket } from './views/bucket.js';
import { connectionsDialog } from './views/connexions.js';
import * as icloud from './icloud.js';

const SECTIONS = [
    { id: 'accueil', label: 'accueil' },
    { id: 'projets', label: 'projets' },
    { id: 'calendrier', label: 'calendrier', mobile: 'agenda' },
    { id: 'social', label: 'social media' },
    { id: 'budget', label: 'budget perso' },
    { id: 'new-york', label: 'new york life' },
    { id: 'bien-etre', label: 'bien-être' },
    { id: 'bucket', label: 'bucket list' },
];
const MOBILE_TABS = ['accueil', 'projets', 'calendrier', 'bien-etre'];
const PAGES = {
    accueil: renderHome,
    projets: renderProjects,
    calendrier: renderCalendar,
    social: renderSocial,
    budget: renderBudget,
    'new-york': renderNewYork,
    'bien-etre': renderWellbeing,
    bucket: renderBucket,
};

const root = document.getElementById('app');

function route() {
    const [, page = 'accueil', param] = location.hash.replace(/^#/, '').split('/');
    return { page: page === 'projet' ? 'projet' : page, param };
}

// ---------- Connexion ----------
function renderLogin(message) {
    let lastUser = '';
    try { lastUser = localStorage.getItem('pilotage-user') || ''; } catch { /* rien */ }
    const user = h('input', { class: 'field', type: 'text', placeholder: 'utilisateur', value: lastUser, autocomplete: 'username', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', required: true, 'aria-label': 'utilisateur' });
    const password = h('input', { class: 'field', type: 'password', placeholder: 'mot de passe', autocomplete: 'current-password', required: true, 'aria-label': 'mot de passe' });
    const error = h('p', { class: 'login-error', role: 'alert' }, message || '');
    const submit = h('button', { type: 'submit', class: 'btn primary wide' }, 'entrer');
    root.replaceChildren(h('main', { class: 'login' },
        h('div', { class: 'login-box' },
            h('div', { class: 'stack-sm' }, h('div', { class: 'eyebrow' }, 'creative director · pilotage'), h('h1', { class: 'display' }, 'bonjour.')),
            h('form', {
                class: 'stack',
                onsubmit: async (e) => {
                    e.preventDefault();
                    submit.disabled = true;
                    error.textContent = '';
                    try {
                        const session = await store.signIn(user.value, password.value);
                        try { localStorage.setItem('pilotage-user', user.value.trim()); } catch { /* rien */ }
                        await startApp(() => store.startCloud(session));
                    } catch (err) {
                        console.error(err);
                        const msg = err.message || '';
                        if (err.code === 'PGRST202' || /could not find the function/i.test(msg)) {
                            // acces-maryse.sql pas encore exécuté dans Supabase
                            error.textContent = 'accès pas encore activé : il reste à lancer acces-maryse.sql dans Supabase. en attendant, tu peux entrer ton email à la place de « maryse ».';
                        } else {
                            error.textContent = /invalid|unknown/i.test(msg) ? 'utilisateur ou mot de passe incorrect.' : 'connexion impossible pour le moment.';
                        }
                        submit.disabled = false;
                    }
                },
            }, user, password, submit, error, h('p', { class: 'small muted' }, 'Une seule fois par appareil : la connexion reste ensuite mémorisée.')),
            h('button', { type: 'button', class: 'link plain', onclick: () => startApp(() => store.startDemo()) }, 'essayer en mode démo · les données restent sur cet appareil, rien n\'est envoyé en ligne'))));
    (lastUser ? password : user).focus();
}

async function startApp(starter) {
    root.replaceChildren(h('div', { class: 'loading' }, h('span', { class: 'display' }, 'un instant.')));
    try {
        await starter();
    } catch (err) {
        console.error(err);
        renderLogin('impossible de charger tes données. vérifie ta connexion.');
        return;
    }
    store.onChange((reason) => {
        // Pendant la frappe, une synchro venue de l'autre appareil attend que tu aies fini
        if (reason === 'sync' && isTyping()) return;
        render();
    });
    window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { store.reload(); icloud.refresh(); } });
    setInterval(() => { if (document.visibilityState === 'visible' && !isTyping()) { store.reload(); icloud.refresh(); } }, 120000);
    icloud.loadStatus();
    window.matchMedia('(max-width: 820px)').addEventListener('change', (e) => { state.mobile = e.matches; render(); });
    state.rerender = render;
    render();
}

const isTyping = () => {
    const a = document.activeElement;
    return a && (a.matches('input:not([type=checkbox]):not([type=date]):not([type=color]), textarea, select') || a.isContentEditable);
};

// ---------- Mise en page ----------
function sideNav(current) {
    const p = profile();
    return h('nav', { class: 'sidenav', 'aria-label': 'navigation principale' },
        h('div', { class: 'brand-block' }, h('div', { class: 'brand-name' }, `${p.fullName || p.name}.`), h('div', { class: 'eyebrow' }, p.tagline || 'creative director · pilotage')),
        h('div', { class: 'nav-links' }, SECTIONS.map((s, i) => h('a', {
            href: `#/${s.id}`, class: `nav-link${current === s.id ? ' on' : ''}`, 'aria-current': current === s.id ? 'page' : null,
        }, h('span', { class: 'nav-num' }, String(i + 1).padStart(2, '0')), s.label))),
        h('div', { class: 'nav-bottom' },
            h('button', { type: 'button', class: 'btn wide', onclick: () => newProjectDialog() }, '+ nouveau projet'),
            saveIndicator(),
            h('button', { type: 'button', class: 'link plain small', onclick: () => connectionsDialog() }, 'iCloud et rappels'),
            store.getMode() === 'cloud' ? h('button', { type: 'button', class: 'link plain small', onclick: () => passwordDialog() }, 'changer mon mot de passe') : null,
            h('button', { type: 'button', class: 'link plain small', onclick: logout }, store.getMode() === 'demo' ? 'quitter le mode démo' : 'se déconnecter')));
}

function mobileTop() {
    const p = profile();
    return h('header', { class: 'mobile-top' },
        h('div', { class: 'brand-name' }, `${p.fullName || p.name}.`),
        h('div', { class: 'mobile-top-right' },
            h('span', { class: 'eyebrow' }, shortDate(today())),
            h('button', { type: 'button', class: 'btn small', 'aria-label': 'nouveau projet', onclick: () => newProjectDialog() }, '+ projet')));
}

function bottomBar(current) {
    const menuOn = !MOBILE_TABS.includes(current) && current !== 'projet';
    return h('nav', { class: 'bottombar', 'aria-label': 'navigation' },
        MOBILE_TABS.map((id) => {
            const s = SECTIONS.find((x) => x.id === id);
            const on = current === id || (id === 'projets' && current === 'projet');
            return h('a', { href: `#/${id}`, class: on ? 'on' : '', 'aria-current': on ? 'page' : null }, s.mobile || s.label);
        }),
        h('button', { type: 'button', class: menuOn ? 'on' : '', onclick: openMenu }, 'menu'));
}

function openMenu() {
    const close = () => sheet.remove();
    const current = route().page;
    const sheet = h('div', { class: 'overlay sheet-overlay', onclick: (e) => { if (e.target === sheet) close(); } },
        h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'menu' },
            h('div', { class: 'nav-links' }, SECTIONS.map((s, i) => h('a', {
                href: `#/${s.id}`, class: `nav-link${current === s.id ? ' on' : ''}`, onclick: close,
            }, h('span', { class: 'nav-num' }, String(i + 1).padStart(2, '0')), s.label))),
            h('button', { type: 'button', class: 'btn wide', onclick: () => { close(); newProjectDialog(); } }, '+ nouveau projet'),
            saveIndicator(),
            h('button', { type: 'button', class: 'link plain small', onclick: () => { close(); connectionsDialog(); } }, 'iCloud et rappels'),
            store.getMode() === 'cloud' ? h('button', { type: 'button', class: 'link plain small', onclick: () => { close(); passwordDialog(); } }, 'changer mon mot de passe') : null,
            h('button', { type: 'button', class: 'link plain small', onclick: () => { close(); logout(); } }, store.getMode() === 'demo' ? 'quitter le mode démo' : 'se déconnecter')));
    document.body.append(sheet);
}

function saveIndicator() {
    const labels = { idle: 'tout est enregistré', saved: 'tout est enregistré', saving: 'enregistrement…', error: 'pas encore enregistré · nouvel essai…', offline: 'hors ligne · enregistré dès le retour du réseau' };
    const el = h('div', { class: 'save-state', role: 'status' });
    const set = (s) => { el.textContent = store.getMode() === 'demo' ? `mode démo · ${labels[s]}` : labels[s]; el.dataset.state = s; };
    set(store.saveState.status);
    store.saveState.listeners.add(set);
    return el;
}

// Changer le mot de passe : l'actuel, puis le nouveau deux fois. Les autres appareils restent connectés.
function passwordDialog() {
    return modal((box, close) => {
        const field = (placeholder, autocomplete) => h('input', { class: 'field', type: 'password', placeholder, autocomplete, required: true, 'aria-label': placeholder });
        const current = field('mot de passe actuel', 'current-password');
        const next = field('nouveau mot de passe', 'new-password');
        const again = field('nouveau mot de passe, encore', 'new-password');
        const error = h('p', { class: 'login-error', role: 'alert' });
        const submit = h('button', { type: 'submit', class: 'btn primary' }, 'enregistrer');
        box.append(h('form', {
            class: 'stack',
            onsubmit: async (e) => {
                e.preventDefault();
                error.textContent = '';
                if (next.value.length < 10) { error.textContent = 'au moins 10 caractères, s\'il te plaît.'; return; }
                if (next.value !== again.value) { error.textContent = 'les deux nouveaux mots de passe ne sont pas identiques.'; return; }
                if (next.value === current.value) { error.textContent = 'le nouveau mot de passe doit être différent de l\'actuel.'; return; }
                submit.disabled = true;
                try {
                    await store.changePassword(current.value, next.value);
                    close(true);
                    toast('mot de passe changé');
                } catch (err) {
                    console.error(err);
                    error.textContent = /invalid/i.test(err.message || '') ? 'mot de passe actuel incorrect.' : 'changement impossible pour le moment.';
                    submit.disabled = false;
                }
            },
        }, h('h2', null, 'changer mon mot de passe.'), current, next, again, error,
            h('p', { class: 'small muted' }, 'Au moins 10 caractères. Tes autres appareils restent connectés.'),
            h('div', { class: 'modal-actions' },
                h('button', { type: 'button', class: 'btn ghost', onclick: () => close(null) }, 'annuler'),
                submit)));
    }, { label: 'changer mon mot de passe' });
}

async function logout() {
    await store.signOut();
    location.hash = '';
    location.reload();
}

function render() {
    const { page, param } = route();
    // On mémorise le champ actif et la position pour les retrouver après le nouveau dessin
    const activeId = document.activeElement?.id;
    const scroll = window.scrollY;
    store.saveState.listeners.clear();
    let content;
    if (page === 'projet') content = renderProject(param);
    else if (PAGES[page]) content = PAGES[page]();
    else { location.hash = '#/accueil'; return; }

    const banner = store.getMode() === 'demo' ? h('div', { class: 'demo-banner', role: 'note' },
        h('strong', null, 'mode démo'), ' · tes données restent sur cet appareil : pas de sauvegarde en ligne, pas de synchronisation avec ton téléphone ou ton ordinateur. ',
        h('button', { type: 'button', class: 'link plain', onclick: logout }, 'se connecter à mon compte')) : null;
    const shell = h('div', { class: 'shell' },
        state.mobile ? mobileTop() : sideNav(page),
        h('main', { class: 'main', id: 'main' }, banner, content),
        state.mobile ? bottomBar(page) : null);
    root.replaceChildren(shell);
    window.scrollTo(0, scroll);
    if (activeId) document.getElementById(activeId)?.focus({ preventScroll: true });
}

// ---------- Démarrage ----------
(async function boot() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
    const forcedDemo = new URLSearchParams(location.search).has('demo');
    let saved = null;
    try { saved = localStorage.getItem('pilotage-mode'); } catch { /* rien */ }
    if (forcedDemo || saved === 'demo') { startApp(() => store.startDemo()); return; }
    if (!window.supabase) { renderLogin('connexion indisponible (réseau ?). tu peux essayer le mode démo.'); return; }
    try {
        const session = await store.currentSession();
        if (session) { store.keepStorage(); startApp(() => store.startCloud(session)); }
        else renderLogin();
    } catch (err) {
        console.error(err);
        renderLogin();
    }
}());

window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); toast('un souci est survenu, réessaie'); });
