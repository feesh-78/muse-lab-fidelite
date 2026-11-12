// Dialogue avec l'agenda iCloud (protocole CalDAV) : liste des agendas, lecture, ajout, modification, suppression.
// Connexion par identifiant Apple + mot de passe d'application (account.apple.com), jamais le vrai mot de passe.
import { XMLParser } from 'fast-xml-parser';
import ICAL from 'ical.js';

const ROOT = 'https://caldav.icloud.com/';
export const TZ = 'Europe/Paris';
const parser = new XMLParser({
    removeNSPrefix: true, ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false, htmlEntities: true,
    isArray: (name) => ['response', 'propstat', 'comp'].includes(name),
});

export class ICloudAuthError extends Error {}
export class ICloudConflict extends Error {}

const text = (v) => (v == null ? '' : typeof v === 'object' ? String(v['#text'] ?? '') : String(v));

export class CalDav {
    constructor(appleId, password) {
        this.auth = `Basic ${Buffer.from(`${appleId}:${password}`).toString('base64')}`;
    }

    async request(url, method, body, headers = {}) {
        const res = await fetch(url, {
            method, body,
            headers: { Authorization: this.auth, 'Content-Type': 'application/xml; charset=utf-8', ...headers },
        });
        if (res.status === 401 || res.status === 403) throw new ICloudAuthError('identifiants iCloud refusés');
        return res;
    }

    async multistatus(url, method, depth, body) {
        const res = await this.request(url, method, body, { Depth: String(depth) });
        if (res.status !== 207) throw new Error(`iCloud ${method} : ${res.status}`);
        const doc = parser.parse(await res.text());
        return (doc.multistatus?.response || []).map((r) => ({
            href: text(r.href),
            props: Object.assign({}, ...(r.propstat || []).filter((ps) => /\s200\s/.test(text(ps.status))).map((ps) => ps.prop || {})),
        }));
    }

    // Adresse du dossier qui contient les agendas de ce compte
    async discover() {
        const [me] = await this.multistatus(ROOT, 'PROPFIND', 0,
            '<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>');
        const principal = new URL(text(me?.props['current-user-principal']?.href), ROOT).href;
        const [home] = await this.multistatus(principal, 'PROPFIND', 0,
            '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>');
        return new URL(text(home?.props['calendar-home-set']?.href), principal).href;
    }

    // Agendas qui acceptent des rendez-vous (les listes de rappels sont écartées)
    async calendars(homeUrl) {
        const list = await this.multistatus(homeUrl, 'PROPFIND', 1,
            '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/">'
            + '<d:prop><d:displayname/><d:resourcetype/><c:supported-calendar-component-set/><a:calendar-color/></d:prop></d:propfind>');
        return list
            .filter((r) => r.props.resourcetype && typeof r.props.resourcetype === 'object' && 'calendar' in r.props.resourcetype)
            .filter((r) => {
                const comps = r.props['supported-calendar-component-set']?.comp;
                return !comps || comps.some((c) => c['@_name'] === 'VEVENT');
            })
            .map((r) => ({ url: new URL(r.href, homeUrl).href, name: text(r.props.displayname) || 'agenda', color: text(r.props['calendar-color']).slice(0, 7) }));
    }

    // Rendez-vous d'un agenda entre deux instants (Date)
    async objects(calUrl, from, to) {
        const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
        const list = await this.multistatus(calUrl, 'REPORT', 1,
            '<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop>'
            + `<c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${stamp(from)}" end="${stamp(to)}"/>`
            + '</c:comp-filter></c:comp-filter></c:filter></c:calendar-query>');
        return list.filter((r) => r.props['calendar-data'])
            .map((r) => ({ href: new URL(r.href, calUrl).href, etag: text(r.props.getetag), ics: text(r.props['calendar-data']) }));
    }

