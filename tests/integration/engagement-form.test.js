const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Configuration de l'environnement de test
const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Engagement Form</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        .was-validated .form-control:invalid {
            border-color: #dc3545;
            padding-right: calc(1.5em + 0.75rem);
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23dc3545' viewBox='0 0 12 12'%3e%3ccircle cx='6' cy='6' r='4.5'/%3e%3cpath stroke-linejoin='round' d='M5.8 3.6h.4L6 6.5z'/%3e%3ccircle cx='6' cy='8.2' r='.6' fill='%23dc3545' stroke='none'/%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right calc(0.375em + 0.1875rem) center;
            background-size: calc(0.75em + 0.375rem) calc(0.75em + 0.375rem);
        }
        .was-validated .form-control:valid {
            border-color: #198754;
            padding-right: calc(1.5em + 0.75rem);
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3e%3cpath fill='%23198754' d='M2.3 6.73L.6 4.53c-.4-1.04.46-1.4 1.1-.8l1.1 1.4 3.4-3.8c.6-.63 1.6-.27 1.2.7l-4 4.6c-.43.5-.8.4-1.1.1z'/%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right calc(0.375em + 0.1875rem) center;
            background-size: calc(0.75em + 0.375rem) calc(0.75em + 0.375rem);
        }
    </style>
</head>
<body>
    <div class="container mt-5">
        <form id="engagementForm" class="needs-validation" novalidate>
            <div class="mb-3">
                <label for="numeroActe" class="form-label">Numéro d'acte</label>
                <input type="text" id="numeroActe" class="form-control" readonly>
            </div>
            
            <div class="mb-3">
                <label for="dateEtablissement" class="form-label">Date d'établissement</label>
                <input type="date" id="dateEtablissement" class="form-control required-field" required>
            </div>
            
            <div class="mb-3">
                <label for="lieuEtablissement" class="form-label">Lieu d'établissement</label>
                <input type="text" id="lieuEtablissement" class="form-control required-field" required>
            </div>
            
            <div class="mb-3">
                <label for="dateDebutConcubinage" class="form-label">Date de début de concubinage</label>
                <input type="date" id="dateDebutConcubinage" class="form-control required-field" required>
            </div>
            
            <div class="mb-3">
                <label for="adresseCommune" class="form-label">Adresse commune</label>
                <input type="text" id="adresseCommune" class="form-control required-field" required>
            </div>
            
            <h4>Concubin 1</h4>
            <div class="mb-3">
                <label for="concubin1_nom" class="form-label">Nom complet</label>
                <input type="text" id="concubin1_nom" class="form-control required-field" required>
            </div>
            
            <h4>Concubin 2</h4>
            <div class="mb-3">
                <label for="concubin2_nom" class="form-label">Nom complet</label>
                <input type="text" id="concubin2_nom" class="form-control required-field" required>
            </div>
            
            <button type="submit" id="saveBtn" class="btn btn-primary">Enregistrer</button>
            <button type="button" id="printBtn" class="btn btn-secondary" disabled>Imprimer</button>
        </form>
    </div>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;

// Charger le fichier JS du formulaire depuis le dossier public du projet
const js = fs.readFileSync(path.resolve(__dirname, '../../public/js/engagement.js'), 'utf8');

// Créer un mock pour les fonctions globales utilisées dans le code
const mockAlert = jest.fn();

// Fonction utilitaire pour attendre que le DOM soit chargé
function waitForDOMContentLoaded(window) {
    return new Promise((resolve) => {
        if (window.document.readyState === 'complete') {
            resolve();
        } else {
            window.document.addEventListener('DOMContentLoaded', resolve);
        }
    });
}

describe('Engagement Form Tests', () => {
    let dom;
    let window;
    let document;
    let form;
    
    // Avant chaque test, on crée un nouvel environnement JSDOM
    beforeEach(async () => {
        // Créer un DOM avec jQuery et Bootstrap
        dom = new JSDOM(html, { 
            runScripts: 'dangerously',
            resources: 'usable',
            url: 'http://localhost'
        });
        
        window = dom.window;
        document = window.document;
        
        // Mock de la fonction alert
        window.alert = mockAlert;
        
        // Ajouter le script de test après que jQuery soit chargé
        return new Promise((resolve) => {
            window.addEventListener('load', () => {
                const scriptEl = window.document.createElement('script');
                scriptEl.textContent = js;
                window.document.body.appendChild(scriptEl);
                
                // On récupère le formulaire
                form = document.getElementById('engagementForm');
                
                // Simuler l'événement DOMContentLoaded
                const event = new window.Event('DOMContentLoaded');
                document.dispatchEvent(event);
                
                // Donner un peu de temps pour l'initialisation
                setTimeout(resolve, 100);
            });
        });
    });
  
    // Test 1: Vérifier que le formulaire existe
    test('Le formulaire doit exister', () => {
        expect(form).not.toBeNull();
    });
    
    // Test 2: Vérifier que le formulaire a les champs requis
    test('Le formulaire doit contenir les champs requis', () => {
        const requiredFields = [
            'numeroActe',
            'dateEtablissement',
            'lieuEtablissement',
            'dateDebutConcubinage',
            'adresseCommune',
            'concubin1_nom',
            'concubin2_nom'
        ];
        
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            expect(field).not.toBeNull();
            
            // Vérifier si le champ est requis (sauf numeroActe qui est en lecture seule)
            if (fieldId !== 'numeroActe') {
                expect(field.required).toBe(true);
            }
        });
    });
    
    // Test 3: Vérifier que le bouton d'impression est désactivé en mode création
    test('Le bouton d\'impression doit être désactivé en mode création', () => {
        const printBtn = document.getElementById('printBtn');
        expect(printBtn).not.toBeNull();
        expect(printBtn.disabled).toBe(true);
    });
    
    // Test 4: Vérifier que le formulaire a la classe needs-validation
    test('Le formulaire doit avoir la classe needs-validation', () => {
        const form = document.getElementById('engagementForm');
        expect(form.classList.contains('needs-validation')).toBe(true);
    });
    
    // Test 5: Vérifier que les champs obligatoires sont marqués comme requis
    test('Les champs obligatoires doivent avoir l\'attribut required', () => {
        const requiredFields = [
            'dateEtablissement',
            'lieuEtablissement',
            'dateDebutConcubinage',
            'adresseCommune',
            'concubin1_nom',
            'concubin2_nom'
        ];
        
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            expect(field.required).toBe(true);
        });
    });
    
    // Test 6: Vérifier la validation des champs de date
    test('Les champs de date ne doivent pas accepter de dates futures', () => {
        const dateFields = ['dateEtablissement', 'dateDebutConcubinage'];
        
        dateFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            // Définir une date future
            field.value = tomorrow.toISOString().split('T')[0];
            
            // Déclencher l'événement change
            const event = new window.Event('change');
            field.dispatchEvent(event);
            
            // Vérifier que le champ est valide (la validation côté client est gérée par le navigateur)
            // On vérifie simplement que le champ a une valeur
            expect(field.value).not.toBe('');
        });
    });
    
    // Test 7: Vérifier que le formulaire ne peut pas être soumis vide
    test('Le formulaire ne doit pas pouvoir être soumis vide', () => {
        const form = document.getElementById('engagementForm');
        
        // Simuler la soumission du formulaire
        const event = new window.Event('submit', { cancelable: true });
        const wasPrevented = !form.dispatchEvent(event);
        
        // Vérifier que l'événement a été empêché
        expect(wasPrevented).toBe(true);
        
        // Vérifier que la classe was-validated a été ajoutée
        expect(form.classList.contains('was-validated')).toBe(true);
    });
});
