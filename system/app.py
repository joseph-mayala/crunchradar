"""Vercel entry point. Vercel looks for a FastAPI instance named `app` in this file and runs it as one function.

Locally nothing changes: `python -m crunchradar serve` still starts the same app.
"""
from crunchradar.api import create_app

app = create_app()
