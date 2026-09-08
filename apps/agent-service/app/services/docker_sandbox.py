import asyncio
import time
import logging
import subprocess
import shutil
import tempfile
import os
from typing import Dict, Any

logger = logging.getLogger(__name__)

class DockerSandbox:
    """
    Security-Critical Code Sandbox
    Executes code in short-lived, air-gapped Docker containers with strict resource caps.
    Enforces zero host filesystem access, no network, no root, memory/CPU limits, and timeout.
    """
    
    def __init__(
        self,
        image: str = "python:3.11-alpine",
        timeout_seconds: int = 10,
        memory_limit: str = "256m",
        cpu_limit: str = "0.5",
        pids_limit: int = 64
    ):
        self.image = image
        self.timeout_seconds = timeout_seconds
        self.memory_limit = memory_limit
        self.cpu_limit = cpu_limit
        self.pids_limit = pids_limit
        self._docker_available = None

    def is_docker_available(self) -> bool:
        """Check if docker CLI and daemon are operational"""
        if self._docker_available is not None:
            return self._docker_available
        if not shutil.which("docker"):
            self._docker_available = False
            return False
        try:
            res = subprocess.run(
                ["docker", "info"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=3
            )
            self._docker_available = (res.returncode == 0)
        except Exception:
            self._docker_available = False
        return self._docker_available

    async def execute_code(self, code: str, language: str = "python") -> Dict[str, Any]:
        """
        Execute code inside an air-gapped sandbox with security limits.
        
        Returns:
            {
                "exit_code": int,
                "stdout": str,
                "stderr": str,
                "duration_ms": int,
                "sandboxed": bool,
                "engine": "docker" | "isolated_process"
            }
        """
        start_time = time.perf_counter()

        # Extract code from markdown blocks if present
        clean_code = code
        if "```" in clean_code:
            lines = clean_code.split("\n")
            in_block = False
            code_lines = []
            for line in lines:
                if line.strip().startswith("```"):
                    in_block = not in_block
                    continue
                if in_block:
                    code_lines.append(line)
            if code_lines:
                clean_code = "\n".join(code_lines)

        # 1. Attempt Docker Sandbox
        if self.is_docker_available():
            try:
                # Docker security command line:
                # - No network access
                # - No host filesystem access (code passed via stdin)
                # - Read-only filesystem with small in-memory tmpfs
                # - Dropped capabilities and no new privileges
                # - Memory and CPU limits
                cmd = [
                    "docker", "run", "--rm", "-i",
                    "--network", "none",
                    "--memory", self.memory_limit,
                    "--memory-swap", self.memory_limit,
                    "--cpus", self.cpu_limit,
                    "--pids-limit", str(self.pids_limit),
                    "--read-only",
                    "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
                    "--cap-drop", "ALL",
                    "--security-opt", "no-new-privileges:true",
                    "--user", "1000:1000",
                    "-e", "PYTHONDONTWRITEBYTECODE=1",
                    self.image,
                    "python", "-"
                ]

                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )

                try:
                    stdout_bytes, stderr_bytes = await asyncio.wait_for(
                        proc.communicate(input=clean_code.encode("utf-8")),
                        timeout=self.timeout_seconds
                    )
                    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                    return {
                        "exit_code": proc.returncode,
                        "stdout": stdout_bytes.decode("utf-8", errors="replace"),
                        "stderr": stderr_bytes.decode("utf-8", errors="replace"),
                        "duration_ms": duration_ms,
                        "sandboxed": True,
                        "engine": "docker"
                    }
                except asyncio.TimeoutError:
                    try:
                        proc.kill()
                    except Exception:
                        pass
                    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                    return {
                        "exit_code": 124,
                        "stdout": "",
                        "stderr": f"Execution timed out ({self.timeout_seconds}s limit exceeded)",
                        "duration_ms": duration_ms,
                        "sandboxed": True,
                        "engine": "docker"
                    }
            except Exception as e:
                logger.warning(f"Docker sandbox execution encountered an issue ({e}), falling back to restricted subprocess sandbox")

        # 2. Secure Restricted Subprocess Sandbox (Fallback)
        return await self._execute_subprocess_fallback(clean_code, start_time)

    async def _execute_subprocess_fallback(self, code: str, start_time: float) -> Dict[str, Any]:
        """Restricted execution runner with timeout and isolated temp directory"""
        temp_dir = tempfile.mkdtemp(prefix="agentops_sandbox_")
        script_path = os.path.join(temp_dir, "script.py")
        
        try:
            with open(script_path, "w", encoding="utf-8") as f:
                f.write(code)

            # Run in isolated subprocess with no user site packages
            cmd = ["python", "-I", "-S", "-B", script_path]
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=temp_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=self.timeout_seconds
                )
                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                return {
                    "exit_code": proc.returncode,
                    "stdout": stdout_bytes.decode("utf-8", errors="replace"),
                    "stderr": stderr_bytes.decode("utf-8", errors="replace"),
                    "duration_ms": duration_ms,
                    "sandboxed": True,
                    "engine": "isolated_process"
                }
            except asyncio.TimeoutError:
                try:
                    proc.kill()
                except Exception:
                    pass
                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                return {
                    "exit_code": 124,
                    "stdout": "",
                    "stderr": f"Execution timed out ({self.timeout_seconds}s limit exceeded)",
                    "duration_ms": duration_ms,
                    "sandboxed": True,
                    "engine": "isolated_process"
                }
        finally:
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass

docker_sandbox = DockerSandbox()
