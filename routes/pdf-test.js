const express = require('express');
const router = express.Router();
const { generatePdf } = require('../services/pdfService');
const Naissance = require('../models/Naissance');

// Test route to check PDF generation
router.get('/test-pdf', async (req, res) => {
    try {
        console.log('PDF test route hit');
        
        // Get the test birth record
        const naissance = await Naissance.findOne({ numeroActe: 'TEST-2023-001' });
        
        if (!naissance) {
            console.log('No test record found');
            return res.status(404).json({ error: 'Test record not found' });
        }
        
        console.log('Found test record:', naissance._id);
        
        // Prepare the data for PDF generation
        const pdfData = {
            numeroActe: naissance.numeroActe,
            dateEtablissement: naissance.dateEtablissement,
            mairie: naissance.mairie,
            
            // Enfant
            nomEnfant: naissance.nomEnfant,
            prenomsEnfant: naissance.prenomsEnfant,
            dateNaissance: naissance.dateNaissance,
            heureNaissance: naissance.heureNaissance,
            lieuNaissance: naissance.lieuNaissance,
            sexe: naissance.sexe,
            
            // Père
            nomPere: naissance.nomPere,
            prenomsPere: naissance.prenomsPere,
            dateNaissancePere: naissance.dateNaissancePere,
            lieuNaissancePere: naissance.lieuNaissancePere,
            professionPere: naissance.professionPere,
            
            // Mère
            nomMere: naissance.nomMere,
            prenomsMere: naissance.prenomsMere,
            dateNaissanceMere: naissance.dateNaissanceMere,
            lieuNaissanceMere: naissance.lieuNaissanceMere,
            professionMere: naissance.professionMere,
            
            // Déclarant
            nomDeclarant: naissance.nomDeclarant,
            prenomsDeclarant: naissance.prenomsDeclarant,
            lienDeclarant: naissance.lienDeclarant,
            adresseDeclarant: naissance.adresseDeclarant,
            
            // Autres champs
            observations: naissance.observations || ''
        };
        
        console.log('Generating PDF with data:', JSON.stringify(pdfData, null, 2));
        
        // Generate the PDF
        const pdfBuffer = await generatePdf('naissance', pdfData);
        
        // Send the PDF
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="acte-naissance-${pdfData.numeroActe}.pdf"`,
            'Content-Length': pdfBuffer.length
        });
        
        console.log('PDF generated successfully');
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Error in test PDF route:', error);
        res.status(500).json({ 
            error: 'Failed to generate PDF', 
            message: error.message,
            stack: error.stack 
        });
    }
});

module.exports = router;
