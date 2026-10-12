// /api/rappels?cle=… : reçoit les rappels de l'iPhone, envoyés par un raccourci (app Raccourcis).
// Le raccourci envoie la liste de TOUS ses rappels non terminés : [{ "titre", "liste", "echeance" }, …]
// (texte JSON, ou un dictionnaire par ligne). Réponse : ce qui a été fait, et les rappels à cocher sur l'iPhone.
import { send, readBody, db } from './_server.js';

const MOIS = { janv: 1, jan: 1, fevr: 2, fev: 2, feb: 2, mars: 3, mar: 3, avr: 4, apr: 4, mai: 5, may: 5, juin: 6, jun: 6, juil: 7, jul: 7, aout: 8, aug: 8, sept: 9, sep: 9, oct: 10, nov: 11, dec: 12 };

// « 2026-10-24T13:30:00+02:00 », « 24 oct. 2026 à 13:30 », « 24/10/2026 »… → « 2026-10-24 »
export function normalizeDate(value) {
    const s = String(value || '').trim();
    if (!s) return '';
    let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
    if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const plain = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    m = plain.match(/(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})/);
    if (m) {
        const month = MOIS[m[2]] || MOIS[m[2].slice(0, 4)] || MOIS[m[2].slice(0, 3)];
        if (month) return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    return '';
}

// Le raccourci peut envoyer un tableau JSON, un objet { rappels: [...] } ou des dictionnaires mis bout à bout
export function parseReminders(body) {
    let data = body;
    if (typeof data === 'string') {
        const s = data.trim();
        if (!s) return [];
        try { data = JSON.parse(s); } catch {
            data = JSON.parse(`[${s.replace(/}\s*,?\s*{/g, '},{')}]`);
        }
    }
    if (data && !Array.isArray(data) && Array.isArray(data.rappels)) data = data.rappels;
    if (data && !Array.isArray(data) && typeof data === 'object') data = [data];
    if (!Array.isArray(data)) throw new SyntaxError('liste attendue');
    const pick = (o, ...keys) => { for (const k of keys) if (o[k] != null && o[k] !== '') return String(o[k]); return ''; };
    return data.filter((o) => o && typeof o === 'object').map((o) => ({
        titre: pick(o, 'titre', 'Titre', 'title', 'Title').trim().slice(0, 300),
        liste: pick(o, 'liste', 'Liste', 'list', 'List').trim().slice(0, 120),
        echeance: normalizeDate(pick(o, 'echeance', 'échéance', 'Echeance', 'due', 'date')),
    })).filter((o) => o.titre);
}

export default async function handler(req, res) {
    const cle = String(new URL(req.url, 'http://x').searchParams.get('cle') || '');
    if (req.method !== 'POST') {
        return send(res, 200, { message: 'adresse de synchronisation des rappels : à utiliser dans le raccourci iPhone (méthode POST).' });
    }
    if (!cle) return send(res, 401, { message: 'clé manquante dans l\'adresse' });
    let rappels;
    try {
        rappels = parseReminders(await readBody(req));
    } catch {
        return send(res, 400, { message: 'rappels illisibles : vérifie le raccourci (dictionnaires combinés)' });
    }
    try {
        const r = await db('/rest/v1/rpc/pilotage_rappels_sync', { method: 'POST', body: { p_cle: cle, p_rappels: rappels } });
        const parts = [`${rappels.length} rappels lus`];
        if (r.crees) parts.push(`${r.crees} ajoutés`);
        if (r.mis_a_jour) parts.push(`${r.mis_a_jour} mis à jour`);
        if (r.termines) parts.push(`${r.termines} cochés`);
        return send(res, 200, { ...r, a_cocher_titres: (r.a_cocher || []).map((x) => x.titre), message: `pilotage : ${parts.join(', ')}.` });
    } catch (err) {
        if (err.code === '28000') return send(res, 401, { message: 'clé inconnue : recopie l\'adresse depuis l\'outil (iCloud et rappels)' });
        console.error(err);
        return send(res, 502, { message: 'synchronisation impossible pour le moment' });
    }
}
