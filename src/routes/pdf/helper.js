const crypto = require('crypto');

const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');

const EXTRACTED_TABLE_SELECT = {
  id: true,
  userId: true,
  sourceFileName: true,
  contentHash: true,
  title: true,
  tableHash: true,
  schemaHash: true,
  columns: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

const EXTRACTED_ROW_SELECT = {
  id: true,
  extractedTableId: true,
  rowHash: true,
  rowData: true,
  rowIndex: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const sortObjectKeys = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = sortObjectKeys(value[key]);
      return result;
    }, {});
};

const stableStringify = (value) => JSON.stringify(sortObjectKeys(value));

const hashValue = (value) => crypto.createHash('sha256').update(stableStringify(value)).digest('hex');

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : value);

const normalizeColumn = (column = {}) => ({
  title: normalizeString(column.title || ''),
  key: normalizeString(column.key || ''),
  dataType: normalizeString(column.dataType || 'string'),
});

const normalizeRow = (row = {}) => sortObjectKeys(row);

const normalizeColumns = (columns = []) => {
  return columns
    .map((column) => normalizeColumn(column))
    .sort((left, right) => {
      return (
        left.key.localeCompare(right.key) ||
        left.title.localeCompare(right.title) ||
        left.dataType.localeCompare(right.dataType)
      );
    });
};

const normalizeTableForHash = (table = {}) => {
  const columns = normalizeColumns(Array.isArray(table.columns) ? table.columns : []);
  const rows = Array.isArray(table.rows)
    ? table.rows.map((row) => normalizeRow(row)).sort((left, right) => {
        return stableStringify(left).localeCompare(stableStringify(right));
      })
    : [];

  return {
    title: normalizeString(table.title || ''),
    columns,
    rows,
  };
};

const normalizeExtractionForHash = (extractedData = {}) => {
  const tables = Array.isArray(extractedData.tables)
    ? extractedData.tables.map((table) => normalizeTableForHash(table)).sort((left, right) => {
        return (
          stableStringify(left.columns).localeCompare(stableStringify(right.columns)) ||
          stableStringify(left.rows).localeCompare(stableStringify(right.rows)) ||
          left.title.localeCompare(right.title)
        );
      })
    : [];

  return { tables };
};

const getExtractionContentHash = (extractedData) => hashValue(normalizeExtractionForHash(extractedData));

const getTableSchemaHash = (table) => {
  const normalizedColumns = normalizeColumns(Array.isArray(table?.columns) ? table.columns : []);
  return hashValue({ columns: normalizedColumns });
};

const getTableHash = (table) => hashValue(normalizeTableForHash(table));

const getRowHash = (schemaHash, row) => hashValue({ schemaHash, row: normalizeRow(row) });

const getExtractedTableBySchemaHash = (tx, userId, schemaHash) => {
  return tx.extractedTable.findFirst({
    where: { userId, schemaHash, isDeleted: false },
    select: { ...EXTRACTED_TABLE_SELECT, _count: { select: { extractedRows: { where: { isDeleted: false } } } } },
  });
};

const getExtractedTableById = (tx, tableId, userId = null) => {
  return tx.extractedTable.findFirst({
    where: {
      id: tableId,
      isDeleted: false,
      ...(userId ? { userId } : {}),
    },
    select: {
      ...EXTRACTED_TABLE_SELECT,
      extractedRows: {
        where: { isDeleted: false },
        orderBy: [{ rowIndex: 'asc' }, { createdAt: 'asc' }],
        select: EXTRACTED_ROW_SELECT,
      },
    },
  });
};

const getOwnedExtractedTable = (tableId, userId) => getExtractedTableById(prisma, tableId, userId);

const getExtractedTablesByUserId = (userId) => {
  return prisma.extractedTable.findMany({
    where: { userId, isDeleted: false },
    orderBy: [{ createdAt: 'asc' }, { updatedAt: 'asc' }],
    select: {
      ...EXTRACTED_TABLE_SELECT,
      extractedRows: {
        where: { isDeleted: false },
        orderBy: [{ rowIndex: 'asc' }, { createdAt: 'asc' }],
        select: EXTRACTED_ROW_SELECT,
      },
    },
  });
};

const buildTableShapeFromRecord = (tableRecord) => ({
  title: tableRecord.title || null,
  columns: tableRecord.columns,
  rows: Array.isArray(tableRecord.extractedRows)
    ? tableRecord.extractedRows.map((row) => row.rowData)
    : tableRecord.rows || [],
});

