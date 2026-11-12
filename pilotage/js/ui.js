// Briques d'interface réutilisées par toutes les pages
import { fileUrl, cachedUrl, uploadFile } from './store.js';
import { shortDate, today } from './dates.js';

// h('div', { class: 'card', onclick: fn }, enfant1, enfant2…)
export function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
        for (const [k, v] of Object.entries(props)) {
            if (v === null || v === undefined || v === false) continue;
            if (k === 'class') el.className = v;
            else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
            else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
            else if (k === 'value') el.value = v;
            else if (k === 'checked') el.checked = !!v;
            else if (k === 'html') el.innerHTML = v;
            else el.setAttribute(k, v === true ? '' : v);
        }
    }
    append(el, children);
    return el;
}
function append(el, children) {
    for (const c of children) {
        if (c === null || c === undefined || c === false) continue;
        if (Array.isArray(c)) append(el, c);
        else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
}

export const eyebrow = (text, cls = '') => h('div', { class: `eyebrow ${cls}` }, text);

export function sectionHead(title, right, { tag = 'h2', id } = {}) {
    return h('div', { class: 'section-head' }, h(tag, { id }, title), right || null);
}

export function tag(b) {
    return h('span', { class: 'tag', style: { background: b.bg, color: b.fg } }, b.label);
}

export function progressBar(pct, thick = false) {
    return h('span', { class: `bar${thick ? ' thick' : ''}`, role: 'img', 'aria-label': `avancement ${pct} %` },
        h('span', { style: { width: `${pct}%` } }));
}

// Image stockée en ligne : affichée dès que son adresse est connue
export function img(ref, props = {}) {
    const el = h('img', { alt: '', loading: 'lazy', decoding: 'async', ...props });
    const hit = cachedUrl(ref);
    if (hit) el.src = hit;
    else fileUrl(ref).then((url) => { if (url) el.src = url; });
    return el;
}

// Pastille de date cliquable : un sélecteur de date natif invisible est posé dessus (fonctionne aussi sur iPhone)
export function datePill(value, onChange, { label = 'deadline', cls = '' } = {}) {
    const t = today();
    const late = value && value < t;
    const text = !value ? '[deadline]' : value === t ? 'aujourd\'hui' : late ? `en retard · ${shortDate(value)}` : shortDate(value);
    const input = h('input', {
        type: 'date', value: value || '', 'aria-label': label,
        onchange: (e) => { if (e.target.value) onChange(e.target.value); },
    });
    return h('span', { class: `date-pill${late ? ' late' : ''} ${cls}` }, text, input);
}

// ---------- Fenêtres (confirmation, formulaires) ----------
export function modal(build, { label = 'fenêtre' } = {}) {
    return new Promise((resolve) => {
        const close = (value) => {
            overlay.remove();
            document.removeEventListener('keydown', onKey);
            resolve(value);
        };
        const onKey = (e) => { if (e.key === 'Escape') close(null); };
        const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': label });
        const overlay = h('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) close(null); } }, box);
        build(box, close);
        document.body.append(overlay);
        document.addEventListener('keydown', onKey);
        const first = box.querySelector('input, textarea, select, button.primary');
        if (first) first.focus();
    });
}

// Rien n'est supprimé sans confirmation
export function confirmDialog(message, okLabel = 'supprimer') {
    return modal((box, close) => {
        box.append(
            h('h2', null, 'tu confirmes ?'),
            h('p', { class: 'muted' }, message),
            h('div', { class: 'modal-actions' },
                h('button', { type: 'button', class: 'btn ghost', onclick: () => close(false) }, 'annuler'),
                h('button', { type: 'button', class: 'btn danger primary', onclick: () => close(true) }, okLabel)),
        );
    }, { label: 'confirmation' }).then(Boolean);
}

export function promptDialog(title, { placeholder = '', value = '', okLabel = 'valider', type = 'text' } = {}) {
    return modal((box, close) => {
        const input = h('input', { class: 'field', type, placeholder, value });
        const form = h('form', { onsubmit: (e) => { e.preventDefault(); close(input.value.trim() || null); } },
            h('h2', null, title), input,
            h('div', { class: 'modal-actions' },
                h('button', { type: 'button', class: 'btn ghost', onclick: () => close(null) }, 'annuler'),
                h('button', { type: 'submit', class: 'btn primary' }, okLabel)));
        box.append(form);
    }, { label: title });
}

// ---------- Dépôt de fichiers : glisser-déposer ou choix dans la galerie ----------
export function dropzone({ label, accept = 'image/*', multiple = true, onFiles, cls = '' }) {
    const input = h('input', { type: 'file', accept, multiple, hidden: true, onchange: () => { if (input.files.length) handle([...input.files]); input.value = ''; } });
    const zone = h('button', { type: 'button', class: `dropzone ${cls}`, onclick: () => input.click() }, h('span', { class: 'dz-label' }, label), input);
    async function handle(files) {
        zone.classList.add('busy');
        const lbl = zone.querySelector('.dz-label');
        const before = lbl.textContent;
        lbl.textContent = files.length > 1 ? `envoi de ${files.length} fichiers…` : 'envoi en cours…';
        try {
            const refs = [];
            for (const f of files) refs.push({ ref: await uploadFile(f), file: f });
            onFiles(refs);
        } catch (err) {
            console.error(err);
            toast('envoi impossible, vérifie ta connexion');
        } finally {
            zone.classList.remove('busy');
            lbl.textContent = before;
        }
    }
    makeDroppable(zone, handle, accept);
    zone.handleFiles = handle;
    return zone;
}

// Rend n'importe quel élément capable de recevoir des fichiers glissés
export function makeDroppable(el, handle, accept = '') {
    el.addEventListener('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); el.classList.add('drag-over'); } });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        el.classList.remove('drag-over');
        let files = [...e.dataTransfer.files];
        if (accept === 'image/*') files = files.filter((f) => f.type.startsWith('image/'));
        if (files.length) handle(files);
    });
}
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');

export function pickFiles(accept = 'image/*', multiple = false) {
    return new Promise((resolve) => {
        const input = h('input', { type: 'file', accept, multiple, hidden: true });
        input.onchange = () => { resolve([...input.files]); input.remove(); };
        document.body.append(input);
        input.click();
    });
}

// ---------- Réordonner au doigt ou à la souris (poignée .grip) ----------
// container : la liste ; chaque élément porte data-sort-id ; onDone reçoit les ids dans le nouvel ordre
export function sortable(container, onDone) {
    container.addEventListener('pointerdown', (e) => {
        const grip = e.target.closest('.grip');
        if (!grip || !container.contains(grip)) return;
        const item = grip.closest('[data-sort-id]');
        if (!item || item.parentElement !== container) return;
        e.preventDefault();
        grip.setPointerCapture(e.pointerId);
        item.classList.add('dragging');
        const startOrder = ids();
        const move = (ev) => {
            const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-sort-id]');
            if (!target || target === item || target.parentElement !== container) return;
            const r = target.getBoundingClientRect();
            const sameRow = ev.clientY > r.top && ev.clientY < r.bottom;
            const after = sameRow && r.width < container.clientWidth * 0.9
                ? ev.clientX > r.left + r.width / 2
                : ev.clientY > r.top + r.height / 2;
            container.insertBefore(item, after ? target.nextSibling : target);
        };
        const up = () => {
            grip.removeEventListener('pointermove', move);
            grip.removeEventListener('pointerup', up);
            grip.removeEventListener('pointercancel', up);
            item.classList.remove('dragging');
            const order = ids();
            if (order.join() !== startOrder.join()) onDone(order);
        };
        grip.addEventListener('pointermove', move);
        grip.addEventListener('pointerup', up);
        grip.addEventListener('pointercancel', up);
    });
    const ids = () => [...container.children].map((c) => c.dataset.sortId).filter(Boolean);
    return container;
}

export const grip = (label = 'déplacer') => h('button', { type: 'button', class: 'grip', 'aria-label': label, title: label },
    h('span', { 'aria-hidden': 'true', html: '<svg width="10" height="16" viewBox="0 0 10 16"><g fill="currentColor"><circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/></g></svg>' }));

export const closeBtn = (label, onclick) => h('button', { type: 'button', class: 'x-btn', 'aria-label': label, title: label, onclick },
    h('span', { 'aria-hidden': 'true', html: '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' }));

// Petit message temporaire en bas de l'écran
export function toast(text) {
    const el = h('div', { class: 'toast', role: 'status' }, text);
    document.body.append(el);
    setTimeout(() => el.remove(), 3200);
}

// Champ texte qui enregistre à chaque frappe, sans redessiner la page
export function autoInput(props, onSave) {
    return h(props.tag || 'input', { ...props, tag: null, oninput: (e) => onSave(e.target.value) });
}
