from app.schemas.analyze import AnalyzeRequest, AnalyzeResponse


def analyze_query(payload: AnalyzeRequest) -> AnalyzeResponse:
    return AnalyzeResponse(
        queryType="placeholder",
        answer=(
            "AI analysis scaffolding is ready. Business reasoning logic will be added "
            "in the next phase."
        ),
        confidence=0.2,
    )