const refreshExtractedTableHashes = async (tx, tableId, tableRecord) => {
  const tableShape = buildTableShapeFromRecord(tableRecord);

  return tx.extractedTable.update({
    where: { id: tableId },
    data: {
      title: tableRecord.title || null,
      columns: tableRecord.columns,
      schemaHash: getTableSchemaHash(tableShape),
      tableHash: getTableHash(tableShape),
    },
    select: { id: true },
  });
};

const createManyExtractedRows = (tx, rows) => {
  if (!rows.length) {
    return Promise.resolve({ count: 0 });
  }

  return tx.extractedRow.createMany({ data: rows, skipDuplicates: true });
};

const createExtractedTable = async (data) => {
  const { userId, title, columns = [], rows = [], sourceFileName = null, contentHash = null } = data;
  const normalizedColumns = normalizeColumns(columns);
  const normalizedRows = Array.isArray(rows) ? rows.map((row) => normalizeRow(row)) : [];
  const tableShape = { title: title || null, columns: normalizedColumns, rows: normalizedRows };
  const schemaHash = getTableSchemaHash(tableShape);

  return prisma.extractedTable.create({
    data: {
      userId,
      sourceFileName,
      contentHash,
      title: title || null,
      tableHash: getTableHash(tableShape),
      schemaHash,
      columns: normalizedColumns,
      ...(normalizedRows.length > 0 && {
        extractedRows: {
          createMany: {
            data: normalizedRows.map((row, rowIndex) => ({
              rowIndex,
              rowHash: getRowHash(schemaHash, row),
              rowData: row,
            })),
            skipDuplicates: true,
          },
        },
      }),
    },
    select: {
      ...EXTRACTED_TABLE_SELECT,
      extractedRows: {
        where: { isDeleted: false },
        orderBy: [{ rowIndex: 'asc' }, { createdAt: 'asc' }],
        select: EXTRACTED_ROW_SELECT,
      },
    },
  });
};

const updateExtractedTableById = async (tableId, data, tableRecord) => {
  const nextTitle = Object.prototype.hasOwnProperty.call(data, 'title') ? data.title : tableRecord.title;
  const nextColumns = Array.isArray(data.columns) ? normalizeColumns(data.columns) : tableRecord.columns;
  const nextRows = Array.isArray(data.rows) ? data.rows.map((row) => normalizeRow(row)) : null;
  const columnsChanged = Array.isArray(data.columns);
  const rowsChanged = Array.isArray(data.rows);
  const hashesNeedRefresh = columnsChanged || rowsChanged;

  return prisma.$transaction(async (tx) => {
    const tableUpdate = hashesNeedRefresh
      ? refreshExtractedTableHashes(tx, tableId, {
          title: nextTitle || null,
          columns: nextColumns,
          rows: nextRows ?? tableRecord.extractedRows.map((row) => row.rowData),
        })
      : tx.extractedTable.update({
          where: { id: tableId },
          data: { title: nextTitle || null, columns: nextColumns },
          select: { id: true },
        });

    if (rowsChanged) {
      const schemaHash = nextRows.length > 0 ? getTableSchemaHash({ columns: nextColumns }) : null;

      await Promise.all([
        tableUpdate,
        tx.extractedRow.updateMany({
          where: { extractedTableId: tableId, isDeleted: false },
          data: { isDeleted: true },
        }),
      ]);

      if (schemaHash && nextRows.length > 0) {
        await tx.extractedRow.createMany({
          data: nextRows.map((row, rowIndex) => ({
            extractedTableId: tableId,
            rowIndex,
            rowHash: getRowHash(schemaHash, row),
            rowData: row,
          })),
          skipDuplicates: true,
        });
      }
    } else {
      await tableUpdate;
    }

    return getExtractedTableById(tx, tableId);
  });
};

const deleteExtractedTableById = async (tableId) => {
  return prisma.$transaction(async (tx) => {
    const [deletedTable] = await Promise.all([
      tx.extractedTable.update({
        where: { id: tableId },
        data: { isDeleted: true },
        select: EXTRACTED_TABLE_SELECT,
      }),
      tx.extractedRow.updateMany({
        where: { extractedTableId: tableId },
        data: { isDeleted: true },
      }),
    ]);

    return deletedTable;
  });
};

