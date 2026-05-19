const router = require('express').Router();

const userRoutes = require('./user.routes');

router.get('/health', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'API is running'
  });
});

router.use('/users', userRoutes);

module.exports = router;
