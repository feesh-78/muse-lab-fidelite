// 09 · Ce qui tourne dans ma tête : déposer une pensée en un geste, la qualifier ensuite seulement si j'en ai envie.
// Une pensée peut devenir une tâche ou un projet, toujours après validation.
import { h, eyebrow, modal, confirmDialog, toast } from '../ui.js';
import { all, get, create, update, remove, uploadFile, fileUrl, deleteFile } from '../store.js';
import { projects } from '../data.js';
import { today, longDate } from '../dates.js';
import { state } from '../state.js';

const TYPES = [
    { id: 'idee', label: 'idée' },
    { id: 'inquietude', label: 'inquiétude' },
    { id: 'emotion', label: 'émotion' },
    { id: 'decision', label: 'décision' },
];
const NEEDS = [
    { id: 'action', label: 'une action à faire' },
    { id: 'attendre', label: 'peut attendre' },
    { id: 'exprimer', label: 'j\'avais juste besoin de l\'exprimer' },
];
const STATES = [
    { id: 'tete', label: 'en tête' },
    { id: 'apaisee', label: 'apaisées' },
    { id: 'archivee', label: 'archivées' },
    { id: 'tout', label: 'tout' },
];
const labelOf = (list, id) => (list.find((x) => x.id === id) || {}).label;
const hour = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`; };
const stateOf = (p) => (p.archived ? 'archivee' : p.calm ? 'apaisee' : 'tete');
// Une pensée peut n'être qu'un audio : on lui donne alors un intitulé pour les tâches et projets
const textOf = (p) => p.text || `pensée audio du ${longDate(p.date)}`;
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
async function removeThought(p) {
    if (p.audio) await deleteFile(p.audio);
    remove(p.id);
}

function selectOf(list, value, label, none) {
    const sel = h('select', { class: 'field', 'aria-label': label }, h('option', { value: '' }, none), list.map((x) => h('option', { value: x.id }, x.label)));
    sel.value = value || '';
    return sel;
}

// ---------- Relier à une tâche ou à un projet (après validation) ----------
function toTaskDialog(p) {
    return modal((box, close) => {
        const title = h('input', { class: 'field', value: (p.nextAction || textOf(p)).slice(0, 140), 'aria-label': 'intitulé de la tâche' });
        const due = h('input', { class: 'field date', type: 'date', value: today(), 'aria-label': 'deadline' });
        const project = h('select', { class: 'field', 'aria-label': 'projet' }, h('option', { value: '' }, 'aucun · perso'),
            projects((x) => x.status !== 'archive').map((x) => h('option', { value: x.id }, x.name)));
        box.append(h('form', {
            class: 'stack',
            onsubmit: (ev) => {
                ev.preventDefault();
                if (!title.value.trim()) { title.focus(); return; }
                if (!due.value) { due.focus(); return; }
                const t = create('task', { title: title.value.trim(), due: due.value, done: false, order: Date.now() / 1e10, ...(project.value ? { projectId: project.value } : { brand: 'perso' }) });
                update(p.id, { taskId: t.id, need: 'action' });
                toast('la tâche est créée.');
                close(true);
            },
        },
        h('h2', null, 'en faire une tâche\u00a0?'),
        h('p', { class: 'small muted' }, 'Elle apparaîtra dans ta to-do et ton calendrier à la date choisie. Rien n\'est créé sans ton clic sur « créer la tâche ».'),
        h('label', { class: 'field-label' }, 'la tâche', title),
        h('div', { class: 'two' }, h('label', { class: 'field-label' }, 'deadline', due), h('label', { class: 'field-label' }, 'projet', project)),
        h('div', { class: 'modal-actions' },
            h('button', { type: 'button', class: 'btn ghost', onclick: () => close(null) }, 'annuler'),
            h('button', { type: 'submit', class: 'btn primary' }, 'créer la tâche'))));
    }, { label: 'en faire une tâche' });
}

function toProjectDialog(p) {
    return modal((box, close) => {
        const name = h('input', { class: 'field', value: (p.nextAction || textOf(p)).split('\n')[0].slice(0, 80), 'aria-label': 'nom du projet' });
        box.append(h('form', {
            class: 'stack',
            onsubmit: (ev) => {
                ev.preventDefault();
                if (!name.value.trim()) { name.focus(); return; }
                const pr = create('project', {
                    name: name.value.trim().replace(/\.$/, ''), type: '', brand: 'perso', status: 'idee',
                    order: Date.now() / 1e10, concept: textOf(p), keywords: [], moodboard: [], palette: [], ideas: [], notes: '', docs: [], cover: null,
                });
                update(p.id, { projectId: pr.id });
                toast('le projet est créé, dans tes idées.');
                close(true);
            },
        },
        h('h2', null, 'en faire un projet\u00a0?'),
        h('p', { class: 'small muted' }, 'Il sera rangé dans tes idées de projets (marque perso), avec ta pensée comme concept. Rien n\'est créé sans ton clic sur « créer le projet ».'),
        h('label', { class: 'field-label' }, 'nom du projet', name),
        h('div', { class: 'modal-actions' },
            h('button', { type: 'button', class: 'btn ghost', onclick: () => close(null) }, 'annuler'),
            h('button', { type: 'submit', class: 'btn primary' }, 'créer le projet'))));
    }, { label: 'en faire un projet' });
}

// ---------- Modifier une pensée ----------
function thoughtDialog(p) {
    return modal((box, close) => {
        const text = h('textarea', { class: 'field', rows: 5, 'aria-label': 'ma pensée' });
        text.value = p.text;
        const type = selectOf(TYPES, p.type, 'ce que c\'est', 'pas précisé');
        const need = selectOf(NEEDS, p.need, 'ce dont j\'ai besoin', 'pas précisé');
        const next = h('input', { class: 'field', value: p.nextAction || '', placeholder: 'facultatif : un tout petit pas', 'aria-label': 'prochaine petite action' });
        box.append(h('form', {
            class: 'stack',
            onsubmit: (ev) => {
                ev.preventDefault();
                if (!text.value.trim() && !p.audio) { text.focus(); return; }
                update(p.id, { text: text.value.trim(), type: type.value || null, need: need.value || null, nextAction: next.value.trim() });
                close(true);
            },
        },
        h('h2', null, 'ma pensée.'),
        eyebrow(`${longDate(p.date)} · ${hour(p.createdAt)}`),
        p.audio ? audioPlayer(p.audio) : null,
        text,
        h('div', { class: 'two' }, h('label', { class: 'field-label' }, 'c\'est plutôt', type), h('label', { class: 'field-label' }, 'j\'ai besoin de', need)),
        h('label', { class: 'field-label' }, 'prochaine petite action', next),
        h('div', { class: 'modal-actions' },
            h('button', {
                type: 'button', class: 'btn ghost danger-text push-left',
                onclick: async () => { close(null); if (await confirmDialog(p.audio ? 'Cette pensée et son audio seront supprimés.' : 'Cette pensée sera supprimée.')) removeThought(p); },
            }, 'supprimer'),
            h('button', { type: 'button', class: 'btn ghost', onclick: () => close(null) }, 'annuler'),
            h('button', { type: 'submit', class: 'btn primary' }, 'enregistrer'))));
    }, { label: 'ma pensée' });
}

function linkLine(p) {
    const task = p.taskId && get(p.taskId);
    const project = p.projectId && get(p.projectId);
    const links = [];
    if (task) links.push(h('a', { class: 'link', href: task.projectId ? `#/projet/${task.projectId}` : '#/calendrier' }, `→ tâche : ${task.title}`));
    if (project) links.push(h('a', { class: 'link', href: `#/projet/${project.id}` }, `→ projet : ${project.name}`));
    return links.length ? h('div', { class: 'thought-links small' }, links) : null;
}

