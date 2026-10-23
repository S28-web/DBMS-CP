import base64
import mimetypes
import pathlib
import re

html_path = pathlib.Path("aditya_l1_space_anomaly_tracker.html")
html = html_path.read_text(encoding="utf-8")

def inline_img(match):
    prefix, src, suffix = match.group(1), match.group(2), match.group(3)
    if src.startswith(("data:", "http")):
        return match.group(0)
    p = pathlib.Path(src)
    if p.exists():
        mime = mimetypes.guess_type(str(p))[0] or "image/png"
        b64 = base64.b64encode(p.read_bytes()).decode("ascii")
        print(f"Inlined: {src} -> {len(b64)} b64 chars")
        return f"{prefix}data:{mime};base64,{b64}{suffix}"
    print(f"Not found: {src}")
    return match.group(0)

new_html = re.sub(r'(<img[^>]+src=")([^"]+)(")', inline_img, html)
html_path.write_text(new_html, encoding="utf-8")
print(f"Updated HTML file, new size: {len(new_html)}")
