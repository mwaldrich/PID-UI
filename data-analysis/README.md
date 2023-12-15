This directory contains 4 files:

- `clicks.txt` -- the actual data we gathered on experiment day
- `to_csv.py` -- a script that turns the `clicks.txt` into 2 different spreadsheets:
    - `initial_experiment.csv` -- a spreadsheet representing the data from the initial experiment (i.e. before the counterbalance)
    - `counterbalance.csv` -- a spreadsheet representing the data from the counterbalance

We perform the following analysis on the raw data:
1. Compute the number of successful balances (derived from the PID values)
2. Compute if an interaction was "changed" from before (i.e. PID values need to change between interactions for this to be true)