function thoughtCard(p) {
    const tags = [labelOf(TYPES, p.type), labelOf(NEEDS, p.need)].filter(Boolean);
    const st = stateOf(p);
    return h('article', { class: `card thought${st !== 'tete' ? ` ${st}` : ''}` },
        h('div', { class: 'section-head' },
            eyebrow(`${longDate(p.date)} · ${hour(p.createdAt)}${st === 'apaisee' ? ' · apaisée' : st === 'archivee' ? ' · archivée' : ''}`),
            h('button', { type: 'button', class: 'link plain small', onclick: () => thoughtDialog(p) }, 'modifier')),
        p.audio ? audioPlayer(p.audio, p.audioDuration) : null,
        p.text ? h('p', { class: 'thought-text' }, p.text) : null,
        tags.length ? h('div', { class: 'chips' }, tags.map((t) => h('span', { class: 'chip small static' }, t))) : null,
        p.nextAction ? h('p', { class: 'small' }, h('strong', null, 'prochaine petite action · '), p.nextAction) : null,
        linkLine(p),
        h('div', { class: 'thought-actions' },
            st === 'tete' ? h('button', { type: 'button', class: 'btn small', onclick: () => update(p.id, { calm: true }) }, 'c\'est apaisé') : null,
            st === 'apaisee' ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => update(p.id, { calm: false }) }, 'ça revient') : null,
            st !== 'archivee' ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => update(p.id, { archived: true }) }, 'archiver')
                : h('button', { type: 'button', class: 'btn ghost small', onclick: () => update(p.id, { archived: false }) }, 'désarchiver'),
            !p.taskId && st !== 'archivee' ? h('button', { type: 'button', class: 'link plain small', onclick: () => toTaskDialog(p) }, 'en faire une tâche') : null,
            !p.projectId && st !== 'archivee' ? h('button', { type: 'button', class: 'link plain small', onclick: () => toProjectDialog(p) }, 'en faire un projet') : null));
}

