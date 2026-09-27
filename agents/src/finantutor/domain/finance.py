"""Cálculo financiero determinista; tasas efectivas expresadas como fracciones."""

from decimal import Decimal, InvalidOperation, localcontext
from typing import Any


def number(value: Any) -> Decimal:
    if isinstance(value, bool):
        raise ValueError("Se requiere un número, no un booleano.")
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError("Número inválido.") from None
    if not parsed.is_finite() or abs(parsed) > Decimal("1e15"):
        raise ValueError("Número no finito o fuera de rango.")
    return parsed


def cashflows(values: Any) -> list[Decimal]:
    if not isinstance(values, list) or not 2 <= len(values) <= 240:
        raise ValueError("Se requieren entre 2 y 240 flujos, incluyendo t=0.")
    return [number(value) for value in values]


def npv(flows: list[Decimal], rate: Decimal) -> Decimal:
    if rate <= -1 or rate > 100:
        raise ValueError("La tasa por período debe ser mayor que -1 y menor o igual a 100.")
    with localcontext() as context:
        context.prec = 40
        return sum((value / (1 + rate) ** period for period, value in enumerate(flows)), Decimal(0))


def format_number(value: Decimal) -> str:
    return (
        str(value.quantize(Decimal("0.00000001"))) if abs(value) < Decimal("1e25") else str(value)
    )


def calculate(operation: str, parameters: dict[str, Any]) -> dict[str, Any]:
    """Devuelve supuestos y resultados, sin ejecutar expresiones del usuario."""
    with localcontext() as context:
        context.prec = 40
        return _calculate(operation, parameters)


def _calculate(operation: str, p: dict[str, Any]) -> dict[str, Any]:
    if operation == "convert_rate":
        rate = number(p["rate"])
        source = number(p["source_periods_per_year"])
        target = number(p["target_periods_per_year"])
        if rate <= -1 or rate > 100 or not 0 < source <= 366 or not 0 < target <= 366:
            raise ValueError("Tasa o periodicidad inválida.")
        result = (1 + rate) ** (source / target) - 1
        return {
            "status": "ok",
            "rate": format_number(result),
            "convention": "effective_compound",
            "source_periods_per_year": str(source),
            "target_periods_per_year": str(target),
        }
    flows = cashflows(p.get("cashflows"))
    period = p.get("period")
    if period not in ("month", "quarter", "year"):
        raise ValueError("Especifica period: month, quarter o year.")
    currency = p.get("currency")
    if not isinstance(currency, str) or len(currency) != 3 or not currency.isalpha():
        raise ValueError("Especifica una moneda de tres letras, por ejemplo PEN.")
    base = {
        "period": period,
        "currency": currency.upper(),
        "cashflows": [str(x) for x in flows],
        "convention": "Flujo inicial t=0; flujos posteriores al final de cada período.",
    }
    if operation == "npv":
        rate = number(p["rate"])
        result = npv(flows, rate)
        discounted = [format_number(value / (1 + rate) ** i) for i, value in enumerate(flows)]
        return {
            **base,
            "status": "ok",
            "npv": format_number(result),
            "rate": str(rate),
            "discounted_flows": discounted,
        }
    if operation == "sensitivity":
        rates = p.get("rates")
        if not isinstance(rates, list) or not 1 <= len(rates) <= 20:
            raise ValueError("Indica entre 1 y 20 tasas.")
        return {
            **base,
            "status": "ok",
            "scenarios": [
                {"rate": str(number(r)), "npv": format_number(npv(flows, number(r)))} for r in rates
            ],
        }
    if operation != "irr":
        raise ValueError("Operación desconocida. Usa npv, irr, convert_rate o sensitivity.")
    nonzero = [x for x in flows if x != 0]
    changes = sum((a > 0) != (b > 0) for a, b in zip(nonzero, nonzero[1:]))
    if changes == 0:
        return {**base, "status": "no_root", "explanation": "No hay cambio de signo."}
    if changes > 1:
        return {
            **base,
            "status": "ambiguous_cashflows",
            "explanation": "Varios cambios de signo: puede haber múltiples TIR. Usa VAN y sensibilidad.",
        }
    low, high = Decimal("-0.9999"), Decimal(1)
    left, right = npv(flows, low), npv(flows, high)
    while left * right > 0 and high < 100:
        high = min(high * 2, Decimal(100))
        right = npv(flows, high)
    if left * right > 0:
        return {
            **base,
            "status": "no_bracket",
            "explanation": "Sin raíz en el intervalo de tasas [-0.9999, 100].",
        }
    for _ in range(200):
        middle = (low + high) / 2
        value = npv(flows, middle)
        if abs(value) < Decimal("1e-12") or high - low < Decimal("1e-14"):
            return {
                **base,
                "status": "ok",
                "irr": format_number(middle),
                "residual_npv": str(value),
            }
        if left * value <= 0:
            high = middle
        else:
            low, left = middle, value
    return {**base, "status": "not_converged"}
