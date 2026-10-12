// Connexions iPhone : agenda iCloud (dans les deux sens) et rappels (via un raccourci de l'app Raccourcis)
import { h, modal, confirmDialog, toast } from '../ui.js';
import { all, remove, update, singleton, getMode, getClient, currentSession } from '../store.js';
import { CALENDARS } from '../data.js';
import { icloud, isConnected, connect, saveMapping, disconnect, saveEvent, targetOf, errorText, loadStatus } from '../icloud.js';
import { shortDate } from '../dates.js';

const APPLE_PASSWORDS = 'https://account.apple.com/account/manage/section/security';

export function connectionsDialog() {
    return modal((box, close) => {
        const draw = () => box.replaceChildren(
            h('div', { class: 'section-head' }, h('h2', null, 'iCloud et rappels.'),
                h('button', { type: 'button', class: 'btn ghost small', onclick: () => close(null) }, 'fermer')),
            getMode() !== 'cloud'
                ? h('p', { class: 'muted' }, 'disponible une fois connectée à ton compte (pas en mode démo).')
                : [agendaPart(draw), remindersPart(draw)],
        );
        draw();
        // État à jour (relié depuis un autre appareil ?) puis nouveau dessin, sauf si une saisie est en cours
        if (getMode() === 'cloud') loadStatus().then(() => { if (box.isConnected && !box.contains(document.activeElement)) draw(); });
    }, { label: 'iCloud et rappels' });
}

// ---------- Agenda iCloud ----------
function agendaPart(redraw) {
    return h('section', { class: 'stack-sm connect-part' },
        h('h3', { class: 'h-small' }, 'agenda iCloud.'),
        isConnected() ? connectedAgenda(redraw) : connectForm(redraw));
}

function connectForm(redraw) {
    const appleId = h('input', { class: 'field', type: 'email', placeholder: 'adresse de ton identifiant apple', autocomplete: 'username', autocapitalize: 'none', 'aria-label': 'identifiant apple' });
    const password = h('input', { class: 'field', type: 'password', placeholder: 'abcd-efgh-ijkl-mnop', autocomplete: 'off', 'aria-label': 'mot de passe d\'application' });
    const error = h('p', { class: 'login-error', role: 'alert' });
    const submit = h('button', { type: 'submit', class: 'btn primary' }, 'relier mon agenda');
    return h('form', {
        class: 'stack-sm',
        onsubmit: async (e) => {
            e.preventDefault();
            if (!appleId.value.trim() || !password.value.trim()) return;
            submit.disabled = true;
            submit.textContent = 'vérification auprès d\'apple…';
            error.textContent = '';
            try {
                await connect(appleId.value.trim(), password.value.trim());
                toast('agenda iCloud relié');
                redraw();
            } catch (err) {
                error.textContent = errorText(err);
                submit.disabled = false;
                submit.textContent = 'relier mon agenda';
            }
        },
    },
    h('p', { class: 'small muted' }, 'Tes rendez-vous iPhone s\'affichent dans le calendrier, et ce que tu ajoutes ici arrive sur ton iPhone.'),
    h('ol', { class: 'steps small' },
        h('li', null, 'Ouvre ', h('a', { href: APPLE_PASSWORDS, target: '_blank', rel: 'noopener', class: 'link' }, 'account.apple.com'), ' > Connexion et sécurité > Mots de passe pour apps.'),
        h('li', null, 'Crée-en un nommé « pilotage » et copie-le (il ressemble à abcd-efgh-ijkl-mnop).'),
        h('li', null, 'Colle-le ci-dessous avec l\'adresse de ton identifiant Apple.')),
    h('label', { class: 'field-label' }, 'identifiant apple', appleId),
    h('label', { class: 'field-label' }, 'mot de passe d\'application', password),
    h('p', { class: 'small muted' }, 'Ce n\'est pas ton vrai mot de passe Apple : il est gardé chiffré et tu peux le supprimer à tout moment sur account.apple.com.'),
    error,
    h('div', { class: 'modal-actions' }, submit));
}