// ---------- Audio : enregistrer au micro, réécouter, puis déposer ----------
const MAX_SECONDS = 10 * 60;
let rec = null; // enregistrement en cours
let take = null; // audio enregistré, pas encore déposé

function audioPlayer(ref, duration) {
    const el = h('audio', { controls: true, preload: 'none', class: 'thought-audio', 'aria-label': `pensée audio${duration ? ` de ${mmss(duration)}` : ''}` });
    fileUrl(ref).then((url) => { if (url) el.src = url; });
    return el;
}

function pickType() {
    const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
    return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
}

async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast('ton navigateur ne permet pas d\'enregistrer ici.'); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch {
        toast('micro refusé : autorise-le dans les réglages du navigateur pour enregistrer.');
        return;
    }
    const type = pickType();
    const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(rec?.timer);
        const blob = new Blob(chunks, { type: recorder.mimeType || type || 'audio/webm' });
        const duration = (Date.now() - rec.start) / 1000;
        rec = null;
        if (blob.size) take = { blob, url: URL.createObjectURL(blob), duration };
        state.rerender();
    };
    rec = { recorder, start: Date.now() };
    rec.timer = setInterval(() => {
        const sec = (Date.now() - rec.start) / 1000;
        const el = document.getElementById('tete-rec-time');
        if (el) el.textContent = mmss(sec);
        if (sec >= MAX_SECONDS) stopRecording();
    }, 500);
    recorder.start();
    state.rerender();
}
function stopRecording() { if (rec && rec.recorder.state !== 'inactive') rec.recorder.stop(); }
function discardTake() { if (take) URL.revokeObjectURL(take.url); take = null; state.rerender(); }

function audioBox() {
    if (rec) {
        return h('div', { class: 'rec-box recording', role: 'status' },
            h('span', { class: 'rec-dot', 'aria-hidden': 'true' }), h('span', null, 'j\'enregistre · ', h('strong', { id: 'tete-rec-time' }, mmss((Date.now() - rec.start) / 1000))),
            h('button', { type: 'button', class: 'btn small', onclick: stopRecording }, 'arrêter'));
    }
    if (take) {
        return h('div', { class: 'rec-box' },
            h('audio', { controls: true, src: take.url, class: 'thought-audio', 'aria-label': 'réécouter mon audio' }),
            h('button', { type: 'button', class: 'link plain small', onclick: discardTake }, 'recommencer'));
    }
    return h('button', { type: 'button', class: 'btn ghost self-start', onclick: startRecording }, '🎙 enregistrer un audio');
}

