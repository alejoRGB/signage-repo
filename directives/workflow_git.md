# Git & Deployment Workflow

This directive outlines the standard operating procedure for version control and deploying changes to the production environment (Vercel).

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

## 2. Deployment (Vercel)

The project is configured for **Continuous Deployment** via Vercel.

*   **Trigger**: Pushing to the `master` branch on GitHub automatically triggers a new deployment on Vercel.
*   **Verification**:
    *   After pushing, check the Vercel dashboard or the project URL to ensure the build succeeded.
    *   **Project URL**: `https://signage-repo-dc5s.vercel.app` (canonical production URL).

### Standard Operating Procedure (SOP)
**After any successful verification of code changes:**
1.  **Commit**: Immediately commit the changes with a descriptive message.
2.  **Push**: Push to `origin master` to trigger Vercel deployment.
3.  **Notify**: Inform the user that a new version is building and provide the link.

## 3. Troubleshooting Discrepancies

If the live site (or API) does not match your local code:
1.  **Check Git Status**: Are your changes actually committed and pushed? (`git log origin/master..HEAD` should be empty).
2.  **Check Build Status**: Did the Vercel build fail?
3.  **Check Config**: Is the device pointing to the correct Vercel URL (Production vs Preview)?
