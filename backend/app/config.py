import os

class Settings:
    PROJECT_NAME: str = "AEGIS-X Autonomous Financial Crime OS"
    API_PORT: int = 8000
    HOST: str = "127.0.0.1"
    
    # Optional API key for LLM integrations
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

settings = Settings()
