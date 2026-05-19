const router = require('express').Router();

router.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    data: []
  });
});

module.exports = router;
