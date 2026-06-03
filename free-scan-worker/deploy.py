#!/usr/bin/env python3
import requests, os, json

TOKEN = "KD3XREZlWO6OmOSjiEbgbjI8AeUA3LxIyHZJkSUFXsA.k8ed4FD2CXNLWjZrkxK6ZxejV-8C8DJBpPUnnVToUrI"
ACCOUNT = "c15be6d9f56d52b99d19b9296f24e63c"
WORKER = "geo-free-scan"

proxy = {"http": "http://172.19.48.1:10808", "https": "http://172.19.48.1:10808"}

with open("worker.js") as f:
    code = f.read()

# Upload via API
main_module = {
    "main_module": code
}

headers = {
    "Authorization": f"Bearer {TOKEN}",
}

# Use multipart upload for ES module format
import io
# Build metadata
metadata = {
    "body_part": "main_module",
    "compatibility_date": "2024-01-01",
}

boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"

parts = [
    f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n{json.dumps(metadata)}\r\n',
    f'--{boundary}\r\nContent-Disposition: form-data; name="main_module"; filename="worker.js"\r\nContent-Type: application/javascript\r\n\r\n{code}\r\n',
    f'--{boundary}--\r\n'
]

body = "".join(parts).encode()

headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"

url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/{WORKER}"

r = requests.put(url, headers=headers, data=body, proxies=proxy, timeout=30)
print("Status:", r.status_code)
result = r.json()
if result.get("success"):
    print("SUCCESS: Worker uploaded!")
    # Also need to create a route/trigger to make it live
    # Create deployment
    deploy_url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/{WORKER}/deployments"
    deploy_body = {"strategy": "percentage", "deployments": [{"strategy": "percentage", "annotations": {"workers/triggered_by": "api"}, "rollout": [{"name": "main_module", "percentage": 100}]}]}
    dr = requests.post(deploy_url, headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}, json=deploy_body, proxies=proxy, timeout=15)
    print("Deploy status:", dr.status_code, dr.json().get("success"))
else:
    print("FAILED:", json.dumps(result.get("errors", []), indent=2))
