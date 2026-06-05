const router = require('express').Router();

const contactsController = require('./contacts/contacts.controller');
const { protect } = require('../middlewares/auth.middleware');
const {
  validateCreateContact,
  validateUpdateContact,
} = require('./contacts/contacts.validation');

router.use(protect);

router
  .route('/')
  .post(validateCreateContact, contactsController.createContact)
  .get(contactsController.getContacts);

router
  .route('/:contactId')
  .get(contactsController.getContact)
  .patch(validateUpdateContact, contactsController.updateContact)
  .delete(contactsController.deleteContact);

module.exports = router;
