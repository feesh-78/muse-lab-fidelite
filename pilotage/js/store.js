// Données de l'application : tout est un "élément" { id, kind, ...champs }.
// Une tâche, un projet, un rendez-vous n'existent qu'une fois : chaque page lit la même source.
// Chaque modification est enregistrée automatiquement (en ligne via Supabase, ou sur l'appareil en mode démo).
import { SUPABASE_URL, SUPABASE_ANON_KEY, TABLE, BUCKET } from '../config.js';
import { seedItems, missingSeed, SEED_VERSION } from './data.js';

const LS_CACHE = 'pilotage-cache-v1';
const LS_PENDING = 'pilotage-pending-v1';
const LS_DEMO = 'pilotage-demo-v1';
const SAVE_DELAY = 600;
const RETRY_DELAY = 5000;

let client = null;
let mode = null; // 'cloud' | 'demo'
let user = null;
const items = new Map();
const pending = new Set(); // ids à enregistrer (ou à supprimer s'ils ne sont plus dans items)
const listeners = new Set();
let flushTimer = null;

export const saveState = { status: 'idle', listeners: new Set() }; // idle | saving | saved | error | offline
function setSaveStatus(status) {
    saveState.status = status;
    saveState.listeners.forEach((fn) => fn(status));
}

export const getMode = () => mode;
export const onChange = (fn) => listeners.add(fn);
function emit(reason) { listeners.forEach((fn) => fn(reason)); }

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

// ---------- Lecture ----------
export const get = (id) => items.get(id) || null;
export function all(kind, filter) {
    const list = [];
    for (const it of items.values()) if (it.kind === kind && (!filter || filter(it))) list.push(it);
    return list;
}
// Élément unique (profil, réglages…) : créé à la volée s'il n'existe pas
export function singleton(kind, defaults = {}) {
    if (!items.has(kind)) {
        items.set(kind, { id: kind, kind, ...defaults });
        markDirty(kind);
    }
    return items.get(kind);
}

// ---------- Écriture ----------
export function create(kind, fields = {}, { quiet = false } = {}) {
    const id = fields.id || uid();
    const it = { ...fields, id, kind, createdAt: fields.createdAt || new Date().toISOString() };
    items.set(id, it);
    markDirty(id);
    if (!quiet) emit('create');
    return it;
}
// quiet : enregistre sans redessiner la page (frappe dans un champ texte)
export function update(id, patch, { quiet = false } = {}) {
    const it = items.get(id);
    if (!it) return null;
    Object.assign(it, patch);
    markDirty(id);
    if (!quiet) emit('update');
    return it;
}
export function remove(id) {
    if (!items.has(id)) return;
    items.delete(id);
    markDirty(id);
    emit('remove');
}

function markDirty(id) {
    pending.add(id);
    persistLocal();
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, SAVE_DELAY);
    setSaveStatus('saving');
}

function persistLocal() {
    try {
        const data = JSON.stringify([...items.values()]);
        localStorage.setItem(mode === 'demo' ? LS_DEMO : LS_CACHE, data);
        if (mode === 'cloud') localStorage.setItem(LS_PENDING, JSON.stringify([...pending]));
    } catch { /* stockage local plein ou indisponible : la sauvegarde en ligne reste la référence */ }
}

async function flush() {
    if (!pending.size) return;
    if (mode === 'demo') {
        pending.clear();
        persistLocal();
        setSaveStatus('saved');
        return;
    }
    if (!navigator.onLine) { setSaveStatus('offline'); return; }
    const ids = [...pending];
    pending.clear();
    const upserts = [];
    const deletes = [];
    for (const id of ids) {
        const it = items.get(id);
        if (it) {
            const { id: _id, kind, ...data } = it;
            upserts.push({ owner: user.id, id, kind, data, updated_at: new Date().toISOString() });
        } else deletes.push(id);
    }
    try {
        if (upserts.length) {
            const { error } = await client.from(TABLE).upsert(upserts, { onConflict: 'owner,id' });
            if (error) throw error;
        }
        if (deletes.length) {
            const { error } = await client.from(TABLE).delete().in('id', deletes);
            if (error) throw error;
        }
        persistLocal();
        setSaveStatus(pending.size ? 'saving' : 'saved');
    } catch (err) {
        console.error('Enregistrement impossible', err);
        ids.forEach((id) => pending.add(id));
        persistLocal();
        setSaveStatus('error');
        clearTimeout(flushTimer);
        flushTimer = setTimeout(flush, RETRY_DELAY);
    }
}
window.addEventListener('online', () => flush());
window.addEventListener('pagehide', () => flush());

