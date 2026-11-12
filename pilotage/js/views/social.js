// 04 · Social media : mon compte instagram perso et velvet company, de l'idée au post
import { h, eyebrow, modal, confirmDialog, toast } from '../ui.js';
import { all, create, update, remove, singleton } from '../store.js';
import { FORMATS, STAGES, stageLabel, handle, projects, weekStart } from '../data.js';
import { today, addDays, dayNum, shortDate, fromKey } from '../dates.js';
import { state } from '../state.js';

const ACCOUNTS = ['perso', 'velvet'];
const MAX_TAGS = 5;

// Fenêtre d'une carte de contenu : titre, format, compte, date, légende, 5 hashtags, projet lié
export function postDialog(post, defaults = {}) {
    const p = post || { title: '', format: 'reel', account: 'perso', stage: 'idee', date: '', time: '', caption: '', hashtags: [], projectId: null, ...defaults };
    return modal((box, close) => {
        const title = h('input', { class: 'field', value: p.title, placeholder: 'titre du contenu', 'aria-label': 'titre' });
        const select = (options, value, label) => {
            const s = h('select', { class: 'field', 'aria-label': label }, options.map(([v, l]) => h('option', { value: v }, l)));
            s.value = value ?? '';
            return s;
        };
        const format = select(FORMATS.map((f) => [f, f]), p.format, 'format');
        const account = select(ACCOUNTS.map((a) => [a, handle(a)]), p.account, 'compte');
        const stage = select(STAGES.map((s) => [s.id, stageLabel(s.id)]), p.stage, 'étape');
        const date = h('input', { class: 'field', type: 'date', value: p.date || '', 'aria-label': 'date de publication' });
        const time = h('input', { class: 'field', type: 'time', value: p.time || '', 'aria-label': 'heure' });
        const caption = h('textarea', { class: 'field', rows: 4, placeholder: 'la légende du post…', 'aria-label': 'légende' });
        caption.value = p.caption || '';
        const tags = h('input', { class: 'field', value: (p.hashtags || []).map((t) => `#${t}`).join(' '), placeholder: '#dance #velvet … (5 maximum)', 'aria-label': 'hashtags' });
        const tagInfo = h('span', { class: 'small muted' }, '');
        const parseTags = () => [...new Set(tags.value.split(/[\s,]+/).map((t) => t.replace(/^#+/, '').trim()).filter(Boolean))];
        const checkTags = () => {
            const n = parseTags().length;
            tagInfo.textContent = `${Math.min(n, MAX_TAGS)} / ${MAX_TAGS} hashtags${n > MAX_TAGS ? ' · seuls les 5 premiers seront gardés' : ''}`;
        };
        tags.addEventListener('input', checkTags);
        checkTags();
        const project = select([['', 'aucun'], ...projects((x) => x.status !== 'archive').map((x) => [x.id, `${x.name}.`])], p.projectId || '', 'projet lié');
        box.append(h('form', {
            onsubmit: (e) => {
                e.preventDefault();
                if (!title.value.trim()) { title.focus(); return; }
                const fields = {
                    title: title.value.trim(), format: format.value, account: account.value, stage: stage.value,
                    date: date.value || null, time: time.value || null, caption: caption.value,
                    hashtags: parseTags().slice(0, MAX_TAGS), projectId: project.value || null,
                };
                if (post) update(post.id, fields); else create('post', fields);
                close(true);
            },
        },
        h('h2', null, post ? 'le contenu.' : 'nouveau contenu.'),
        h('label', { class: 'field-label' }, 'titre', title),
        h('div', { class: 'two' }, h('label', { class: 'field-label' }, 'format', format), h('label', { class: 'field-label' }, 'compte', account)),
        h('div', { class: 'two' }, h('label', { class: 'field-label' }, 'date', date), h('label', { class: 'field-label' }, 'heure', time)),
        h('div', { class: 'two' }, h('label', { class: 'field-label' }, 'étape', stage), h('label', { class: 'field-label' }, 'projet lié', project)),
        h('label', { class: 'field-label' }, 'légende', caption),
        h('label', { class: 'field-label' }, 'hashtags', tags), tagInfo,
        h('div', { class: 'modal-actions' },
            post ? h('button', {
                type: 'button', class: 'btn ghost danger-text push-left',
                onclick: async () => { close(null); if (await confirmDialog(`Le contenu « ${post.title} » sera supprimé.`)) remove(post.id); },
            }, 'supprimer') : null,
            h('button', { type: 'button', class: 'btn ghost', onclick: () => close(null) }, 'annuler'),
            h('button', { type: 'submit', class: 'btn primary' }, post ? 'enregistrer' : 'ajouter'))));
    }, { label: 'contenu' });
}

// Glisser une carte d'une colonne à l'autre (souris ou doigt, via la carte entière après un court déplacement)
function enableBoardDrag(board) {
    board.addEventListener('pointerdown', (e) => {
        const card = e.target.closest('.post-card');
        if (!card || e.button > 0) return;
        const startX = e.clientX;
        const startY = e.clientY;
        let ghost = null;
        let target = null;
        const isTouch = e.pointerType === 'touch';
        // Au doigt, il faut partir de la poignée pour ne pas gêner le défilement
        if (isTouch && !e.target.closest('.grip')) return;
        if (isTouch) e.preventDefault();
        const move = (ev) => {
            if (!ghost) {
                if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
                ghost = card.cloneNode(true);
                ghost.classList.add('post-ghost');
                ghost.style.width = `${card.offsetWidth}px`;
                document.body.append(ghost);
                card.classList.add('dragging');
            }
            ghost.style.transform = `translate(${ev.clientX - 20}px, ${ev.clientY - 20}px)`;
            ghost.style.display = 'none';
            const col = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.board-col');
            ghost.style.display = '';
            board.querySelectorAll('.board-col').forEach((c) => c.classList.toggle('drop-target', c === col));
            target = col;
        };
        const up = () => {
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            document.removeEventListener('pointercancel', up);
            if (!ghost) return;
            ghost.remove();
            card.classList.remove('dragging');
            board.querySelectorAll('.board-col').forEach((c) => c.classList.remove('drop-target'));
            card.dataset.dragged = '1';
            setTimeout(() => { delete card.dataset.dragged; }, 50);
            if (target && target.dataset.stage !== card.dataset.stage) {
                const stage = target.dataset.stage;
                update(card.dataset.id, { stage });
                if (stage === 'programme' && !all('post').find((p) => p.id === card.dataset.id)?.date) toast('pense à donner une date à ce contenu');
            }
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
        document.addEventListener('pointercancel', up);
    });
}

function postCard(p) {
    const when = p.date ? `${dayNum(p.date)}${p.time ? ` · ${p.time.replace(':', 'h')}` : ''}` : handle(p.account);
    return h('div', {
        class: `post-card stage-${p.stage}`, 'data-id': p.id, 'data-stage': p.stage, role: 'button', tabindex: '0',
        onclick: (e) => { if (!e.currentTarget.dataset.dragged && !e.target.closest('.grip')) postDialog(p); },
        onkeydown: (e) => { if (e.key === 'Enter') postDialog(p); },
    },
    h('span', { class: 'post-title' }, p.title),
    h('span', { class: 'post-meta' }, `${p.format} · ${when}`),
    h('span', { class: 'grip post-grip', 'aria-hidden': 'true', html: '<svg width="10" height="16" viewBox="0 0 10 16"><g fill="currentColor"><circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/></g></svg>' }));
}

function board(posts) {
    const el = h('div', { class: 'board' }, STAGES.map((s, i) => {
        const list = posts.filter((p) => p.stage === s.id).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
        return h('div', { class: `board-col col-${s.id}`, 'data-stage': s.id },
            h('div', { class: 'board-head' }, eyebrow(`${String(i + 1).padStart(2, '0')} · ${s.label}`), h('span', { class: 'board-count' }, String(list.length))),
            list.map(postCard),
            h('button', { type: 'button', class: 'board-add', onclick: () => postDialog(null, { stage: s.id, account: state.socialAccount && state.socialAccount !== 'tous' ? state.socialAccount : 'perso' }) }, s.id === 'idee' ? '+ idée' : '+'));
    }));
    enableBoardDrag(el);
    return el;
}

function weekGrid(posts) {
    const start = state.socialWeek || weekStart(today());
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const t = today();
    const cells = [h('div', { class: 'wg-corner' })];
    days.forEach((d) => cells.push(h('div', { class: `wg-day eyebrow${d === t ? ' today' : ''}` }, dayNum(d))));
    ACCOUNTS.forEach((acc) => {
        cells.push(h('div', { class: 'wg-account' }, handle(acc)));
        days.forEach((d) => {
            const list = posts.filter((p) => p.account === acc && p.date === d);
            cells.push(h('div', { class: 'wg-cell', onclick: (e) => { if (e.target === e.currentTarget) postDialog(null, { account: acc, date: d, stage: 'idee' }); } },
                list.map((p) => h('button', {
                    type: 'button', class: `wg-chip ${p.format === 'story' ? 'story' : p.stage === 'programme' || p.stage === 'publie' ? 'ready' : 'notready'}`,
                    onclick: () => postDialog(p), title: p.title,
                }, p.format === 'story' ? 'story' : `${p.format} · ${stageLabel(p.stage)}`))));
        });
    });
    const move = (n) => { state.socialWeek = addDays(start, 7 * n); state.rerender(); };
    return h('section', { class: 'card', 'aria-labelledby': 't-grille' },
        h('div', { class: 'section-head' }, h('h2', { id: 't-grille' }, 'ma semaine de posts.'),
            h('span', { class: 'arrows' },
                h('button', { type: 'button', class: 'arrow-btn', 'aria-label': 'semaine précédente', onclick: () => move(-1) }, '←'),
                h('button', { type: 'button', class: 'arrow-btn', 'aria-label': 'semaine suivante', onclick: () => move(1) }, '→'))),
        h('div', { class: 'wg-scroll' }, h('div', { class: 'week-posts' }, cells)),
        h('div', { class: 'legend' },
            h('span', null, h('span', { class: 'legend-dot ready' }), 'programmé'),
            h('span', null, h('span', { class: 'legend-dot story' }), 'story du jour'),
            h('span', null, h('span', { class: 'legend-dot notready' }), 'pas encore prêt')));
}

function handlesEditor() {
    const s = singleton('social', { handles: { perso: '@moncompte', velvet: '@velvetcompany' } });
    return h('details', { class: 'handles' },
        h('summary', null, 'mes comptes instagram'),
        h('div', { class: 'two' }, ACCOUNTS.map((a) => h('label', { class: 'field-label' }, a === 'perso' ? 'mon compte perso' : 'velvet company',
            h('input', {
                class: 'field', value: s.handles[a] || '', 'aria-label': `compte ${a}`,
                onchange: (e) => update('social', { handles: { ...singleton('social').handles, [a]: e.target.value.trim().replace(/^([^@])/, '@$1') } }),
            })))));
}

export function renderSocial() {
    const acc = state.socialAccount || 'tous';
    const posts = all('post').filter((p) => acc === 'tous' || p.account === acc);
    const start = state.socialWeek || weekStart(today());
    const chip = (id, label) => h('button', { type: 'button', class: `chip${acc === id ? ' on' : ''}`, 'aria-pressed': String(acc === id), onclick: () => { state.socialAccount = id; state.rerender(); } }, label);
    return h('div', { class: 'page social' },
        h('header', { class: 'page-head' },
            h('div', { class: 'stack-sm' }, eyebrow(`semaine du ${fromKey(start).getDate()} au ${shortDate(addDays(start, 6)).replace(/^\S+ /, '')}`), h('h1', { class: 'title' }, 'mon contenu.')),
            h('div', { class: 'chips' }, chip('tous', 'tous les comptes'), ACCOUNTS.map((a) => chip(a, handle(a))))),
        h('section', { class: 'stack', 'aria-labelledby': 't-pipe' },
            h('div', { class: 'section-head' }, h('h2', { id: 't-pipe' }, 'de l\'idée au post.'), h('span', { class: 'small muted hide-mobile' }, 'glisse une carte d\'une colonne à l\'autre')),
            board(posts)),
        weekGrid(posts),
        handlesEditor());
}
