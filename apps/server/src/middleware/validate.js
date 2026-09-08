const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    throw new ApiError(400, 'Validation Error', true, JSON.stringify({
      errors: errorMessages
    }));
  }
  next();
};

module.exports = validate;
