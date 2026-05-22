# import asyncio
# import logging
# import httpx
# import urllib.parse
# from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

# logger = logging.getLogger(__name__)

# class BrowserService:
#     def __init__(self):
#         self.is_running = False

#     # --- SEARCH ENGINE (Uses Public APIs - Fast, Free, & Unblockable) ---

#     def _search_web_sync(self, query: str) -> list:
#         """Synchronous search using Hacker News, Reddit, and Wikipedia APIs"""
#         results = []
        
#         headers = {
#             "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
#         }
#         wiki_headers = {
#             "User-Agent": "AI-Platform-Jarvis/1.0 (https://github.com/aiplatform; admin@ai-platform.com)"
#         }
#         reddit_headers = {
#             "User-Agent": "linux:ai-platform-jarvis:v1.0 (by /u/ai-platform)"
#         }
        
#         # 1. Search Hacker News
#         try:
#             hn_url = f"https://hn.algolia.com/api/v1/search?query={urllib.parse.quote(query)}&tags=story&hitsPerPage=3"
#             with httpx.Client(timeout=10.0, headers=headers) as client:
#                 resp = client.get(hn_url)
#                 resp.raise_for_status() 
#                 data = resp.json()
#                 for hit in data.get('hits', []):
#                     url = hit.get('url') or f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
#                     results.append({
#                         "title": hit.get('title', 'No title'),
#                         "url": url,
#                         # FIX: Removed emojis to prevent Llama3 stream crash
#                         "snippet": f"Points: {hit.get('points', 0)} | Comments: {hit.get('num_comments', 0)}"
#                     })
#         except Exception as e:
#             logger.error(f"HN API search failed: {e}")

#         # 2. Search Reddit
#         if not results:
#             try:
#                 reddit_url = f"https://www.reddit.com/search.json?q={urllib.parse.quote(query)}&sort=relevance&t=week&limit=3"
#                 with httpx.Client(timeout=10.0, headers=reddit_headers) as client:
#                     resp = client.get(reddit_url)
#                     resp.raise_for_status()
#                     data = resp.json()
#                     for child in data.get('data', {}).get('children', []):
#                         post = child.get('data', {})
#                         results.append({
#                             "title": post.get('title', 'No title'),
#                             "url": f"https://www.reddit.com{post.get('permalink', '')}",
#                             "snippet": f"Upvotes: {post.get('score', 0)} | Comments: {post.get('num_comments', 0)}"
#                         })
#             except Exception as e:
#                 logger.error(f"Reddit API search failed: {e}")

#         # 3. Search Wikipedia
#         if not results:
#             try:
#                 wiki_url = f"https://en.wikipedia.org/w/api.php?action=opensearch&search={urllib.parse.quote(query)}&limit=2&format=json"
#                 with httpx.Client(timeout=10.0, headers=wiki_headers) as client:
#                     resp = client.get(wiki_url)
#                     resp.raise_for_status()
#                     data = resp.json()
#                     if len(data) > 3:
#                         titles = data[1]
#                         urls = data[3]
#                         for i in range(len(titles)):
#                             results.append({
#                                 "title": titles[i],
#                                 "url": urls[i],
#                                 "snippet": "Wikipedia Article"
#                             })
#             except Exception as e:
#                 logger.error(f"Wikipedia API search failed: {e}")

#         return results

#     async def search_web(self, query: str) -> str:
#         """Search the web using public APIs and return top results"""
#         logger.info(f"\n [Browser] Searching for: {query}")
#         try:
#             results = await asyncio.to_thread(self._search_web_sync, query)
            
#             if not results:
#                 return "No search results found."
            
#             formatted = f"Search Results for: {query}\n\n"
#             for i, r in enumerate(results, 1):
#                 title = r.get("title", "No title")
#                 url = r.get("url", "")
#                 snippet = r.get("snippet", "")
#                 # FIX: Removed emojis here too
#                 formatted += f"{i}. {title}\n   {snippet}\n   URL: {url}\n\n"
#             return formatted

#         except Exception as e:
#             logger.error(f"Browser search error: {e}")
#             return f"Search error: {str(e)}"

#     async def search_web(self, query: str) -> str:
#         """Search the web using public APIs and return top results"""
#         logger.info(f"\n [Browser] Searching for: {query}")
#         try:
#             # Run synchronous search in a thread to not block FastAPI
#             results = await asyncio.to_thread(self._search_web_sync, query)
            
#             if not results:
#                 return "No search results found. The APIs might be temporarily down."
            
#             # Format for Jarvis
#             formatted = f"\n **Search Results for: {query}**\n\n"
#             for i, r in enumerate(results, 1):
#                 title = r.get("title", "No title")
#                 url = r.get("url", "")
#                 snippet = r.get("snippet", "")
#                 formatted += f"{i}. **{title}**\n   {snippet}\n   🔗 {url}\n\n"
#             return formatted

#         except Exception as e:
#             logger.error(f"Browser search error: {e}")
#             return f"\n Search error: {str(e)}"

#     # --- WEB SCRAPER (Uses Playwright - For reading specific URLs) ---

#     def _scrape_page_sync(self, url: str) -> dict:
#         """Synchronous Playwright scrape"""
#         with sync_playwright() as p:
#             browser = p.chromium.launch(
#                 headless=True, 
#                 args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-blink-features=AutomationControlled']
#             )
#             context = browser.new_context(
#                 user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
#             )
#             page = context.new_page()
#             page.goto(url, wait_until="domcontentloaded", timeout=15000)
            
