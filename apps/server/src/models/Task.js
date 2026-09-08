const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    goal: {
      type: String,
      required: [true, 'Goal is required'],
      trim: true,
      maxlength: [2000, 'Goal cannot exceed 2000 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters']
    },
    status: {
      type: String,
      enum: ['pending', 'queued', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled', 'budget_exceeded'],
      default: 'pending',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    budget: {
      maxCost: {
        type: Number,
        default: 10,
        min: [0, 'Budget cannot be negative']
      },
      spentCost: {
        type: Number,
        default: 0,
        min: [0, 'Spent cost cannot be negative']
      },
      currency: {
        type: String,
        default: 'USD'
      }
    },
    config: {
      model: {
        type: String,
        default: 'gpt-4'
      },
      temperature: {
        type: Number,
        default: 0.7,
        min: 0,
        max: 2
      },
      maxRetries: {
        type: Number,
        default: 2,
        min: 0,
        max: 5
      },
      allowCodeExecution: {
        type: Boolean,
        default: false
      }
    },
    result: {
      type: mongoose.Schema.Types.Mixed
    },
    error: {
      message: String,
      stack: String,
      timestamp: Date
    },
    startedAt: Date,
    completedAt: Date,
    duration: {
      type: Number,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ userId: 1, createdAt: -1 });

taskSchema.pre('save', function (next) {
  if (this.startedAt && this.completedAt) {
    this.duration = this.completedAt - this.startedAt;
  }
  next();
});

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
