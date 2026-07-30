from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"missing expected text for {label}")
    return text.replace(old, new, 1)


copy_path = Path("src/resources/copy.ts")
copy = copy_path.read_text()
copy = replace_once(
    copy,
    '    currentRevision: "Current revision",\n',
    '    currentRevision: "Current revision",\n    back: "Back",\n    checking: "Checking…",\n    project: "Project",\n',
    "shared workflow copy",
)
copy = replace_once(
    copy,
    '    viewRevisions: "View revisions",\n  },\n  delivery: {',
    '''    viewRevisions: "View revisions",
  },
  revision: {
    guided: "Guided revision",
    confirmTitle: "Confirm new revision",
    verificationTitle: "Creation needs verification",
    newTitle: "New revision",
    introPrefix: "Create the next revision for",
    introSuffix: "JL Mixing Studio will create the next revision number, folder, ID, timestamp, and notes file.",
    description: "Revision description",
    optional: "(optional)",
    descriptionHelp: "Leave blank to use the default description. Source files are still added manually.",
    review: "Review revision",
    confirmationIntro: "Nothing has changed yet. Confirm to create one new revision. The currently approved and delivered revisions will stay unchanged.",
    newRevision: "New revision",
    descriptionLabel: "Description",
    creating: "Creating…",
    create: "Create revision",
    uncertainHelp: "Do not create another revision automatically. Close this message, refresh Revisions, and verify the result before trying again.",
  },
  approval: {
    guided: "Guided approval",
    confirmTitle: "Confirm revision approval",
    verificationTitle: "Approval needs verification",
    approvePrefix: "Approve Revision",
    introPrefix: "Record approval for",
    introConnector: "of",
    introSuffix: "The current time will be recorded when you confirm the approval.",
    approvedBy: "Approved by",
    approvedByHelp: "This name is saved with the project approval.",
    review: "Review approval",
    confirmationIntro: "Nothing has changed yet. Confirm to make the selected revision the approved revision and save the new approval details.",
    selectedRevision: "Selected revision",
    currentApprovedRevision: "Current approved revision",
    none: "None",
    approvalTime: "Approval time",
    currentTimeAtExecution: "Current time at execution",
    checkChanges: "Check what will change",
    existingApprovalSuffix: "has an existing approval record that will be replaced.",
    olderThanCurrentConnector: "is older than current",
    deliveryRemainsPrefix: "The existing delivery remains on",
    approving: "Approving…",
    approve: "Approve revision",
    uncertainHelp: "Do not approve the revision again automatically. Close this message, refresh Revisions, and verify the result before trying again.",
  },
  delivery: {''',
    "revision and approval copy domains",
)
for duplicate in [
    '    cancel: "Cancel",\n',
    '    close: "Close",\n',
    '    currentRevision: "Current revision",\n',
]:
    copy = replace_once(copy, duplicate, "", f"remove delivery duplicate {duplicate.strip()}")
copy_path.write_text(copy)

