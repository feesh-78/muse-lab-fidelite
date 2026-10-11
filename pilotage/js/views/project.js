// 02b · Fiche projet : concept, to-do, moodboard, idées, notes, documents
import { h, img, eyebrow, progressBar, confirmDialog, closeBtn, dropzone, pickFiles, makeDroppable, sortable, grip, toast, promptDialog } from '../ui.js';
import { get, update, remove, uploadFile, deleteFile, fileUrl, uid, all } from '../store.js';
import { BRANDS, POSTIT_COLORS, projectTasks, progress, nextDeadline, statusLabel } from '../data.js';
import { shortDate, dayMonth, today } from '../dates.js';
import { moodboard, palette, taskList, taskAdder } from '../components.js';

const block = (n, title, id, body, cls = '') => h('section', { class: `card ${cls}`, 'aria-labelledby': id },
    h('div', { class: 'section-head' }, h('h2', { id }, title), eyebrow(n, cls.includes('cherry') ? 'gold' : '')), body);

// Pour la saisie libre : enregistre sans redessiner
const quiet = (id, field) => (e) => update(id, { [field]: e.target.value }, { quiet: true });

function header(p) {
    const pr = progress(p.id);
    const next = nextDeadline(p.id);
    const changeCover = async (files) => {
        const file = files?.[0];
        if (!file) return;
        try {
            const old = p.cover;
            update(p.id, { cover: await uploadFile(file) });
            deleteFile(old);
        } catch { toast('envoi impossible, vérifie ta connexion'); }
    };
    const coverEl = h('button', { type: 'button', class: `fiche-cover${p.cover ? '' : ' empty'}`, 'aria-label': 'changer l\'image de couverture', onclick: async () => changeCover(await pickFiles()) },
        p.cover ? img(p.cover, { alt: `couverture du projet ${p.name}` }) : null,
        h('span', { class: 'photo-change' }, p.cover ? 'changer' : '+ image de couverture'));
    makeDroppable(coverEl, changeCover, 'image/*');

    // Nom éditable directement dans le titre
    const name = h('span', {
        class: 'title-edit', contenteditable: 'plaintext-only', spellcheck: 'false', role: 'textbox', 'aria-label': 'nom du projet',
        oninput: (e) => update(p.id, { name: e.target.textContent.trim().replace(/\.$/, '') }, { quiet: true }),
        onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } },
    }, p.name);
    if (name.contentEditable !== 'plaintext-only') name.contentEditable = 'true';
    const type = h('input', { class: 'inline-input eyebrow', value: p.type || '', placeholder: 'type de projet', 'aria-label': 'type de projet', size: Math.max(10, (p.type || '').length + 1), oninput: quiet(p.id, 'type') });
    const statusSel = h('select', { class: 'inline-select eyebrow', 'aria-label': 'statut', onchange: (e) => update(p.id, { status: e.target.value }) },
        ['cours', 'idee', 'termine'].map((s) => h('option', { value: s }, statusLabel(s))));
    statusSel.value = p.status === 'archive' ? 'cours' : p.status;
    const brandSel = h('select', { class: 'inline-select eyebrow', 'aria-label': 'marque', onchange: (e) => update(p.id, { brand: e.target.value }) },
        BRANDS.map((b) => h('option', { value: b.id }, b.label)));
    brandSel.value = p.brand;

    const keyLabel = h('input', { class: 'inline-input', value: p.keyLabel || '', placeholder: 'soirée, lancement…', size: Math.max(14, (p.keyLabel || '').length + 1), 'aria-label': 'nom de la date clé', oninput: quiet(p.id, 'keyLabel') });
    const keyDate = h('input', { class: 'inline-input', type: 'date', value: p.keyDate || '', 'aria-label': 'date clé', onchange: (e) => update(p.id, { keyDate: e.target.value || null }) });

    return h('header', { class: 'card fiche-head' },
        coverEl,
        h('div', { class: 'fiche-info' },
            h('div', { class: 'stack-sm' },
                h('div', { class: 'eyebrow-line' }, h('span', { class: 'eyebrow' }, 'fiche projet ·'), type, h('span', { class: 'eyebrow' }, '·'), statusSel, h('span', { class: 'eyebrow' }, '·'), brandSel),
                h('h1', { class: 'display fiche-title' }, name, '.'),
                p.status === 'archive' ? h('span', { class: 'tag archived' }, 'archivé') : null),
            h('div', { class: 'fiche-stats' },
                h('div', { class: 'fiche-progress' },
                    h('span', { class: 'pc-foot' }, h('span', null, 'avancement'), h('span', null, `${pr.done} tâche${pr.done > 1 ? 's' : ''} sur ${pr.total}`)),
                    progressBar(pr.pct, true)),
                h('div', { class: 'stack-xs' }, eyebrow('prochaine deadline'), h('span', { class: 'stat' }, next ? shortDate(next) : '—')),
                h('div', { class: 'stack-xs keydate' }, eyebrow('date clé'), h('span', { class: 'keydate-fields' }, keyLabel, keyDate)))));
}