function connectedAgenda(redraw) {
    const st = icloud.status;
    const calendars = st.calendars || [];
    const mapping = { ...(st.mapping || {}) };
    const error = h('p', { class: 'login-error', role: 'alert' });
    const selects = CALENDARS.map((c) => {
        const sel = h('select', {
            class: 'field', 'aria-label': `agenda iCloud pour ${c.label}`,
            onchange: async (e) => {
                mapping[c.id] = e.target.value || null;
                error.textContent = '';
                try { await saveMapping(mapping); redraw(); } catch (err) { error.textContent = errorText(err); }
            },
        }, h('option', { value: '' }, '— rester dans l\'outil —'), calendars.map((x) => h('option', { value: x.url }, x.name)));
        sel.value = mapping[c.id] || '';
        return h('label', { class: 'map-row' }, h('span', { class: 'cal-swatch', style: { background: c.bg } }), h('span', { class: 'map-name' }, c.label), sel);
    });
    const local = all('event').filter((e) => targetOf(e.calendar));
    return h('div', { class: 'stack-sm' },
        h('p', { class: 'small' }, `relié à ${st.appleId}. Chaque calendrier de l'outil va dans l'agenda iCloud de ton choix :`),
        h('div', { class: 'stack-sm' }, selects),
        error,
        local.length ? h('div', { class: 'stack-sm' },
            h('p', { class: 'small muted' }, `${local.length} date${local.length > 1 ? 's' : ''} déjà dans l'outil sur ces calendriers ne ${local.length > 1 ? 'sont' : 'est'} pas encore sur ton iPhone.`),
            h('button', { type: 'button', class: 'btn small', onclick: () => pushExisting(local, redraw) }, `les envoyer vers iCloud`)) : null,
        h('div', { class: 'modal-actions' },
            h('button', {
                type: 'button', class: 'btn ghost danger-text small',
                onclick: async () => {
                    if (!(await confirmDialog('Ton agenda iCloud ne sera plus affiché ici, et les dates ajoutées dans l\'outil n\'iront plus sur ton iPhone. Rien n\'est supprimé de ton iPhone.', 'déconnecter'))) return;
                    try { await disconnect(); redraw(); } catch (err) { toast(errorText(err)); }
                },
            }, 'déconnecter iCloud')));
}

async function pushExisting(list, redraw) {
    const lines = list.slice(0, 8).map((e) => `· ${e.title} (${shortDate(e.date)})`).join('\n');
    if (!(await confirmDialog(`Ces dates seront déplacées dans ton agenda iCloud :\n${lines}${list.length > 8 ? '\n…' : ''}`, 'envoyer'))) return;
    let ok = 0;
    for (const e of list) {
        try {
            await saveEvent({ title: e.title, date: e.date, time: e.time || '', calendar: e.calendar, repeat: e.repeat === 'weekly' ? 'weekly' : null, big: !!e.big });
            remove(e.id);
            ok++;
        } catch (err) {
            toast(`${e.title} : ${errorText(err)}`);
            break;
        }
    }
    if (ok) toast(`${ok} date${ok > 1 ? 's' : ''} envoyée${ok > 1 ? 's' : ''} vers iCloud`);
    redraw();
}

// ---------- Rappels ----------
const randomKey = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const syncUrl = (key) => `${location.origin}/api/rappels?cle=${key}`;

async function createKey() {
    const session = await currentSession();
    const key = randomKey();
    const { error } = await getClient().from('pilotage_rappels_cles')
        .upsert({ owner: session.user.id, cle_hash: await sha256(key) }, { onConflict: 'owner' });
    if (error) throw error;
    update('profile', { rappelsCle: key });
    return key;
}