const createExtractedRowByTableId = async (tableId, rowData, tableRecord) => {
  const schemaHash = getTableSchemaHash({ columns: tableRecord.columns });
  const normalizedRow = normalizeRow(rowData);
  const rowHash = getRowHash(schemaHash, normalizedRow);

  const existingRow = tableRecord.extractedRows.find((row) => row.rowHash === rowHash) || null;

  if (existingRow) {
    return existingRow;
  }

  return prisma.$transaction(async (tx) => {
    const createdRow = await tx.extractedRow.create({
      data: {
        extractedTableId: tableId,
        rowIndex: tableRecord.extractedRows.length,
        rowHash,
        rowData: normalizedRow,
      },
      select: EXTRACTED_ROW_SELECT,
    });

    await refreshExtractedTableHashes(tx, tableId, {
      title: tableRecord.title || null,
      columns: tableRecord.columns,
      rows: [...tableRecord.extractedRows.map((r) => r.rowData), normalizedRow],
    });

    return createdRow;
  });
};

const updateExtractedRowById = async (tableId, rowId, rowData, tableRecord) => {
  const currentRow = tableRecord.extractedRows.find((row) => row.id === rowId);

  if (!currentRow) {
    return null;
  }

  const schemaHash = getTableSchemaHash({ columns: tableRecord.columns });
  const normalizedRow = normalizeRow(rowData);
  const rowHash = getRowHash(schemaHash, normalizedRow);

  const existingRow = tableRecord.extractedRows.find((row) => row.id !== rowId && row.rowHash === rowHash) || null;

  if (existingRow) {
    return existingRow;
  }

  return prisma.$transaction(async (tx) => {
    const updatedRow = await tx.extractedRow.update({
      where: { id: rowId },
      data: { rowHash, rowData: normalizedRow },
      select: EXTRACTED_ROW_SELECT,
    });

    await refreshExtractedTableHashes(tx, tableId, {
      title: tableRecord.title || null,
      columns: tableRecord.columns,
      rows: tableRecord.extractedRows.map((r) => (r.id === rowId ? normalizedRow : r.rowData)),
    });

    return updatedRow;
  });
};

const bulkUpdateExtractedRows = async (tableId, updates = {}, tableRecord) => {
  const schemaHash = getTableSchemaHash({ columns: tableRecord.columns });
  const rowIds = Object.keys(updates);

  return prisma.$transaction(async (tx) => {
    await Promise.all(
      rowIds.map((rowId) => {
        const existingRow = tableRecord.extractedRows.find((row) => row.id === rowId);
        const rowData = normalizeRow({
          ...((existingRow && existingRow.rowData) || {}),
          ...updates[rowId],
        });

        return tx.extractedRow.update({
          where: { id: rowId, extractedTableId: tableId, isDeleted: false },
          data: { rowData, rowHash: getRowHash(schemaHash, rowData) },
          select: { id: true },
        });
      })
    );

    await refreshExtractedTableHashes(tx, tableId, {
      title: tableRecord.title || null,
      columns: tableRecord.columns,
      rows: tableRecord.extractedRows.map((row) =>
        rowIds.includes(row.id)
          ? normalizeRow({ ...row.rowData, ...updates[row.id] })
          : row.rowData
      ),
    });

    return {
      count: rowIds.length,
      table: await getExtractedTableById(tx, tableId),
    };
  });
};


const bulkUpdateExtractedRowsSimple = async (tableId, rowIds = [], data = {}, tableRecord) => {
  const schemaHash = getTableSchemaHash({ columns: tableRecord.columns });
  const normalizedRow = normalizeRow(data);
  const rowHash = getRowHash(schemaHash, normalizedRow);

  try {
    const updated = await prisma.extractedRow.updateMany({
      where: { id: { in: rowIds }, extractedTableId: tableId, isDeleted: false },
      data: { rowData: normalizedRow, rowHash },
    });

    const table = await prisma.$transaction(async (tx) => {
      await refreshExtractedTableHashes(tx, tableId, {
        title: tableRecord.title || null,
        columns: tableRecord.columns,
        rows: tableRecord.extractedRows.map((row) => (rowIds.includes(row.id) ? normalizedRow : row.rowData)),
      });

      return getExtractedTableById(tx, tableId);
    });

    return { count: updated.count, table };
  } catch (err) {
    if (err && err.code === 'P2002') {
      // Fall back to per-row updates inside a fresh transaction
      return prisma.$transaction(async (tx) => {
        const schemaHashLocal = getTableSchemaHash({ columns: tableRecord.columns });

        await Promise.all(
          rowIds.map((rowId) => {
            const existingRow = tableRecord.extractedRows.find((row) => row.id === rowId);
            const rowDataLocal = normalizeRow({ ...((existingRow && existingRow.rowData) || {}), ...data });
            return tx.extractedRow.update({
              where: { id: rowId, extractedTableId: tableId, isDeleted: false },
              data: { rowData: rowDataLocal, rowHash: getRowHash(schemaHashLocal, rowDataLocal) },
              select: { id: true },
            });
          }),
        );

        await refreshExtractedTableHashes(tx, tableId, {
          title: tableRecord.title || null,
          columns: tableRecord.columns,
          rows: tableRecord.extractedRows.map((row) => (rowIds.includes(row.id) ? normalizeRow({ ...row.rowData, ...data }) : row.rowData)),
        });

        return {
          count: rowIds.length,
          table: await getExtractedTableById(tx, tableId),
        };
      });
    }

    throw err;
  }
};