function concept(p) {
    const text = h('textarea', { class: 'concept-text', rows: 4, placeholder: 'écris ici ton concept en quelques phrases : pour qui, ce qu\'elles vivent, ce qu\'elles emportent.', 'aria-label': 'le concept', oninput: quiet(p.id, 'concept') });
    text.value = p.concept || '';
    const kw = h('input', { class: 'kw-input', placeholder: '+ mot-clé', 'aria-label': 'ajouter un mot-clé' });
    const addKw = () => {
        const v = kw.value.trim();
        if (!v) return;
        kw.value = '';
        update(p.id, { keywords: [...(p.keywords || []), v] });
        requestAnimationFrame(() => document.querySelector('.kw-input')?.focus());
    };
    kw.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addKw(); } });
    kw.addEventListener('blur', addKw);
    return block('01', 'le concept.', 'f-concept', [
        text,
        h('div', { class: 'keywords' },
            (p.keywords || []).map((k, i) => h('span', { class: 'kw' }, k, closeBtn(`retirer le mot-clé ${k}`, async () => {
                if (await confirmDialog(`Le mot-clé « ${k} » sera retiré.`, 'retirer')) update(p.id, { keywords: p.keywords.filter((_, j) => j !== i) });
            }))),
            kw),
    ], 'cherry');
}

function todo(p) {
    const tasks = projectTasks(p.id);
    return block('02', 'la to-do.', 'f-todo', [
        h('p', { class: 'small muted' }, 'Chaque tâche a sa deadline. Elle apparaît toute seule dans le calendrier.'),
        tasks.length ? taskList(tasks, { showBrand: false, showNumber: false }) : h('p', { class: 'empty' }, 'pas encore de tâche.'),
        taskAdder({ id: 'f-task', fields: () => ({ projectId: p.id }) }),
    ]);
}

function ideas(p) {
    const list = p.ideas || [];
    const grid = h('div', { class: 'postits' }, list.map((idea, i) => {
        const c = POSTIT_COLORS[i % POSTIT_COLORS.length];
        const text = h('textarea', {
            class: 'postit-text', rows: 3, 'aria-label': 'idée',
            oninput: (e) => update(p.id, { ideas: get(p.id).ideas.map((x) => (x.id === idea.id ? { ...x, text: e.target.value } : x)) }, { quiet: true }),
        });
        text.value = idea.text;
        return h('div', { class: 'postit', style: { background: c.bg, color: c.fg }, 'data-sort-id': idea.id },
            text, grip('déplacer l\'idée'),
            closeBtn('supprimer l\'idée', async () => {
                if (await confirmDialog('Cette idée sera supprimée.')) update(p.id, { ideas: get(p.id).ideas.filter((x) => x.id !== idea.id) });
            }));
    }));
    sortable(grid, (order) => update(p.id, { ideas: order.map((id) => get(p.id).ideas.find((x) => x.id === id)) }));
    const input = h('input', { id: 'f-idea', class: 'field pill', placeholder: 'noter une idée…', 'aria-label': 'nouvelle idée', autocomplete: 'off' });
    const form = h('form', {
        class: 'adder',
        onsubmit: (e) => {
            e.preventDefault();
            if (!input.value.trim()) return;
            update(p.id, { ideas: [...list, { id: uid(), text: input.value.trim() }] });
            requestAnimationFrame(() => document.getElementById('f-idea')?.focus());
        },
    }, input, h('button', { type: 'submit', class: 'btn' }, 'noter'));
    return block('04', 'les idées.', 'f-idees', [list.length ? grid : null, form]);
}

function notes(p) {
    const area = h('textarea', { class: 'field notes', rows: 9, placeholder: 'écris librement : un compte rendu d\'appel, un texte, des prix, ce que tu ne veux pas oublier…', 'aria-label': 'mes notes sur le projet', oninput: quiet(p.id, 'notes') });
    area.value = p.notes || '';
    return block('05', 'mes notes.', 'f-notes', [area, h('div', { class: 'small muted' }, 'enregistré automatiquement')]);
}

const DOC_BADGES = { pdf: ['PDF', '#7A1014', '#FFFFFF'], doc: ['DOC', '#5A3418', '#FFFFFF'], img: ['IMG', '#D9A078', '#2A160C'], link: ['LIEN', '#2A160C', '#FBF4EA'], file: ['FICHIER', '#D9B45A', '#2A160C'] };
function docKind(file) {
    if (/pdf/.test(file.type) || /\.pdf$/i.test(file.name)) return 'pdf';
    if (/word|document|rtf|text/.test(file.type) || /\.(docx?|pages|odt|txt|rtf)$/i.test(file.name)) return 'doc';
    if (file.type.startsWith('image/')) return 'img';
    return 'file';
}

