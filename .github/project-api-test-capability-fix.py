from pathlib import Path

path = Path('src-tauri/src/cli.rs')
s = path.read_text()
old = '"capabilities":["system.info","client.create","project.create","revision.create","intake.validate","revision.approve","delivery.create"]'
new = '"capabilities":["system.info","client.create","project.create","project.create.effective_artist","revision.create","intake.validate","revision.approve","delivery.create"]'
if old not in s:
    raise SystemExit('cli test discovery capability fixture not found')
path.write_text(s.replace(old, new, 1))
