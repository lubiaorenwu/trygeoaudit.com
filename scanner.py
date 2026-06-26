#!/usr/bin/env python3
"""GEO Audit Scanner — standalone brand visibility checker for AI engines."""

import json, sys, re, ssl, socket, time
from urllib.request import Request, urlopen
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

class GEOScanner:
    def __init__(self, brand, domain=""):
        self.brand = brand
        self.domain = domain or brand.lower().replace(" ", "") + ".com"
    
    def _fetch(self, url, timeout=8):
        try:
            req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
            return urlopen(req, timeout=timeout).read().decode(errors="ignore")
        except Exception as e:
            return None

    def check_ssl(self):
        if not self.domain: return {"status": "skipped"}
        host = urlparse(f"https://{self.domain}").hostname or self.domain
        try:
            ctx = ssl.create_default_context()
            with socket.create_connection((host, 443), timeout=8) as s:
                with ctx.wrap_socket(s, server_hostname=host) as ss:
                    cert = ss.getpeercert()
                    return {"status": "ok", "expires": cert.get("notAfter", "?")[:10]}
        except Exception as e:
            return {"status": "fail", "detail": str(e)[:80]}

    def check_robots_txt(self):
        if not self.domain: return {"status": "skipped"}
        content = self._fetch(f"https://{self.domain}/robots.txt")
        if not content:
            return {"status": "missing", "detail": "No robots.txt found"}
        content = content.lower()
        ai_crawlers = ["GPTBot", "Google-Extended", "Anthropic-ai", "CCBot", "PerplexityBot"]
        blocked = [c for c in ai_crawlers if 'disallow' in content.split(c.lower())[-1][:200].lower() if c.lower() in content] if False else []
        # Simpler check
        blocked = [c for c in ai_crawlers if c.lower() in content]
        return {"status": "ok", "ai_crawlers_mentioned": blocked,
                "detail": f"robots.txt present, {len(blocked)} AI crawler references found"}

    def check_schema(self):
        if not self.domain: return {"status": "skipped"}
        html = self._fetch(f"https://{self.domain}/")
        if not html:
            return {"status": "fail", "detail": "Cannot fetch homepage"}
        schemas = re.findall(r'"@type"\s*:\s*"([^"]+)"', html)
        return {"status": "ok" if schemas else "missing",
                "schemas": schemas[:5], "count": len(schemas)}

    def check_bing_index(self):
        if not self.domain: return {"status": "skipped"}
        host = urlparse(f"https://{self.domain}").hostname or self.domain
        html = self._fetch(f"https://www.bing.com/search?q=site:{host}", timeout=10)
        if html and 'no results' not in html.lower():
            # Count approximate results
            count_m = re.search(r'(\d[\d,]*)\s*results', html)
            return {"status": "ok", "indexed": True,
                    "detail": f"Found in Bing index" + (f" (~{count_m.group(1)} pages)" if count_m else "")}
        return {"status": "fail", "indexed": False, "detail": "Not found in Bing — AI engines that use Bing won't see you"}

    def scan(self):
        results = {"brand": self.brand, "domain": self.domain, "checks": {}}
        
        with ThreadPoolExecutor(max_workers=6) as ex:
            futures = {
                ex.submit(self.check_ssl): "ssl",
                ex.submit(self.check_robots_txt): "robots_txt",
                ex.submit(self.check_schema): "schema",
                ex.submit(self.check_bing_index): "bing_index",
            }
            for f in as_completed(futures):
                results["checks"][futures[f]] = f.result()

        # Score
        score = 0
        checks = results["checks"]
        if checks["ssl"]["status"] == "ok": score += 25
        if checks["schema"]["status"] == "ok": score += 25
        if checks["bing_index"].get("indexed"): score += 25
        if len(checks["robots_txt"].get("ai_crawlers_mentioned", [])) > 0: score += 25
        
        results["score"] = score
        results["recommendations"] = self._build_recommendations(checks, score)
        return results
    
    def _build_recommendations(self, checks, score):
        recs = []
        if checks["ssl"]["status"] != "ok":
            recs.append({"level": "critical", "text": "HTTPS broken — fix SSL certificate. AI engines penalize insecure sites."})
        if checks["schema"]["status"] == "missing":
            recs.append({"level": "high", "text": "Add Schema.org JSON-LD markup to help AI understand your content structure."})
        if not checks["bing_index"].get("indexed"):
            recs.append({"level": "high", "text": "Not in Bing index — ChatGPT/DeepSeek use Bing. Submit via IndexNow."})
        if checks["schema"]["status"] == "ok" and checks["schema"].get("count", 0) < 2:
            recs.append({"level": "medium", "text": "Only basic schema found. Add FAQPage, Article, and SoftwareApplication schemas."})
        if checks["robots_txt"].get("status") == "missing":
            recs.append({"level": "low", "text": "No robots.txt — add one to control which AI crawlers can access your site."})
        if score >= 90:
            recs.append({"level": "good", "text": "Technical foundation solid. Next step: build Q&A content targeting AI search queries."})
        return recs

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("brand")
    p.add_argument("--domain", default="")
    args = p.parse_args()
    scanner = GEOScanner(args.brand, args.domain)
    print(json.dumps(scanner.scan(), indent=2, ensure_ascii=False))