function remindersPart(redraw) {
    const p = singleton('profile');
    const key = p.rappelsCle;
    const lists = h('input', {
        class: 'field', placeholder: 'ex. Velvet, Muse Lab, Creative', value: (p.rappelsListes || []).join(', '), 'aria-label': 'listes de rappels à importer',
        onchange: (e) => update('profile', { rappelsListes: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }, { quiet: true }),
    });
    const last = h('p', { class: 'small muted' });
    if (key) {
        getClient().from('pilotage_rappels_cles').select('derniere_synchro').maybeSingle().then(({ data }) => {
            last.textContent = data?.derniere_synchro
                ? `dernière synchronisation : ${new Date(data.derniere_synchro).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}`
                : 'pas encore de synchronisation depuis l\'iPhone.';
        });
    }
    const make = async () => {
        try { await createKey(); redraw(); } catch (err) { console.error(err); toast('création impossible : le réglage connexions-icloud.sql est-il passé dans Supabase ?'); }
    };
    return h('section', { class: 'stack-sm connect-part' },
        h('h3', { class: 'h-small' }, 'rappels iPhone.'),
        h('p', { class: 'small muted' }, 'Apple ne laisse aucun site lire tes Rappels : c\'est un raccourci de ton iPhone qui les envoie ici. Chaque rappel devient une tâche, rangée dans le projet qui porte le nom de sa liste. Un rappel coché sur l\'iPhone est coché ici.'),
        h('label', { class: 'field-label' }, 'listes à importer (vide = toutes)', lists),
        key ? [
            h('label', { class: 'field-label' }, 'adresse à coller dans le raccourci',
                h('div', { class: 'copy-line' },
                    h('input', { class: 'field', readonly: true, value: syncUrl(key), onfocus: (e) => e.target.select(), 'aria-label': 'adresse de synchronisation' }),
                    h('button', { type: 'button', class: 'btn small', onclick: () => navigator.clipboard?.writeText(syncUrl(key)).then(() => toast('adresse copiée')) }, 'copier'))),
            last,
            h('details', { class: 'steps-box' }, h('summary', null, 'créer le raccourci sur l\'iPhone (5 minutes, une seule fois)'), shortcutSteps()),
            h('button', {
                type: 'button', class: 'link plain small',
                onclick: async () => { if (await confirmDialog('L\'ancienne adresse ne marchera plus : il faudra coller la nouvelle dans le raccourci.', 'changer d\'adresse')) make(); },
            }, 'changer d\'adresse'),
        ] : h('button', { type: 'button', class: 'btn small', onclick: make }, 'créer mon adresse de synchronisation'));
}

function shortcutSteps() {
    const li = (...c) => h('li', null, ...c);
    const b = (t) => h('strong', null, t);
    return h('div', { class: 'stack-sm small' },
        h('p', null, 'Sur l\'iPhone, app ', b('Raccourcis'), ' > ', b('+'), ' > nomme le raccourci « pilotage rappels », puis ajoute ces actions dans l\'ordre :'),
        h('ol', { class: 'steps' },
            li(b('Rechercher des rappels'), ' : touche « Ajouter un filtre », choisis ', b('Est terminé'), ' et laisse-le sur « non ».'),
            li(b('Répéter avec chaque élément'), ' (il reçoit les rappels trouvés).'),
            li('Dans la répétition, ', b('Dictionnaire'), ' avec trois lignes de texte :',
                h('ul', null,
                    h('li', null, b('titre'), ' : Élément de répétition > Titre'),
                    h('li', null, b('liste'), ' : Élément de répétition > Liste'),
                    h('li', null, b('echeance'), ' : Élément de répétition > Date d\'échéance (touche-la : Format de date > ISO 8601)'))),
            li('Après la répétition, ', b('Combiner le texte'), ' : Résultats de la répétition, avec « Nouvelle ligne ».'),
            li(b('Obtenir le contenu de l\'URL'), ' : colle l\'adresse ci-dessus. Touche la flèche : Méthode ', b('POST'), ', Corps de la requête ', b('Fichier'), ', Fichier = Texte combiné.'),
            li('Facultatif : ', b('Obtenir la valeur du dictionnaire'), ' « message » puis ', b('Afficher la notification'), ' pour voir le résultat.')),
        h('p', null, 'Pour que ça tourne tout seul : Raccourcis > ', b('Automatisation'), ' > ', b('+'), ' > ', b('App'), ' > Rappels > ', b('Est fermée'), ' > ', b('Exécuter immédiatement'), ' > « pilotage rappels ». Ajoute aussi une automatisation ', b('Heure de la journée'), ' (8 h, chaque jour).'));
}
