# GEO Audit Scan Tool Redesign Specification

This specification outlines the architecture, data flow, API integration, and front-end requirements for the rewritten `free-scan/index.html` and Cloudflare Worker.

---

## 1. Core Architecture Changes

- **Direct AI Queries:** No longer query Tavily. Each engine (or its corresponding API provider) is queried directly to check if the brand is mentioned.
- **Tiered Scanning (Free vs. Pro):**
  - **Free Scan:** Scans exactly 3 engines: **ChatGPT** (via OpenAI), **DeepSeek**, and **Gemini** (via Google/OpenRouter).
  - **Pro Monitor:** Automatically unlocks all 8+ engines (ChatGPT, DeepSeek, Gemini, Perplexity, Claude, Doubao, Kimi, Qwen).
- **Structured JSON Output:** We use JSON Schema / Structured Outputs on the LLM calls to guarantee a parseable boolean response indicating visibility, along with a citation snippet.
- **Concurrent Operations & Timeout:**
  - All engine API requests are made in parallel using `Promise.all()` or `Promise.allSettled()`.
  - Individual engine queries have a strict **8-second timeout** wrapper.
  - Overall scanning execution must complete in **under 10 seconds**.
- **Security & Obfuscation:**
  - API keys are base64 obfuscated using `atob()` on the client side to avoid simple static-scanner detection in the client repository.
- **Minimum Viable Key Configuration:**
  - The tool can run with only **OpenAI** and **DeepSeek** keys configured. Other engines degrade gracefully (return "Not Found" or "Limited") if their keys are missing.

---

## 2. API Endpoints, Models, and Authentication

### A. ChatGPT (OpenAI API)
- **Endpoint:** `https://api.openai.com/v1/chat/completions`
- **Model:** `gpt-4o-mini`
- **Auth Header:** `Authorization: Bearer <OPENAI_API_KEY>`
- **Structured Output Payload:**
  ```json
  {
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "system",
        "content": "You are a research assistant. Analyze if the brand is cited or mentioned in relation to its industry."
      },
      {
        "role": "user",
        "content": "Search your knowledge base. Is the brand '{{brand}}' mentioned as a solution or company? Answer in JSON."
      }
    ],
    "response_format": {
      "type": "json_schema",
      "json_schema": {
        "name": "geo_audit",
        "strict": true,
        "schema": {
          "type": "object",
          "properties": {
            "cited": { "type": "boolean" },
            "snippet": { "type": "string" }
          },
          "required": ["cited", "snippet"],
          "additionalProperties": false
        }
      }
    }
  }
  ```

### B. DeepSeek
- **Endpoint:** `https://api.deepseek.com/v1/chat/completions`
- **Model:** `deepseek-chat`
- **Auth Header:** `Authorization: Bearer <DEEPSEEK_API_KEY>`
- **Format:** Structured JSON completion.

### C. Gemini (Google Generative AI / OpenRouter)
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=<GEMINI_API_KEY>`
- **Model:** `gemini-1.5-flash`
- **Format:** JSON schema output.

### D. Extra Pro Engines (Perplexity, Claude, Doubao, Kimi, Qwen)
- Authenticated and routed similarly using respective API endpoints or OpenRouter as a unified gateway for maximum performance and minimum key management.

---

## 3. Graceful Key Degradation

If a non-essential key is missing or undefined:
- The engine result is returned as `cited: false` or marked as `status: "limited"`.
- It does not crash the application.
- The scanner proceeds seamlessly.
