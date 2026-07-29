from pathlib import Path
import re

TESTING = ["cleanup", "fireEvent", "render", "screen", "waitFor", "within"]
VITEST = ["afterEach", "beforeEach", "describe", "expect", "it", "vi"]
SUPPORT = [
    "mockedInvoke", "mockedWriteText", "version", "preflightResult", "createResult",
    "projectPreflightResult", "projectCreateResult", "revisionPreviewResult",
    "revisionCreateResult", "deliveryPreviewResult", "deliveryCreateResult",
    "approvalPreviewResult", "approvalResult", "intakeReport", "intakeNotRun",
    "intakePreview", "healthyWorkspace", "respondWith", "resetAppTestState",
]
TYPES = [
    "ApprovalOperationResult", "ClientOperationResult", "DeliveryOperationResult",
    "IntakeOperationResult", "IntakeReport", "ProjectOperationResult",
    "RevisionOperationResult", "StudioOperationResult", "VersionCheck", "WorkspaceSnapshot",
]

files = sorted(Path("src").glob("App.*.test.tsx"))
assert len(files) == 6, files

for path in files:
    text = path.read_text()
    body_start = text.index("afterEach(cleanup);")
    body = text[body_start:]

    def used(name: str) -> bool:
        return re.search(rf"\b{re.escape(name)}\b", body) is not None

    testing = [name for name in TESTING if used(name)]
    vitest = [name for name in VITEST if used(name)]
    support = [name for name in SUPPORT if used(name)]
    types = [name for name in TYPES if used(name)]

    header = []
    header.append(f'import {{ {", ".join(testing)} }} from "@testing-library/react";')
    header.append(f'import {{ {", ".join(vitest)} }} from "vitest";')
    if support:
        header.append(f'import {{ {", ".join(support)} }} from "./App.testSupport";')
    header.append('import App from "./App";')
    if types:
        header.append(f'import type {{ {", ".join(types)} }} from "./types";')
    path.write_text("\n".join(header) + "\n\n" + body)

    check = path.read_text()
    assert len(re.findall(r'(?m)^  it\("', check)) > 0, path

# Preserve the 65-test guardrail after header repair.
titles = []
for path in files:
    titles.extend(re.findall(r'(?m)^  it\("([^"]+)"', path.read_text()))
assert len(titles) == len(set(titles)) == 65, len(titles)
