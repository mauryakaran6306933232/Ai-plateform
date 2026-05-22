import asyncio
import os
import re
import json
from sqlalchemy import select
from app.services.llm_service import llm_service
from app.services.execution_service import execution_service
from app.services.model_service import model_service
from app.services.security_service import security_service
from app.websocket_manager import ws_manager

class AgentService:
    async def run_workflow(self, task: str, user_id: str = "default_user"):
        print(f"\n [AgentService] Starting LangGraph workflow for task: {task}")
        await ws_manager.broadcast("workflow:status", {"status": "running", "task": task})

        # ==========================================
        # 1. FETCH CODEBASE CONTEXT (RAG)
        # ==========================================
        codebase_context = ""
        try:
            from app.database import async_session
            from app.models import Project
            import chromadb
            from app.config import get_settings
            settings = get_settings()

            async with async_session() as session:
                result = await session.execute(select(Project).where(Project.status == "analyzed").order_by(Project.created_at.desc()))
                project = result.scalar_one_or_none()
                if project:
                    client = chromadb.HttpClient(host=settings.CHROMA_HOST, port=settings.CHROMA_PORT)
                    collection = client.get_collection(name=f"project_{project.id}")
                    results = collection.query(query_texts=[task], n_results=3)

                    if results and results['documents'] and results['documents'][0]:
                        context_list = results['documents'][0]
                        raw_context = "\n\n".join(context_list)
                        if len(raw_context) > 3000:
                            raw_context = raw_context[:3000] + "\n... [Context truncated]"
                        codebase_context = "\n--- CODEBASE CONTEXT ---\n" + raw_context + "\n--- END CONTEXT ---\n"
        except Exception as e:
            print(f"\n [AgentService] RAG context fetch failed (normal if no repo loaded): {e}")

        # ==========================================
        # 2. PLANNING PHASE (WITH MERMAID)
        # ==========================================
        await ws_manager.broadcast("agent:status", {
            "agent_id": "planner", "status": "thinking",
            "message": "Planner Agent is breaking down the task..."
        })

        plan_prompt = f"""User Request: {task}\nContext: {{}}\nCreate a detailed task plan."""
        if codebase_context:
            plan_prompt = f"""{codebase_context}\n\nUser Request: {task}\nBased on the codebase context provided above, complete the following task:\n"""
        
        # NEW: Request Mermaid diagram output
        plan_prompt += "\n\nCRITICAL: You MUST include a system architecture diagram using a ```mermaid code block. Output your plan, and include the mermaid diagram."

        full_plan_response = ""
        try:
            async for chunk in llm_service.stream_generate(prompt=plan_prompt, model=model_service.get_model()):
                full_plan_response += chunk
                await ws_manager.broadcast("agent:output", {"agent_id": "planner", "token": chunk})
                await asyncio.sleep(0.01)
        except Exception as e:
            full_plan_response = f"Error planning: {str(e)}"

        # Extract and broadcast Mermaid diagram
        mermaid_match = re.search(r"```mermaid\s*\n(.*?)```", full_plan_response, re.DOTALL)
        if mermaid_match:
            mermaid_code = mermaid_match.group(1).strip()
            await ws_manager.broadcast("workflow:mermaid_diagram", {"code": mermaid_code})

        await ws_manager.broadcast("agent:status", {"agent_id": "planner", "status": "completed", "message": "Plan generated."})

        # ==========================================
        # 3. PARSE PLAN (UPGRADED PIPELINE)
        # ==========================================
        plan = [
            {"id": "coder", "agent": "coder", "description": task},
            {"id": "security", "agent": "security", "description": "Scan for hardcoded secrets, vulnerabilities, and dependency CVEs"},
            {"id": "tester", "agent": "tester", "description": "Write a comprehensive pytest test suite"},
            {"id": "reviewer", "agent": "reviewer", "description": "Review the code, security scan, and test results"},
            {"id": "refactor", "agent": "refactor", "description": "Optimize the code for production"}
        ]

        # ==========================================
        # 4. EXECUTION PHASE
        # ==========================================
        task_results = {}
        previous_output = ""
        saved_coder_files = [] # NEW: Track multiple files

        for step in plan:
            agent_id = step["agent"]
            print(f"\n [AgentService] Running graph node: {agent_id}")
            await ws_manager.broadcast("agent:status", {
                "agent_id": agent_id, "status": "thinking",
                "message": f"{agent_id.capitalize()} Agent is processing..."
            })

            full_response = ""
            prompt = step["description"]

            # --- CODER AGENT (MULTI-FILE SCAFFOLDING) ---
            if agent_id == "coder":
                if codebase_context:
                    prompt = (
                        f"{codebase_context}\n\n"
                        f"INSTRUCTION: I have provided the CODEBASE CONTEXT above. Read it carefully. "
                        f"Based on that context, complete the following user task:\n"
                        f"{step['description']}\n\n"
                        f"If the user asked to explain the codebase, explain the files provided in the context. "
                        f"If the user asked to write code, write the code based on the existing codebase style.\n\n"
                    )
                
                # NEW: Multi-File Prompt
                prompt += (
                    "CRITICAL INSTRUCTION FOR CODE OUTPUT:\n"
                    "You MUST output a single JSON object inside a ```json block.\n"
                    "The JSON must have a key 'files' which is an array of objects. Each object must have 'path' (e.g., 'src/main.py') and 'content' (the full code).\n"
                    "Example:\n"
                    "```json\n"
                    "{\n  \"files\": [\n    {\"path\": \"main.py\", \"content\": \"print('hello')\"},\n    {\"path\": \"utils.py\", \"content\": \"def helper(): pass\"}\n  ]\n}\n```\n"
                    "Do not output anything outside the JSON block."
                )

                try:
                    async for chunk in llm_service.stream_generate(prompt=prompt, model=model_service.get_model()):
                        full_response += chunk
                        await ws_manager.broadcast("agent:output", {"agent_id": agent_id, "token": chunk})
                        await asyncio.sleep(0.01)
                except Exception as e:
                    full_response = f"\n Ollama Error: {str(e)}"

                # Parse Multi-File JSON
                try:
                    json_match = re.search(r"```json\s*\n(.*?)```", full_response, re.DOTALL)
                    if json_match:
                        parsed = json.loads(json_match.group(1))
                        files_array = parsed.get("files", [])
                        for f_obj in files_array:
                            f_path = f_obj.get("path", f"task_{int(asyncio.get_event_loop().time())}.py")
                            f_content = f_obj.get("content", "")
                            filepath = execution_service.save_code(f_path, f_content)
                            saved_coder_files.append(f_path)
                            await ws_manager.broadcast("execution:file_ready", {
                                "agent_id": "coder", "filename": f_path, "filepath": filepath,
                                "message": f"\n Code saved to workspace/{f_path}"
                            })
                    else:
                        # Fallback for single file output if LLM ignores JSON instruction
                        code = execution_service.extract_code_from_text(full_response)
                        if code:
                            filename = f"task_{int(asyncio.get_event_loop().time())}.py"
                            filepath = execution_service.save_code(filename, code)
                            saved_coder_files.append(filename)
                            await ws_manager.broadcast("execution:file_ready", {
                                "agent_id": "coder", "filename": filename, "filepath": filepath,
                                "message": f"\n Code saved to workspace/{filename}"
                            })
                except json.JSONDecodeError:
                    # Fallback for single file output if JSON is malformed
                    code = execution_service.extract_code_from_text(full_response)
                    if code:
                        filename = f"task_{int(asyncio.get_event_loop().time())}.py"
                        filepath = execution_service.save_code(filename, code)
                        saved_coder_files.append(filename)
                        await ws_manager.broadcast("execution:file_ready", {
                            "agent_id": "coder", "filename": filename, "filepath": filepath,
                            "message": f"\n Code saved to workspace/{filename}"
                        })

            # --- SECURITY AGENT (MERGED: REGEX + PIP AUDIT) ---
            elif agent_id == "security" and saved_coder_files:
                full_response = ""
                for target_file in saved_coder_files:
                    filepath = os.path.join(execution_service.workspace_dir, target_file)
                    if not os.path.exists(filepath): continue
                    
                    try:
                        with open(filepath, "r", encoding="utf-8") as f:
                            code_to_scan = f.read()

                        scan_results = security_service.scan_code(code_to_scan)
                        if scan_results["is_secure"]:
                            full_response += f"■ [{target_file}] Code Pattern Scan Passed.\n"
                        else:
                            full_response += f"■ [{target_file}] Code Pattern Scan FAILED!\n{scan_results['summary']}\n"
                            for finding in scan_results["findings"]:
                                full_response += f"- [{finding['severity'].upper()}] Line {finding['line']}: {finding['snippet']}\n"

                        imports = re.findall(r'^\s*(?:import|from)\s+([a-zA-Z0-9_]+)', code_to_scan, re.MULTILINE)
                        stdlib = {'os', 'sys', 're', 'json', 'math', 'time', 'datetime', 'asyncio', 'subprocess', 'pathlib', 'logging', 'typing', 'collections'}
                        third_party = list(set(imp for imp in imports if imp.lower() not in stdlib))

                        if third_party:
                            req_path = os.path.join(execution_service.workspace_dir, "requirements_audit.txt")
                            with open(req_path, "w") as f:
                                for pkg in third_party: f.write(f"{pkg}\n")

                            audit_cmd = "pip install -r /app/workspace/requirements_audit.txt > /dev/null 2>&1 && pip audit -r /app/workspace/requirements_audit.txt"
                            stdout, stderr, return_code = await asyncio.to_thread(execution_service._run_shell_sync, audit_cmd, 30)
                            
                            if return_code == 0:
                                full_response += f"■ [{target_file}] Dependency Audit Passed.\n"
                            else:
                                full_response += f"■ [{target_file}] Dependency Audit FAILED!\n{stdout}\n"
                            if os.path.exists(req_path): os.remove(req_path)
                        else:
                            full_response += f"■ [{target_file}] No third-party dependencies detected.\n"

                    except Exception as e:
                        full_response += f"Security scan skipped for {target_file}: {str(e)}\n"

                await ws_manager.broadcast("agent:output", {"agent_id": agent_id, "token": full_response})

            # --- TESTER AGENT (PYTEST) ---
            elif agent_id == "tester" and saved_coder_files:
                # Test the first main file for now (can be expanded)
                target_file = saved_coder_files[0]
                prompt = (
                    f"Write a comprehensive pytest test suite for the following Python file: `{target_file}`. "
                    f"The tests should cover edge cases and normal operations.\n"
                    f"Output ONLY the raw Python pytest code inside a ```python block. No explanations."
                )
                try:
                    async for chunk in llm_service.stream_generate(prompt=prompt, model=model_service.get_model()):
                        full_response += chunk
                        await ws_manager.broadcast("agent:output", {"agent_id": agent_id, "token": chunk})
                        await asyncio.sleep(0.01)
                except Exception as e:
                    full_response = f"Error generating tests: {str(e)}"

                test_code = execution_service.extract_code_from_text(full_response)
                if test_code:
                    test_filename = f"test_{target_file}"
                    test_filepath = execution_service.save_code(test_filename, test_code)
                    await ws_manager.broadcast("execution:file_ready", {
                        "agent_id": "tester", "filename": test_filename, "filepath": test_filepath,
                        "message": f"\n Test suite saved to workspace/{test_filename}"
                    })

                    await ws_manager.broadcast("agent:output", {"agent_id": agent_id, "token": f"\n\n■ Running pytest in Docker Sandbox...\n"})
                    stdout, stderr, return_code = await asyncio.to_thread(
                        execution_service._run_sync_subprocess, test_filepath, 15
                    )
                    test_output = f"\nPytest Exit Code: {return_code}\n\n{stdout}"
                    if stderr and return_code != 0:
                        test_output += f"\n\nError Output:\n{stderr}"
                    await ws_manager.broadcast("agent:output", {"agent_id": agent_id, "token": test_output})
                    full_response += test_output

            # --- REVIEWER AGENT ---
            elif agent_id == "reviewer" and "coder" in task_results:
                security_context = task_results.get("security", "No security scan performed.")
                test_context = task_results.get("tester", "No tests executed.")
                prompt = (
                    f"Review this code for bugs and security.\n\n"
                    f"Code:\n{task_results['coder']}\n\n"
                    f"Security Scan Results:\n{security_context}\n\n"
                    f"Test Results:\n{test_context}"
                )
                try:
                    async for chunk in llm_service.stream_generate(prompt=prompt, model=model_service.get_model()):
                        full_response += chunk
                        await ws_manager.broadcast("agent:output", {"agent_id": agent_id, "token": chunk})
                        await asyncio.sleep(0.01)
                except Exception as e:
                    full_response = f"Ollama Error: {str(e)}"

            # --- REFACTOR AGENT ---
            elif agent_id == "refactor" and "coder" in task_results:
                prompt = f"Refactor this code for production:\n{task_results['coder']}"
                try:
                    async for chunk in llm_service.stream_generate(prompt=prompt, model=model_service.get_model()):
                        full_response += chunk
                        await ws_manager.broadcast("agent:output", {"agent_id": agent_id, "token": chunk})
                        await asyncio.sleep(0.01)
                except Exception as e:
                    full_response = f"Ollama Error: {str(e)}"

            if not full_response:
                full_response = f"\n No response from Ollama."
                await ws_manager.broadcast("agent:output", {"agent_id": agent_id, "token": full_response})

            task_results[agent_id] = full_response
            previous_output = full_response
            await ws_manager.broadcast("agent:status", {
                "agent_id": agent_id, "status": "completed",
                "message": f"{agent_id.capitalize()} Agent finished."
            })
            await asyncio.sleep(1)

        print("\n [AgentService] LangGraph workflow complete!")
        await ws_manager.broadcast("workflow:status", {
            "status": "completed", "task": task, "final_output": previous_output
        })

    # ==========================================
    # SELF-HEALING METHOD
    # ==========================================
    async def fix_code(self, filename: str, error_output: str):
        filepath = os.path.join(execution_service.workspace_dir, filename)
        print(f"\n [AgentService] Auto-fixing {filename}...")
        await ws_manager.broadcast("agent:status", {
            "agent_id": "coder", "status": "thinking",
            "message": "Coder Agent is fixing the error..."
        })

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                broken_code = f.read()
        except Exception as e:
            await ws_manager.broadcast("agent:output", {"agent_id": "coder", "token": f"Could not read file: {e}"})
            return

        previous_content = broken_code # Save for Diff

        if not broken_code.strip() or (len(broken_code) > 10000 and 'def ' not in broken_code and 'class ' not in broken_code):
            await ws_manager.broadcast("agent:output", {"agent_id": "coder", "token": "\n The file is empty or not valid Python code. Cannot auto-fix."})
            return

        prompt = (
            "You are an expert Python debugger. The following Python code produced an error when executed.\n"
            "Please fix the code and output ONLY the complete corrected Python code.\n"
            "Do NOT include any explanations or markdown formatting like ```python.\n"
            "Just output the raw corrected Python code.\n\n"
            f"Broken Code:\n{broken_code}\n\n"
            f"Error Output:\n{error_output}\n\n"
            "Corrected Python Code:\n"
        )

        full_response = ""
        try:
            async for chunk in llm_service.stream_generate(prompt=prompt, model=model_service.get_model()):
                full_response += chunk
                await ws_manager.broadcast("agent:output", {"agent_id": "coder", "token": chunk})
                await asyncio.sleep(0.01)
        except Exception as e:
            full_response = f"Error fixing code: {str(e)}"

        fixed_code = execution_service.extract_code_from_text(full_response)

        if not fixed_code and full_response.strip():
            raw = full_response.strip()
            lines = raw.split('\n')
            code_lines = []
            in_code = False
            for line in lines:
                if line.strip().startswith('Here is') or line.strip().startswith('The fix'):
                    continue
                if line.strip().startswith('```'):
                    in_code = not in_code
                    continue
                if in_code or (not line.strip().startswith('#') and line.strip()):
                    code_lines.append(line)
            if code_lines:
                fixed_code = '\n'.join(code_lines)
            if fixed_code.count('(') > fixed_code.count(')'):
                fixed_code = fixed_code[:fixed_code.rfind(')') + 1]

        if fixed_code:
            execution_service.save_code(filename, fixed_code)
            await ws_manager.broadcast("execution:file_ready", {
                "agent_id": "coder", "filename": filename,
                "message": f"\n Code fixed and saved to workspace/{filename}",
                "previous_content": previous_content, # NEW: Send previous content for Diff
                "new_content": fixed_code # NEW: Send new content for Diff
            })
        else:
            await ws_manager.broadcast("agent:output", {
                "agent_id": "coder",
                "token": "\n\n The AI could not generate a valid fix. The error might be too complex."
            })

        await ws_manager.broadcast("agent:status", {"agent_id": "coder", "status": "completed", "message": "Coder finished."})
        await ws_manager.broadcast("workflow:status", {"status": "completed", "task": "auto_fix"})
        await ws_manager.broadcast("jarvis:notification", {
            "status": "auto_fix_complete", "agent_id": "jarvis",
            "message": f"■■ **Self-Heal Complete**: I've analyzed the error in `{filename}`, rewritten the code, and saved it.",
            "filename": filename
        })

agent_service = AgentService()