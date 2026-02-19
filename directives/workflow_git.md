# Git & Deployment Workflow

This directive outlines the standard operating procedure for version control and deployment, split by change scope.

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

## 2. Change Scope Matrix (Mandatory)

Before deployment, classify the change:

1. **Web-only** (`web/**`, API/backend used by web): run Vercel workflow.
2. **Player-only** (`player/**`, `deploy.ps1`, `execution/player_ops.py`): run Raspberry workflow only.
3. **Mixed** (web + player): run both workflows.

Rules:
- For **Player-only** changes, do not require a web deployment validation step.
- For **Web-only** changes, do not require Raspberry deployment.

## 3. Deployment (Vercel)

The project is configured for **Continuous Deployment** via Vercel.

*   **Trigger**: Pushing to the `master` branch on GitHub automatically triggers a new deployment on Vercel.
*   **Verification**:
    *   After pushing, check the Vercel dashboard or the project URL to ensure the build succeeded.
    *   **Project URL**: `https://signage-repo-dc5s.vercel.app` (canonical production URL).

### Standard Operating Procedure (SOP)
**When scope is Web-only or Mixed:**
1.  **Commit**: Immediately commit the changes with a descriptive message.
2.  **Push**: Push to `origin master` to trigger Vercel deployment.
3.  **Notify**: Inform the user that a new version is building and provide the link.

## 4. Raspberry Deployment (Player-only or Mixed)

When scope includes player changes:
1. Deploy player updates to target Raspberry devices.
2. Verify service status per device (`systemctl is-active signage-player`).
3. Report status per device (IP/hostname + active/inactive).
4. If credentials are missing, request IP/user/password before deploying.

## 5. Troubleshooting Discrepancies

If the live site (or API) does not match your local code:
1.  **Check Git Status**: Are your changes actually committed and pushed? (`git log origin/master..HEAD` should be empty).
2.  **Check Build Status**: Did the Vercel build fail?
3.  **Check Config**: Is the device pointing to the correct Vercel URL (Production vs Preview)?
