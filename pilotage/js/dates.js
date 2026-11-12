// Dates au format AAAA-MM-JJ, en heure locale, et affichage en français minuscule
const JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function toKey(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fromKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}
export const today = () => toKey(new Date());
export function addDays(key, n) {
    const d = fromKey(key);
    d.setDate(d.getDate() + n);
    return toKey(d);
}
export function daysBetween(fromKeyStr, toKeyStr) {
    return Math.round((fromKey(toKeyStr) - fromKey(fromKeyStr)) / 86400000);
}

// "ven 16 oct"
export function shortDate(key) {
    if (!key) return '';
    const d = fromKey(key);
    return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}
// "16 oct" (+ année si différente de l'année en cours)
export function dayMonth(key) {
    if (!key) return '';
    const d = fromKey(key);
    const y = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
    return `${d.getDate()} ${MOIS[d.getMonth()]}${y}`;
}
// "lun 12"
export function dayNum(key) {
    const d = fromKey(key);
    return `${JOURS[d.getDay()]} ${d.getDate()}`;
}
// "dimanche 11 octobre 2026"
export function longDate(key) {
    const d = fromKey(key);
    return `${JOURS_LONGS[d.getDay()]} ${d.getDate()} ${MOIS_LONGS[d.getMonth()]} ${d.getFullYear()}`;
}
// "17 mars 2027"
export function fullDate(key) {
    const d = fromKey(key);
    return `${d.getDate()} ${MOIS_LONGS[d.getMonth()]} ${d.getFullYear()}`;
}
