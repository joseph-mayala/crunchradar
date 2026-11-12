"""One place that talks to the Gemini API: retries busy models and falls back to the next model before giving up."""
import json
import re
import time
import urllib.error
import urllib.request

from .config import Settings

FALLBACK_MODELS = ["gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-flash-latest"]
RETRY_CODES = (429, 500, 502, 503, 504)


def models_to_try(s: Settings) -> list[str]:
    seen, out = set(), []
    for m in [s.gemini_model, *FALLBACK_MODELS]:
        if m and m not in seen:
            seen.add(m)
            out.append(m)
    return out


def _retry_delay(err: urllib.error.HTTPError) -> float | None:
    """Seconds Gemini asks us to wait on a 429 ('retryDelay': '12s'), if it says."""
    try:
        body = json.loads(err.read().decode("utf-8", "replace"))
        for d in body.get("error", {}).get("details", []):
            m = re.match(r"^([\d.]+)s$", str(d.get("retryDelay", "")))
            if m:
                return float(m.group(1))
    except Exception:  # noqa: BLE001 - the body is optional
        pass
    return None


def generate(payload: dict, s: Settings, timeout: float, sleep=time.sleep, urlopen=urllib.request.urlopen) -> dict:
    """POST generateContent. A busy, retired or rate-limited model moves straight on to the next one. If every model says 'too many requests',
    wait as long as Gemini asks (up to 15 s) and go round again, up to three passes, within an overall deadline.
    Raises the last error if everything fails. The response carries '_model' (which one answered)."""
    last: Exception | None = None
    deadline = time.monotonic() + max(timeout, 1) * 3
    for pass_no in range(3):
        wait = 1.0
        for model in models_to_try(s):
            left = deadline - time.monotonic()
            if left <= 0:
                raise last or TimeoutError("Gemini deadline reached")
            req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", data=json.dumps(payload).encode(),
                                         headers={"Content-Type": "application/json", "x-goog-api-key": s.gemini_key})
            try:
                with urlopen(req, timeout=min(timeout, left)) as r:  # noqa: S310
                    data = json.load(r)
                data["_model"] = model
                return data
            except urllib.error.HTTPError as e:
                last = e
                if e.code == 429:
                    d = _retry_delay(e)
                    if d is not None:
                        wait = max(wait, min(d, 15.0))
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                last = e
        if pass_no < 2:
            sleep(wait)
    raise last or RuntimeError("no Gemini model available")
