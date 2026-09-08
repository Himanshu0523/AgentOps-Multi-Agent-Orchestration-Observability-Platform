import logging
from typing import Dict, Any, Tuple, Optional
from bson import ObjectId
from app.db.mongo_client import sync_db
from datetime import datetime

logger = logging.getLogger(__name__)

# Rates per 1,000,000 tokens in USD
MODEL_PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4": {"input": 30.00, "output": 60.00},
    "gpt-4-turbo": {"input": 10.00, "output": 30.00},
    "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
    "claude-3-5-sonnet": {"input": 3.00, "output": 15.00},
    "default": {"input": 2.00, "output": 8.00},
}

class PricingEngine:
    """Pricing Engine for real-time LLM cost tracking and budget governance"""

    def estimate_tokens(self, text: Optional[str]) -> int:
        """Estimate token count from text using character heuristics (~4 chars/token)"""
        if not text:
            return 0
        return max(1, len(str(text)) // 4)

    def calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> Dict[str, Any]:
        """
        Calculates exact dollar cost based on model and token counts.
        """
        rates = MODEL_PRICING.get(model.lower(), MODEL_PRICING["default"])
        input_cost = (input_tokens / 1_000_000.0) * rates["input"]
        output_cost = (output_tokens / 1_000_000.0) * rates["output"]
        total_cost = round(input_cost + output_cost, 6)

        return {
            "tokens": {
                "input": input_tokens,
                "output": output_tokens,
                "total": input_tokens + output_tokens
            },
            "amount": total_cost,
            "currency": "USD"
        }

    def check_and_enforce_budget(self, task_id: str, new_cost: float = 0.0) -> Tuple[bool, float, float]:
        """
        Verifies if task execution exceeds configured maxCost limit.
        Returns: (is_exceeded: bool, spent_cost: float, max_cost: float)
        """
        try:
            t_oid = ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id
            task = sync_db.tasks.find_one({"_id": t_oid})
            if not task:
                return False, 0.0, 0.0

            budget = task.get("budget", {})
            max_cost = float(budget.get("maxCost", 5.0) or 5.0)
            spent_cost = float(budget.get("spentCost", 0.0) or 0.0) + new_cost

            # Update spent cost on task
            sync_db.tasks.update_one(
                {"_id": t_oid},
                {"$set": {"budget.spentCost": round(spent_cost, 6)}}
            )

            # Hard Limit Check
            if max_cost > 0 and spent_cost >= max_cost:
                logger.warning(f"Task {task_id} budget exceeded! Spent: ${spent_cost:.4f} >= Limit: ${max_cost:.4f}")
                sync_db.tasks.update_one(
                    {"_id": t_oid},
                    {"$set": {"status": "budget_exceeded", "updatedAt": datetime.now()}}
                )
                return True, spent_cost, max_cost

            return False, spent_cost, max_cost
        except Exception as e:
            logger.error(f"Error checking budget for task {task_id}: {e}")
            return False, 0.0, 0.0

pricing_engine = PricingEngine()
