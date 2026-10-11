// État de l'interface (filtres, affichage mobile), partagé entre les pages
export const state = {
    brandFilter: 'tout',
    projectFilter: 'tout',
    mobile: window.matchMedia('(max-width: 820px)').matches,
    rerender: () => {},
};
