from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import settings
import logging

logger = logging.getLogger(__name__)

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None
    
    @classmethod
    async def connect(cls):
        """Connect to MongoDB"""
        try:
            cls.client = AsyncIOMotorClient(settings.mongodb_uri)
            cls.db = cls.client.agentops
            logger.info("Connected to MongoDB")
            
            # Verify replica set
            hello_response = await cls.client.admin.command('hello')
            if 'setName' in hello_response:
                logger.info(f"MongoDB Replica Set: {hello_response['setName']} ✓")
            else:
                logger.warning("MongoDB is not configured as a replica set")
                
        except Exception as e:
            logger.error(f"MongoDB connection error: {e}")
            raise
    
    @classmethod
    async def close(cls):
        """Close MongoDB connection"""
        if cls.client:
            cls.client.close()
            logger.info("MongoDB connection closed")
    
    @classmethod
    def get_db(cls):
        """Get database instance"""
        return cls.db

# Sync client for LangGraph (if needed)
from pymongo import MongoClient
sync_client = MongoClient(settings.mongodb_uri)
sync_db = sync_client.agentops