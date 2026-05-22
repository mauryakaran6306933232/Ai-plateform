import os
import asyncio
import glob
import time
import re
from app.services.desktop_service import desktop_service
from app.services.llm_service import llm_service
from app.services.metrics_service import metrics_service
from app.services.memory_service import memory_service
from app.services.execution_service import execution_service
from app.websocket_manager import ws_manager
from app.services.browser_service import browser_service
from app.services.model_service import model_service
from app.services.gsuite_service import gsuite_service

JARVIS_DEFAULT_PROMPT = """You are Jarvis, an advanced AI OS assistant for a FAANG-level AI Platform.
You are concise, highly intelligent, and helpful.
If you are provided with WEB SEARCH RESULTS, summarize them intelligently. Do not just list links; explain what they mean.
If there are no search results, tell the user honestly. DO NOT make up or hallucinate news articles.
If you dispatch a task to the AI Engineer, tell the user you have assembled the engineering team and will notify them when complete."""

JARVIS_FOCUS_PROMPT = """You are Jarvis in FOCUS MODE. 
Rules: Be extremely concise. Provide bullet points. No proactive alerts. No web searching unless explicitly asked. Answer the direct question with maximum efficiency."""

JARVIS_RESEARCH_PROMPT = """You are Jarvis in RESEARCH MODE.
Rules: Always search the web for the latest information before answering. Provide detailed summaries with citations/links. Compare multiple sources. Be thorough and academic."""

JARVIS_DEBUG_PROMPT = """You are Jarvis in DEBUG MODE.
Rules: Focus exclusively on analyzing errors, reading code from the workspace, and applying fixes. Output code patches directly. Be technical and precise. If an error is provided, analyze the stack trace and suggest the exact line to fix."""

MODE_PROMPTS = {
    "default": JARVIS_DEFAULT_PROMPT,
    "focus": JARVIS_FOCUS_PROMPT,
    "research": JARVIS_RESEARCH_PROMPT,
    "debug": JARVIS_DEBUG_PROMPT
}

