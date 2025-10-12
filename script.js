// Éléments du DOM
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const loadingIndicator = document.getElementById('loadingIndicator');
const resultsSection = document.getElementById('resultsSection');
const resultsBody = document.getElementById('resultsBody');
const searchInput = document.getElementById('searchInput');
const totalClientsEl = document.getElementById('totalClients');
const totalCreditsEl = document.getElementById('totalCredits');
const totalNewCreditsEl = document.getElementById('totalNewCredits');
const lastUpdateEl = document.getElementById('lastUpdate');
const newFileBtn = document.getElementById('newFileBtn');
const resetAllBtn = document.getElementById('resetAllBtn');

let clientsData = [];
let currentSortColumn = 'credits';
let currentSortOrder = 'desc';
let lastUpdateDate = null;

// Charger les données sauvegardées au démarrage
document.addEventListener('DOMContentLoaded', () => {
    loadSavedData();
    setupEventListeners();
});

// Fonction pour charger les données sauvegardées
function loadSavedData() {
    const savedData = localStorage.getItem('museLab_clientsData');
    if (savedData) {
        try {
            clientsData = JSON.parse(savedData);
            const savedSort = localStorage.getItem('museLab_sortSettings');
            if (savedSort) {
                const sortSettings = JSON.parse(savedSort);
                currentSortColumn = sortSettings.column;
                currentSortOrder = sortSettings.order;
            }
            const savedDate = localStorage.getItem('museLab_lastUpdate');
            if (savedDate) {
                lastUpdateDate = savedDate;
            }
            if (clientsData.length > 0) {
                dropZone.style.display = 'none';
                displayResults();
            }
        } catch (error) {
            console.error('Erreur lors du chargement des données:', error);
        }
    }
}

// Fonction pour sauvegarder les données
function saveData() {
    localStorage.setItem('museLab_clientsData', JSON.stringify(clientsData));
    localStorage.setItem('museLab_sortSettings', JSON.stringify({
        column: currentSortColumn,
        order: currentSortOrder
    }));
    if (lastUpdateDate) {
        localStorage.setItem('museLab_lastUpdate', lastUpdateDate);
    }
}

// Gestion du drag & drop
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Gestion du nouveau fichier
newFileBtn.addEventListener('click', () => {
    resultsSection.style.display = 'none';
    dropZone.style.display = 'flex';
    fileInput.value = '';
    clientsData = [];
    lastUpdateDate = null;
    localStorage.removeItem('museLab_clientsData');
    localStorage.removeItem('museLab_sortSettings');
    localStorage.removeItem('museLab_lastUpdate');
    localStorage.removeItem('museLab_previousData');
});

// Gestion de la réinitialisation totale
resetAllBtn.addEventListener('click', () => {
    const confirmation = confirm(
        '⚠️ ATTENTION ⚠️\n\n' +
        'Êtes-vous sûr de vouloir tout réinitialiser ?\n\n' +
        'Cette action supprimera :\n' +
        '• Toutes les données actuelles\n' +
        '• L\'historique des mises à jour\n' +
        '• Les nouveaux crédits calculés\n\n' +
        'Cette action est IRRÉVERSIBLE.'
    );

    if (confirmation) {
        // Supprimer toutes les données du localStorage
        localStorage.removeItem('museLab_clientsData');
        localStorage.removeItem('museLab_sortSettings');
        localStorage.removeItem('museLab_lastUpdate');
        localStorage.removeItem('museLab_previousData');

        // Réinitialiser les variables
        clientsData = [];
        lastUpdateDate = null;
        currentSortColumn = 'credits';
        currentSortOrder = 'desc';

        // Retourner à l'écran d'upload
        resultsSection.style.display = 'none';
        dropZone.style.display = 'flex';
        fileInput.value = '';

        // Notification de succès
        alert('✅ Toutes les données ont été réinitialisées avec succès.');
    }
});

// Fonction pour traiter le fichier Excel
function handleFile(file) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        alert('Veuillez sélectionner un fichier Excel (.xlsx ou .xls)');
        return;
    }

    dropZone.style.display = 'none';
    loadingIndicator.style.display = 'flex';

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Lire la première feuille
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            processExcelData(jsonData);
        } catch (error) {
            console.error('Erreur lors de la lecture du fichier:', error);
            alert('Erreur lors de la lecture du fichier. Veuillez vérifier le format.');
            loadingIndicator.style.display = 'none';
            dropZone.style.display = 'flex';
        }
    };

    reader.readAsArrayBuffer(file);
}