workflow_path = Path("src/AppWorkflows.tsx")
workflow = workflow_path.read_text()
replacements = [
    ('<p className="kicker">Guided revision</p>', '<p className="kicker">{productCopy.revision.guided}</p>', 'revision kicker'),
    ('? "Confirm new revision"', '? productCopy.revision.confirmTitle', 'revision confirm title'),
    ('? "Creation needs verification"\n              : "New revision"', '? productCopy.revision.verificationTitle\n              : productCopy.revision.newTitle', 'revision alternate titles'),
    ('<p className="dialog-intro">Create the next revision for <strong>{project.projectName}</strong>. JL Mixing Studio will create the next revision number, folder, ID, timestamp, and notes file.</p>', '<p className="dialog-intro">{productCopy.revision.introPrefix} <strong>{project.projectName}</strong>. {productCopy.revision.introSuffix}</p>', 'revision intro'),
    ('Revision description <span>(optional)</span>', '{productCopy.revision.description} <span>{productCopy.revision.optional}</span>', 'revision description label'),
    ('<small>Leave blank to use the default description. Source files are still added manually.</small>', '<small>{productCopy.revision.descriptionHelp}</small>', 'revision description help'),
    ('{pending ? "Checking…" : "Review revision"}', '{pending ? productCopy.common.checking : productCopy.revision.review}', 'revision review button'),
    ('<p className="dialog-intro">Nothing has changed yet. Confirm to create one new revision. The currently approved and delivered revisions will stay unchanged.</p>', '<p className="dialog-intro">{productCopy.revision.confirmationIntro}</p>', 'revision confirmation intro'),
    ('<div><dt>Project</dt><dd>{project.projectName}</dd></div>', '<div><dt>{productCopy.common.project}</dt><dd>{project.projectName}</dd></div>', 'revision project label'),
    ('<div><dt>New revision</dt><dd>Revision {state.preview.number}</dd></div>', '<div><dt>{productCopy.revision.newRevision}</dt><dd>Revision {state.preview.number}</dd></div>', 'revision new label'),
    ('<div><dt>Description</dt><dd>{state.preview.description}</dd></div>', '<div><dt>{productCopy.revision.descriptionLabel}</dt><dd>{state.preview.description}</dd></div>', 'revision description summary'),
    ('>Back</button><button ref={confirmButton}', '>{productCopy.common.back}</button><button ref={confirmButton}', 'revision back button'),
    ('{pending ? "Creating…" : "Create revision"}', '{pending ? productCopy.revision.creating : productCopy.revision.create}', 'revision create button'),
    ('<p className="dialog-intro">Do not create another revision automatically. Close this message, refresh Revisions, and verify the result before trying again.</p>', '<p className="dialog-intro">{productCopy.revision.uncertainHelp}</p>', 'revision uncertain help'),
    ('<p className="kicker">Guided approval</p>', '<p className="kicker">{productCopy.approval.guided}</p>', 'approval kicker'),
    ('? "Confirm revision approval"', '? productCopy.approval.confirmTitle', 'approval confirm title'),
    ('? "Approval needs verification"\n              : `Approve Revision ${state.revision.number}`', '? productCopy.approval.verificationTitle\n              : `${productCopy.approval.approvePrefix} ${state.revision.number}`', 'approval alternate titles'),
    ('<p className="dialog-intro">Record approval for <strong>Revision {state.revision.number}</strong> of <strong>{project.projectName}</strong>. The current time will be recorded when you confirm the approval.</p>', '<p className="dialog-intro">{productCopy.approval.introPrefix} <strong>Revision {state.revision.number}</strong> {productCopy.approval.introConnector} <strong>{project.projectName}</strong>. {productCopy.approval.introSuffix}</p>', 'approval intro'),
    ('              Approved by\n', '              {productCopy.approval.approvedBy}\n', 'approval field label'),
    ('<small>This name is saved with the project approval.</small>', '<small>{productCopy.approval.approvedByHelp}</small>', 'approval help'),
    ('{pending ? "Checking…" : "Review approval"}', '{pending ? productCopy.common.checking : productCopy.approval.review}', 'approval review button'),
    ('<p className="dialog-intro">Nothing has changed yet. Confirm to make the selected revision the approved revision and save the new approval details.</p>', '<p className="dialog-intro">{productCopy.approval.confirmationIntro}</p>', 'approval confirmation intro'),
    ('<div><dt>Project</dt><dd>{project.projectName}</dd></div>', '<div><dt>{productCopy.common.project}</dt><dd>{project.projectName}</dd></div>', 'approval project label'),
    ('<div><dt>Selected revision</dt><dd>Revision {state.preview.revision}</dd></div>', '<div><dt>{productCopy.approval.selectedRevision}</dt><dd>Revision {state.preview.revision}</dd></div>', 'approval selected revision'),
    ('<div><dt>Current approved revision</dt><dd>{project.approvedRevision === null ? "None" : `Revision ${project.approvedRevision}`}</dd></div>', '<div><dt>{productCopy.approval.currentApprovedRevision}</dt><dd>{project.approvedRevision === null ? productCopy.approval.none : `Revision ${project.approvedRevision}`}</dd></div>', 'approval current approved'),
    ('<div><dt>Approved by</dt><dd>{state.preview.approvedBy}</dd></div>', '<div><dt>{productCopy.approval.approvedBy}</dt><dd>{state.preview.approvedBy}</dd></div>', 'approval approved by summary'),
    ('<div><dt>Approval time</dt><dd>Current time at execution</dd></div>', '<div><dt>{productCopy.approval.approvalTime}</dt><dd>{productCopy.approval.currentTimeAtExecution}</dd></div>', 'approval time'),
    ('<strong>Check what will change</strong>', '<strong>{productCopy.approval.checkChanges}</strong>', 'approval warning title'),
    ('`Revision ${state.revision.number} has an existing approval record that will be replaced.`', '`${productCopy.projects.revisionPrefix} ${state.revision.number} ${productCopy.approval.existingApprovalSuffix}`', 'approval existing warning'),
    ('`Revision ${state.revision.number} is older than current Revision ${project.currentRevision}.`', '`${productCopy.projects.revisionPrefix} ${state.revision.number} ${productCopy.approval.olderThanCurrentConnector} ${productCopy.projects.revisionPrefix} ${project.currentRevision}.`', 'approval older warning'),
    ('`The existing delivery remains on Revision ${project.deliveredRevision}.`', '`${productCopy.approval.deliveryRemainsPrefix} ${productCopy.projects.revisionPrefix} ${project.deliveredRevision}.`', 'approval delivery warning'),
    ('>Back</button><button ref={confirmButton}', '>{productCopy.common.back}</button><button ref={confirmButton}', 'approval back button'),
    ('{pending ? "Approving…" : "Approve revision"}', '{pending ? productCopy.approval.approving : productCopy.approval.approve}', 'approval submit button'),
    ('<p className="dialog-intro">Do not approve the revision again automatically. Close this message, refresh Revisions, and verify the result before trying again.</p>', '<p className="dialog-intro">{productCopy.approval.uncertainHelp}</p>', 'approval uncertain help'),
]
for old, new, label in replacements:
    workflow = replace_once(workflow, old, new, label)
workflow_path.write_text(workflow)