class JarvisService:
    async def _schedule_routine_action(self, msg_clean: str) -> str:
        """Parses a scheduling request and registers it with the Scheduler Service"""
        from app.services.scheduler_service import scheduler_service

        interval_minutes = 5
        numbers = re.findall(r'\b\d+\b', msg_clean)
        if numbers:
            interval_minutes = int(numbers[0])
            if interval_minutes < 1:
                interval_minutes = 1

        task_type = "system_status"
        condition = None

        if any(w in msg_clean for w in ["cpu", "system", "metrics", "performance"]):
            task_type = "system_status"
            if "over" in msg_clean or "above" in msg_clean or ">" in msg_clean:
                threshold_nums = re.findall(r'(?:over|above|>)\s*(\d+)', msg_clean)
                if threshold_nums:
                    condition = f"cpu over {threshold_nums[0]}"

        job_id = f"routine_{task_type}_{int(time.time())}"

        try:
            job = scheduler_service.add_job(
                job_id=job_id,
                task_type=task_type,
                interval_minutes=interval_minutes,
                condition=condition
            )

            return (
                f"\n--- ACTION RESULT ---\n"
                f"Routine scheduled successfully. I will check {task_type} every {interval_minutes} minute(s)."
                f"{f' Condition: Alert if {condition}.' if condition else ''}\n"
                f"Job ID: {job_id}. You can cancel it in the Jarvis Automation tab.\n"
                f"--- END RESULT ---\n"
                f"Tell the user you have set up the scheduled routine and will monitor it in the background."
            )
        except Exception as e:
            return f"\n--- ACTION FAILED ---\nFailed to schedule routine: {str(e)}--- END RESULT ---"

    async def chat_stream(self, message: str, user_id: str = "default_user", mode: str = "default"):
        print(f"\n [Jarvis] Received message: {message} (Mode: {mode})")

        print("\n [Jarvis] Checking for actions...")
        action_context = await self._check_actions(message, mode)

        memory_context = ""
        try:
            memories = memory_service.search(message, n_results=2)
            if memories:
                memory_text = "\n".join(memories)
                if len(memory_text) > 1500:
                    memory_text = memory_text[:1500] + "..."
                memory_context = "\n--- PAST MEMORIES ---\n" + memory_text + "\n--- END MEMORIES ---\n"
        except Exception as e:
            print(f"\n [Jarvis] Memory retrieval failed: {e}")

        live_context = metrics_service.get_current_state()
        system_context = f"\n--- LIVE SYSTEM CONTEXT ---\n{live_context}\n--- END CONTEXT ---\n"
        
        # NEW: Select prompt based on mode
        base_prompt = MODE_PROMPTS.get(mode, JARVIS_DEFAULT_PROMPT)
        full_prompt = f"{base_prompt}\n\n{memory_context}{system_context}"

        if action_context:
            if len(action_context) > 2500:
                action_context = action_context[:2500] + "\n...[Truncated]..."
            full_prompt += action_context

        full_prompt += f"\nUser: {message}\nJarvis:"
        
        await ws_manager.broadcast("jarvis:response", {"status": "thinking", "agent_id": "jarvis"})
        full_response = ""
        try:
            async for chunk in llm_service.stream_generate(prompt=full_prompt, model=model_service.get_model()):
                full_response += chunk
                await ws_manager.broadcast("jarvis:response", {"status": "streaming", "agent_id": "jarvis", "token": chunk})
                await asyncio.sleep(0.01)
        except Exception as e:
            full_response = f"Error generating response: {str(e)}"
            await ws_manager.broadcast("jarvis:response", {"status": "error", "agent_id": "jarvis", "token": full_response})

        try:
            memory_service.store(f"User said: {message}", metadata={"type": "user_input"})
            memory_service.store(f"Jarvis replied: {full_response}", metadata={"type": "jarvis_response"})
        except Exception as e:
            print(f"\n [Jarvis] Memory storage failed: {e}")

        await ws_manager.broadcast("jarvis:response", {"status": "done", "agent_id": "jarvis"})

    async def _check_actions(self, message: str, mode: str = "default") -> str:
        msg_lower = message.lower()
        msg_clean = msg_lower.replace(",", " ").replace("?", "").replace("!", "").replace('"', "").replace("'", "")
        msg_clean = re.sub(r'\s+', ' ', msg_clean)

        print(f"\n [Jarvis] Checking actions for: {msg_clean}")
        
        # NEW: Debug Mode Auto-Action
        if mode == "debug" and ("error" in msg_clean or "traceback" in msg_clean or "failed" in msg_clean):
            print("\n [Jarvis] Debug Mode + Error detected. Auto-analyzing!")
            return await self._autonomous_code_action(f"Analyze and fix this error: {message}")

        # 1. SCHEDULED ROUTINES
        is_scheduling_task = (
            any(w in msg_clean for w in ["every", "schedule", "routine", "cron"]) and
            any(w in msg_clean for w in ["minute", "hour", "check", "monitor", "alert", "run"])
        )
        if is_scheduling_task:
            print("\n [Jarvis] Matched Scheduling Routine action!")
            return await self._schedule_routine_action(msg_clean)

        # 2. AI ENGINEER ORCHESTRATION
        is_engineering_task = (
            any(w in msg_clean for w in ["build", "implement", "develop", "create a", "engineer"]) and
            any(w in msg_clean for w in ["feature", "module", "api", "system", "service", "component", "app", "code"])
        )
        if is_engineering_task:
            print("\n [Jarvis] Matched AI Engineer Orchestration action!")
            return await self._orchestrate_engineer_action(message)

        # 3. AUTONOMOUS CODE EXECUTION
        is_coding_task = (
            ("write" in msg_clean and any(w in msg_clean for w in ["code", "python", "script", "program"])) or
            ("generate" in msg_clean and any(w in msg_clean for w in ["code", "python", "script", "program"])) or
            ("code this" in msg_clean)
        )
        if is_coding_task:
            print("\n [Jarvis] Matched Autonomous Coding action!")
            return await self._autonomous_code_action(message)

        # 4. EMAIL AUTOMATION
        elif "email" in msg_clean and any(w in msg_clean for w in ["send", "draft", "write", "compose"]):
            print("\n [Jarvis] Matched Email action!")
            return await self._email_action(msg_clean)

        # 5. CALENDAR AUTOMATION
        elif any(w in msg_clean for w in ["schedule", "calendar", "meeting", "event"]):
            print("\n [Jarvis] Matched Calendar action!")
            return await self._calendar_action(msg_clean)

        # 6. CODE EXECUTION
        elif any(word in msg_clean for word in ["run code", "run script", "run latest", "execute code", "run my"]):
            print("\n [Jarvis] Matched Run Script action!")
            result = await self._execute_latest_script()
            return f"\n--- ACTION RESULT ---\n{result}\n--- END RESULT ---\nTell the user the result of the script execution."

        # 7. SYSTEM METRICS
        elif any(word in msg_clean for word in ["cpu", "system status", "metrics", "performance"]):
            print("\n [Jarvis] Matched Metrics action!")
            return f"\n--- ACTION RESULT ---\n{metrics_service.get_current_state()}\n--- END RESULT ---\nSummarize the system status for the user."
        elif any(word in msg_clean for word in ["start stream", "start analytics"]):
            await metrics_service.start_stream()
            return "\n--- ACTION RESULT ---\nAnalytics stream started.--- END RESULT ---"
        elif any(word in msg_clean for word in ["stop stream", "stop analytics"]):
            metrics_service.stop_stream()
            return "\n--- ACTION RESULT ---\nAnalytics stream stopped.--- END RESULT ---"

        # 8. WEB SEARCH (Forced in Research Mode or by command)
        elif mode == "research" or any(word in msg_clean for word in [
            "search web", "search the web", "google", "look up", "search the internet", "web search",
            "latest", "current", "recent", "news", "today", "this week", "what is the latest", "what happened"
        ]):
            print(f"\n [Jarvis] Matched Web Search action! (Mode: {mode})")
            search_query = msg_clean
            for prefix in [
                "jarvis search the web for", "jarvis search web for", "jarvis google", "jarvis look up",
                "search the web for", "search web for", "google", "look up",
                "search the internet for", "search for", "web search",
                "what is the latest", "what happened", "tell me the latest", "give me the latest",
                "latest news on", "latest", "current", "recent", "news"
            ]:
                if search_query.startswith(prefix):
                    search_query = search_query[len(prefix):].strip()
                    break

            for suffix in ["today", "right now", "please", "now"]:
                if search_query.endswith(suffix):
                    search_query = search_query[:-len(suffix)].strip()
            if not search_query or len(search_query) < 2:
                search_query = "latest AI technology news"

            try:
                results = await browser_service.search_web(search_query)
                if "No search results found" in results:
                    return f"\n--- WEB SEARCH FAILED ---\nNo results for '{search_query}'.--- END RESULTS ---\nTell the user you couldn't find anything."
                else:
                    return f"\n--- WEB SEARCH RESULTS for '{search_query}' ---\n{results}\n--- END RESULTS ---\nCRITICAL: Synthesize these search results into a comprehensive answer."
            except Exception as e:
                return f"\n--- ACTION FAILED ---\nWeb search failed: {str(e)}--- END RESULT ---"

        # 9. WEB SCRAPER
        elif any(word in msg_clean for word in ["scrape", "summarize page", "read page", "browse", "visit url", "go to"]):
            print("\n [Jarvis] Matched Scrape action!")
            url_match = re.search(r'https?://[^\s]+', message)
            url = None
            if url_match:
                url = url_match.group(0)
            else:
                for prefix in ["scrape ", "summarize page ", "read page ", "browse ", "visit ", "go to "]:
                    if msg_clean.startswith(prefix):
                        domain = message[len(prefix):].strip()
                        if domain and not domain.startswith("http"):
                            domain = f"https://{domain}"
                        url = domain

            if url:
                try:
                    scraped_text = await browser_service.scrape_page(url)
                    if execution_service and "Browser error" not in scraped_text:
                        filename = f"scrape_{int(time.time())}.txt"
                        filepath = execution_service.save_code(filename, f"Source: {url}\n\n{scraped_text}")
                        await ws_manager.broadcast("execution:file_ready", {"agent_id": "jarvis", "filename": filename})
                    return f"\n--- SCRAPPED PAGE CONTENT from {url} ---\n{scraped_text}\n--- END CONTENT ---\nSummarize the scraped content for the user."
                except Exception as e:
                    return f"\n--- ACTION FAILED ---\nScraping failed: {str(e)}--- END RESULT ---"

        # 10. DESKTOP AUTOMATION - SCREENSHOT
        elif any(word in msg_clean for word in [
            "screenshot", "screensort", "screen short", "screen shot", "screen capture",
            "what's on screen", "what is on screen", "capture screen"
        ]):
            print("\n [Jarvis] Matched Screenshot action!")
            try:
                filename, filepath = await desktop_service.take_screenshot()
                await ws_manager.broadcast("execution:file_ready", {
                    "agent_id": "jarvis", "filename": filename, "filepath": filepath,
                    "message": f"\n■ Screenshot saved to workspace/{filename}"
                })
                return (
                    f"\n--- ACTION RESULT ---\n"
                    f"Screenshot taken successfully. It has been saved to the AI workspace as `{filename}`.\n"
                    f"--- END RESULT ---\n"
                    f"INSTRUCTIONS FOR YOU: Tell the user you took the screenshot and saved it to the workspace. "
                    f"Tell them they can view it in the Workspace Explorer tab. DO NOT say you are displaying the image."
                )
            except Exception as e:
                return f"\n--- ACTION FAILED ---\nFailed to take screenshot: {str(e)}--- END RESULT ---"

        # 11. DESKTOP AUTOMATION - TYPING
        elif any(word in msg_clean for word in ["type ", "keyboard "]):
            print("\n [Jarvis] Matched Typing action!")
            text_to_type = msg_clean
            for prefix in ["jarvis type ", "jarvis keyboard ", "type ", "keyboard "]:
                if text_to_type.startswith(prefix):
                    text_to_type = text_to_type[len(prefix):].strip()
                    break
            if text_to_type:
                await desktop_service.type_text(text_to_type)
                return f"\n--- ACTION RESULT ---\nTyped '{text_to_type}' on the local machine.\n--- END RESULT ---"
            else:
                return "\n--- ACTION FAILED ---\nNo text provided to type.--- END RESULT ---"

        # NO ACTION MATCHED
        print(f"\n [Jarvis] No action matched. Using LLM.")
        return None

    # ==========================================
    # HELPER METHODS FOR ACTIONS
    # ==========================================
    async def _orchestrate_engineer_action(self, message: str) -> str:
        """Dispatches a task to the full multi-agent AI Engineer pipeline"""
        from app.services.agent_service import agent_service
        asyncio.create_task(agent_service.run_workflow(message))
        return (
            f"\n--- ACTION RESULT ---\n"
            f"Task dispatched to the AI Engineering team. The Planner, Coder, Reviewer, and Refactor agents are now working.\n"
            f"--- END RESULT ---\n"
            f"INSTRUCTIONS FOR YOU: Tell the user you have assembled the engineering team and started the workflow. "
            f"Tell them they can watch the live progress in the AI Engineer tab, and you will notify them when the code is ready."
        )

    async def _autonomous_code_action(self, message: str) -> str:
        """Jarvis writes code, saves it, and executes it autonomously"""
        prompt = (
            f"User Request: {message}\n\n"
            f"You are an autonomous coding agent. Write ONLY raw Python code to fulfill the request. "
            f"No markdown formatting, no explanations, just the python code."
        )

        full_code = ""
        try:
            async for chunk in llm_service.stream_generate(prompt=prompt, model=model_service.get_model()):
                full_code += chunk
        except Exception as e:
            return f"\n--- ACTION FAILED ---\nFailed to generate code: {str(e)}--- END RESULT ---"

        if "```python" in full_code:
            full_code = full_code.split("```python")[1].split("```")[0].strip()
        elif "```" in full_code:
            full_code = full_code.split("```")[1].split("```")[0].strip()

        if not full_code.strip():
            return "\n--- ACTION FAILED ---\nGenerated code was empty.--- END RESULT ---"

        filename = f"jarvis_script_{int(time.time())}.py"
        filepath = execution_service.save_code(filename, full_code)

        await ws_manager.broadcast("execution:file_ready", {
            "agent_id": "jarvis", "filename": filename, "filepath": filepath,
            "message": f"■ Script saved to workspace/{filename}"
        })

        stdout, stderr, return_code = await asyncio.to_thread(execution_service._run_sync_subprocess, filepath, 15)
        output = stdout.strip() if stdout.strip() else "(No console output)"
        errors = stderr.strip()

        result_text = f"Script Executed: {filename}\nExit Code: {return_code}\n\nConsole Output:\n{output}"
        if errors:
            result_text += f"\n\nError Output:\n{errors}"

        return f"\n--- ACTION RESULT ---\n{result_text}\n--- END RESULT ---\nTell the user you wrote and executed the script."

    async def _email_action(self, msg_clean: str) -> str:
        """Drafts an email based on user command"""
        to = "unknown@example.com"
        subject = "Draft from Jarvis"
        body = "Drafted by AI Platform Jarvis."
        if " to " in msg_clean:
            parts = msg_clean.split(" to ")[1]
            to = parts.split(" ")[0]

        if " about " in msg_clean:
            subject = msg_clean.split(" about ")[1].strip()
            body = f"Regarding {subject},\n\n[Jarvis will generate full body here based on context]"

        try:
            filename = await gsuite_service.draft_email(to, subject, body)
            await ws_manager.broadcast("execution:file_ready", {
                "agent_id": "jarvis", "filename": filename,
                "message": f"■ Email draft saved to workspace/{filename}"
            })
            return (
                f"\n--- ACTION RESULT ---\n"
                f"Email drafted successfully. To: {to}, Subject: {subject}. "
                f"Saved to workspace as {filename}. Google API not connected, operating in Draft Mode.\n"
                f"--- END RESULT ---\nTell the user you drafted the email and saved it to the workspace."
            )
        except Exception as e:
            return f"\n--- ACTION FAILED ---\nFailed to draft email: {str(e)}--- END RESULT ---"

    async def _calendar_action(self, msg_clean: str) -> str:
        """Drafts a calendar event based on user command"""
        title = "Meeting with Jarvis"
        date = time.strftime('%Y-%m-%d')
        time_str = "10:00"
        description = "Scheduled by AI Platform Jarvis."
        if " about " in msg_clean:
            title = msg_clean.split(" about ")[1].strip()
            description = title

        if " tomorrow " in msg_clean:
            from datetime import datetime, timedelta
            tomorrow = datetime.now() + timedelta(days=1)
            date = tomorrow.strftime('%Y-%m-%d')

        try:
            filename = await gsuite_service.draft_calendar_event(title, date, time_str, description)
            await ws_manager.broadcast("execution:file_ready", {
                "agent_id": "jarvis", "filename": filename,
                "message": f"■■ Calendar event saved to workspace/{filename}"
            })
            return (
                f"\n--- ACTION RESULT ---\n"
                f"Calendar event drafted successfully. Title: {title}, Date: {date}. "
                f"Saved to workspace as {filename}. Google API not connected, operating in Draft Mode.\n"
                f"--- END RESULT ---\nTell the user you created the calendar event file and saved it to the workspace."
            )
        except Exception as e:
            return f"\n--- ACTION FAILED ---\nFailed to draft event: {str(e)}--- END RESULT ---"

    async def _execute_latest_script(self) -> str:
        try:
            workspace = execution_service.workspace_dir
            list_of_files = glob.glob(os.path.join(workspace, "*.py"))
            if not list_of_files:
                return "No Python scripts found in workspace."

            latest_file = max(list_of_files, key=os.path.getmtime)
            filename = os.path.basename(latest_file)

            stdout, stderr, return_code = await asyncio.to_thread(execution_service._run_sync_subprocess, latest_file, 15)
            output = stdout.strip() if stdout.strip() else "(No console output)"
            errors = stderr.strip()
            result = f"Script Executed: {filename}\nExit Code: {return_code}\n\nConsole Output:\n{output}"

            if return_code != 0 and errors:
                result += f"\n\nError Output:\n{errors}\n\nAutonomous Mode Activated: Dispatching Coder Agent to self-heal..."
                from app.services.agent_service import agent_service
                asyncio.create_task(agent_service.fix_code(filename, errors))
            return result
        except Exception as e:
            return f"Action Failed: Could not execute script. Error: {str(e)}"

jarvis_service = JarvisService()