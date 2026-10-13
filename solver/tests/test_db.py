from datetime import UTC, date, datetime
from uuid import UUID

from solver.db import _camel


def test_rows_use_the_api_keys_and_plain_values():
    row = {
        "agent_id": UUID("15fef5fa-5e98-4718-b4cd-3dd8ed7bbe11"),
        "skill_id": None,
        "start_date": date(2026, 11, 2),
        "created_at": datetime(2026, 11, 2, 9, 0, tzinfo=UTC),
        "min_count": 2,
    }
    assert _camel(row) == {
        "agentId": "15fef5fa-5e98-4718-b4cd-3dd8ed7bbe11",
        "skillId": None,
        "startDate": "2026-11-02",
        "createdAt": "2026-11-02T09:00:00+00:00",
        "minCount": 2,
    }
