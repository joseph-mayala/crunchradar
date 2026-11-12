"""Reproduces every survey number used in the deck and README: python3 docs/survey/summarise.py"""
import csv, collections, os
here = os.path.dirname(os.path.abspath(__file__))
rows = list(csv.reader(open(os.path.join(here, "responses.csv"), newline="", encoding="utf-8")))
hdr, data = rows[0], rows[1:]
n = len(data)
for i, q in enumerate(hdr):
    c = collections.Counter(r[i] for r in data)
    print(f"\n{q}\n" + "\n".join(f"  {v:>2} of {n}  {k}" for k, v in sorted(c.items(), key=lambda kv: -kv[1])))
