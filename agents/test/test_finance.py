from decimal import Decimal

import pytest

from finantutor.domain.finance import calculate, number

BASE = {"cashflows": [-1000, 600, 600], "period": "year", "currency": "PEN"}


def test_known_npv_and_discounted_flows():
    result = calculate("npv", {**BASE, "rate": "0.10"})
    assert Decimal(result["npv"]) == Decimal("41.32231405")
    assert Decimal(result["discounted_flows"][0]) == -1000
    assert len(result["discounted_flows"]) == 3


def test_known_irr():
    result = calculate("irr", {**BASE, "cashflows": [-100, 110]})
    assert result["status"] == "ok"
    assert Decimal(result["irr"]) == Decimal("0.10000000")


def test_irr_reports_potential_multiple_roots():
    result = calculate("irr", {**BASE, "cashflows": [-100, 230, -132]})
    assert result["status"] == "ambiguous_cashflows"
    assert "irr" not in result


def test_irr_reports_no_root():
    assert calculate("irr", {**BASE, "cashflows": [100, 200]})["status"] == "no_root"


def test_annual_to_monthly_rate():
    result = calculate(
        "convert_rate",
        {"rate": "0.12", "source_periods_per_year": 1, "target_periods_per_year": 12},
    )
    assert abs(Decimal(result["rate"]) - Decimal("0.009488792934")) < Decimal("0.00000001")


def test_sensitivity_is_monotonic_for_standard_cash_flows():
    results = calculate("sensitivity", {**BASE, "rates": [0, ".10", ".20"]})["scenarios"]
    assert Decimal(results[0]["npv"]) > Decimal(results[1]["npv"]) > Decimal(results[2]["npv"])


@pytest.mark.parametrize("value", ["NaN", "Infinity", True, "abc", "1e100"])
def test_rejects_nonfinite_or_unbounded_inputs(value):
    with pytest.raises(ValueError):
        number(value)


@pytest.mark.parametrize(
    "fields",
    [{"rate": -1}, {"rate": 101}, {"rate": ".1", "period": "week"}, {"rate": ".1", "currency": ""}],
)
def test_requires_valid_assumptions(fields):
    with pytest.raises(ValueError):
        calculate("npv", {**BASE, **fields})