#             text_content = page.evaluate("""
#                 () => {
#                     const main = document.querySelector('main') || document.querySelector('article') || document.body;
#                     return main.innerText.substring(0, 3000);
#                 }
#             """)
#             title = page.title()
#             browser.close()
#             return {"title": title, "text": text_content}

#     async def scrape_page(self, url: str) -> str:
#         """Scrape text content from a URL"""
#         logger.info(f"\n [Browser] Scraping: {url}")
#         try:
#             # Run synchronous playwright in a thread
#             data = await asyncio.to_thread(self._scrape_page_sync, url)
            
#             if not data or not data.get("text"):
#                 return "The page appears to be empty or requires JavaScript rendering."
                
#             return f"\n **{data['title']}**\nURL: {url}\n\n{data['text']}"

#         except PlaywrightTimeout:
#             return "\n Browser timed out. The page took too long to load."
#         except Exception as e:
#             logger.error(f"Browser scrape error: {e}")
#             return f"\n Browser scrape error: {str(e)}"

# # Singleton
# browser_service = BrowserService()
import asyncio
import logging
import httpx
import urllib.parse
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

logger = logging.getLogger(__name__)

class BrowserService:
    def __init__(self):
        self.is_running = False

    def _search_web_sync(self, query: str) -> list:
        results = []
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        wiki_headers = {"User-Agent": "AI-Platform-Jarvis/1.0 (admin@ai-platform.com)"}
        reddit_headers = {"User-Agent": "linux:ai-platform-jarvis:v1.0"}
        
        try:
            hn_url = f"https://hn.algolia.com/api/v1/search?query={urllib.parse.quote(query)}&tags=story&hitsPerPage=3"
            with httpx.Client(timeout=10.0, headers=headers) as client:
                resp = client.get(hn_url)
                resp.raise_for_status() 
                data = resp.json()
                for hit in data.get('hits', []):
                    url = hit.get('url') or f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
                    results.append({
                        "title": hit.get('title', 'No title'),
                        "url": url,
                        "snippet": f"Points: {hit.get('points', 0)} | Comments: {hit.get('num_comments', 0)}"
                    })
        except Exception as e:
            logger.error(f"HN API search failed: {e}")

        if not results:
            try:
                reddit_url = f"https://www.reddit.com/search.json?q={urllib.parse.quote(query)}&sort=relevance&t=week&limit=3"
                with httpx.Client(timeout=10.0, headers=reddit_headers) as client:
                    resp = client.get(reddit_url)
                    resp.raise_for_status()
                    data = resp.json()
                    for child in data.get('data', {}).get('children', []):
                        post = child.get('data', {})
                        results.append({
                            "title": post.get('title', 'No title'),
                            "url": f"https://www.reddit.com{post.get('permalink', '')}",
                            "snippet": f"Upvotes: {post.get('score', 0)} | Comments: {post.get('num_comments', 0)}"
                        })
            except Exception as e:
                logger.error(f"Reddit API search failed: {e}")

        if not results:
            try:
                wiki_url = f"https://en.wikipedia.org/w/api.php?action=opensearch&search={urllib.parse.quote(query)}&limit=2&format=json"
                with httpx.Client(timeout=10.0, headers=wiki_headers) as client:
                    resp = client.get(wiki_url)
                    resp.raise_for_status()
                    data = resp.json()
                    if len(data) > 3:
                        titles = data[1]
                        urls = data[3]
                        for i in range(len(titles)):
                            results.append({"title": titles[i], "url": urls[i], "snippet": "Wikipedia Article"})
            except Exception as e:
                logger.error(f"Wikipedia API search failed: {e}")

        return results

    async def search_web(self, query: str) -> str:
        logger.info(f"\n [Browser] Searching for: {query}")
        try:
            results = await asyncio.to_thread(self._search_web_sync, query)
            if not results:
                return "No search results found."
            
            formatted = f"Search Results for: {query}\n\n"
            for i, r in enumerate(results, 1):
                title = r.get("title", "No title")
                url = r.get("url", "")
                snippet = r.get("snippet", "")
                formatted += f"{i}. {title}\n   {snippet}\n   URL: {url}\n\n"
            return formatted
        except Exception as e:
            logger.error(f"Browser search error: {e}")
            return f"Search error: {str(e)}"

    def _scrape_page_sync(self, url: str) -> dict:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'])
            context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=15000)
            text_content = page.evaluate("() => { const main = document.querySelector('main') || document.querySelector('article') || document.body; return main.innerText.substring(0, 3000); }")
            title = page.title()
            browser.close()
            return {"title": title, "text": text_content}

    async def scrape_page(self, url: str) -> str:
        logger.info(f"\n [Browser] Scraping: {url}")
        try:
            data = await asyncio.to_thread(self._scrape_page_sync, url)
            if not data or not data.get("text"):
                return "The page appears to be empty."
            return f"Title: {data['title']}\nURL: {url}\n\n{data['text']}"
        except PlaywrightTimeout:
            return "Browser timed out."
        except Exception as e:
            logger.error(f"Browser scrape error: {e}")
            return f"Browser scrape error: {str(e)}"

browser_service = BrowserService()