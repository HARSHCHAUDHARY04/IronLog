import json

log_path = "/Users/harshchaudhary/.gemini/antigravity-ide/brain/14d61dfe-bedf-4014-a44b-7444af8ea099/.system_generated/logs/transcript.jsonl"

files_recovered = {}

with open(log_path, 'r') as f:
    for line in f:
        try:
            data = json.loads(line)
            # Look at TOOL_RESPONSE which contains the view_file output
            if data.get('type') == 'TOOL_RESPONSE' or data.get('type') == 'PLANNER_RESPONSE' or data.get('type') == 'CODE_ACTION':
                content = data.get('content', '')
                if 'The following code has been modified to include a line number' in content:
                    lines = content.split('\n')
                    filepath = None
                    file_content = []
                    for l in lines:
                        if l.startswith('File Path:'):
                            filepath = l.split('file://')[1].split('`')[0]
                        elif 'The following code has been modified' in l:
                            continue
                        elif l.startswith('The above content shows the entire, complete file'):
                            continue
                        elif ':' in l and l.split(':')[0].isdigit():
                            # Remove the line number
                            idx = l.find(': ')
                            if idx != -1:
                                file_content.append(l[idx+2:])
                    
                    if filepath and filepath.endswith('.tsx') or filepath.endswith('.ts'):
                        files_recovered[filepath] = '\n'.join(file_content)
        except Exception as e:
            pass

for filepath, content in files_recovered.items():
    if "Desktop/fitness app/ironlog" in filepath:
        # urldecode path
        import urllib.parse
        decoded_path = urllib.parse.unquote(filepath)
        print("Recovering:", decoded_path)
        with open(decoded_path, 'w') as out:
            out.write(content)
