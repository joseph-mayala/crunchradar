"""One place that talks to the Gemini API: retries busy models and falls back to the next model before giving up."""
import json
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


def generate(payload: dict, s: Settings, timeout: float, sleep=time.sleep, urlopen=urllib.request.urlopen) -> dict:
    """POST generateContent. A busy or retired model moves straight on to the next one; a second pass retries after a short wait.
    Raises the last error if every model fails. The response carries '_model' (which one answered)."""
    last: Exception | None = None
    deadline = time.monotonic() + max(timeout, 1) * 2
    for pass_no in range(2):
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
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                last = e
        if pass_no == 0:
            sleep(1.0)
    raise last or RuntimeError("no Gemini model available")
