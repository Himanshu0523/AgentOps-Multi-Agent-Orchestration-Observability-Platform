const express = require('express');
const router = express.Router();
const {
  getApprovals,
  createApproval,
  approveAction,
  rejectAction
} = require('../controllers/approvalController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getApprovals);
router.post('/', createApproval);
router.post('/:id/approve', approveAction);
router.post('/:id/reject', rejectAction);

module.exports = router;
