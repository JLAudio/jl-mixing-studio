from pathlib import Path

root = Path(__file__).resolve().parents[1]
copy_path = root / "src" / "resources" / "copy.ts"
workflow_path = root / "src" / "AppWorkflows.tsx"

copy_text = copy_path.read_text()
anchor = '    breadcrumbLabel: "Breadcrumb",\n'
addition = '    cancel: "Cancel",\n    close: "Close",\n    currentRevision: "Current revision",\n'
if addition not in copy_text:
    if anchor not in copy_text:
        raise SystemExit("common copy anchor not found")
    copy_text = copy_text.replace(anchor, anchor + addition)
copy_path.write_text(copy_text)

workflow_text = workflow_path.read_text()
workflow_text = workflow_text.replace("productCopy.delivery.cancel", "productCopy.common.cancel")
workflow_text = workflow_text.replace("productCopy.delivery.close", "productCopy.common.close")
workflow_text = workflow_text.replace("productCopy.delivery.currentRevision", "productCopy.common.currentRevision")
workflow_path.write_text(workflow_text)
