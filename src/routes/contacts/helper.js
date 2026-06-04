const prisma = require('../../config/prisma');

const USER_CONTACT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  primaryContact: true,
  secondaryContact: true,
  contactType: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
};

const createContact = (userId, data) => {
  return prisma.userContact.create({
    data: {
      ...data,
      userId,
    },
    select: USER_CONTACT_SELECT,
  });
};

const findContactsByUserId = (userId) => {
  return prisma.userContact.findMany({
    where: { userId },
    orderBy: {
      createdAt: 'desc',
    },
    select: USER_CONTACT_SELECT,
  });
};

const findContactByIdAndUserId = (id, userId) => {
  return prisma.userContact.findFirst({
    where: {
      id,
      userId,
    },
    select: USER_CONTACT_SELECT,
  });
};

const updateContact = (id, userId, data) => {
  return prisma.userContact.updateMany({
    where: {
      id,
      userId,
    },
    data,
  });
};

const deleteContact = (id, userId) => {
  return prisma.userContact.deleteMany({
    where: {
      id,
      userId,
    },
  });
};

module.exports = {
  USER_CONTACT_SELECT,
  createContact,
  findContactsByUserId,
  findContactByIdAndUserId,
  updateContact,
  deleteContact,
};