    async get(href) {
        const res = await this.request(href, 'GET', undefined, { 'Content-Type': 'text/calendar' });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`iCloud GET : ${res.status}`);
        return { href, etag: res.headers.get('etag') || '', ics: await res.text() };
    }

    async put(href, ics, etag) {
        const res = await this.request(href, 'PUT', ics, {
            'Content-Type': 'text/calendar; charset=utf-8',
            ...(etag ? { 'If-Match': etag } : { 'If-None-Match': '*' }),
        });
        if (res.status === 412) throw new ICloudConflict('modifié entre-temps sur un autre appareil');
        if (!res.ok) throw new Error(`iCloud PUT : ${res.status}`);
        return { href, etag: res.headers.get('etag') || '' };
    }

    async remove(href, etag) {
        const res = await this.request(href, 'DELETE', undefined, etag ? { 'If-Match': etag } : {});
        if (res.status === 412) throw new ICloudConflict('modifié entre-temps sur un autre appareil');
        if (!res.ok && res.status !== 404) throw new Error(`iCloud DELETE : ${res.status}`);
    }
}

// ---------- Lecture des fichiers .ics ----------
const PARTS = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function local(jsDate) {
    const p = Object.fromEntries(PARTS.formatToParts(jsDate).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const dateOf = (t) => `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;

function registerZones(comp) {
    for (const tz of comp.getAllSubcomponents('vtimezone')) {
        const id = tz.getFirstPropertyValue('tzid');
        if (id && !ICAL.TimezoneService.has(id)) ICAL.TimezoneService.register(tz);
    }
}

function occurrence(event, start, end) {
    const allDay = start.isDate;
    const s = allDay ? { date: dateOf(start), time: '' } : local(start.toJSDate());
    const e = !end ? null : allDay ? { date: dateOf(end), time: '' } : local(end.toJSDate());
    return { date: s.date, time: s.time, endTime: e && !allDay && e.date === s.date ? e.time : '', allDay, title: event.summary || '(sans titre)' };
}

// Toutes les dates d'un rendez-vous (répétitions comprises) entre deux instants
export function expand(ics, from, to) {
    const comp = new ICAL.Component(ICAL.parse(ics));
    registerZones(comp);
    const vevents = comp.getAllSubcomponents('vevent');
    const master = vevents.find((v) => !v.hasProperty('recurrence-id')) || vevents[0];
    if (!master) return [];
    const event = new ICAL.Event(master);
    vevents.filter((v) => v !== master && v.hasProperty('recurrence-id')).forEach((v) => event.relateException(v));
    const meta = {
        uid: event.uid, recurring: event.isRecurring(),
        big: master.getFirstPropertyValue('x-pilotage-big') === '1',
        weekly: /FREQ=WEEKLY(?!.*INTERVAL=[2-9])/.test(String(master.getFirstPropertyValue('rrule') || '')),
    };
    if (!event.isRecurring()) {
        const end = event.endDate;
        if (event.startDate.toJSDate() > to || (end ? end.toJSDate() : event.startDate.toJSDate()) < from) return [];
        return [{ ...occurrence(event, event.startDate, end), ...meta }];
    }
    const out = [];
    const it = event.iterator();
    for (let n = 0, next = it.next(); next && n < 2000; n++, next = it.next()) {
        const occ = event.getOccurrenceDetails(next);
        if (occ.startDate.toJSDate() > to) break;
        if ((occ.endDate || occ.startDate).toJSDate() < from) continue;
        out.push({ ...occurrence(occ.item, occ.startDate, occ.endDate), ...meta });
    }
    return out;
}

// ---------- Écriture ----------
const PARIS_VTIMEZONE = [
    'BEGIN:VTIMEZONE', 'TZID:Europe/Paris',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
    'END:VTIMEZONE',
].join('\r\n');

function ensureParisZone(comp) {
    if (comp.getAllSubcomponents('vtimezone').some((z) => z.getFirstPropertyValue('tzid') === TZ)) return;
    const vcal = new ICAL.Component(ICAL.parse(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${PARIS_VTIMEZONE}\r\nEND:VCALENDAR`));
    const zone = vcal.getFirstSubcomponent('vtimezone');
    comp.addSubcomponent(zone);
    registerZones(comp);
}

