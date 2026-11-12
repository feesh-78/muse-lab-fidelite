// Outils communs aux fonctions serveur : réponses, compte connecté, base Supabase, chiffrement.
import crypto from 'node:crypto';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export function send(res, status, data) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(data));
}

// Corps de la requête, quel que soit son format (JSON, texte brut envoyé par un raccourci…)
export async function readBody(req) {
    if (req.body !== undefined && !Buffer.isBuffer(req.body)) return req.body;
    if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
    const chunks = [];
    for await (const c of req) chunks.push(c);
    return Buffer.concat(chunks).toString('utf8');
}

// Appel à la base Supabase, au nom du compte connecté (les règles RLS s'appliquent) ou en anonyme
export async function db(path, { token, method = 'GET', body, prefer } = {}) {
    const res = await fetch(`${SUPABASE_URL}${path}`, {
        method,
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            ...(prefer ? { Prefer: prefer } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const textBody = await res.text();
    let data = null;
    try { data = textBody ? JSON.parse(textBody) : null; } catch { data = textBody; }
    if (!res.ok) {
        const err = new Error((data && data.message) || `supabase ${res.status}`);
        err.status = res.status;
        err.code = data && data.code;
        throw err;
    }
    return data;
}

// Compte connecté à l'outil (jeton envoyé par le navigateur)
export async function currentUser(req) {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const user = await res.json();
    return user && user.id ? { id: user.id, token } : null;
}

// Chiffrement du mot de passe d'application (clé ICLOUD_KEY, réglée dans Vercel, jamais envoyée au navigateur)
function key() {
    const k = Buffer.from(process.env.ICLOUD_KEY || '', 'base64');
    if (k.length !== 32) throw new Error('ICLOUD_KEY manquante dans les réglages Vercel');
    return k;
}
export function seal(plain) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}
export function unseal(sealed) {
    const [iv, tag, enc] = String(sealed).split('.').map((x) => Buffer.from(x, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
