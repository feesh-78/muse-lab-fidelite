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
const downloadBtn = document.getElementById('downloadBtn');
const historyBtn = document.getElementById('historyBtn');
const historyModal = document.getElementById('historyModal');
const closeHistoryModal = document.getElementById('closeHistoryModal');
const historyList = document.getElementById('historyList');

let clientsData = [];
let currentSortColumn = 'credits';
let currentSortOrder = 'desc';
let lastUpdateDate = null;
let history = [];

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

    // Charger l'historique
    const savedHistory = localStorage.getItem('museLab_history');
    if (savedHistory) {
        try {
            history = JSON.parse(savedHistory);
        } catch (error) {
            console.error('Erreur lors du chargement de l\'historique:', error);
            history = [];
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

// Fonction pour sauvegarder dans l'historique
function saveToHistory() {
    const historyEntry = {
        date: lastUpdateDate,
        timestamp: new Date().getTime(),
        clientsData: JSON.parse(JSON.stringify(clientsData)),
        totalClients: clientsData.length,
        totalCredits: clientsData.reduce((sum, c) => sum + c.credits, 0),
        totalNewCredits: clientsData.reduce((sum, c) => sum + (c.newCredits || 0), 0)
    };

    // Ajouter au début du tableau
    history.unshift(historyEntry);

    // Limiter à 10 entrées
    if (history.length > 10) {
        history = history.slice(0, 10);
    }

    // Sauvegarder dans localStorage
    localStorage.setItem('museLab_history', JSON.stringify(history));
}

// Fonction pour afficher l'historique
function displayHistory() {
    if (history.length === 0) {
        historyList.innerHTML = '<p class="no-history">Aucun historique disponible.</p>';
        return;
    }

    let html = '';
    history.forEach((entry, index) => {
        html += `
            <div class="history-item">
                <div class="history-info">
                    <div class="history-date">${entry.date}</div>
                    <div class="history-stats">
                        <span><strong>${entry.totalClients}</strong> clientes</span>
                        <span><strong>${entry.totalCredits}</strong> crédits</span>
                        <span class="new-credits-badge">+${entry.totalNewCredits} nouveaux</span>
                    </div>
                </div>
                <div class="history-actions">
                    <button class="btn-download-history" onclick="downloadHistoryVersion(${index})">⬇️</button>
                    <button class="btn-restore" onclick="restoreFromHistory(${index})">Restaurer</button>
                    <button class="btn-delete-history" onclick="deleteHistoryEntry(${index})">✕</button>
                </div>
            </div>
        `;
    });

    historyList.innerHTML = html;
}

// Fonction pour restaurer une version de l'historique
function restoreFromHistory(index) {
    const entry = history[index];
    if (!entry) return;

    const confirmation = confirm(
        `Voulez-vous restaurer la version du ${entry.date} ?\n\n` +
        `Cette version contient :\n` +
        `• ${entry.totalClients} clientes\n` +
        `• ${entry.totalCredits} crédits utilisés\n` +
        `• ${entry.totalNewCredits} nouveaux crédits`
    );

    if (confirmation) {
        clientsData = JSON.parse(JSON.stringify(entry.clientsData));
        lastUpdateDate = entry.date;

        saveData();
        displayResults();

        historyModal.style.display = 'none';

        alert('✅ Version restaurée avec succès !');
    }
}

// Fonction pour supprimer une entrée de l'historique
function deleteHistoryEntry(index) {
    const entry = history[index];
    const confirmation = confirm(`Supprimer la version du ${entry.date} de l'historique ?`);

    if (confirmation) {
        history.splice(index, 1);
        localStorage.setItem('museLab_history', JSON.stringify(history));
        displayHistory();
    }
}

// Fonction pour télécharger les données en Excel
function downloadExcel(data, filename) {
    // Créer un nouveau workbook
    const wb = XLSX.utils.book_new();

    // Préparer les données pour Excel
    const excelData = data.map(client => ({
        'Prénom': client.prenom,
        'Nom': client.nom,
        'Crédits Utilisés': client.credits,
        'Nouveaux Crédits': client.newCredits || 0
    }));

    // Créer la feuille de calcul
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Définir la largeur des colonnes
    ws['!cols'] = [
        { wch: 15 }, // Prénom
        { wch: 15 }, // Nom
        { wch: 18 }, // Crédits Utilisés
        { wch: 18 }  // Nouveaux Crédits
    ];

    // Ajouter la feuille au workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Fidélité');

    // Télécharger le fichier
    XLSX.writeFile(wb, filename);
}

// Fonction pour télécharger la version actuelle
function downloadCurrentVersion() {
    const date = new Date().toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).replace(/[/:]/g, '-').replace(', ', '_');

    downloadExcel(clientsData, `MuseLab_Fidelite_${date}.xlsx`);
}

// Fonction pour télécharger une version de l'historique
function downloadHistoryVersion(index) {
    const entry = history[index];
    if (!entry) return;

    const dateFormatted = entry.date.replace(/[/:]/g, '-').replace(', ', '_');
    downloadExcel(entry.clientsData, `MuseLab_Fidelite_${dateFormatted}.xlsx`);
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
        localStorage.removeItem('museLab_history');

        // Réinitialiser les variables
        clientsData = [];
        lastUpdateDate = null;
        currentSortColumn = 'credits';
        currentSortOrder = 'desc';
        history = [];

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

    // Sauvegarder dans l'historique
    saveToHistory();

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

    // Gestion du bouton de téléchargement
    downloadBtn.addEventListener('click', () => {
        downloadCurrentVersion();
    });

    // Gestion du bouton historique
    historyBtn.addEventListener('click', () => {
        displayHistory();
        historyModal.style.display = 'flex';
    });

    // Fermer la modal
    closeHistoryModal.addEventListener('click', () => {
        historyModal.style.display = 'none';
    });

    // Fermer en cliquant en dehors de la modal
    historyModal.addEventListener('click', (e) => {
        if (e.target === historyModal) {
            historyModal.style.display = 'none';
        }
    });
}
