const prisma = require('../../config/prisma');

const PDF_DOCUMENT_SELECT = {
  id: true,
  userId: true,
  fileName: true,
  filePath: true,
  extractedText: true,
  extractedData: true,
  createdAt: true,
  updatedAt: true,
};

const createPdfDocument = (data) => {
  return prisma.pdfDocument.create({
    data,
    select: PDF_DOCUMENT_SELECT,
  });
};

const getUserPdfDocuments = (userId) => {
  return prisma.pdfDocument.findMany({
    where: { userId },
    orderBy: {
      createdAt: 'desc',
    },
    select: PDF_DOCUMENT_SELECT,
  });
};

const getPdfDocumentById = (id) => {
  return prisma.pdfDocument.findUnique({
    where: { id },
    select: PDF_DOCUMENT_SELECT,
  });
};

const updatePdfDocument = (id, data) => {
  const allowedData = {};

  if (Object.prototype.hasOwnProperty.call(data, 'extractedData')) {
    allowedData.extractedData = data.extractedData;
  }

  return prisma.pdfDocument.update({
    where: { id },
    data: allowedData,
    select: PDF_DOCUMENT_SELECT,
  });
};

const deletePdfDocument = (id) => {
  return prisma.pdfDocument.delete({
    where: { id },
    select: PDF_DOCUMENT_SELECT,
  });
};

module.exports = {
  PDF_DOCUMENT_SELECT,
  createPdfDocument,
  getUserPdfDocuments,
  getPdfDocumentById,
  updatePdfDocument,
  deletePdfDocument,
};