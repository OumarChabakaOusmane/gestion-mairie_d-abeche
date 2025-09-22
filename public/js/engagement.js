document.addEventListener('DOMContentLoaded', function() {
    // Pré-chargement: récupérer l'utilisateur courant pour officierEtatCivil et vérifier le rôle
    let currentUser = null;
    (async () => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const resp = await fetch('/api/users/me', { headers: { 'Authorization': `Bearer ${token}` } });
                if (resp.ok) {
                    const data = await resp.json();
                    currentUser = data?.data || null;
                    const role = currentUser?.role;
                    const allowed = role === 'admin' || role === 'officier_etat_civil';
                    if (!allowed) {
                        // Désactiver le bouton enregistrer et afficher un avertissement
                        const saveBtn = document.getElementById('saveBtn');
                        if (saveBtn) saveBtn.disabled = true;
                        const container = document.querySelector('.container');
                        if (container) {
                            const alertDiv = document.createElement('div');
                            alertDiv.className = 'alert alert-warning';
                            alertDiv.innerHTML = `<strong>Permissions insuffisantes:</strong> votre rôle est <b>${role || 'inconnu'}</b>. Seuls <b>admin</b> ou <b>officier_etat_civil</b> peuvent enregistrer cet acte.`;
                            container.prepend(alertDiv);
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Impossible de récupérer /api/users/me:', e);
        }
    })();
    // Initialisation de la validation Bootstrap avec des messages personnalisés
    var forms = document.querySelectorAll('.needs-validation');
    
    // Ajout des messages d'erreur personnalisés
    document.addEventListener('DOMContentLoaded', function() {
        // Écouter les événements d'entrée pour effacer les messages d'erreur
        document.querySelectorAll('.form-control').forEach(function(input) {
            input.addEventListener('input', function() {
                if (input.validity.valid) {
                    input.classList.remove('is-invalid');
                    input.classList.add('is-valid');
                } else {
                    input.classList.remove('is-valid');
                }
            });
            
            // Validation personnalisée pour les champs de date
            if (input.type === 'date') {
                input.addEventListener('change', function() {
                    validateDateField(this);
                });
            }
            
            // Validation en temps réel pour les champs requis
            if (input.required) {
                input.addEventListener('blur', function() {
                    validateRequiredField(this);
                });
            }
        });
    });
    
    // Fonction de validation pour les champs de date
    function validateDateField(dateInput) {
        const now = new Date();
        const selectedDate = new Date(dateInput.value);
        const fieldId = dateInput.id;
        
        // Réinitialiser les messages d'erreur
        dateInput.setCustomValidity('');
        
        // Vérifier si la date est dans le futur
        if (selectedDate > now) {
            dateInput.setCustomValidity('La date ne peut pas être dans le futur');
        }
        
        // Validation spécifique pour la date de début de concubinage
        if (fieldId === 'dateDebutConcubinage') {
            const dateEtablissement = new Date(document.getElementById('dateEtablissement').value);
            if (dateEtablissement && selectedDate > dateEtablissement) {
                dateInput.setCustomValidity('La date de début de concubinage ne peut pas être postérieure à la date d\'établissement');
            }
        }
        
        // Afficher le message d'erreur personnalisé
        if (dateInput.validity.customError) {
            dateInput.classList.add('is-invalid');
            dateInput.classList.remove('is-valid');
            showFieldError(dateInput, dateInput.validationMessage);
        } else if (dateInput.validity.valid) {
            dateInput.classList.add('is-valid');
            dateInput.classList.remove('is-invalid');
            clearFieldError(dateInput);
        }
    }
    
    // Fonction de validation pour les champs requis
    function validateRequiredField(input) {
        if (!input.value.trim()) {
            input.setCustomValidity('Ce champ est requis');
            input.classList.add('is-invalid');
            input.classList.remove('is-valid');
            showFieldError(input, 'Ce champ est requis');
        } else {
            input.setCustomValidity('');
            input.classList.add('is-valid');
            input.classList.remove('is-invalid');
            clearFieldError(input);
        }
    }
    
    // Afficher un message d'erreur sous le champ
    function showFieldError(input, message) {
        // Supprimer les messages d'erreur existants
        clearFieldError(input);
        
        // Créer et ajouter le message d'erreur
        const errorDiv = document.createElement('div');
        errorDiv.className = 'invalid-feedback d-block';
        errorDiv.textContent = message;
        
        // Insérer après le champ de formulaire
        input.parentNode.appendChild(errorDiv);
    }
    
    // Supprimer les messages d'erreur existants
    function clearFieldError(input) {
        // Supprimer les messages d'erreur existants
        const parent = input.parentNode;
        const existingError = parent.querySelector('.invalid-feedback');
        if (existingError) {
            parent.removeChild(existingError);
        }
    }
    
    // Validation du formulaire au chargement de la page
    Array.prototype.slice.call(forms).forEach(function(form) {
        form.addEventListener('submit', function(event) {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
                
                // Afficher les messages d'erreur pour tous les champs invalides
                form.querySelectorAll(':invalid').forEach(function(input) {
                    validateRequiredField(input);
                });
            }
            form.classList.add('was-validated');
        }, false);
    });

    // Gestion de la soumission du formulaire
    $('#engagementForm').on('submit', function(e) {
        e.preventDefault();
        
        // Valider le formulaire
        if (!this.checkValidity()) {
            e.stopPropagation();
            $(this).addClass('was-validated');
            
            // Faire défiler jusqu'au premier champ invalide
            const firstInvalid = this.querySelector(':invalid');
            if (firstInvalid) {
                firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstInvalid.focus();
            }
            
            return;
        }

        // Préparer les données du formulaire
        const formData = new FormData(this);
        // Valeurs par défaut requises par le validateur backend
        const defaults = {
            regimeBiens: 'séparation de biens',
            concubinDefaults: {
                nationalite: 'Tchadienne',
                typePieceIdentite: 'CNI',
                numeroPieceIdentite: 'N/A',
                situationMatrimoniale: 'célibataire',
                adresse: ''
            }
        };

        const engagementData = {
            numeroActe: formData.get('numeroActe'),
            // Le back-end calcule/stocke dateEtablissement lui-même; nous utilisons la date de l'engagement en front pour validations
            dateEngagement: formData.get('dateEngagement'),
            lieuEtablissement: formData.get('lieuEtablissement'),
            dateDebutConcubinage: formData.get('dateDebutConcubinage'),
            adresseCommune: formData.get('adresseCommune'),
            observations: formData.get('observations'),
            // Champs exigés par le validateur
            dateEtablissement: new Date().toISOString(),
            officierEtatCivil: currentUser?.name || 'Officier d\'état civil',
            regimeBiens: defaults.regimeBiens,
            // Mapper les champs du formulaire (partenaire1/2) vers la structure attendue par l'API (concubin1/2)
            concubin1: {
                nom: formData.get('partenaire1.nom'),
                prenoms: formData.get('partenaire1.prenom'),
                dateNaissance: formData.get('partenaire1.dateNaissance'),
                lieuNaissance: formData.get('partenaire1.lieuNaissance'),
                profession: formData.get('partenaire1.profession'),
                adresse: formData.get('partenaire1.adresse') || defaults.concubinDefaults.adresse,
                nationalite: formData.get('partenaire1.nationalite') || defaults.concubinDefaults.nationalite,
                typePieceIdentite: formData.get('partenaire1.typePieceIdentite') || defaults.concubinDefaults.typePieceIdentite,
                numeroPieceIdentite: formData.get('partenaire1.numeroPieceIdentite') || defaults.concubinDefaults.numeroPieceIdentite,
                situationMatrimoniale: formData.get('partenaire1.situationMatrimoniale') || defaults.concubinDefaults.situationMatrimoniale
            },
            concubin2: {
                nom: formData.get('partenaire2.nom'),
                prenoms: formData.get('partenaire2.prenom'),
                dateNaissance: formData.get('partenaire2.dateNaissance'),
                lieuNaissance: formData.get('partenaire2.lieuNaissance'),
                profession: formData.get('partenaire2.profession'),
                adresse: formData.get('partenaire2.adresse') || defaults.concubinDefaults.adresse,
                nationalite: formData.get('partenaire2.nationalite') || defaults.concubinDefaults.nationalite,
                typePieceIdentite: formData.get('partenaire2.typePieceIdentite') || defaults.concubinDefaults.typePieceIdentite,
                numeroPieceIdentite: formData.get('partenaire2.numeroPieceIdentite') || defaults.concubinDefaults.numeroPieceIdentite,
                situationMatrimoniale: formData.get('partenaire2.situationMatrimoniale') || defaults.concubinDefaults.situationMatrimoniale
            }
        };

        // Vérifier que les dates sont valides
        const today = new Date();
        const dateEtablissement = new Date(engagementData.dateEngagement);
        const dateDebutConcubinage = new Date(engagementData.dateDebutConcubinage);
        
        if (dateEtablissement > today) {
            showAlert('warning', 'Attention', 'La date d\'établissement ne peut pas être dans le futur.');
            $('#dateEngagement').focus();
            return;
        }
        
        if (dateDebutConcubinage > today) {
            showAlert('warning', 'Attention', 'La date de début de concubinage ne peut pas être dans le futur.');
            $('#dateDebutConcubinage').focus();
            return;
        }
        
        if (dateDebutConcubinage > dateEtablissement) {
            showAlert('warning', 'Attention', 'La date de début de concubinage ne peut pas être postérieure à la date d\'établissement.');
            $('#dateDebutConcubinage').focus();
            return;
        }

        // Afficher le loader
        const $saveBtn = $('#saveBtn');
        $saveBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Enregistrement...');

        // Déterminer l'URL et la méthode en fonction du mode (ajout/édition)
        const urlParams = new URLSearchParams(window.location.search);
        const isEditMode = urlParams.has('edit') || urlParams.has('id');
        const url = isEditMode ? `/api/engagements/${urlParams.get('edit') || urlParams.get('id')}` : '/api/engagements';
        const method = isEditMode ? 'PUT' : 'POST';

        // Récupérer le token JWT du stockage local
        const token = localStorage.getItem('token');
        
        // Envoyer les données au serveur avec le token d'authentification
        $.ajax({
            url: url,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            type: method,
            contentType: 'application/json',
            data: JSON.stringify(engagementData),
            success: function(response) {
                const message = isEditMode ? 'mis à jour' : 'enregistré';
                showAlert('success', 'Succès', `L'engagement a été ${message} avec succès.`);
                
                if (!isEditMode) {
                    // Réinitialiser le formulaire en mode ajout
                    $('#engagementForm')[0].reset();
                    $('#engagementForm').removeClass('was-validated');
                    generateNumeroActe();
                    
                    // Faire défiler vers le haut du formulaire
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    // Rediriger vers la liste après 1.5 secondes en mode édition
                    setTimeout(() => {
                        window.location.href = '/engagements';
                    }, 1500);
                }
            },
            error: function(xhr) {
                const action = isEditMode ? 'la mise à jour' : "l'enregistrement";
                let errorMessage = `Une erreur est survenue lors de ${action}`;
                let errorDetails = '';
                
                // Gestion des erreurs en fonction du code de statut
                if (xhr.status === 400) {
                    errorMessage = 'Données invalides. Veuillez vérifier les informations saisies.';
                    if (xhr.responseJSON && xhr.responseJSON.errors) {
                        errorDetails = Object.values(xhr.responseJSON.errors).join('\n');
                    }
                } else if (xhr.status === 401) {
                    errorMessage = 'Session expirée. Veuillez vous reconnecter.';
                    // Rediriger vers la page de connexion après un délai
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                } else if (xhr.status === 403) {
                    errorMessage = 'Accès refusé. Vous n\'avez pas les permissions nécessaires.';
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        errorDetails = xhr.responseJSON.error;
                    } else {
                        // Vérifier si l'utilisateur a le bon rôle
                        const userData = localStorage.getItem('user');
                        if (userData) {
                            try {
                                const user = JSON.parse(userData);
                                errorDetails = `Rôle actuel: ${user.role || 'non défini'}`;
                            } catch (e) {
                                console.error('Erreur lors de l\'analyse des données utilisateur:', e);
                            }
                        }
                    }
                } else if (xhr.status === 500) {
                    errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
                } else if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                } else if (xhr.responseJSON && xhr.responseJSON.error) {
                    errorMessage = xhr.responseJSON.error;
                } else if (xhr.statusText) {
                    errorMessage += ` (${xhr.status} ${xhr.statusText})`;
                }
                
                // Afficher l'erreur à l'utilisateur
                if (errorDetails) {
                    errorMessage += `\n\nDétails : ${errorDetails}`;
                }
                
                showAlert('danger', 'Erreur', errorMessage);
            },
            complete: function() {
                // Réactiver le bouton d'enregistrement
                $saveBtn.prop('disabled', false).html('Enregistrer');
            }
        });
    });

    // Fonction pour afficher les alertes
    function showAlert(type, title, message) {
        const $alert = $(`
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                <strong>${title} :</strong> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `);
        
        // Supprimer les alertes existantes et ajouter la nouvelle
        $('.alert').remove();
        $('#engagementForm').prepend($alert);
        
        // Supprimer l'alerte après 5 secondes
        setTimeout(() => {
            $alert.alert('close');
        }, 5000);
    }

    // Gestion du bouton d'enregistrement
    $('#saveBtn').on('click', function() {
        // Déclencher la validation du formulaire
        const form = document.getElementById('engagementForm');
        if (form.checkValidity()) {
            // Si le formulaire est valide, déclencher la soumission
            $(form).trigger('submit');
        } else {
            // Sinon, forcer l'affichage des erreurs
            form.classList.add('was-validated');
        }
    });

    // Générer un numéro d'acte si le champ est vide
    function generateNumeroActe() {
        if (!$('#numeroActe').val()) {
            const now = new Date();
            const year = now.getFullYear();
            const random = Math.floor(1000 + Math.random() * 9000); // 4 chiffres aléatoires
            const numero = `ENG-${year}-${random}`;
            $('#numeroActe').val(numero);
        }
    }

    // Gestion du mode édition
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit') || urlParams.get('id');
    
    if (editId) {
        // Charger les données existantes
        loadEngagementData(editId);
        // Changer le titre de la page
        $('h1').text('Modifier un engagement de cial');
        // Changer le texte du bouton de sauvegarde
        $('#saveBtn').html('<i class="fas fa-save me-2"></i>Mettre à jour');
        // Activer le bouton d'impression
        $('#printBtn').prop('disabled', false);
    } else {
        // Générer un numéro d'acte pour un nouvel engagement
        generateNumeroActe();
        // Désactiver le bouton d'impression pour un nouvel engagement
        $('#printBtn').prop('disabled', true);
    }

    // Fonction pour charger les données d'un engagement existant
    function loadEngagementData(id) {
        $.ajax({
            url: `/api/engagements/${id}`,
            type: 'GET',
            success: function(response) {
                const engagement = response.engagement || response; // Gérer les deux formats de réponse
                
                // Remplir le formulaire avec les données existantes
                $('#numeroActe').val(engagement.numeroActe || '');
                $('#dateEtablissement').val(engagement.dateEtablissement ? new Date(engagement.dateEtablissement).toISOString().split('T')[0] : '');
                $('#lieuEtablissement').val(engagement.lieuEtablissement || '');
                $('#dateDebutConcubinage').val(engagement.dateDebutConcubinage ? new Date(engagement.dateDebutConcubinage).toISOString().split('T')[0] : '');
                $('#adresseCommune').val(engagement.adresseCommune || '');
                $('#observations').val(engagement.observations || '');

                // Remplir les informations du premier partenaire
                if (engagement.concubin1) {
                    $('#concubin1_nom').val(engagement.concubin1.nom || '');
                    $('#concubin1_dateNaissance').val(engagement.concubin1.dateNaissance ? new Date(engagement.concubin1.dateNaissance).toISOString().split('T')[0] : '');
                    $('#concubin1_lieuNaissance').val(engagement.concubin1.lieuNaissance || '');
                    $('#concubin1_domicile').val(engagement.concubin1.domicile || '');
                }

                // Remplir les informations du deuxième partenaire
                if (engagement.concubin2) {
                    $('#concubin2_nom').val(engagement.concubin2.nom || '');
                    $('#concubin2_dateNaissance').val(engagement.concubin2.dateNaissance ? new Date(engagement.concubin2.dateNaissance).toISOString().split('T')[0] : '');
                    $('#concubin2_lieuNaissance').val(engagement.concubin2.lieuNaissance || '');
                    $('#concubin2_domicile').val(engagement.concubin2.domicile || '');
                }
                
                // Afficher les informations de fin d'engagement si applicable
                if (engagement.statut === 'fini' && engagement.dateFinEngagement) {
                    const endInfo = `
                        <div class="alert alert-info">
                            <h5>Fin de l'engagement</h5>
                            <p class="mb-0">Cet engagement a pris fin le ${new Date(engagement.dateFinEngagement).toLocaleDateString('fr-FR')}.</p>
                        </div>
                    `;
                    $('.container-fluid').prepend(endInfo);
                }
                
                // Afficher les informations de conversion si converti en mariage
                if (engagement.statut === 'converti_en_mariage') {
                    const convertInfo = `
                        <div class="alert alert-info">
                            <h5>Converti en mariage</h5>
                            <p class="mb-0">Cet engagement a été converti en acte de mariage.</p>
                        </div>
                    `;
                    $('.container-fluid').prepend(convertInfo);
                }
            },
            error: function(xhr) {
                showAlert('danger', 'Erreur', 'Impossible de charger les données de l\'engagement');
                console.error('Erreur lors du chargement des données:', xhr);
            }
        });
    }

    // Fonction pour télécharger le PDF
    function downloadPdf(engagementId) {
        if (!engagementId) {
            showAlert('error', 'Erreur', 'ID d\'engagement manquant');
            return;
        }

        // Afficher un indicateur de chargement
        const printBtn = $('#printBtn');
        const originalText = printBtn.html();
        printBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Téléchargement...');

        // Récupérer le token JWT du stockage local
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        // Créer un nouvel objet URL pour éviter la mise en cache
        const url = new URL(`/api/engagements/${engagementId}/pdf`, window.location.origin);
        url.searchParams.append('_', new Date().getTime()); // Éviter le cache

        // Créer un lien temporaire pour le téléchargement
        const link = document.createElement('a');
        link.style.display = 'none';
        document.body.appendChild(link);

        fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            cache: 'no-store'
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.message || 'Erreur lors du téléchargement du PDF');
                });
            }
            return response.blob();
        })
        .then(blob => {
            // Créer une URL pour le blob
            const url = window.URL.createObjectURL(blob);
            
            // Configurer le lien de téléchargement
            link.href = url;
            link.download = `engagement-${engagementId}-${new Date().toISOString().split('T')[0]}.pdf`;
            
            // Déclencher le téléchargement
            link.click();
            
            // Nettoyer
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);
        })
        .catch(error => {
            console.error('Erreur lors du téléchargement du PDF:', error);
            showAlert('error', 'Erreur', error.message || 'Échec du téléchargement du PDF');
        })
        .finally(() => {
            // Réactiver le bouton
            printBtn.prop('disabled', false).html(originalText);
        });
    }

