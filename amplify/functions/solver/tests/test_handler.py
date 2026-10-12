from solver.handler import handler


def test_handler_solves_trivial_model():
    result = handler({}, None)
    assert result["status"] == "OPTIMAL"
