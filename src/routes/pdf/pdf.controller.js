const pdfModel = require('./helper');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const fs = require('fs');
const { extractPdfText } = require('../../utils/pdfExtractor');
const { extractWithGroq } = require('../../utils/groqClient');

const removeLocalFile = (filePath) => {
  if (!filePath) {
    return;
  }

  fs.unlink(filePath, () => {});
};

const getOwnedTable = async (tableId, userId, next, notFoundMessage = 'Table not found') => {
  const table = await pdfModel.getOwnedExtractedTable(tableId, userId);

  if (!table) {
    next(new ApiError(404, notFoundMessage));
    return null;
  }

  return table;
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

    const result = await pdfModel.processUploadedPdf({
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
        {
          tableCount: result.tableCount,
          insertedTables: result.insertedTables,
          duplicateTables: result.duplicateTables,
          insertedRows: result.insertedRows,
          duplicateRows: result.duplicateRows,
        }
      )
    );
  } catch (error) {
    next(error);
  }
};

const getMergedExtractedData = async (req, res, next) => {
  try {
    const mergedData = await pdfModel.getMergedExtractedDataByUser(req.user.id);

    return res.status(200).json(
      new ApiResponse(
        200,
        'Merged extracted data fetched successfully',
        mergedData
      )
    );
  } catch (error) {
    next(error);
  }
};

const getPdfTables = async (req, res, next) => {
  try {
    const tables = await pdfModel.getExtractedTablesByUserId(req.user.id);

    return res.status(200).json(
      new ApiResponse(
        200,
        'PDF tables fetched successfully',
        tables
      )
    );
  } catch (error) {
    next(error);
  }
};

const createPdfTable = async (req, res, next) => {
  try {
    const { title, columns = [], rows = [] } = req.body;

    const createdTable = await pdfModel.createExtractedTable({
      userId: req.user.id,
      sourceFileName: null,
      contentHash: null,
      title,
      columns,
      rows,
    });

    return res.status(201).json(
      new ApiResponse(
        201,
        'Table created successfully',
        createdTable
      )
    );
  } catch (error) {
    next(error);
  }
};

const updatePdfTable = async (req, res, next) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id, next);
    if (!table) return;

    const updatedTable = await pdfModel.updateExtractedTableById(req.params.tableId, req.body, table);

    return res.status(200).json(
      new ApiResponse(
        200,
        'Table updated successfully',
        updatedTable
      )
    );
  } catch (error) {
    next(error);
  }
};

const replacePdfTable = async (req, res, next) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id, next);
    if (!table) return;

    const replacedTable = await pdfModel.replaceExtractedTableBulk(req.params.tableId, req.body, table);

    return res.status(200).json(
      new ApiResponse(
        200,
        'Table replaced successfully',
        replacedTable
      )
    );
  } catch (error) {
    next(error);
  }
};

const deletePdfTable = async (req, res, next) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id, next);
    if (!table) return;

    const deletedTable = await pdfModel.deleteExtractedTableById(req.params.tableId);

    return res.status(200).json(
      new ApiResponse(
        200,
        'Table deleted successfully',
        deletedTable
      )
    );
  } catch (error) {
    next(error);
  }
};

const createPdfTableRow = async (req, res, next) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id, next);
    if (!table) return;

    const createdRow = await pdfModel.createExtractedRowByTableId(req.params.tableId, req.body.rowData, table);

    return res.status(201).json(
      new ApiResponse(
        201,
        'Row created successfully',
        createdRow
      )
    );
  } catch (error) {
    next(error);
  }
};

const updatePdfTableRow = async (req, res, next) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id, next);
    if (!table) return;

    const updatedRow = await pdfModel.updateExtractedRowById(req.params.tableId, req.params.rowId, req.body.rowData, table);

    return res.status(200).json(
      new ApiResponse(
        200,
        'Row updated successfully',
        updatedRow
      )
    );
  } catch (error) {
    next(error);
  }
};

const bulkUpdatePdfTableRows = async (req, res, next) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id, next);
    if (!table) return;

    // Support two payload shapes:
    // 1) Detailed per-row updates: { updates: { rowId: { col: value, ... }, ... } }
    // 2) Simple same-update for all selected rows: { rowIds: [...], data: { col: value, ... } }
    let result;
    if (Array.isArray(req.body.rowIds) && req.body.rowIds.length > 0 && req.body.data && typeof req.body.data === 'object') {
      result = await pdfModel.bulkUpdateExtractedRowsSimple(req.params.tableId, req.body.rowIds, req.body.data, table);
    } else {
      result = await pdfModel.bulkUpdateExtractedRows(req.params.tableId, req.body.updates, table);
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        'Rows updated successfully',
        result
      )
    );
  } catch (error) {
    next(error);
  }
};

const bulkDeletePdfTableRows = async (req, res, next) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id, next);
    if (!table) return;

    const result = await pdfModel.deleteExtractedRowsByIds(req.params.tableId, req.body.rowIds, table);

    return res.status(200).json(
      new ApiResponse(
        200,
        'Rows deleted successfully',
        result
      )
    );
  } catch (error) {
    next(error);
  }
};

const deletePdfTableRow = async (req, res, next) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id, next);
    if (!table) return;

    const deletedRow = await pdfModel.deleteExtractedRowById(req.params.tableId, req.params.rowId, table);

    if (!deletedRow) {
      return next(new ApiError(404, 'Row not found'));
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        'Row deleted successfully',
        deletedRow
      )
    );
  } catch (error) {
    next(error);
  }
};

const clearPdfTableRows = async (req, res, next) => {
  try {
    const table = await getOwnedTable(req.params.tableId, req.user.id, next);
    if (!table) return;

    const cleared = await pdfModel.clearExtractedRowsByTableId(req.params.tableId, table);

    return res.status(200).json(
      new ApiResponse(
        200,
        'Table rows cleared successfully',
        cleared
      )
    );
  } catch (error) {
    next(error);
  }
};

const getUserPdfs = async (req, res, next) => {
  try {
    const tables = await pdfModel.getExtractedTablesByUserId(req.user.id);

    return res.status(200).json(
      new ApiResponse(
        200,
        'PDFs fetched successfully',
        tables
      )
    );
  } catch (error) {
    next(error);
  }
};

const getPdf = async (req, res, next) => {
  try {
    const tableId = req.params.tableId || req.params.id;
    const table = await pdfModel.getOwnedExtractedTable(tableId, req.user.id);

    if (!table) {
      return next(new ApiError(404, 'PDF not found'));
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        'PDF fetched successfully',
        table
      )
    );
  } catch (error) {
    next(error);
  }
};

const deletePdf = async (req, res, next) => {
  try {
    const tableId = req.params.tableId || req.params.id;
    const table = await pdfModel.getOwnedExtractedTable(tableId, req.user.id);

    if (!table) {
      return next(new ApiError(404, 'PDF not found'));
    }

    const deletedPdf = await pdfModel.deleteExtractedTableById(tableId);

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

module.exports = {
  uploadPdf,
  getUserPdfs,
  getMergedExtractedData,
  getPdfTables,
  createPdfTable,
  updatePdfTable,
  replacePdfTable,
  deletePdfTable,
  createPdfTableRow,
  updatePdfTableRow,
  bulkUpdatePdfTableRows,
  bulkDeletePdfTableRows,
  deletePdfTableRow,
  clearPdfTableRows,
  getPdf,
  deletePdf,
};
