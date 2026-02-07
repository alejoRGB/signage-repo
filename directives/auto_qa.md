# Auto-QA Directive

This directive outlines the workflow for automated testing, diagnosis, and repair of the Digital Signage application.

## 1. Objective
Ensure application stability by running automated tests, analyzing failures, and implementing fixes iteratively.

## 2. Trigger
-   After significant code changes to `web/` or `player/`.
-   Before deployment to production.
-   On demand by the user ("Run Auto-QA").

## 3. Workflow

### Step 1: Run Tests
Use the `execution/run_tests.py` script to execute the relevant test suite.

```bash
# Run all tests
python execution/run_tests.py all

# Run only web unit tests
python execution/run_tests.py unit

# Run Playwright E2E tests
python execution/run_tests.py e2e

# Run QA Automation suite
python execution/run_tests.py qa
```

### Step 2: Analyze Results
-   If **PASS**: Workflow complete. Report success.
-   If **FAIL**:
    -   Read the output logs.
    -   Identify the failing test case and the error message.
    -   Common failures:
        -   Selector not found (UI change).
        -   API 500/400 (Backend error).
        -   Timeout (Performance/Network).

### Step 3: Diagnosis & Fix
1.  **Reproduce**: If possible, try to understand the state that caused the failure.
2.  **Fix**:
    -   **Code Fix**: Update the application code if it's a bug.
    -   **Test Fix**: Update the test if the feature specification changed.
3.  **Recursion**: Go back to Step 1 and run *only* the failing test to verify the fix.

## 4. Tools
-   `execution/run_tests.py`: Main entry point.
-   `execution/web_ops.py`: Underlying web commands.
-   `qa_automation/tests/`: E2E test files.

## 5. Reporting
-   Summarize which tests failed and how they were fixed.
-   Update `task.md` with the status.
