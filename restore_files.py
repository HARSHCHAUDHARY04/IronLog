import json

log_path = "/Users/harshchaudhary/.gemini/antigravity-ide/brain/14d61dfe-bedf-4014-a44b-7444af8ea099/.system_generated/logs/transcript.jsonl"

with open(log_path, 'r') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get('type') == 'RUN_COMMAND' and "cat" in data.get('content', ''):
                pass
            if data.get('type') == 'CODE_ACTION' and "view_file" in str(data):
                pass
            if data.get('type') == 'TOOL_RESPONSE' or data.get('type') == 'CODE_ACTION':
                content = data.get('content', '')
                if "File Path:" in content and "The following code has been modified" in content:
                    print("Found file view:", content.split("File Path:")[1].split("\n")[0])
        except Exception as e:
            pass
