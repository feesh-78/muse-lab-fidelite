// /api/icloud?action=… : relie l'agenda iCloud de Maryse aux calendriers de l'outil, dans les deux sens.
//   status      → compte relié ?, agendas iCloud, correspondances
//   connect     → { appleId, password } : vérifie auprès d'Apple puis enregistre (mot de passe chiffré)
//   mapping     → { mapping: { muselab: url|null, velvet, creative, perso } }
//   disconnect  → oublie le compte iCloud
//   events      → ?from=AAAA-MM-JJ&to=AAAA-MM-JJ : rendez-vous des agendas reliés
//   save        → { event: { title, date, time, calendar, repeat, big }, ref?: { href, etag, date } }
//   delete      → { ref: { href, etag } }
import crypto from 'node:crypto';
import { send, readBody, db, currentUser, seal, unseal } from './_server.js';
import { CalDav, ICloudAuthError, ICloudConflict, expand, buildIcs, updateIcs } from './_caldav.js';

const TOOL_CALENDARS = ['muselab', 'velvet', 'creative', 'perso'];
const GUESS = {
    muselab: /muse|lab|studio|cours/i,
    velvet: /velvet/i,
    creative: /creative|content|contenu|travail|work|pro/i,
    perso: /perso|personnel|home|maison|famille|privé|prive/i,
};

async function account(me) {
    const rows = await db('/rest/v1/pilotage_icloud?select=*', { token: me.token });
    return rows && rows[0] ? rows[0] : null;
}

