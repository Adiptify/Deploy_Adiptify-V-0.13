import os

root_dir = r"c:\Users\kradi\Projects\GEN_AI\Project_2"
output_file = r"c:\Users\kradi\Projects\GEN_AI\Project_2\Project_Full_Context.md"

exclude_dirs = {'.git', '.github', 'node_modules', 'dist', 'build', '.vscode', 'coverage', '__pycache__', '.venv', 'venv', 'env'}
exclude_files = {'.DS_Store', 'package-lock.json', 'yarn.lock', 'Adiptify_Copyright_Registration.md', 'Project_Full_Context.md'}

allowed_extensions = {
    '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.scss', 
    '.md', '.py', '.java', '.yml', '.yaml', '.sh', '.xml', '.env.example', '.env'
}

with open(output_file, 'w', encoding='utf-8') as outfile:
    outfile.write("# Project Full Context and Source Code\n\n")
    
    for subdir, dirs, files in os.walk(root_dir):
        # Modify dirs in-place to skip excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            if file in exclude_files:
                continue
                
            ext = os.path.splitext(file)[1].lower()
            if ext not in allowed_extensions and file != '.env' and file != '.gitignore' and file != 'Dockerfile':
                continue
                
            filepath = os.path.join(subdir, file)
            rel_path = os.path.relpath(filepath, root_dir)
            
            try:
                with open(filepath, 'r', encoding='utf-8') as infile:
                    content = infile.read()
                    
                    outfile.write(f"## File: `{rel_path}`\n\n")
                    # Use standard markdown code block, try to guess language from extension
                    lang = ext.replace('.', '')
                    if not lang and file == '.env':
                        lang = 'bash'
                    elif not lang and file == 'Dockerfile':
                        lang = 'dockerfile'
                    
                    outfile.write(f"```{lang}\n")
                    outfile.write(content)
                    if not content.endswith('\n'):
                        outfile.write('\n')
                    outfile.write("```\n\n")
            except Exception as e:
                outfile.write(f"## File: `{rel_path}`\n\n")
                outfile.write(f"*Could not read file contents: {e}*\n\n")

print("Context generation complete.")
