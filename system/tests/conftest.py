import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.pop("GEMINI_API_KEY", None)

from crunchradar.config import Settings  # noqa: E402
from crunchradar.store import Store  # noqa: E402
from crunchradar.workflows import System  # noqa: E402


@pytest.fixture
def sysm(tmp_path):
    s = Settings(db_path=str(tmp_path / "t.db"), gemini_key="", secret="test-secret", base_url="http://test")
    return System(s, Store(s.db_path))