// ---------- Démarrage, connexion ----------
export function initClient() {
    if (!client && window.supabase) {
        client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            // Session gardée sur l'appareil et renouvelée automatiquement : on ne se connecte qu'une fois par appareil
            auth: { persistSession: true, autoRefreshToken: true },
        });
    }
    return client;
}

export async function currentSession() {
    if (!initClient()) return null;
    const { data } = await client.auth.getSession();
    return data.session;
}

// Jeton de la session (renouvelé au besoin) pour les fonctions serveur de l'outil (api/)
export async function accessToken() {
    if (mode !== 'cloud') return null;
    const session = await currentSession();
    return session ? session.access_token : null;
}
export const getClient = () => (mode === 'cloud' ? client : null);

// Connexion par nom d'utilisateur (« maryse ») ou par email.
// Le nom est traduit en email par la fonction pilotage_login_email (acces-maryse.sql).
export async function signIn(login, password) {
    initClient();
    let email = login.trim();
    if (!email.includes('@')) {
        const { data, error } = await client.rpc('pilotage_login_email', { p_username: email });
        if (error) throw error;
        if (!data) throw new Error('unknown user');
        email = data;
    }
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    keepStorage();
    return data.session;
}

// Demande au navigateur de ne pas effacer la session et le cache : la connexion reste mémorisée sur l'appareil
export function keepStorage() {
    try { navigator.storage?.persist?.(); } catch { /* navigateur sans cette option */ }
}

export async function signOut() {
    await flush();
    if (mode === 'cloud' && client) await client.auth.signOut();
    try {
        localStorage.removeItem(LS_CACHE);
        localStorage.removeItem(LS_PENDING);
        localStorage.removeItem('pilotage-mode');
        localStorage.removeItem('pilotage-icloud-v1');
    } catch { /* rien */ }
    items.clear();
    mode = null;
}

export async function startCloud(session) {
    mode = 'cloud';
    user = session.user;
    try { localStorage.setItem('pilotage-mode', 'cloud'); } catch { /* rien */ }
    // Affichage immédiat depuis le cache local, puis mise à jour depuis le serveur
    try {
        const cached = JSON.parse(localStorage.getItem(LS_CACHE) || '[]');
        cached.forEach((it) => items.set(it.id, it));
        JSON.parse(localStorage.getItem(LS_PENDING) || '[]').forEach((id) => pending.add(id));
    } catch { /* cache illisible : on repart du serveur */ }
    await reload();
    if (!items.size) seed(); else upgradeSeed();
    if (pending.size) flush();
}

export function startDemo() {
    mode = 'demo';
    try { localStorage.setItem('pilotage-mode', 'demo'); } catch { /* rien */ }
    try {
        const saved = JSON.parse(localStorage.getItem(LS_DEMO) || '[]');
        saved.forEach((it) => items.set(it.id, it));
    } catch { /* rien */ }
    if (!items.size) seed(); else upgradeSeed();
}

// Une base créée avant les nouvelles pages reçoit leur contenu de départ, une seule fois
function upgradeSeed() {
    const profile = items.get('profile');
    if (!profile || (profile.seedVersion || 1) >= SEED_VERSION) return;
    missingSeed(new Set(items.keys())).forEach((it) => { items.set(it.id, it); pending.add(it.id); });
    profile.seedVersion = SEED_VERSION;
    pending.add('profile');
    persistLocal();
    flush();
}

