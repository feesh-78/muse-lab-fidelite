// Agenda iCloud : les rendez-vous des agendas reliés s'affichent dans le calendrier, et ce qui est ajouté,
// modifié ou supprimé dans l'outil sur un calendrier relié l'est aussi sur l'iPhone.
// Le serveur (api/icloud.js) parle à Apple : le navigateur ne voit jamais le mot de passe d'application.
import { getMode, accessToken, isOpenAccess } from './store.js';
import { state } from './state.js';
import { addDays, today } from './dates.js';

const LS = 'pilotage-icloud-v1';
const months = (from, to) => {
    const out = [];
    for (let m = from.slice(0, 7); m <= to.slice(0, 7);) {
        out.push(m);
        const [y, mo] = m.split('-').map(Number);
        m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
    }
    return out;
};

export const icloud = {
    status: null, // { connected, appleId, calendars, mapping } · null = pas encore connu
    events: [], // { key, href, etag, title, date, time, endTime, allDay, calendar, recurring, weekly, big, source: 'icloud' }
    fresh: new Set(), // mois relus depuis iCloud pendant cette visite
    loading: new Set(),
    error: null,
};

try {
    const cached = JSON.parse(localStorage.getItem(LS) || 'null');
    if (cached) { icloud.status = cached.status; icloud.events = cached.events || []; }
} catch { /* cache illisible */ }

function persist() {
    try { localStorage.setItem(LS, JSON.stringify({ status: icloud.status, events: icloud.events })); } catch { /* rien */ }
}

export async function api(action, { body, params = {} } = {}) {
    const token = await accessToken();
    if (!token) throw Object.assign(new Error('non connecté'), { status: 401 });
    let res;
    try {
        res = await fetch(`/api/icloud?${new URLSearchParams({ action, ...params })}`, {
            method: body ? 'POST' : 'GET',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store',
        });
    } catch {
        throw Object.assign(new Error('pas de réseau'), { code: 'offline' });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `erreur ${res.status}`), { status: res.status, code: data.code || (res.status === 404 ? 'unavailable' : '') });
    return data;
}

export const isConnected = () => getMode() === 'cloud' && !isOpenAccess() && !!icloud.status?.connected;
// Agenda iCloud relié à un calendrier de l'outil (ou null)
export const targetOf = (calendar) => (isConnected() && icloud.status.mapping?.[calendar]) || null;

function setStatus(status) {
    icloud.status = status;
    if (!status.connected) { icloud.events = []; icloud.fresh.clear(); }
    persist();
}

export async function loadStatus() {
    if (getMode() !== 'cloud' || isOpenAccess()) return;
    try {
        setStatus(await api('status'));
        state.rerender();
    } catch (err) {
        icloud.error = err;
    }
}

export async function connect(appleId, password) {
    setStatus(await api('connect', { body: { appleId, password } }));
    refresh();
    return icloud.status;
}
export async function saveMapping(mapping) {
    setStatus(await api('mapping', { body: { mapping } }));
    refresh();
    return icloud.status;
}
export async function disconnect() {
    setStatus(await api('disconnect', { body: {} }));
    state.rerender();
}

// Rendez-vous iCloud entre deux dates : ce qui est en mémoire tout de suite, une relecture en arrière-plan si besoin
export function eventsBetween(from, to, { load = true } = {}) {
    if (!isConnected()) return [];
    if (load) ensure(from, to);
    return icloud.events.filter((e) => e.date >= from && e.date <= to);
}

function ensure(from, to) {
    const missing = months(from, to).filter((m) => !icloud.fresh.has(m) && !icloud.loading.has(m));
    if (missing.length) fetchMonths(missing);
}

async function fetchMonths(list) {
    list.forEach((m) => icloud.loading.add(m));
    const from = `${list[0]}-01`;
    const [y, mo] = list[list.length - 1].split('-').map(Number);
    const to = `${list[list.length - 1]}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`;
    try {
        const { events } = await api('events', { params: { from, to } });
        icloud.events = icloud.events.filter((e) => e.date < from || e.date > to)
            .concat(events.map((e) => ({ ...e, key: `${e.href}|${e.date}`, source: 'icloud' })));
        list.forEach((m) => icloud.fresh.add(m));
        icloud.error = null;
        persist();
        state.rerender();
    } catch (err) {
        icloud.error = err;
        if (err.code === 'not_connected') setStatus({ connected: false });
        console.warn('agenda iCloud indisponible', err.message);
    } finally {
        list.forEach((m) => icloud.loading.delete(m));
    }
}

// Relit les mois déjà affichés (retour sur l'app, après une modification)
export function refresh() {
    if (!isConnected()) return;
    const shown = [...icloud.fresh];
    icloud.fresh.clear();
    if (!shown.length) shown.push(...months(addDays(today(), -31), addDays(today(), 62)));
    // par blocs de mois qui se suivent
    shown.sort();
    let block = [];
    for (const m of shown) {
        if (block.length && months(block[block.length - 1], m).length > 2) { fetchMonths(block); block = []; }
        block.push(m);
    }
    if (block.length) fetchMonths(block);
}

// fields : { title, date, time, calendar, repeat, big } · ref : rendez-vous iCloud existant (ou null)
export async function saveEvent(fields, ref = null) {
    const r = await api('save', { body: { event: fields, ref: ref ? { href: ref.href, etag: ref.etag, date: ref.date } : null } });
    refresh();
    return r;
}
export async function deleteEvent(ref) {
    await api('delete', { body: { ref: { href: ref.href, etag: ref.etag } } });
    icloud.events = icloud.events.filter((e) => e.href !== ref.href);
    persist();
    refresh();
}

export function errorText(err) {
    if (err.code === 'icloud_auth') return 'apple refuse l\'identifiant ou le mot de passe d\'application. vérifie-les (le mot de passe d\'application ressemble à abcd-efgh-ijkl-mnop).';
    if (err.code === 'offline') return 'pas de réseau pour le moment.';
    if (err.code === 'unavailable') return 'la connexion iCloud n\'est disponible que sur maryse-pilotage.vercel.app.';
    if (err.code === 'conflict') return 'ce rendez-vous vient d\'être modifié sur un autre appareil : réessaie dans un instant.';
    if (err.code === 'gone') return 'ce rendez-vous a été supprimé sur un autre appareil.';
    return err.message || 'iCloud ne répond pas pour le moment.';
}