// Fonction pour traiter les données Excel
function processExcelData(data) {
    // Sauvegarder les données actuelles comme données précédentes
    if (clientsData.length > 0) {
        localStorage.setItem('museLab_previousData', JSON.stringify(clientsData));
    }

    // Ignorer la première ligne (en-têtes)
    const rows = data.slice(1);

    // Map pour agréger les crédits par client (Prénom + Nom)
    const clientsMap = new Map();

    rows.forEach(row => {
        // Colonne A (index 0) = crédits, Colonne B (index 1) = Prénom, Colonne C (index 2) = Nom
        const credits = parseFloat(row[0]) || 0;
        const prenom = (row[1] || '').toString().trim();
        const nom = (row[2] || '').toString().trim();

        // Ignorer les lignes vides
        if (!prenom && !nom) return;

        // Créer une clé unique avec prénom et nom
        const clientKey = `${prenom}|${nom}`;

        // Additionner les crédits pour ce client
        if (clientsMap.has(clientKey)) {
            clientsMap.set(clientKey, clientsMap.get(clientKey) + credits);
        } else {
            clientsMap.set(clientKey, credits);
        }
    });

    // Récupérer les données précédentes
    const previousData = localStorage.getItem('museLab_previousData');
    const previousClientsMap = new Map();

    if (previousData) {
        try {
            const previousClients = JSON.parse(previousData);
            previousClients.forEach(client => {
                const key = `${client.prenom}|${client.nom}`;
                previousClientsMap.set(key, client.credits);
            });
        } catch (error) {
            console.error('Erreur lors du chargement des données précédentes:', error);
        }
    }

    // Convertir la Map en tableau pour l'affichage avec calcul des nouveaux crédits
    clientsData = Array.from(clientsMap.entries()).map(([key, credits]) => {
        const [prenom, nom] = key.split('|');
        const previousCredits = previousClientsMap.get(key) || 0;
        const newCredits = credits - previousCredits;
        return { prenom, nom, credits, newCredits };
    });

    // Enregistrer la date de mise à jour
    lastUpdateDate = new Date().toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    // Trier par crédits décroissant par défaut
    sortData('credits', 'desc');

    // Sauvegarder les données
    saveData();

    displayResults();
}

// Fonction pour trier les données
function sortData(column, order = null) {
    // Si on clique sur la même colonne, inverser l'ordre
    if (order === null) {
        if (currentSortColumn === column) {
            currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            currentSortColumn = column;
            currentSortOrder = column === 'credits' ? 'desc' : 'asc';
        }
    } else {
        currentSortColumn = column;
        currentSortOrder = order;
    }

    clientsData.sort((a, b) => {
        let comparison = 0;

        if (column === 'credits') {
            comparison = a.credits - b.credits;
        } else if (column === 'newCredits') {
            comparison = a.newCredits - b.newCredits;
        } else if (column === 'prenom') {
            comparison = a.prenom.localeCompare(b.prenom, 'fr');
        } else if (column === 'nom') {
            comparison = a.nom.localeCompare(b.nom, 'fr');
        }

        return currentSortOrder === 'asc' ? comparison : -comparison;
    });

    // Sauvegarder les paramètres de tri
    saveData();
}

// Fonction pour afficher les résultats
function displayResults(filterText = '') {
    resultsBody.innerHTML = '';

    // Filtrer les données si nécessaire
    const filteredData = filterText
        ? clientsData.filter(client =>
            client.prenom.toLowerCase().includes(filterText.toLowerCase()) ||
            client.nom.toLowerCase().includes(filterText.toLowerCase())
          )
        : clientsData;

    // Calculer les totaux
    const totalCredits = filteredData.reduce((sum, client) => sum + client.credits, 0);
    const totalNewCredits = filteredData.reduce((sum, client) => sum + (client.newCredits || 0), 0);

    // Afficher les statistiques
    totalClientsEl.textContent = filteredData.length;
    totalCreditsEl.textContent = totalCredits;
    totalNewCreditsEl.textContent = totalNewCredits;

    // Afficher la date de mise à jour
    if (lastUpdateDate) {
        lastUpdateEl.textContent = lastUpdateDate;
    }

    // Afficher chaque client
    filteredData.forEach(client => {
        const row = document.createElement('tr');
        const newCreditsClass = (client.newCredits || 0) > 0 ? 'new-credits-positive' : 'new-credits-zero';
        row.innerHTML = `
            <td>${client.prenom}</td>
            <td>${client.nom}</td>
            <td class="credits-cell">${client.credits}</td>
            <td class="new-credits-cell ${newCreditsClass}">+${client.newCredits || 0}</td>
        `;
        resultsBody.appendChild(row);
    });

    // Mettre à jour les indicateurs de tri dans les en-têtes
    updateSortIndicators();

    // Afficher la section des résultats
    loadingIndicator.style.display = 'none';
    resultsSection.style.display = 'block';
}

// Fonction pour mettre à jour les indicateurs de tri
function updateSortIndicators() {
    document.querySelectorAll('th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });

    const columnMap = {
        'prenom': 0,
        'nom': 1,
        'credits': 2,
        'newCredits': 3
    };

    const thIndex = columnMap[currentSortColumn];
    const th = document.querySelectorAll('th')[thIndex];
    if (th) {
        th.classList.add(`sort-${currentSortOrder}`);
    }
}

// Fonction pour configurer les écouteurs d'événements
function setupEventListeners() {
    const headers = document.querySelectorAll('th');
    headers[0].addEventListener('click', () => {
        sortData('prenom');
        displayResults(searchInput.value);
    });
    headers[1].addEventListener('click', () => {
        sortData('nom');
        displayResults(searchInput.value);
    });
    headers[2].addEventListener('click', () => {
        sortData('credits');
        displayResults(searchInput.value);
    });
    headers[3].addEventListener('click', () => {
        sortData('newCredits');
        displayResults(searchInput.value);
    });

    // Gestion de la recherche
    searchInput.addEventListener('input', (e) => {
        displayResults(e.target.value);
    });
}
