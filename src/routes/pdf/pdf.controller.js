const fs = require('fs');

const pdfModel = require('./helper');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { extractPdfText } = require('../../utils/pdfExtractor');
const { extractWithGroq } = require('../../utils/groqClient');

const removeLocalFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const uploadPdf = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return next(new ApiError(400, 'PDF file is required'));
    }

    let extractedText;
    let extractedData;

    try {
      extractedText = await extractPdfText(file.path);
    } catch (error) {
      removeLocalFile(file.path);
      return next(new ApiError(422, 'PDF parsing failed'));
    }

    try {
      extractedData = await extractWithGroq(extractedText);
    } catch (error) {
      removeLocalFile(file.path);
      const statusCode = error.statusCode || 502;
      const message =
        statusCode === 401 || statusCode === 403
          ? 'Groq API authentication failed'
          : statusCode === 429
            ? 'Groq API rate limit exceeded'
            : error.message || 'Groq API failure';

      return next(new ApiError(502, message));
    }

    const savedPdf = await pdfModel.createPdfDocument({
      userId,
      fileName: file.originalname,
      filePath: file.path,
      extractedText,
      extractedData,
    });

    return res.status(201).json(
      new ApiResponse(
        201,
        'PDF extracted successfully',
        savedPdf
      )
    );
  } catch (error) {
    if (req.file?.path) {
      removeLocalFile(req.file.path);
    }

    next(error);
  }
};

const getUserPdfs = async (req, res, next) => {
  try {
    const pdfDocuments = await pdfModel.getUserPdfDocuments(req.user.id);

    return res.status(200).json(
      new ApiResponse(
        200,
        'PDFs fetched successfully',
        pdfDocuments
      )
    );
  } catch (error) {
    next(error);
  }
};

const getPdf = async (req, res, next) => {
  try {
    const pdfDocument = await pdfModel.getPdfDocumentById(req.params.id);

    if (!pdfDocument) {
      return next(new ApiError(404, 'PDF not found'));
    }

    if (pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        'PDF fetched successfully',
        pdfDocument
      )
    );
  } catch (error) {
    next(error);
  }
};

const deletePdf = async (req, res, next) => {
  try {
    const pdfDocument = await pdfModel.getPdfDocumentById(req.params.id);

    if (!pdfDocument) {
      return next(new ApiError(404, 'PDF not found'));
    }

    if (pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    const deletedPdf = await pdfModel.deletePdfDocument(req.params.id);
    removeLocalFile(deletedPdf.filePath);

    return res.status(200).json(
      new ApiResponse(
        200,
        'PDF deleted successfully',
        deletedPdf
      )
    );
  } catch (error) {
    next(error);
  }
};

const updatePdfExtractedData = async (req, res, next) => {
  try {
    const pdfDocument = await pdfModel.getPdfDocumentById(req.params.id);

    if (!pdfDocument) {
      return next(new ApiError(404, 'PDF not found'));
    }

    if (pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    if (!Object.prototype.hasOwnProperty.call(req.body, 'extractedData')) {
      return next(new ApiError(400, 'extractedData is required'));
    }

    const updatedPdf = await pdfModel.updatePdfDocument(req.params.id, {
      extractedData: req.body.extractedData,
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        'PDF extracted data updated successfully',
        updatedPdf
      )
    );
  } catch (error) {
    next(error);
  }
};

const clearPdfExtractedData = async (req, res, next) => {
  try {
    const pdfDocument = await pdfModel.getPdfDocumentById(req.params.id);

    if (!pdfDocument) {
      return next(new ApiError(404, 'PDF not found'));
    }

    if (pdfDocument.userId !== req.user.id) {
      return next(new ApiError(403, 'Forbidden'));
    }

    const updatedPdf = await pdfModel.updatePdfDocument(req.params.id, {
      extractedData: null,
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        'PDF extracted data cleared successfully',
        updatedPdf
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadPdf,
  getUserPdfs,
  getPdf,
  deletePdf,
  updatePdfExtractedData,
  clearPdfExtractedData,
};
