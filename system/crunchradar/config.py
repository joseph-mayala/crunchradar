"""Settings come from environment variables (or a local .env file). Secrets are never in the code."""
import os
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv() -> None:
    f = ROOT / ".env"
    if not f.exists():
        return
    for line in f.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()


@dataclass
class Settings:
    # The 28 h limit: 1 credit = 40 notional hours (MQA). Classes and revision are TEAM ASSUMPTIONS.
    semester_start: date = field(default_factory=lambda: date.fromisoformat(os.getenv("SEMESTER_START", "2027-01-04")))
    weeks: int = 14
    credits: int = int(os.getenv("CREDITS", "21"))
    classes_h: float = float(os.getenv("CLASSES_H", "20"))
    revision_h: float = float(os.getenv("REVISION_H", "12"))
    avoid_weeks: tuple = (6, 10)        # Chinese New Year, Hari Raya (approx.)
    protected_weeks: tuple = (14,)      # revision week before finals
    holidays: dict = field(default_factory=lambda: {3: "Thaipusam (approx.)", 6: "Chinese New Year", 10: "Hari Raya Aidilfitri (approx.)"})
    gemini_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
    gemini_timeout: float = float(os.getenv("GEMINI_TIMEOUT", "8"))
    base_url: str = os.getenv("BASE_URL", "http://localhost:8000")
    secret: str = os.getenv("APP_SECRET", "dev-secret-change-me")
    db_path: str = os.getenv("CRUNCH_DB", str(ROOT / "crunchradar.db"))
    data_dir: Path = Path(os.getenv("DATA_DIR", str(ROOT / "data")))
    calendar_ics: str = os.getenv("CALENDAR_ICS", "")        # URL or file path; default = data/cohort.ics
    briefs_dir: str = os.getenv("BRIEFS_DIR", "")            # default = data/briefs
    programme_leader_email: str = os.getenv("PL_EMAIL", "programme.leader@example.edu")
    cohort_size: int = int(os.getenv("COHORT_SIZE", "52"))
    pulse_threshold: float = 0.30
    approval_ttl_hours: float = float(os.getenv("APPROVAL_TTL_HOURS", "72"))      # approval links stop working after this
    lecturer_ttl_days: float = float(os.getenv("LECTURER_TTL_DAYS", "14"))       # decline links stop working after this
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    mail_from: str = os.getenv("MAIL_FROM", "crunchradar@example.edu")
    lecturer_emails: dict = field(default_factory=dict)     # module id -> email; falls back to outbox

    @property
    def slt_per_week(self) -> float:
        return self.credits * 40 / self.weeks

    @property
    def limit(self) -> float:
        env = os.getenv("LIMIT_HOURS")
        return float(env) if env else round(self.slt_per_week - self.classes_h - self.revision_h)

    def ics_source(self) -> str:
        return self.calendar_ics or str(self.data_dir / "cohort.ics")

    def briefs_source(self) -> Path:
        return Path(self.briefs_dir) if self.briefs_dir else self.data_dir / "briefs"


def get_settings() -> Settings:
    return Settings()
