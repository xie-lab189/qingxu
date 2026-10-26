import os
ws = r"c:\ProgramData\WorkBuddy\chromium-env\1364dgq\WorkBuddy\2026-10-15-21-42-53\qingxu"
rid = "qx-ppt-docx-20261026"
for d in ["stage1", "stage2/intermediate", "stage3", "working", "trace"]:
    os.makedirs(os.path.join(ws, "output", rid, d), exist_ok=True)
test = os.path.join(ws, "output", rid, "working", "_srv_test.html")
with open(test, "w", encoding="utf-8") as f:
    f.write('<!doctype html><html><head><meta charset="utf-8">'
            '<style>body{font-family:SimSun;font-size:12pt}</style></head>'
            '<body><h1>test</h1><p>hello</p></body></html>')
print("DIRS_OK", test)