function documents(p) {
    const docs = p.docs || [];
    const open = async (d) => {
        if (d.kind === 'link') { window.open(d.url, '_blank', 'noopener'); return; }
        const win = window.open('', '_blank');
        const url = await fileUrl(d.ref);
        if (url && win) win.location = url; else if (url) location.href = url;
    };
    const rows = h('div', { class: 'rows' }, docs.map((d) => {
        const [label, bg, fg] = DOC_BADGES[d.kind] || DOC_BADGES.file;
        return h('div', { class: 'doc-row' },
            h('button', { type: 'button', class: 'doc-open', onclick: () => open(d) },
                h('span', { class: 'doc-badge', style: { background: bg, color: fg } }, label),
                h('span', { class: 'doc-name' }, d.name),
                h('span', { class: 'small muted' }, dayMonth(d.date))),
            closeBtn('supprimer le document', async () => {
                if (!(await confirmDialog(`Le document « ${d.name} » sera supprimé.`))) return;
                update(p.id, { docs: get(p.id).docs.filter((x) => x.id !== d.id) });
                if (d.ref) deleteFile(d.ref);
            }));
    }));
    const zone = dropzone({
        label: 'dépose tes documents ici, ou clique pour en choisir',
        accept: '.pdf,.doc,.docx,.pages,.odt,.txt,.rtf,.key,.ppt,.pptx,.xls,.xlsx,.numbers,image/*',
        onFiles: (refs) => update(p.id, { docs: [...(get(p.id).docs || []), ...refs.map(({ ref, file }) => ({ id: uid(), kind: docKind(file), name: file.name, ref, date: today() }))] }),
    });
    const addLink = async () => {
        const url = await promptDialog('coller un lien.', { placeholder: 'https://…', type: 'url', okLabel: 'ajouter' });
        if (!url) return;
        const full = /^https?:\/\//.test(url) ? url : `https://${url}`;
        const name = await promptDialog('nom du document.', { placeholder: 'ex. brief shooting (google docs)', value: new URL(full).hostname.replace(/^www\./, ''), okLabel: 'ajouter' });
        update(p.id, { docs: [...(get(p.id).docs || []), { id: uid(), kind: 'link', name: name || full, url: full, date: today() }] });
    };
    return block('06', 'mes documents.', 'f-docs', [
        docs.length ? rows : null,
        h('div', { class: 'doc-actions' }, zone, h('button', { type: 'button', class: 'btn', onclick: addLink }, '+ coller un lien')),
    ]);
}

export function renderProject(id) {
    const p = get(id);
    if (!p || p.kind !== 'project') {
        return h('div', { class: 'page' }, h('a', { href: '#/projets', class: 'link back' }, '← tous mes projets'), h('h1', { class: 'title' }, 'projet introuvable.'));
    }
    const archive = async () => {
        if (p.status === 'archive') { update(p.id, { status: 'cours' }); return; }
        if (await confirmDialog(`« ${p.name} » quittera tes projets en cours. Tu le retrouveras dans « archivés ».`, 'archiver')) update(p.id, { status: 'archive' });
    };
    const destroy = async () => {
        const tasks = projectTasks(p.id);
        if (!(await confirmDialog(`Le projet « ${p.name} », ses ${tasks.length} tâches, son moodboard et ses documents seront supprimés définitivement.`, 'supprimer le projet'))) return;
        tasks.forEach((t) => remove(t.id));
        [...(p.moodboard || []).map((m) => m.ref), ...(p.docs || []).map((d) => d.ref), p.cover].forEach((ref) => ref && deleteFile(ref));
        // les envies de la bucket list reliées perdent simplement leur lien
        all('wish', (w) => w.projectId === p.id).forEach((w) => update(w.id, { projectId: null }, { quiet: true }));
        remove(p.id);
        location.hash = '#/projets';
    };
    return h('div', { class: 'page fiche' },
        h('div', { class: 'fiche-top' },
            h('a', { href: '#/projets', class: 'link back' }, '← tous mes projets'),
            h('div', { class: 'row-actions' },
                h('button', { type: 'button', class: 'btn ghost small', onclick: archive }, p.status === 'archive' ? 'désarchiver' : 'archiver'),
                h('button', { type: 'button', class: 'btn ghost small danger-text', onclick: destroy }, 'supprimer'))),
        header(p),
        h('div', { class: 'split' },
            h('div', { class: 'col-1 stack' }, concept(p), todo(p), notes(p)),
            h('div', { class: 'col-1 stack' },
                block('03', 'le moodboard.', 'f-mood', [
                    moodboard(p.id),
                    h('div', { class: 'palette-line' }, eyebrow('palette'), palette(p.id, { compact: true })),
                ]),
                ideas(p),
                documents(p))));
}
