# Git Workflow Directive

This directive covers git hygiene and command sequencing.
The canonical scope classification and mandatory deployment rules live in `agent_directives/AGENTS.md` to avoid duplication.

## 1. Version Control (Git)

The project uses `git` for version control. The main branch is `master`.

### Common Commands

*   **Check Status**:
    ```bash
    git status
    ```
    *Always run this first to see what files are modified.*

*   **Stage Changes**:
    ```bash
    git add .
    ```
    *Stages all modified files.*

*   **Commit**:
    ```bash
    git commit -m "Descriptive message about changes"
    ```
    *Be specific. e.g., "fix: player duration logic" or "feat: added frontend route".*

*   **Push to GitHub**:
    ```bash
    git push origin master
    ```
    *This uploads your commits to the remote repository.*

## 2. Deployment Verification (Vercel)

When `agent_directives/AGENTS.md` determines the scope is `Web-only` or `Mixed`, verify the Vercel deployment after pushing.

The project is configured for Continuous Deployment via Vercel.

*   **Trigger**: Pushing to the `master` branch on GitHub automatically triggers a new deployment on Vercel.
*   **Verification**:
    *   After pushing, check the Vercel dashboard or the project URL to ensure the build succeeded.
    *   **Project URL**: `https://signage-repo-dc5s.vercel.app` (canonical production URL).

### Verification Checklist
1. Confirm the push reached `origin/master`.
2. Inspect the latest Vercel deployment status.
3. If `Error`, inspect logs, fix, push again, and re-verify.
4. Report deployment URL and final status (`Ready`) when applicable.

## 3. Troubleshooting Discrepancies

If the live site (or API) does not match your local code:
1.  **Check Git Status**: Are your changes actually committed and pushed? (`git log origin/master..HEAD` should be empty).
2.  **Check Build Status**: Did the Vercel build fail?
3.  **Check Config**: Is the device pointing to the correct Vercel URL (Production vs Preview)?
