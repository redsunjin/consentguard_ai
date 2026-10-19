"""
FastAPI Main Entrypoint for ConsentGuard AI Backend
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.clauses import router as clauses_router
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="개인 동의서 및 약관 리스크 실시간 방어 AI 에이전트 백엔드 API (Zero-Retention)",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clauses_router)


@app.get("/health", tags=["system"])
async def health_check():
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "zero_retention": True,
        "disclaimer": "본 서비스는 공정거래위원회 표준약관 기준에 따른 텍스트 요약 도구이며, 법률 자문을 대신하지 않습니다.",
    }
