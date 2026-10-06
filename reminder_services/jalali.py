"""Gregorian → Jalali date (no extra dependency)."""

from datetime import date

MONTHS_FA = [
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
]
_FA_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


def to_jalali(value: date) -> tuple[int, int, int]:
    gy, gm, gd = value.year, value.month, value.day
    g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    gy2 = gy + 1 if gm > 2 else gy
    days = 355666 + 365 * gy + (gy2 + 3) // 4 - (gy2 + 99) // 100 + (gy2 + 399) // 400 + gd + g_d_m[gm - 1]
    jy = -1595 + 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        jm, jd = 1 + days // 31, 1 + days % 31
    else:
        jm, jd = 7 + (days - 186) // 30, 1 + (days - 186) % 30
    return jy, jm, jd


def fa_digits(text) -> str:
    return str(text).translate(_FA_DIGITS)


def format_fa(value: date) -> str:
    """۱۴ مهر ۱۴۰۵"""
    jy, jm, jd = to_jalali(value)
    return f"{fa_digits(jd)} {MONTHS_FA[jm - 1]} {fa_digits(jy)}"