// Initialisation après le chargement du DOM
if (editId) {
    // Charger les données existantes
    loadEngagementData(editId);
    // Changer le titre de la page
    $('h1').text('Modifier un engagement de cial');
    // Changer le texte du bouton de sauvegarde
    $('#saveBtn').html('<i class="fas fa-save me-2"></i>Mettre à jour');
    // Activer le bouton d'impression
    $('#printBtn').prop('disabled', false);
} else {
    // Générer un numéro d'acte pour un nouvel engagement
    generateNumeroActe();
    // Désactiver le bouton d'impression pour un nouvel engagement
    $('#printBtn').prop('disabled', true);
}

// Fonction pour charger les données d'un engagement existant
function loadEngagementData(id) {
    $.ajax({
        url: `/api/engagements/${id}`,
        type: 'GET',
        success: function(response) {
            const engagement = response.engagement || response; // Gérer les deux formats de réponse
            
            // Remplir le formulaire avec les données existantes
            $('#numeroActe').val(engagement.numeroActe || '');
            $('#dateEtablissement').val(engagement.dateEtablissement ? new Date(engagement.dateEtablissement).toISOString().split('T')[0] : '');
            $('#lieuEtablissement').val(engagement.lieuEtablissement || '');
            $('#dateDebutConcubinage').val(engagement.dateDebutConcubinage ? new Date(engagement.dateDebutConcubinage).toISOString().split('T')[0] : '');
            $('#adresseCommune').val(engagement.adresseCommune || '');
            $('#observations').val(engagement.observations || '');

            // Remplir les informations du premier partenaire
            if (engagement.concubin1) {
                $('#concubin1_nom').val(engagement.concubin1.nom || '');
                $('#concubin1_dateNaissance').val(engagement.concubin1.dateNaissance ? new Date(engagement.concubin1.dateNaissance).toISOString().split('T')[0] : '');
                $('#concubin1_lieuNaissance').val(engagement.concubin1.lieuNaissance || '');
                $('#concubin1_domicile').val(engagement.concubin1.domicile || '');
            }

            // Remplir les informations du deuxième partenaire
            if (engagement.concubin2) {
                $('#concubin2_nom').val(engagement.concubin2.nom || '');
                $('#concubin2_dateNaissance').val(engagement.concubin2.dateNaissance ? new Date(engagement.concubin2.dateNaissance).toISOString().split('T')[0] : '');
                $('#concubin2_lieuNaissance').val(engagement.concubin2.lieuNaissance || '');
                $('#concubin2_domicile').val(engagement.concubin2.domicile || '');
            }
            
            // Afficher les informations de fin d'engagement si applicable
            if (engagement.statut === 'fini' && engagement.dateFinEngagement) {
                const endInfo = `
                    <div class="alert alert-info">
                        <h5>Fin de l'engagement</h5>
                        <p class="mb-0">Cet engagement a pris fin le ${new Date(engagement.dateFinEngagement).toLocaleDateString('fr-FR')}.</p>
                    </div>
                `;
                $('.container-fluid').prepend(endInfo);
            }
            
            // Afficher les informations de conversion si converti en mariage
            if (engagement.statut === 'converti_en_mariage') {
                const convertInfo = `
                    <div class="alert alert-info">
                        <h5>Converti en mariage</h5>
                        <p class="mb-0">Cet engagement a été converti en acte de mariage.</p>
                    </div>
                `;
                $('.container-fluid').prepend(convertInfo);
            }
        },
        error: function(xhr) {
            showAlert('danger', 'Erreur', 'Impossible de charger les données de l\'engagement');
            console.error('Erreur lors du chargement des données:', xhr);
        }
    });
}

    // Gestion du bouton d'impression/PDF
    $('#printBtn').click(function(e) {
        e.preventDefault();
        const engagementId = editId || '';
        if (engagementId) {
            // Vérifier si la fonction downloadActePdf est disponible
            if (typeof downloadActePdf === 'function') {
                downloadActePdf('engagement', engagementId, 'printBtn')
                    .catch(error => {
                        console.error('Erreur lors du téléchargement du PDF:', error);
                    });
            } else {
                console.error('La fonction downloadActePdf n\'est pas disponible');
                showAlert('error', 'Erreur', 'Fonction de téléchargement non disponible. Veuillez recharger la page.');
            }
        } else {
            showAlert('warning', 'Avertissement', 'Veuvez enregistrer l\'engagement avant de générer le PDF.');
        }
    });
});
