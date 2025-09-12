const express = require('express');
const router = express.Router();
const Acte = require('../models/Acte');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

router.get('/', async (req, res) => {
  try {
    // Compter les actes par type
    const naissanceCount = await Acte.countDocuments({ type: 'naissance' });
    const mariageCount = await Acte.countDocuments({ type: 'mariage' });
    const decesCount = await Acte.countDocuments({ type: 'deces' });
    
    // Statistiques mensuelles
    const monthlyStats = await Acte.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$dateEnregistrement" },
            month: { $month: "$dateEnregistrement" },
            type: "$type"
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);
    
    // Préparer les données pour le graphique
    const monthlyLabels = [];
    const monthlyNaissances = [];
    const monthlyMariages = [];
    const monthlyDeces = [];
    
    monthlyStats.forEach(stat => {
      const label = `${stat._id.month}/${stat._id.year}`;
      if (!monthlyLabels.includes(label)) {
        monthlyLabels.push(label);
      }
      
      switch(stat._id.type) {
        case 'naissance':
          monthlyNaissances.push(stat.count);
          break;
        case 'mariage':
          monthlyMariages.push(stat.count);
          break;
        case 'deces':
          monthlyDeces.push(stat.count);
          break;
      }
    });
    
    res.json({
      success: true,
      data: {
        naissanceCount,
        mariageCount,
        decesCount,
        monthlyLabels,
        monthlyNaissances,
        monthlyMariages,
        monthlyDeces
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { type, startDate, endDate, format, mairie, createdBy } = req.query;
    
    // Construire la requête
    const query = {};
    if (type && type !== 'all') query.type = type;
    if (startDate) query.dateEnregistrement = { $gte: new Date(startDate) };
    if (endDate) {
      query.dateEnregistrement = query.dateEnregistrement || {};
      query.dateEnregistrement.$lte = new Date(endDate);
    }
    if (mairie) query.mairie = mairie;
    if (createdBy) query.createdBy = createdBy;
    
    const actes = await Acte.find(query).sort({ dateEnregistrement: 1 });
    
    if (format === 'csv') {
      // Exporter en CSV
      const fields = [
        { label: 'Numéro', value: 'numeroActe' },
        { label: 'Type', value: 'type' },
        { label: 'Date', value: row => new Date(row.dateEnregistrement).toLocaleDateString() },
        { label: 'Mairie', value: 'mairie' },
        { label: 'Créé par', value: row => row.createdBy ? (row.createdBy.nom || row.createdBy.toString()) : '' }
      ];
      
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(actes);
      
      res.header('Content-Type', 'text/csv');
      res.attachment('rapport-actes.csv');
      res.send(csv);
    } else {
      // Exporter en PDF
      const doc = new PDFDocument();
      res.header('Content-Type', 'application/pdf');
      res.attachment('rapport-actes.pdf');
      doc.pipe(res);
      
      // En-tête
      doc.fontSize(20).text('Rapport des Actes d\'État Civil', { align: 'center' });
      doc.moveDown();
      
      // Filtres appliqués
      doc.fontSize(12).text('Filtres appliqués:', { underline: true });
      doc.text(`Type: ${type === 'all' ? 'Tous' : type}`);
      if (startDate) doc.text(`À partir de: ${new Date(startDate).toLocaleDateString()}`);
      if (endDate) doc.text(`Jusqu'à: ${new Date(endDate).toLocaleDateString()}`);
      if (mairie) doc.text(`Mairie: ${mairie}`);
      if (createdBy) doc.text(`Créé par: ${createdBy}`);
      doc.moveDown();
      
      // Tableau des actes
      const table = {
        headers: ['Numéro', 'Type', 'Date', 'Mairie', 'Créé par'],
        rows: actes.map(acte => [
          acte.numeroActe,
          acte.type,
          new Date(acte.dateEnregistrement).toLocaleDateString(),
          acte.mairie,
          acte.createdBy ? (acte.createdBy.nom || acte.createdBy.toString()) : ''
        ])
      };
      
      // Dessiner le tableau
      drawTable(doc, table);
      
      doc.end();
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Fonction utilitaire pour dessiner un tableau dans PDF
function drawTable(doc, table) {
  const startY = doc.y;
  const margin = 50;
  const rowHeight = 30;
  const colWidth = (doc.page.width - 2 * margin) / table.headers.length;
  
  // Dessiner les en-têtes
  doc.font('Helvetica-Bold');
  table.headers.forEach((header, i) => {
    doc.text(header, margin + i * colWidth, startY, {
      width: colWidth,
      align: 'left'
    });
  });
  doc.moveDown();
  
  // Dessiner les lignes
  doc.font('Helvetica');
  table.rows.forEach((row, rowIndex) => {
    const y = startY + (rowIndex + 1) * rowHeight;
    
    row.forEach((cell, colIndex) => {
      doc.text(cell, margin + colIndex * colWidth, y, {
        width: colWidth,
        align: 'left'
      });
    });
    
    // Ligne de séparation
    doc.moveTo(margin, y + rowHeight - 5)
       .lineTo(doc.page.width - margin, y + rowHeight - 5)
       .stroke();
  });
}

module.exports = router;