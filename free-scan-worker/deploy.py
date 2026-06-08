#!/usr/bin/env python3
"""Deploy geo-free-scan Worker with Tavily API key as secret env var."""

import requests, os, json, sys

# Read Tavily key from env (set before running)
TAVILY_KEY = os.environ.get("TAVILY_API_KEY")
if not TAVILY_KEY:
    print("ERROR: TAVILY_API_KEY environment variable not set")
    print("Usage: TAVILY_API_KEY=tvly-xxx python deploy.py")
    sys.exit(1)

# Cloudflare credentials
TOKEN = "KD3XREZlWO6OmOSjiEbgbjI8AeUA3LxIyHZJkSUFXsA.k8ed4FD2CXNLWjZrkxK6ZxejV-8C8DJBpPUnnVToUrI"
ACCOUNT = "c15be6d9f56d52b99d19b9296f24e63c"
WORKER = "geo-free-scan"

proxy = {"http": "http://172.19.48.1:10808", "https": "http://172.19.48.1:10808"}

with open("worker.js") as f:
    code = f.read()

headers = {
    "Authorization": f"Bearer {TOKEN}",
}

# Upload worker script (multipart for ES module)
boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
metadata = {
    "body_part": "main_module",
    "compatibility_date": "2024-01-01",
}
parts = [
    f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n{json.dumps(metadata)}\r\n',
    f'--{boundary}\r\nContent-Disposition: form-data; name="main_module"; filename="worker.js"\r\nContent-Type: application/javascript\r\n\r\n{code}\r\n',
    f'--{boundary}--\r\n'
]
body = "".join(parts).encode()
headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"

url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/{WORKER}"
r = requests.put(url, headers=headers, data=body, proxies=proxy, timeout=30)
print("Upload status:", r.status_code)
result = r.json()
if not result.get("success"):
    print("FAILED:", json.dumps(result.get("errors", []), indent=2))
    sys.exit(1)
print("SUCCESS: Worker uploaded!")

# Set TAVILY_API_KEY as a secret environment variable
secret_url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/{WORKER}/secrets"
secret_headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}
secret_body = {"name": "TAVILY_API_KEY", "text": TAVILY_KEY, "type": "secret_text"}
sr = requests.put(secret_url, headers=secret_headers, json=secret_body, proxies=proxy, timeout=15)
print("Secret set status:", sr.status_code, sr.json().get("success"))

# Create deployment
deploy_url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/{WORKER}/deployments"
deploy_body = {
    "strategy": "percentage",
    "deployments": [{
        "strategy": "percentage",
        "annotations": {"workers/triggered_by": "api"},
        "rollout": [{"name": "main_module", "percentage": 100}]
    }]
}
dr = requests.post(deploy_url, headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}, json=deploy_body, proxies=proxy, timeout=15)
print("Deploy status:", dr.status_code, dr.json().get("success"))
