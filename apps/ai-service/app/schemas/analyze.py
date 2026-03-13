from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    message: str = Field(..., min_length=1)
    gameweek: int | None = Field(default=None, ge=1)


class AnalyzeResponse(BaseModel):
    queryType: str
    answer: str
    confidence: float