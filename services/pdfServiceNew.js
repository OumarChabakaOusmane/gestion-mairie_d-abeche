// Service de génération de PDF (désactivé)

class PdfGenerationError extends Error {
  constructor(message, code = 'PDF_GENERATION_ERROR', details = {}) {
    super(message);
    this.name = 'PdfGenerationError';
    this.code = code;
    this.details = details;
  }
}

const generatePdf = async (type, data) => {
  throw new PdfGenerationError('La génération de PDF est désactivée', 'PDF_GENERATION_DISABLED');
};

module.exports = {
  generatePdf,
  PdfGenerationError
};