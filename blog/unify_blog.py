#!/usr/bin/env python3
"""Unify blog articles: add author byline, update schema author, unify footer."""

import os
import re
import json

BLOG_DIR = '/tmp/trygeoaudit/blog'
INDEX_FILE = os.path.join(BLOG_DIR, 'index.html')

# The unified footer HTML (to replace all existing footers)
UNIFIED_FOOTER = '''<footer class="container">
  <span>GEO Audit &copy; 2026</span>
  <div class="footer-links">
    <a href="/#pricing">Pricing</a>
    <a href="https://5529900303702.gumroad.com/l/sybuc">Deep Report</a>
    <a href="mailto:djh973832@gmail.com">Contact</a>
    <a href="/#privacy">Privacy</a>
    <a href="/blog/">Blog</a>
  </div>
</footer>'''

files = sorted(f for f in os.listdir(BLOG_DIR) if f.endswith('.html') and f != 'index.html')

for filename in files:
    filepath = os.path.join(BLOG_DIR, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # ---- 1. Add author byline after <h1> ----
    # Find the h1 closing tag and insert the byline
    h1_pattern = re.compile(r'(</h1>\s*)\n')
    byline = '</h1>\n\n  <p class="byline-author">By Leo Zhang &middot; Updated June 9, 2026</p>'

    # But some files have <p class="meta"> after h1. We need to put byline BEFORE or replace meta.
    # Actually looking at the example: 
    #   <h1>...</h1>
    #   <p class="meta">Published May 28, 2026 · 5 min read</p>
    # We want:
    #   <h1>...</h1>
    #   <p class="byline-author">By Leo Zhang · Updated June 9, 2026</p>
    #   <p class="meta">Published May 28, 2026 · 5 min read</p>
    
    # Insert byline right after </h1>
    content = re.sub(
        r'(</h1>\s*\n\s*)',
        r'\1  <p class="byline-author">By Leo Zhang &middot; Updated June 9, 2026</p>\n\n',
        content
    )

    # ---- 2. Remove any existing "Published ... Updated ..." line that we'll replace with author byline ----
    # Some files have: <p style="font-size:13px;color:var(--muted);margin-top:32px"><em>Published ...</em></p>
    # or <p style="font-size:13px;color:var(--z500);margin-top:32px"><em>Published ...</em></p>
    # or <p><em>Published ...</em></p>
    # Remove all <p ...><em>Published ...</em></p> lines
    content = re.sub(
        r'<p[^>]*style="[^"]*font-size:13px[^"]*"[^>]*>\s*<em>Published[^<]*</em>\s*</p>\s*\n?',
        '',
        content
    )
    
    # Also remove other publication date lines like: <p style="font-size:13px;color:var(--z500);margin-top:48px"><em>...</em></p>
    # But keep those that have citations/test info (they don't start with "Published")
    # The ones we want to keep: <em>Sources: ...</em>, <em>Test environment: ...</em>, <em>引用来源：...</em>, <em>Originally posted on ...</em>
    # Actually let's be more precise - only remove lines that start with "Published" inside the em tag
    
    # ---- 3. Update Article JSON-LD author ----
    # Find the Article JSON-LD block and update the author field
    def update_article_schema(match):
        block = match.group(0)
        try:
            # Find the JSON part (between <script> and </script>)
            json_start = block.find('{')
            json_end = block.rfind('}') + 1
            json_str = block[json_start:json_end]
            data = json.loads(json_str)
            
            if data.get('@type') == 'Article':
                # Update author to Person type
                data['author'] = {
                    "@type": "Person",
                    "name": "Leo Zhang",
                    "url": "https://trygeoaudit.com/about/"
                }
                new_json_str = json.dumps(data, indent=2, ensure_ascii=False)
                new_block = block[:json_start] + new_json_str + block[json_end:]
                return new_block
        except (json.JSONDecodeError, KeyError):
            pass
        return block

    # Match full script blocks
    content = re.sub(
        r'<script type="application/ld\+json">\s*\{.*?"@type":\s*"Article".*?\}\s*</script>',
        update_article_schema,
        content,
        flags=re.DOTALL
    )

    # ---- 4. Unify footer ----
    # Replace all existing footer blocks with unified footer
    # Match from <footer ...> to </footer>
    content = re.sub(
        r'<footer[^>]*>.*?</footer>',
        UNIFIED_FOOTER,
        content,
        flags=re.DOTALL
    )

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ Updated: {filename}")
    else:
        print(f"⚠ No changes: {filename}")

print("\nDone!")
