---
"eve": patch
---

Add `MLflow()` to `eve/evals/reporters` to report eval results as MLflow traces with assertion assessments, grouped under a tracking run. Install the optional `@mlflow/core` package and configure an experiment id to use an MLflow tracking server or Databricks.
