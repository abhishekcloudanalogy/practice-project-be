const contactsModel = require('./helper');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

const createContact = async (req, res, next) => {
  try {
    const contact = await contactsModel.createContact(req.user.id, req.body);

    return res.status(201).json(
      new ApiResponse(
        201,
        'Contact created successfully',
        contact
      )
    );
  } catch (error) {
    next(error);
  }
};

const getContacts = async (req, res, next) => {
  try {
    const contacts = await contactsModel.findContactsByUserId(req.user.id);

    return res.status(200).json(
      new ApiResponse(
        200,
        'Contacts fetched successfully',
        contacts
      )
    );
  } catch (error) {
    next(error);
  }
};

const getContact = async (req, res, next) => {
  try {
    const contact = await contactsModel.findContactByIdAndUserId(
      req.params.contactId,
      req.user.id
    );

    if (!contact) {
      return next(new ApiError(404, 'Contact not found'));
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        'Contact fetched successfully',
        contact
      )
    );
  } catch (error) {
    next(error);
  }
};

const updateContact = async (req, res, next) => {
  try {
    const result = await contactsModel.updateContact(
      req.params.contactId,
      req.user.id,
      req.body
    );

    if (result.count === 0) {
      return next(new ApiError(404, 'Contact not found'));
    }

    const contact = await contactsModel.findContactByIdAndUserId(
      req.params.contactId,
      req.user.id
    );

    return res.status(200).json(
      new ApiResponse(
        200,
        'Contact updated successfully',
        contact
      )
    );
  } catch (error) {
    next(error);
  }
};

const deleteContact = async (req, res, next) => {
  try {
    const result = await contactsModel.deleteContact(
      req.params.contactId,
      req.user.id
    );

    if (result.count === 0) {
      return next(new ApiError(404, 'Contact not found'));
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        'Contact deleted successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createContact,
  getContacts,
  getContact,
  updateContact,
  deleteContact,
};
