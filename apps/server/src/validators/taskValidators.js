const { body } = require('express-validator');

const createTaskValidators = [
  body('goal')
    .notEmpty()
    .withMessage('Goal is required')
    .isLength({ max: 2000 })
    .withMessage('Goal cannot exceed 2000 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('Description cannot exceed 5000 characters')
    .trim(),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
  body('budget.maxCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget must be a positive number')
];

const updateTaskValidators = [
  body('goal')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Goal cannot exceed 2000 characters')
    .trim(),
  body('status')
    .optional()
    .isIn(['pending', 'queued', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled', 'budget_exceeded'])
    .withMessage('Invalid status'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high')
];

module.exports = {
  createTaskValidators,
  updateTaskValidators
};
