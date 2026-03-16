from fastapi import APIRouter, HTTPException

from app.agents.qa_orchestrator import QuestionOrchestrator
from app.schemas.ask import AskRequest, AskResponse
from app.schemas.analyze import AnalyzeRequest, AnalyzeResponse
from app.services.analyzer import analyze_query
from app.tools.backend_client import BackendApiError
from app.tools.fantasy_tools import ToolInputError


router = APIRouter()
orchestrator = QuestionOrchestrator()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-service"}


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    return analyze_query(payload)


@router.post("/ask", response_model=AskResponse)
async def ask(payload: AskRequest) -> AskResponse:
    try:
        return await orchestrator.ask(payload.question)
    except ToolInputError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except BackendApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to process question") from exc