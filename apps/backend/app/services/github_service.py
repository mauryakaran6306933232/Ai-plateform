import os
import subprocess
import asyncio
import tempfile
import logging
import httpx
import re
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

class GitHubService:
    def _clone_sync(self, repo_url: str, target_dir: str):
        """Synchronous git clone using subprocess (Windows safe)"""
        # If a token is provided, inject it into the URL for private repo access
        if settings.GITHUB_TOKEN and "github.com" in repo_url:
            if repo_url.startswith("https://"):
                repo_url = repo_url.replace("https://", f"https://{settings.GITHUB_TOKEN}@")
            elif repo_url.startswith("http://"):
                repo_url = repo_url.replace("http://", f"http://{settings.GITHUB_TOKEN}@")

        command = ["git", "clone", "--depth", "1", repo_url, target_dir]
        
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=120,
            stdin=subprocess.DEVNULL # 2 minute timeout for large repos
        )
        
        if result.returncode != 0:
            raise Exception(f"Git clone failed: {result.stderr}")
        
        return target_dir

    async def clone_repo(self, repo_url: str) -> str:
        """Clone a GitHub repository asynchronously"""
        # Create a temporary directory for the repo
        temp_dir = tempfile.mkdtemp(prefix="ai_github_")
        
        logger.info(f"Cloning repo: {repo_url} into {temp_dir}")
        
        try:
            await asyncio.to_thread(self._clone_sync, repo_url, temp_dir)
            return temp_dir
        except Exception as e:
            logger.error(f"Failed to clone repository: {e}")
            # Clean up failed directory
            if os.path.exists(temp_dir):
                subprocess.run(["rm", "-rf", temp_dir], capture_output=True)
            raise e

    # ==========================================
    # NEW: GITHUB PR GENERATION
    # ==========================================
    def _create_pr_sync(self, repo_url: str, branch_name: str, file_path: str, file_content: str, commit_message: str, pr_title: str, pr_body: str) -> dict:
        """Synchronous Git operations and GitHub API call to create a PR"""
        if not settings.GITHUB_TOKEN:
            raise Exception("GITHUB_TOKEN is not configured in .env. Cannot open PR.")

        # 1. Parse owner and repo from URL
        match = re.search(r'github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?$', repo_url)
        if not match:
            raise Exception("Invalid GitHub URL format")
        owner, repo = match.groups()

        temp_dir = tempfile.mkdtemp(prefix="ai_pr_")
        
        try:
            # Inject token for authentication
            auth_url = repo_url.replace("https://", f"https://{settings.GITHUB_TOKEN}@")
            
            # 2. Clone repo
            subprocess.run(["git", "clone", "--depth", "1", auth_url, temp_dir], capture_output=True, text=True, timeout=60, check=True)
            
            # 3. Create and checkout branch
            subprocess.run(["git", "checkout", "-b", branch_name], capture_output=True, text=True, cwd=temp_dir, check=True)
            
            # 4. Write the modified file
            full_path = os.path.join(temp_dir, file_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(file_content)
                
            # 5. Git Add, Commit, Push
            subprocess.run(["git", "add", file_path], capture_output=True, text=True, cwd=temp_dir, check=True)
            subprocess.run(
                ["git", "-c", "user.name=AI Platform", "-c", "user.email=ai@platform.com", "commit", "-m", commit_message],
                capture_output=True, text=True, cwd=temp_dir, check=True
            )
            subprocess.run(["git", "push", "origin", branch_name], capture_output=True, text=True, cwd=temp_dir, check=True)
            
            # 6. Create Pull Request via GitHub API
            pr_url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
            headers = {
                "Authorization": f"token {settings.GITHUB_TOKEN}",
                "Accept": "application/vnd.github.v3+json"
            }
            payload = {
                "title": pr_title,
                "body": pr_body,
                "head": branch_name,
                "base": "main" # Assuming default branch is main
            }
            
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(pr_url, json=payload, headers=headers)
                if resp.status_code in (201, 200):
                    return resp.json()
                else:
                    raise Exception(f"GitHub API Error: {resp.status_code} - {resp.text}")
                    
        except subprocess.CalledProcessError as e:
            logger.error(f"Git command failed: {e.stderr}")
            raise Exception(f"Git command failed: {e.stderr}")
        except Exception as e:
            logger.error(f"PR creation failed: {str(e)}")
            raise e
        finally:
            # 7. Cleanup temp dir
            if os.path.exists(temp_dir):
                subprocess.run(["rm", "-rf", temp_dir], capture_output=True)

    async def create_pull_request(self, repo_url: str, branch_name: str, file_path: str, file_content: str, commit_message: str, pr_title: str, pr_body: str) -> dict:
        """Async wrapper to create a PR without blocking the event loop"""
        return await asyncio.to_thread(
            self._create_pr_sync, 
            repo_url, branch_name, file_path, file_content, commit_message, pr_title, pr_body
        )

# Singleton
github_service = GitHubService()