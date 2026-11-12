"""Generate the SAMPLE cohort: data/cohort.ics (stand-in for the Moodle calendar feed) and data/briefs/*.txt.

Module names are the real APD2F2606SE modules. Assessments, dates and hours are made up.
Swap in the real export by pointing CALENDAR_ICS and BRIEFS_DIR at it. Nothing else changes.
"""
from datetime import date, timedelta
from pathlib import Path

START = date(2027, 1, 4)
OUT = Path(__file__).resolve().parent.parent / "data"

# id, mod, title, type, weight, words, group, due, fixed, feedback
ITEMS = [
    ("a1", "CCP", "Individual assignment", "code", 20, 0, False, 5, False, None),
    ("a2", "CCP", "Group project", "code", 40, 0, True, 11, False, None),
    ("b1", "SWAT", "Mid-term test", "test", 20, 0, False, 7, True, None),
    ("b2", "SWAT", "Architecture report", "report", 30, 3000, True, 11, False, None),
    ("c1", "FWD", "Lab logbook 1", "logbook", 5, 0, False, 4, False, 9),
    ("c2", "FWD", "Lab logbook 2", "logbook", 5, 0, False, 8, False, None),
    ("c3", "FWD", "Website project", "code", 40, 0, False, 10, False, None),
    ("d1", "RMCT", "Research proposal", "report", 30, 3500, False, 7, False, None),
    ("d2", "RMCT", "Group presentation", "presentation", 20, 0, True, 12, False, None),
    ("e1", "DSTR", "Lab test", "test", 25, 0, False, 7, True, None),
    ("e2", "DSTR", "Algorithm report", "report", 25, 2000, False, 11, False, None),
    ("f1", "IAC", "Quiz", "quiz", 5, 0, False, 3, False, None),
    ("f2", "IAC", "Mid-term test", "test", 20, 0, False, 8, True, None),
    ("f3", "IAC", "Case study essay", "report", 15, 1500, False, 11, False, None),
]

BRIEFS = {
    "a2": "CCP Group project (40%)\nBuild a concurrent ticketing system in Java and submit the code in Week 11.\nEach group demos their system to the lecturer in Week 12 (10 minutes plus questions).",
    "c3": "FWD Website project (40%)\nBuild a responsive website and submit it in Week 10.\nA 10-minute viva follows submission in Week 11.",
    "d2": "RMCT Group presentation (20%)\nPresent your research design to the class in Week 12.",
    "b2": "SWAT Architecture report (30%)\nSubmit a 3,000-word architecture report in Week 11.",
}


def due_date(week: int) -> date:
    return START + timedelta(days=(week - 1) * 7 + 4)  # Friday of that week


def main() -> None:
    (OUT / "briefs").mkdir(parents=True, exist_ok=True)
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CrunchRadar sample//EN"]
    for id_, mod, title, typ, wt, words, grp, due, fixed, fb in ITEMS:
        desc = f"id: {id_}; type: {typ}; weight: {wt}; words: {words}; group: {'yes' if grp else 'no'}; fixed: {'yes' if fixed else 'no'}" + (f"; feedback: {fb}" if fb else "")
        lines += ["BEGIN:VEVENT", f"UID:{id_}@sample.crunchradar", f"SUMMARY:[{mod}] {title}", f"CATEGORIES:{mod}",
                  f"DTSTART;VALUE=DATE:{due_date(due):%Y%m%d}", f"DESCRIPTION:{desc}", "END:VEVENT"]
    lines.append("END:VCALENDAR")
    (OUT / "cohort.ics").write_text("\r\n".join(lines) + "\r\n")
    for id_, text in BRIEFS.items():
        (OUT / "briefs" / f"{id_}.txt").write_text(text + "\n")
    print(f"wrote {len(ITEMS)} events and {len(BRIEFS)} briefs to {OUT}")


if __name__ == "__main__":
    main()
