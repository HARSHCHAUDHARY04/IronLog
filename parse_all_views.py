import json

log_path = "/Users/harshchaudhary/.gemini/antigravity-ide/brain/14d61dfe-bedf-4014-a44b-7444af8ea099/.system_generated/logs/transcript.jsonl"

found_files = []

with open(log_path, 'r') as f:
    for line in f:
        try:
            data = json.loads(line)
            content = data.get('content', '')
            if 'File Path: `file://' in content:
                for c_line in content.split('\n'):
                    if c_line.startswith('File Path: `file://'):
                        fp = c_line.split('file://')[1].split('`')[0]
                        import urllib.parse
                        fp = urllib.parse.unquote(fp)
                        if fp not in found_files:
                            found_files.append(fp)
        except:
            pass

print("Files found in transcript:")
for f in found_files:
    print(f)
