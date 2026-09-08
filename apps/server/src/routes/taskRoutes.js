const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { protect } = require('../middleware/auth');
const { createTaskValidators, updateTaskValidators } = require('../validators/taskValidators');
const validate = require('../middleware/validate');

router.use(protect);

router.route('/')
  .post(createTaskValidators, validate, taskController.createTask)
  .get(taskController.getTasks);

router.route('/:id')
  .get(taskController.getTask)
  .patch(updateTaskValidators, validate, taskController.updateTask)
  .delete(taskController.deleteTask);

router.get('/:id/details', taskController.getTaskWithDetails);
router.get('/:id/agent-runs', taskController.getTaskAgentRuns);
router.get('/:id/traces', taskController.getTaskTraces);

router.post('/:id/pause', taskController.pauseTask);
router.post('/:id/resume', taskController.resumeTask);
router.post('/:id/cancel', taskController.cancelTask);
router.post('/:id/traces/:traceId/replay', taskController.replayTraceStep);

module.exports = router;
