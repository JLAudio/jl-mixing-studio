from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for relative in ["src/AppShellViews.tsx", "src/AppProjectViews.tsx", "src/ui/routes.ts"]:
    path = ROOT / relative
    text = path.read_text()
    text = text.replace('import { copy } from "./resources/copy";', 'import { copy as productCopy } from "./resources/copy";')
    text = text.replace('import { copy } from "../resources/copy";', 'import { copy as productCopy } from "../resources/copy";')
    text = text.replace("copy.", "productCopy.")
    path.write_text(text)