function dropForm() {
    const area = h('textarea', {
        id: 'tete-text', class: 'field big-thought', rows: 5, placeholder: 'écris comme ça vient, ou enregistre un audio. personne d\'autre ne le lira.',
        'aria-label': 'ma pensée', oninput: (e) => { state.teteDraft = e.target.value; },
    });
    area.value = state.teteDraft || '';
    const submit = h('button', { type: 'submit', class: 'btn primary self-start', disabled: !!rec }, 'déposer ma pensée');
    return h('section', { class: 'card stack', 'aria-labelledby': 'tete-q' },
        h('h2', { id: 'tete-q' }, 'qu\'est-ce qui prend de la place dans ta tête aujourd\'hui\u00a0?'),
        h('form', {
            class: 'stack',
            onsubmit: async (ev) => {
                ev.preventDefault();
                const text = area.value.trim();
                if (rec) return;
                if (!text && !take) { area.focus(); return; }
                let audio = null;
                let audioDuration = null;
                if (take) {
                    submit.disabled = true;
                    submit.textContent = 'envoi de l\'audio…';
                    try {
                        const ext = take.blob.type.includes('mp4') ? 'm4a' : take.blob.type.includes('ogg') ? 'ogg' : 'webm';
                        audio = await uploadFile(new File([take.blob], `pensee-audio.${ext}`, { type: take.blob.type }));
                        audioDuration = Math.round(take.duration);
                    } catch (err) {
                        console.error(err);
                        toast('l\'audio n\'a pas pu être envoyé. vérifie ta connexion et réessaie.');
                        submit.disabled = false;
                        submit.textContent = 'déposer ma pensée';
                        return;
                    }
                    URL.revokeObjectURL(take.url);
                    take = null;
                }
                state.teteDraft = '';
                create('pensee', { text, audio, audioDuration, date: today(), type: null, need: null, nextAction: '', calm: false, archived: false });
                toast('c\'est déposé. tu pourras y revenir quand tu veux.');
            },
        }, area, audioBox(), submit));
}

export function renderTete() {
    const st = state.teteState || 'tete';
    const type = state.teteType || '';
    const need = state.teteNeed || '';
    const all_ = all('pensee');
    // La recherche redessine seulement la liste, pour ne pas perdre la frappe en cours
    const listBox = h('div', { class: 'stack' });
    const drawList = () => {
        const q = (state.teteQuery || '').trim().toLowerCase();
        const list = all_.filter((p) => (st === 'tout' || stateOf(p) === st) && (!type || p.type === type) && (!need || p.need === need)
            && (!q || `${p.text || ''} ${p.nextAction || ''}`.toLowerCase().includes(q)))
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const filtered = q || type || need || st !== 'tete';
        listBox.replaceChildren(list.length ? h('div', { class: 'thought-list' }, list.map(thoughtCard))
            : h('p', { class: 'empty' }, filtered ? 'aucune pensée ne correspond. essaie un autre filtre.' : 'rien ne tourne pour l\'instant. tant mieux.'));
    };
    drawList();
    const chip = (id, label) => h('button', {
        type: 'button', class: `chip${st === id ? ' on' : ''}`, 'aria-pressed': String(st === id),
        onclick: () => { state.teteState = id; state.rerender(); },
    }, label);
    const search = h('input', {
        id: 'tete-search', class: 'field pill', type: 'search', placeholder: 'rechercher dans mes pensées…', value: state.teteQuery || '', 'aria-label': 'rechercher',
        oninput: (e) => { state.teteQuery = e.target.value; drawList(); },
    });
    const typeSel = selectOf(TYPES, type, 'filtrer par type', 'tous les types');
    typeSel.classList.add('pill');
    typeSel.addEventListener('change', () => { state.teteType = typeSel.value; state.rerender(); });
    const needSel = selectOf(NEEDS, need, 'filtrer par besoin', 'tous les besoins');
    needSel.classList.add('pill');
    needSel.addEventListener('change', () => { state.teteNeed = needSel.value; state.rerender(); });
    return h('div', { class: 'page tete' },
        h('header', { class: 'stack-sm' }, eyebrow('pour alléger ma charge mentale'), h('h1', { class: 'title' }, 'ce qui tourne dans ma tête.')),
        dropForm(),
        all_.length ? h('section', { class: 'stack', 'aria-labelledby': 'tete-list' },
            h('div', { class: 'section-head wrap' }, h('h2', { id: 'tete-list' }, 'mes pensées.'),
                h('div', { class: 'chips', role: 'group', 'aria-label': 'filtrer par état' }, STATES.map((s) => chip(s.id, s.label)))),
            h('div', { class: 'tete-filters' }, search, typeSel, needSel),
            listBox)
            : h('p', { class: 'empty' }, 'ici, tu peux tout déposer : une idée, un souci, une émotion, une décision à prendre. rien n\'est obligatoire, tu reviens quand tu veux.'));
}
