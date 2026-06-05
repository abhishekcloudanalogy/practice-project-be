const prisma = require('../../config/prisma');
const { CONTACT_SELECT } = require('../contactus/helper');

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  password: true,
  image: true,
  role: true,
  isActive: true,
  authProvider: true,
  providerAccountId: true,
  createdAt: true,
  updatedAt: true,
};

const findUserByEmail = (email) => {
  return prisma.user.findUnique({
    where: { email },
    select: USER_SELECT,
  });
};

const findUserByProviderAccount = (authProvider, providerAccountId) => {
  return prisma.user.findFirst({
    where: {
      authProvider,
      providerAccountId,
    },
    select: USER_SELECT,
  });
};

const findUserById = (id) => {
  return prisma.user.findUnique({
    where: { id },
    select: USER_SELECT,
  });
};

const findUserByIdWithContacts = (id) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      ...USER_SELECT,
      contacts: {
        orderBy: {
          createdAt: 'desc',
        },
        select: CONTACT_SELECT,
      },
    },
  });
};

const findUserContactsByUserId = (userId) => {
  return prisma.userContact.findMany({
    where: { userId },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      primaryContact: true,
      secondaryContact: true,
      company: true,
      notes: true,
      contactType: true,
      userId: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });
};

const createUser = (data) => {
  return prisma.user.create({
    data,
    select: USER_SELECT,
  });
};

const updateUser = (id, data) => {
  return prisma.user.update({
    where: { id },
    data,
    select: USER_SELECT,
  });
};

const createRefreshToken = ({ userId, token, expiresAt }) => {
  return prisma.refreshToken.create({
    data: {
      user: { connect: { id: userId } },
      token,
      expiresAt,
    },
  });
};

const findRefreshTokenByToken = (token) => {
  return prisma.refreshToken.findUnique({
    where: { token },
    include: {
      user: true,
    },
  });
};

const findActiveRefreshTokenByUserId = (userId) => {
  return prisma.refreshToken.findFirst({
    where: { userId, revoked: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
};

const revokeRefreshToken = (token) => {
  return prisma.refreshToken.updateMany({
    where: { token, revoked: false },
    data: { revoked: true },
  });
};

const revokeAllRefreshTokensForUser = (userId) => {
  return prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });
};

const updateUserActiveStatus = (userId, isActive) => {
  return prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: USER_SELECT,
  });
};

const findAdminsByRole = (role) => {
  return prisma.user.findMany({
    where: { role },
    select: USER_SELECT,
    orderBy: { createdAt: 'desc' },
  });
};

const findAllUsers = (includeSuperAdmin = false) => {
  return prisma.user.findMany({
    where: includeSuperAdmin ? {} : { role: { in: ['USER', 'ADMIN'] } },
    select: USER_SELECT,
    orderBy: { createdAt: 'desc' },
  });
};

module.exports = {
  USER_SELECT,
  findUserByEmail,
  findUserByProviderAccount,
  findUserById,
  findUserByIdWithContacts,
  findUserContactsByUserId,
  createUser,
  updateUser,
  createRefreshToken,
  findRefreshTokenByToken,
  findActiveRefreshTokenByUserId,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
  updateUserActiveStatus,
  findAdminsByRole,
  findAllUsers,
};
