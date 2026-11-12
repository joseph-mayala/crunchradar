from dataclasses import dataclass, replace, asdict
from typing import Optional

TYPES = ("code", "report", "presentation", "test", "quiz", "logbook")


@dataclass(frozen=True)
class Assessment:
    id: str
    mod: str
    title: str
    type: str
    weight: float = 0
    words: int = 0
    group: bool = False
    due: int = 1
    fixed: bool = False              # test dates set by the exams unit: never moved
    hidden: str = ""                 # quote from the brief when the task is not on the calendar
    parent: Optional[str] = None     # hidden tasks move together with their parent
    feedback: Optional[int] = None   # week marks come back, if known

    def with_due(self, due: int) -> "Assessment":
        return replace(self, due=due)

    def to_dict(self) -> dict:
        return asdict(self)
