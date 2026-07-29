from pathlib import Path
import re

TEST_FILES = sorted(Path('src').glob('App.*.test.tsx'))
SUPPORT = Path('src/App.testSupport.ts')


def used(body: str, name: str) -> bool:
    return re.search(rf'\b{re.escape(name)}\b', body) is not None


def prune_named_import(text: str, module: str) -> str:
    pattern = re.compile(rf'import \{{([\s\S]*?)\}} from "{re.escape(module)}";')
    match = pattern.search(text)
    if not match:
        return text
    names = [n.strip() for n in match.group(1).replace('\n', ' ').split(',') if n.strip()]
    body = text[:match.start()] + text[match.end():]
    kept = [n for n in names if used(body, n)]
    if not kept:
        replacement = ''
    elif len(kept) <= 5:
        replacement = f'import {{ {", ".join(kept)} }} from "{module}";'
    else:
        replacement = 'import {\n  ' + ',\n  '.join(kept) + f'\n}} from "{module}";'
    return text[:match.start()] + replacement + text[match.end():]


def prune_type_import(text: str) -> str:
    pattern = re.compile(r'import type \{([\s\S]*?)\} from "\.\/types";')
    match = pattern.search(text)
    if not match:
        return text
    names = [n.strip() for n in match.group(1).replace('\n', ' ').split(',') if n.strip()]
    body = text[:match.start()] + text[match.end():]
    kept = [n for n in names if used(body, n)]
    if not kept:
        replacement = ''
    elif len(kept) <= 5:
        replacement = 'import type { ' + ', '.join(kept) + ' } from "./types";'
    else:
        replacement = 'import type {\n  ' + ',\n  '.join(kept) + '\n} from "./types";'
    return text[:match.start()] + replacement + text[match.end():]


for path in TEST_FILES:
    text = path.read_text()
    text = prune_named_import(text, '@testing-library/react')
    text = prune_named_import(text, 'vitest')
    text = prune_named_import(text, './App.testSupport')
    text = prune_type_import(text)
    text = re.sub(r'\n{3,}', '\n\n', text).lstrip()
    path.write_text(text)

support = SUPPORT.read_text()
support = prune_type_import(support)
support = re.sub(r'\n{3,}', '\n\n', support)
SUPPORT.write_text(support)
