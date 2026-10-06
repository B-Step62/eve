---
"eve": patch
---

Local workflow storage now keeps each run's events and steps in their own directory, so a long-lived agent's writes and run listings stay fast as its store grows instead of rescanning every event file it has ever written. Existing stores are converted automatically on first start.
