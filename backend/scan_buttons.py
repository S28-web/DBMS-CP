import pathlib
import re

text = pathlib.Path("aditya_l1_space_anomaly_tracker.html").read_text(encoding="utf-8")
script_pos = text.find("<script>")
script_text = text[script_pos:] if script_pos != -1 else ""

buttons = re.findall(r'<button[^>]*id="([^"]+)"', text)
print(f"Total buttons with IDs: {len(buttons)}")

missing = []
has = []
for b in set(buttons):
    if f'"{b}"' in script_text or f"'{b}'" in script_text:
        has.append(b)
    else:
        missing.append(b)

print("\n--- BUTTONS WITH LISTENERS ---")
for b in sorted(has):
    print("  [OK]", b)

print("\n--- BUTTONS MISSING LISTENERS ---")
for b in sorted(missing):
    print("  [MISSING]", b)

# Also check sidebar buttons without IDs (like class sidebar-nav-btn)
sidebar_buttons = re.findall(r'<button[^>]*class="[^"]*sidebar-[^"]*"[^>]*>(.*?)</button>', text, re.DOTALL)
print(f"\nSidebar buttons: {len(sidebar_buttons)}")