function seed() {
    seedItems().forEach((it) => { items.set(it.id, it); pending.add(it.id); });
    persistLocal();
    flush();
}

// Recharge tout depuis le serveur (au retour sur l'app, pour récupérer ce qui a été fait sur l'autre appareil)
export async function reload() {
    if (mode !== 'cloud') return false;
    const rows = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await client.from(TABLE).select('id, kind, data').order('id').range(from, from + PAGE - 1);
        if (error) { console.error(error); setSaveStatus('error'); return false; }
        rows.push(...data);
        if (data.length < PAGE) break;
    }
    const fresh = new Map(rows.map((r) => [r.id, { ...r.data, id: r.id, kind: r.kind }]));
    // Les modifications locales pas encore envoyées restent prioritaires
    for (const id of pending) {
        if (items.has(id)) fresh.set(id, items.get(id));
        else fresh.delete(id);
    }
    items.clear();
    fresh.forEach((v, k) => items.set(k, v));
    persistLocal();
    emit('sync');
    return true;
}

// ---------- Fichiers (images, documents) ----------
// Une référence de fichier est une chaîne : "sb:<chemin>" (en ligne) ou "idb:<clé>" (mode démo)
const urlCache = new Map();

export async function uploadFile(file) {
    const prepared = file.type.startsWith('image/') && !/gif|svg/.test(file.type) ? await shrinkImage(file) : file;
    const safe = (file.name || 'fichier').normalize('NFD').replace(/[^\w.-]+/g, '-').slice(-60);
    if (mode === 'demo') {
        const key = `${uid()}-${safe}`;
        await idbPut(key, prepared);
        return `idb:${key}`;
    }
    const path = `${user.id}/${uid()}-${safe}`;
    const { error } = await client.storage.from(BUCKET).upload(path, prepared, { contentType: prepared.type || file.type, upsert: false });
    if (error) throw error;
    return `sb:${path}`;
}

export function cachedUrl(ref) {
    const hit = urlCache.get(ref);
    return hit && hit.expires > Date.now() ? hit.url : null;
}

export async function fileUrl(ref) {
    if (!ref) return null;
    const hit = cachedUrl(ref);
    if (hit) return hit;
    let url = null;
    let expires = Date.now() + 50 * 60 * 1000;
    if (ref.startsWith('idb:')) {
        const blob = await idbGet(ref.slice(4));
        if (blob) { url = URL.createObjectURL(blob); expires = Infinity; }
    } else if (ref.startsWith('sb:')) {
        const { data, error } = await client.storage.from(BUCKET).createSignedUrl(ref.slice(3), 3600);
        if (!error) url = data.signedUrl;
    } else if (/^https?:|^data:/.test(ref)) {
        url = ref; expires = Infinity;
    }
    if (url) urlCache.set(ref, { url, expires });
    return url;
}

export async function deleteFile(ref) {
    if (!ref) return;
    try {
        if (ref.startsWith('idb:')) await idbDelete(ref.slice(4));
        else if (ref.startsWith('sb:')) await client.storage.from(BUCKET).remove([ref.slice(3)]);
    } catch (err) { console.warn('Fichier non supprimé', err); }
}

// Réduit les photos du téléphone (souvent 4 000 px) à 2 000 px maximum avant envoi
async function shrinkImage(file, max = 2000) {
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
        if (scale === 1 && file.size < 1.5e6) return file;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.86));
        if (!blob) return file;
        return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch {
        return file;
    }
}

// Petit coffre IndexedDB pour les fichiers du mode démo
function idb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('pilotage-files', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('files');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function idbRun(modeTx, fn) {
    const db = await idb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('files', modeTx);
        const req = fn(tx.objectStore('files'));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
    });
}
const idbPut = (key, blob) => idbRun('readwrite', (s) => s.put(blob, key));
const idbGet = (key) => idbRun('readonly', (s) => s.get(key));
const idbDelete = (key) => idbRun('readwrite', (s) => s.delete(key));
