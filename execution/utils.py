import os
import subprocess
import sys
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)

logger = logging.getLogger("ExecutionLayer")

def get_project_root():
    """Returns the absolute path to the project root."""
    # Assuming this script is in project_root/execution/
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(current_dir)

def run_command(command, cwd=None, env=None, shell=False):
    """
    Runs a shell command and streams output to stdout.
    Returns the return code.
    """
    if cwd is None:
        cwd = get_project_root()
    
    logger.info(f"Running command: {' '.join(command) if isinstance(command, list) else command} in {cwd}")
    
    try:
        # Use streams inheritance to allow interaction (e.g. password prompts)
        process = subprocess.Popen(
            command,
            cwd=cwd,
            env=env,
            shell=shell,
            # We explicitly do NOT pipe stdout/stderr/stdin, allowing direct passthrough
        )
        
        process.wait()
        return process.returncode
    except Exception as e:
        logger.error(f"Failed to run command: {e}")
        return 1
