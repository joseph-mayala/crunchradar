"""Serve the built web app (system/web/dist) from the same process.

Browsers asking for HTML get the app, so emailed links such as /approve/<token> open the React page. Everything else (curl, the JSON
endpoints, /api, /docs, form posts) is untouched. With no build present this does nothing and the server-rendered pages keep working.
The original server-rendered dashboard stays at /classic.
"""
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

NOT_SPA = ("/api", "/assets", "/docs", "/redoc", "/openapi.json", "/healthz", "/classic", "/workflows", "/pulse")


def dist_dir() -> Path:
    return Path(os.getenv("SPA_DIST") or Path(__file__).resolve().parent.parent / "web" / "dist")


def mount(app: FastAPI, classic_dashboard) -> bool:
    dist = dist_dir()
    index = dist / "index.html"
    if not index.exists():
        return False
    if (dist / "assets").exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")
    app.add_api_route("/classic", classic_dashboard, methods=["GET"], response_class=HTMLResponse, include_in_schema=False)

    @app.middleware("http")
    async def spa_for_browsers(request: Request, call_next):
        path = request.url.path
        wants_html = "text/html" in request.headers.get("accept", "")
        if request.method == "GET" and not path.startswith(NOT_SPA):
            static = dist / path.lstrip("/")
            if path != "/" and static.is_file() and dist in static.resolve().parents:   # icon.svg and other built files
                return FileResponse(static)
            if wants_html:
                return FileResponse(index, headers={"Cache-Control": "no-cache"})
        return await call_next(request)

    return True