const deleteExtractedRowById = async (tableId, rowId, tableRecord) => {
  return prisma.$transaction(async (tx) => {
    const deletedRow = await tx.extractedRow.update({
      where: { id: rowId },
      data: { isDeleted: true },
      select: EXTRACTED_ROW_SELECT,
    });

    await refreshExtractedTableHashes(tx, tableId, {
      title: tableRecord.title || null,
      columns: tableRecord.columns,
      rows: tableRecord.extractedRows.filter((row) => row.id !== rowId).map((row) => row.rowData),
    });

    return deletedRow;
  });
};

const deleteExtractedRowsByIds = async (tableId, rowIds = [], tableRecord) => {
  return prisma.$transaction(async (tx) => {
    const deleted = await tx.extractedRow.updateMany({
      where: { id: { in: rowIds }, extractedTableId: tableId, isDeleted: false },
      data: { isDeleted: true },
    });

    await refreshExtractedTableHashes(tx, tableId, {
      title: tableRecord.title || null,
      columns: tableRecord.columns,
      rows: tableRecord.extractedRows.filter((row) => !rowIds.includes(row.id)).map((row) => row.rowData),
    });

    return {
      count: deleted.count,
      table: await getExtractedTableById(tx, tableId),
    };
  });
};

const clearExtractedRowsByTableId = async (tableId, tableRecord) => {
  return prisma.$transaction(async (tx) => {
    const [deleted] = await Promise.all([
      tx.extractedRow.updateMany({
        where: { extractedTableId: tableId, isDeleted: false },
        data: { isDeleted: true },
      }),
      refreshExtractedTableHashes(tx, tableId, {
        title: tableRecord.title || null,
        columns: tableRecord.columns,
        rows: [],
      }),
    ]);

    return deleted;
  });
};

const replaceExtractedTableBulk = async (tableId, data, tableRecord) => {
  const nextTitle = Object.prototype.hasOwnProperty.call(data, 'title') ? data.title : tableRecord.title;
  const nextColumns = Array.isArray(data.columns) ? normalizeColumns(data.columns) : tableRecord.columns;
  const nextRows = Array.isArray(data.rows) ? data.rows.map((row) => normalizeRow(row)) : [];

  return prisma.$transaction(async (tx) => {
    await tx.extractedTable.update({
      where: { id: tableId },
      data: { title: nextTitle || null, columns: nextColumns },
      select: { id: true },
    });

    await tx.extractedRow.updateMany({
      where: { extractedTableId: tableId, isDeleted: false },
      data: { isDeleted: true },
    });

    if (nextRows.length > 0) {
      const schemaHash = getTableSchemaHash({ columns: nextColumns });

      await tx.extractedRow.createMany({
        data: nextRows.map((row, rowIndex) => ({
          extractedTableId: tableId,
          rowIndex,
          rowHash: getRowHash(schemaHash, row),
          rowData: row,
        })),
        skipDuplicates: true,
      });
    }

    const [, table] = await Promise.all([
      refreshExtractedTableHashes(tx, tableId, {
        title: nextTitle || null,
        columns: nextColumns,
        rows: nextRows,
      }),
      getExtractedTableById(tx, tableId),
    ]);

    return table;
  });
};

