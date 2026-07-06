const Financial = require('../models/financial');

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function sendError(res, error) {
  res.status(error.status || 500).json({
    error: error.status ? error.message : 'Financial request failed.'
  });
}

async function showFinancial(req, res, next) {
  try {
    const records = await Financial.listRecords();
    res.render('financial', {
      records,
      recordsJson: jsonForScript(records)
    });
  } catch (error) {
    next(error);
  }
}

async function createRecord(req, res) {
  try {
    const record = await Financial.createRecord(req.body, req.user);
    res.status(201).json({ record });
  } catch (error) {
    sendError(res, error);
  }
}

async function updateRecord(req, res) {
  try {
    const record = await Financial.updateRecord(req.params.id, req.body);
    res.json({ record });
  } catch (error) {
    sendError(res, error);
  }
}

async function deleteRecord(req, res) {
  try {
    await Financial.deleteRecord(req.params.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
}

module.exports = {
  showFinancial,
  createRecord,
  updateRecord,
  deleteRecord
};
