import pytest
from app.services.llm_service import LLMAnalysisService, LLMFormatError


def test_parse_valid_llm_json():
    raw = '{"candidate_name":"Ana Ribeiro","skills":["Python","SQL"],"years_experience":2,"fit_score":85,"summary":"Boa aderência técnica para a vaga proposta."}'
    result = LLMAnalysisService()._parse_and_validate(raw)
    assert result.fit_score == 85
    assert result.skills == ["Python", "SQL"]


def test_recover_json_inside_text():
    raw = 'resultado: {"candidate_name":"Ana Ribeiro","skills":["Python"],"years_experience":2,"fit_score":80,"summary":"A candidata apresenta aderência técnica consistente."}'
    result = LLMAnalysisService()._parse_and_validate(raw)
    assert result.candidate_name == "Ana Ribeiro"


def test_reject_invalid_llm_json_contract():
    raw = '{"candidate_name":"Ana","skills":[],"years_experience":2,"fit_score":120,"summary":"curto"}'
    with pytest.raises(LLMFormatError):
        LLMAnalysisService()._parse_and_validate(raw)


def test_mock_analysis_runs_without_api_key():
    result = LLMAnalysisService()._mock_analysis(
        "Nome: Ana Ribeiro. Desenvolvedora com 2 anos de experiência em Python, FastAPI, React, SQL e Git.",
        "Vaga para Python, FastAPI, Next.js, SQL e integração com LLM.",
    )
    assert result.fit_score >= 50
    assert "Python" in result.skills
