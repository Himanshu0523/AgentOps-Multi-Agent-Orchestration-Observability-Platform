from pymongo import MongoClient
from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import settings
import logging

logger = logging.getLogger(__name__)

class MongoDB:
    """MongoDB connection manager for both Async (FastAPI) and Sync (LangGraph)"""
    _sync_client: MongoClient = None
    _async_client: AsyncIOMotorClient = None
    _sync_db = None
    _async_db = None

    @classmethod
    def connect_sync(cls):
        """Create synchronous MongoDB connection"""
        if cls._sync_client is None:
            cls._sync_client = MongoClient(settings.mongodb_uri)
            cls._sync_db = cls._sync_client.agentops
            logger.info("Sync MongoDB connected")
        return cls._sync_db

    @classmethod
    async def connect_async(cls):
        """Create asynchronous MongoDB connection"""
        if cls._async_client is None:
            cls._async_client = AsyncIOMotorClient(settings.mongodb_uri)
            cls._async_db = cls._async_client.agentops
            logger.info("Async MongoDB connected")
        return cls._async_db

    @classmethod
    async def connect(cls):
        return await cls.connect_async()

    @classmethod
    def get_sync_db(cls):
        if cls._sync_db is None:
            return cls.connect_sync()
        return cls._sync_db

    @classmethod
    def get_async_db(cls):
        if cls._async_db is None:
            cls._async_client = AsyncIOMotorClient(settings.mongodb_uri)
            cls._async_db = cls._async_client.agentops
        return cls._async_db

    @classmethod
    def get_db(cls):
        return cls.get_async_db()

    @classmethod
    def close_sync(cls):
        if cls._sync_client:
            cls._sync_client.close()
            cls._sync_client = None
            cls._sync_db = None

    @classmethod
    async def close_async(cls):
        if cls._async_client:
            cls._async_client.close()
            cls._async_client = None
            cls._async_db = None

    @classmethod
    async def close(cls):
        await cls.close_async()
        cls.close_sync()

# Create sync db singleton
sync_db = MongoDB.get_sync_db()