// Date de l'outil (« 2026-10-12 » + « 10:00 » ou rien) → propriété DTSTART / DTEND
function timeValue(date, time) {
    const [year, month, day] = date.split('-').map(Number);
    if (!time) return ICAL.Time.fromData({ year, month, day, isDate: true });
    const [hour, minute] = time.split(':').map(Number);
    return ICAL.Time.fromData({ year, month, day, hour, minute, second: 0 });
}
function setTime(vevent, name, value) {
    vevent.removeAllProperties(name);
    const prop = new ICAL.Property(name, vevent);
    prop.setValue(value);
    if (!value.isDate) prop.setParameter('tzid', TZ);
    vevent.addProperty(prop);
}

const nowStamp = () => ICAL.Time.fromJSDate(new Date(), true);

// Nouveau rendez-vous : { title, date, time, repeat, big }
export function buildIcs(fields, uid) {
    const comp = new ICAL.Component(['vcalendar', [], []]);
    comp.updatePropertyWithValue('version', '2.0');
    comp.updatePropertyWithValue('prodid', '-//pilotage//maryse//FR');
    comp.updatePropertyWithValue('calscale', 'GREGORIAN');
    ensureParisZone(comp);
    const v = new ICAL.Component('vevent', comp);
    comp.addSubcomponent(v);
    v.updatePropertyWithValue('uid', uid);
    v.updatePropertyWithValue('dtstamp', nowStamp());
    v.updatePropertyWithValue('created', nowStamp());
    applyFields(v, fields, null);
    return comp.toString();
}

// Rendez-vous existant : on change le titre, la date, l'heure, la répétition ; tout le reste (lieu, notes, alertes…) est gardé.
// occurrenceDate : date affichée dans l'outil ; pour une répétition, la série ne bouge que si la date a été changée.
export function updateIcs(ics, fields, occurrenceDate, newUid = null) {
    const comp = new ICAL.Component(ICAL.parse(ics));
    registerZones(comp);
    ensureParisZone(comp);
    const vevents = comp.getAllSubcomponents('vevent');
    const master = vevents.find((x) => !x.hasProperty('recurrence-id')) || vevents[0];
    const event = new ICAL.Event(master);
    const seriesDate = event.isRecurring() && fields.date === occurrenceDate ? dateOf(event.startDate) : fields.date;
    applyFields(master, { ...fields, date: seriesDate }, event);
    if (newUid) vevents.forEach((x) => x.updatePropertyWithValue('uid', newUid));
    master.updatePropertyWithValue('dtstamp', nowStamp());
    master.updatePropertyWithValue('last-modified', nowStamp());
    master.updatePropertyWithValue('sequence', (Number(master.getFirstPropertyValue('sequence')) || 0) + 1);
    // Les exceptions d'une série ne correspondent plus si la série a bougé : on les retire
    if (seriesDate !== dateOf(event.startDate)) vevents.filter((x) => x !== master).forEach((x) => comp.removeSubcomponent(x));
    return comp.toString();
}

function applyFields(v, fields, previous) {
    v.updatePropertyWithValue('summary', fields.title);
    const start = timeValue(fields.date, fields.time);
    let end;
    if (start.isDate) {
        end = start.clone();
        end.adjust(1, 0, 0, 0);
    } else {
        // On garde la durée d'origine si c'était déjà un rendez-vous à heure fixe, sinon 1 h
        let minutes = 60;
        if (previous && !previous.startDate.isDate && previous.endDate) {
            minutes = Math.max(5, Math.round((previous.endDate.toJSDate() - previous.startDate.toJSDate()) / 60000));
        }
        end = start.clone();
        end.adjust(0, 0, minutes, 0);
    }
    v.removeAllProperties('duration');
    setTime(v, 'dtstart', start);
    setTime(v, 'dtend', end);
    const hadWeekly = /FREQ=WEEKLY/.test(String(v.getFirstPropertyValue('rrule') || ''));
    if (fields.repeat === 'weekly' && !hadWeekly) {
        v.removeAllProperties('rrule');
        v.addPropertyWithValue('rrule', ICAL.Recur.fromString('FREQ=WEEKLY'));
    } else if (fields.repeat !== 'weekly' && hadWeekly) {
        v.removeAllProperties('rrule');
    }
    v.removeAllProperties('x-pilotage-big');
    if (fields.big) v.addPropertyWithValue('x-pilotage-big', '1');
}