function publicStatus(row) {
    if (!row) return { connected: false };
    return { connected: true, appleId: row.apple_id, calendars: row.calendars || [], mapping: row.mapping || {} };
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isTime = (s) => s === '' || /^\d{2}:\d{2}$/.test(String(s));

function cleanEvent(e) {
    if (!e || typeof e !== 'object') return null;
    const title = String(e.title || '').trim().slice(0, 300);
    const time = String(e.time || '');
    if (!title || !isDate(e.date) || !isTime(time) || !TOOL_CALENDARS.includes(e.calendar)) return null;
    return { title, date: e.date, time, calendar: e.calendar, repeat: e.repeat === 'weekly' ? 'weekly' : null, big: !!e.big };
}

// Une adresse d'agenda acceptée seulement si elle fait partie des agendas de ce compte
const knownCalendar = (row, url) => (row.calendars || []).some((c) => c.url === url);
const sameHost = (row, href) => {
    try { return (row.calendars || []).some((c) => new URL(c.url).host === new URL(href).host && href.startsWith(c.url)); } catch { return false; }
};

export default async function handler(req, res) {
    try {
        const me = await currentUser(req);
        if (!me) return send(res, 401, { error: 'non connecté à l\'outil' });
        const action = String(req.query?.action || new URL(req.url, 'http://x').searchParams.get('action') || '');
        const body = req.method === 'POST' ? await readBody(req) : null;
        const input = typeof body === 'string' ? JSON.parse(body || '{}') : (body || {});

        if (action === 'status') return send(res, 200, publicStatus(await account(me)));

        if (action === 'connect') {
            const appleId = String(input.appleId || '').trim();
            const password = String(input.password || '').replace(/\s+/g, '');
            if (!appleId || !password) return send(res, 400, { error: 'identifiant et mot de passe d\'application requis' });
            const dav = new CalDav(appleId, password);
            const homeUrl = await dav.discover();
            const calendars = await dav.calendars(homeUrl);
            const previous = await account(me);
            const mapping = {};
            for (const id of TOOL_CALENDARS) {
                const kept = previous?.mapping?.[id];
                mapping[id] = kept && calendars.some((c) => c.url === kept) ? kept : (calendars.find((c) => GUESS[id].test(c.name))?.url || null);
            }
            const row = { owner: me.id, apple_id: appleId, secret: seal(password), home_url: homeUrl, calendars, mapping, updated_at: new Date().toISOString() };
            await db('/rest/v1/pilotage_icloud?on_conflict=owner', { token: me.token, method: 'POST', body: row, prefer: 'resolution=merge-duplicates,return=minimal' });
            return send(res, 200, publicStatus(row));
        }

        const row = await account(me);
        if (!row) return send(res, 409, { error: 'iCloud n\'est pas relié', code: 'not_connected' });
        const dav = new CalDav(row.apple_id, unseal(row.secret));

        if (action === 'disconnect') {
            await db('/rest/v1/pilotage_icloud?owner=eq.' + me.id, { token: me.token, method: 'DELETE' });
            return send(res, 200, { connected: false });
        }

        if (action === 'mapping') {
            const mapping = {};
            // On en profite pour rafraîchir la liste des agendas (un agenda créé sur l'iPhone apparaît)
            const calendars = await dav.calendars(row.home_url);
            for (const id of TOOL_CALENDARS) {
                const url = input.mapping?.[id];
                mapping[id] = url && calendars.some((c) => c.url === url) ? url : null;
            }
            await db('/rest/v1/pilotage_icloud?owner=eq.' + me.id, { token: me.token, method: 'PATCH', body: { mapping, calendars, updated_at: new Date().toISOString() } });
            return send(res, 200, publicStatus({ ...row, mapping, calendars }));
        }

        if (action === 'events') {
            const q = new URL(req.url, 'http://x').searchParams;
            const from = q.get('from');
            const to = q.get('to');
            if (!isDate(from) || !isDate(to)) return send(res, 400, { error: 'dates attendues : from et to' });
            // Une journée de marge de chaque côté pour les fuseaux horaires
            const start = new Date(`${from}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 1);
            const end = new Date(`${to}T23:59:59Z`); end.setUTCDate(end.getUTCDate() + 1);
            const seen = new Set();
            const jobs = TOOL_CALENDARS.filter((id) => row.mapping?.[id] && !seen.has(row.mapping[id]) && seen.add(row.mapping[id]))
                .map(async (calendar) => {
                    const objects = await dav.objects(row.mapping[calendar], start, end);
                    const out = [];
                    for (const o of objects) {
                        try {
                            for (const occ of expand(o.ics, start, end)) {
                                if (occ.date >= from && occ.date <= to) out.push({ ...occ, href: o.href, etag: o.etag, calendar });
                            }
                        } catch (err) { console.warn('rendez-vous illisible', o.href, err.message); }
                    }
                    return out;
                });
            const events = (await Promise.all(jobs)).flat();
            return send(res, 200, { from, to, events });
        }

        if (action === 'save') {
            const fields = cleanEvent(input.event);
            if (!fields) return send(res, 400, { error: 'rendez-vous incomplet' });
            const target = row.mapping?.[fields.calendar];
            if (!target || !knownCalendar(row, target)) return send(res, 409, { error: 'ce calendrier n\'est relié à aucun agenda iCloud', code: 'not_mapped' });
            const ref = input.ref && input.ref.href ? input.ref : null;
            if (ref && !sameHost(row, ref.href)) return send(res, 400, { error: 'rendez-vous inconnu' });
            if (ref && ref.href.startsWith(target)) {
                const current = await dav.get(ref.href);
                if (!current) return send(res, 409, { error: 'ce rendez-vous a été supprimé sur un autre appareil', code: 'gone' });
                const saved = await dav.put(ref.href, updateIcs(current.ics, fields, ref.date), current.etag);
                return send(res, 200, { href: saved.href, etag: saved.etag });
            }
            // Nouveau rendez-vous, ou changement d'agenda : on crée dans le bon agenda puis on retire l'ancien
            const uid = `${crypto.randomUUID()}@pilotage`;
            let ics = buildIcs(fields, uid);
            if (ref) {
                const current = await dav.get(ref.href);
                if (current) ics = updateIcs(current.ics, fields, ref.date, uid);
            }
            const saved = await dav.put(new URL(`${encodeURIComponent(uid)}.ics`, target).href, ics, null);
            if (ref) await dav.remove(ref.href, null);
            return send(res, 200, { href: saved.href, etag: saved.etag });
        }

        if (action === 'delete') {
            const href = input.ref?.href;
            if (!href || !sameHost(row, href)) return send(res, 400, { error: 'rendez-vous inconnu' });
            await dav.remove(href, null);
            return send(res, 200, { ok: true });
        }

        return send(res, 404, { error: 'action inconnue' });
    } catch (err) {
        if (err instanceof ICloudAuthError) return send(res, 401, { error: 'apple refuse l\'identifiant ou le mot de passe d\'application', code: 'icloud_auth' });
        if (err instanceof ICloudConflict) return send(res, 409, { error: err.message, code: 'conflict' });
        if (err instanceof SyntaxError) return send(res, 400, { error: 'requête illisible' });
        console.error(err);
        return send(res, 502, { error: 'iCloud ne répond pas pour le moment', detail: err.message });
    }
}