const processUploadedPdf = async ({ userId, fileName, filePath, extractedText, extractedData }) => {
  return prisma.$transaction(async (tx) => {
    const contentHash = getExtractionContentHash(extractedData);
    const tables = Array.isArray(extractedData?.tables) ? extractedData.tables : [];

    const normalizedTables = tables.map((table) => {
      const normalizedColumns = normalizeColumns(Array.isArray(table.columns) ? table.columns : []);
      const normalizedRows = Array.isArray(table.rows) ? table.rows.map((row) => normalizeRow(row)) : [];
      const schemaHash = getTableSchemaHash({ columns: normalizedColumns });
      return {
        title: table.title || null,
        normalizedColumns,
        normalizedRows,
        schemaHash,
        tableShape: { title: table.title || null, columns: normalizedColumns, rows: normalizedRows },
      };
    });

    const results = await Promise.all(
      normalizedTables.map(async ({ title, normalizedColumns, normalizedRows, schemaHash, tableShape }) => {
        const existingTable = await getExtractedTableBySchemaHash(tx, userId, schemaHash);

        const targetTable = existingTable || await tx.extractedTable.create({
          data: {
            userId,
            sourceFileName: fileName,
            contentHash,
            title,
            tableHash: getTableHash(tableShape),
            schemaHash,
            columns: normalizedColumns,
          },
          select: { ...EXTRACTED_TABLE_SELECT, _count: { select: { extractedRows: { where: { isDeleted: false } } } } },
        });

        const rowCount = existingTable ? existingTable._count.extractedRows : 0;

        const rows = normalizedRows.map((row, rowIndex) => ({
          extractedTableId: targetTable.id,
          rowHash: getRowHash(schemaHash, row),
          rowData: row,
          rowIndex: rowCount + rowIndex,
        }));

        const createdRows = await createManyExtractedRows(tx, rows);

        return {
          inserted: !existingTable,
          insertedRows: createdRows.count,
          totalRows: rows.length,
        };
      })
    );

    return results.reduce(
      (acc, r) => ({
        tableCount: tables.length,
        insertedTables: acc.insertedTables + (r.inserted ? 1 : 0),
        duplicateTables: acc.duplicateTables + (r.inserted ? 0 : 1),
        insertedRows: acc.insertedRows + r.insertedRows,
        duplicateRows: acc.duplicateRows + Math.max(r.totalRows - r.insertedRows, 0),
      }),
      { tableCount: tables.length, insertedTables: 0, duplicateTables: 0, insertedRows: 0, duplicateRows: 0 }
    );
  });
};

const getMergedExtractedDataByUser = async (userId) => {
  const tables = await prisma.extractedTable.findMany({
    where: { userId, isDeleted: false },
    orderBy: [{ createdAt: 'asc' }, { updatedAt: 'asc' }],
    select: {
      id: true,
      title: true,
      sourceFileName: true,
      schemaHash: true,
      columns: true,
      extractedRows: {
        where: { isDeleted: false },
        orderBy: [{ rowIndex: 'asc' }, { createdAt: 'asc' }],
        select: { rowData: true },
      },
    },
  });

  const mergedTables = new Map();

  for (const table of tables) {
    let mergedTable = mergedTables.get(table.schemaHash);

    if (!mergedTable) {
      mergedTable = {
        title: table.title,
        schemaHash: table.schemaHash,
        columns: table.columns,
        rows: [],
        sourceFileNamesSet: new Set(),
        sourceTableIdsSet: new Set(),
      };

      mergedTables.set(table.schemaHash, mergedTable);
    }

    mergedTable.sourceTableIdsSet.add(table.id);

    if (table.sourceFileName) {
      mergedTable.sourceFileNamesSet.add(table.sourceFileName);
    }

    if (!mergedTable.title && table.title) {
      mergedTable.title = table.title;
    }

    mergedTable.rows.push(...table.extractedRows.map((row) => row.rowData));
  }

  return {
    tables: Array.from(mergedTables.values()).map(({ sourceFileNamesSet, sourceTableIdsSet, ...table }) => ({
      ...table,
      sourceFileNames: Array.from(sourceFileNamesSet),
      sourceTableIds: Array.from(sourceTableIdsSet),
    })),
  };
};

module.exports = {
  EXTRACTED_TABLE_SELECT,
  EXTRACTED_ROW_SELECT,
  getExtractedTableById,
  getExtractedTablesByUserId,
  getOwnedExtractedTable,
  getExtractionContentHash,
  getTableSchemaHash,
  getTableHash,
  getRowHash,
  createManyExtractedRows,
  processUploadedPdf,
  getMergedExtractedDataByUser,
  createExtractedTable,
  updateExtractedTableById,
  deleteExtractedTableById,
  createExtractedRowByTableId,
  updateExtractedRowById,
  bulkUpdateExtractedRows,
  deleteExtractedRowById,
  deleteExtractedRowsByIds,
  clearExtractedRowsByTableId,
  replaceExtractedTableBulk,
  refreshExtractedTableHashes,
  getExtractedTableBySchemaHash,
  bulkUpdateExtractedRowsSimple,
};