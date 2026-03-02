import subprocess, sys

cmds = [
    ["git", "add", "src/components/public/NovoAgendamento.tsx"],
    ["git", "commit", "-m", "fix: dark mode no wrapper do modal LGPD em NovoAgendamento"],
    ["git", "push", "origin", "main"],
]

for cmd in cmds:
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=r"C:\Users\alefm\Desktop\jAgendamento")
    print(" ".join(cmd))
    print(r.stdout or r.stderr)
    if r.returncode != 0:
        sys.exit(r.returncode)

print("Deploy concluído!")
