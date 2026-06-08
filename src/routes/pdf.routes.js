const router = require('express').Router();

const pdfController = require('./pdf/pdf.controller');
const { protect } = require('../middlewares/auth.middleware');
const {
  uploadPdf,
  validateUploadedPdf,
  validateExtractedData,
} = require('./pdf/pdf.validation');

router.use(protect);

router
  .route('/')
  .get(pdfController.getUserPdfs);

router
  .route('/upload')
  .post(uploadPdf, validateUploadedPdf, pdfController.uploadPdf);

router
  .route('/:id/extracted-data')
  .patch(validateExtractedData, pdfController.updatePdfExtractedData)
  .delete(pdfController.clearPdfExtractedData);

router
  .route('/:id')
  .get(pdfController.getPdf)
  .delete(pdfController.deletePdf);

module.exports = router;
