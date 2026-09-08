const express = require('express');
const router = express.Router();
const { getCostSummary, getTaskCost } = require('../controllers/costController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/summary', getCostSummary);
router.get('/tasks/:taskId', getTaskCost);

module.exports = router;
