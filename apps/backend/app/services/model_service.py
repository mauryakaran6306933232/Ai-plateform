class ModelService:
    def __init__(self):
        self.active_model = "llama3" # Default model
        
    def set_model(self, model_name: str):
        self.active_model = model_name
        print(f"\n [ModelService] Active model changed to: {model_name}")
        
    def get_model(self) -> str:
        return self.active_model

# Singleton
model_service = ModelService()