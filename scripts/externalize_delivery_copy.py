from pathlib import Path

root = Path(__file__).resolve().parents[1]
copy_file = root / "src/resources/copy.ts"
workflow_file = root / "src/AppWorkflows.tsx"

copy_text = copy_file.read_text()
anchor = '''  activity: {\n    priority: { recovery: "Recovery", overdue: "Overdue", delivery: "Delivery", upcoming: "Upcoming", review: "Review" },'''
delivery = '''  delivery: {
    guided: "Guided delivery",
    createPackage: "Create delivery package",
    rebuildPackage: "Rebuild delivery package",
    replacementMode: "Replacement mode",
    samePathOverwrite: "Same-path overwrite",
    cleanReplacement: "Clean replacement",
    deliveryNotes: "Delivery Notes",
    createZip: "Create delivery ZIP",
    nonDestructiveReplacement: "Non-destructive replacement",
    destructiveReplacement: "Destructive replacement.",
    cancel: "Cancel",
    previewPackage: "Preview package",
    needsVerification: "Delivery needs verification",
    confirmPackage: "Confirm delivery package",
    close: "Close",
    approvedRevision: "Approved revision",
    currentRevision: "Current revision",
    deliveryMethod: "Delivery method",
    files: "Files",
    zip: "ZIP",
    source: "Source",
    type: "Type",
    destination: "Destination",
    notIncluded: "Not included in this delivery",
    deleteItems: "These items will be deleted",
    cleanConfirmationLabel: "Clean replacement confirmation",
    whatWillChange: "What will change",
    creating: "Creating…",
    cleanAndRebuild: "Clean and rebuild delivery",
    rebuildDelivery: "Rebuild delivery",
    createDelivery: "Create delivery",
    overwriteModeSummary: "Overwrite — same delivered path set only",
    overwriteModeShort: "Overwrite — same path set",
    cleanModeSummary: "Clean — delete all existing contents",
    firstPackageSummary: "None — first package",
    notesDeleted: "Deleted and recreated from template",
    notesPreserved: "Preserved",
    notesCreated: "Created from the standard delivery template",
    zipNotCreated: "Not created",
  },
'''
if anchor not in copy_text:
    raise SystemExit("copy anchor missing")
copy_text = copy_text.replace(anchor, delivery + anchor)
copy_file.write_text(copy_text)

text = workflow_file.read_text()
text = text.replace('import { FolderControl, IntakeReportContent, RouteIssues, type ResourceState } from "./AppViews";', 'import { FolderControl, IntakeReportContent, RouteIssues, type ResourceState } from "./AppViews";\nimport { copy as productCopy } from "./resources/copy";')
replacements = {
    '<p className="kicker">Guided delivery</p>': '<p className="kicker">{productCopy.delivery.guided}</p>',
    '? "Create delivery package" : "Rebuild delivery package"': '? productCopy.delivery.createPackage : productCopy.delivery.rebuildPackage',
    '<legend>Replacement mode</legend>': '<legend>{productCopy.delivery.replacementMode}</legend>',
    '<strong>Same-path overwrite</strong>': '<strong>{productCopy.delivery.samePathOverwrite}</strong>',
    '<strong>Clean replacement</strong>': '<strong>{productCopy.delivery.cleanReplacement}</strong>',
    '<dt>Replacement mode</dt>': '<dt>{productCopy.delivery.replacementMode}</dt>',
    '? "Clean — delete all existing contents" : replacing ? "Overwrite — same delivered path set only" : "None — first package"': '? productCopy.delivery.cleanModeSummary : replacing ? productCopy.delivery.overwriteModeSummary : productCopy.delivery.firstPackageSummary',
    '<dt>Delivery Notes</dt>': '<dt>{productCopy.delivery.deliveryNotes}</dt>',
    '? "Deleted and recreated from template" : replacing ? "Preserved" : "Created from the standard delivery template"': '? productCopy.delivery.notesDeleted : replacing ? productCopy.delivery.notesPreserved : productCopy.delivery.notesCreated',
    '<strong>Create delivery ZIP</strong>': '<strong>{productCopy.delivery.createZip}</strong>',
    '<strong>Non-destructive replacement</strong>': '<strong>{productCopy.delivery.nonDestructiveReplacement}</strong>',
    '<strong>Destructive replacement.</strong>': '<strong>{productCopy.delivery.destructiveReplacement}</strong>',
    '>Cancel</button>': '>{productCopy.delivery.cancel}</button>',
    '>Preview package</button>': '>{productCopy.delivery.previewPackage}</button>',
    '? "Delivery needs verification" : "Confirm delivery package"': '? productCopy.delivery.needsVerification : productCopy.delivery.confirmPackage',
    '>Close</button>': '>{productCopy.delivery.close}</button>',
    '<dt>Approved revision</dt>': '<dt>{productCopy.delivery.approvedRevision}</dt>',
    '<dt>Current revision</dt>': '<dt>{productCopy.delivery.currentRevision}</dt>',
    '<dt>Delivery method</dt>': '<dt>{productCopy.delivery.deliveryMethod}</dt>',
    '<dt>Files</dt>': '<dt>{productCopy.delivery.files}</dt>',
    '? "Clean — delete all existing contents" : state.preview.replacementMode === "overwrite" ? "Overwrite — same path set" : "None — first package"': '? productCopy.delivery.cleanModeSummary : state.preview.replacementMode === "overwrite" ? productCopy.delivery.overwriteModeShort : productCopy.delivery.firstPackageSummary',
    '<dt>ZIP</dt>': '<dt>{productCopy.delivery.zip}</dt>',
    ': "Not created"': ': productCopy.delivery.zipNotCreated',
    '<th>Source</th><th>Type</th><th>Destination</th>': '<th>{productCopy.delivery.source}</th><th>{productCopy.delivery.type}</th><th>{productCopy.delivery.destination}</th>',
    '<strong>Not included in this delivery</strong>': '<strong>{productCopy.delivery.notIncluded}</strong>',
    '<h3>These items will be deleted</h3>': '<h3>{productCopy.delivery.deleteItems}</h3>',
    'aria-label="Clean replacement confirmation"': 'aria-label={productCopy.delivery.cleanConfirmationLabel}',
    '<strong>What will change</strong>': '<strong>{productCopy.delivery.whatWillChange}</strong>',
    '{pending ? "Creating…" : state.preview.replacementMode === "clean" ? "Clean and rebuild delivery" : state.preview.replacementMode === "overwrite" ? "Rebuild delivery" : "Create delivery"}': '{pending ? productCopy.delivery.creating : state.preview.replacementMode === "clean" ? productCopy.delivery.cleanAndRebuild : state.preview.replacementMode === "overwrite" ? productCopy.delivery.rebuildDelivery : productCopy.delivery.createDelivery}',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"missing replacement: {old}")
    text = text.replace(old, new)
workflow_file.write_text(text)
