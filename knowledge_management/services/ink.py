import json

from rest_framework.exceptions import ValidationError

MAX_INK_BYTES = 500_000
MAX_POINTS = 8_000
MAX_CANVAS = 8_000


def validate_strokes(strokes):
    raw = json.dumps(strokes, ensure_ascii=False).encode("utf-8")
    if len(raw) > MAX_INK_BYTES:
        raise ValidationError({"strokes": "A drawing can be at most 500 KB."})
    if not isinstance(strokes, list):
        raise ValidationError({"strokes": "Strokes must be a list."})
    points = 0
    for stroke in strokes:
        coords = stroke.get("points") if isinstance(stroke, dict) else stroke
        if not isinstance(coords, list):
            raise ValidationError({"strokes": "Each stroke needs a list of points."})
        for point in coords:
            points += 1
            if points > MAX_POINTS:
                raise ValidationError({"strokes": f"A drawing can have at most {MAX_POINTS} points."})
            _point(point)
    return strokes


def _point(point):
    if isinstance(point, dict):
        pair = (point.get("x"), point.get("y"))
    elif isinstance(point, (list, tuple)) and len(point) >= 2:
        pair = (point[0], point[1])
    else:
        raise ValidationError({"strokes": "A point is {x, y} or [x, y]."})
    for value in pair:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValidationError({"strokes": "Point coordinates must be numbers."})
        if abs(value) > MAX_CANVAS:
            raise ValidationError({"strokes": f"Coordinates must stay within {MAX_CANVAS}."})


def canvas_size(value, name):
    if not isinstance(value, int) or isinstance(value, bool) or value < 1 or value > MAX_CANVAS:
        raise ValidationError({name: f"Use a size from 1 to {MAX_CANVAS}."})
    return value
