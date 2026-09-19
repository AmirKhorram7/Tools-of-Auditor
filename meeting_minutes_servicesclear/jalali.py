"""Gregorian → Jalali year (no extra dependency)."""

from datetime import date

_G_DAY_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]


def jalali_year(value: date) -> int:
    """Return the Jalali calendar year for a Gregorian date (e.g. 2026-09-19 → 1405)."""
    gy, gm, gd = value.year, value.month, value.day
    if gy > 1600:
        jy = 979
        gy -= 1600
    else:
        jy = 0
        gy -= 621
    gy2 = gy + 1 if gm > 2 else gy
    days = (
        (365 * gy)
        + ((gy2 + 3) // 4)
        - ((gy2 + 99) // 100)
        + ((gy2 + 399) // 400)
        - 80
        + gd
        + _G_DAY_MONTH[gm - 1]
    )
    jy += 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
    return jy
