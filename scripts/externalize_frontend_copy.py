from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
RESOURCES = SRC / "resources"
RESOURCES.mkdir(exist_ok=True)

copy_ts = '''/**
 * Tunable user-facing product copy.
 *
 * Keep protocol names, API capabilities, schema identifiers, command flags, and
 * filesystem contract names in the domain code that owns those contracts.
 */
export const copy = {
  common: {
    openFolder: "Open folder",
    copyPath: "Copy path",
    pathCopied: "Path copied.",
    pathCopyFailed: "The path could not be copied.",
    folderOpened: "Folder opened.",
    folderOpenFailed: "The folder could not be opened.",
    resolvingFolder: "Resolving folder…",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    notSet: "Not set",
    planned: "Planned",
    breadcrumbLabel: "Breadcrumb",
  },
  navigation: {
    brandLabel: "JL Mixing Studio",
    primaryLabel: "Primary navigation",
    currentWorkspace: "Current workspace",
    defaultWorkspace: "Default workspace",
    checking: "Checking…",
    unavailable: "Unavailable",
    globalSearchLabel: "Global search",
    globalSearchPlaceholder: "Search everything",
  },
  workspace: {
    issueAttentionSingular: "item needs",
    issueAttentionPlural: "items need",
    issueAttentionSuffix: "attention",
    partialHelp: "Your available clients and projects are still here below.",
    reviewIssues: "Review issues",
    setupKicker: "Setup required",
    setupTitle: "Your studio workspace isn’t ready yet",
    setupBody: "Set up your studio workspace to get started.",
    invalidKicker: "Something doesn’t look right",
    invalidTitle: "We can’t read this studio setup yet",
    invalidBody: "Check the details below, then try again.",
    emptyKicker: "You’re ready to go",
    emptyTitle: "Your studio is ready for its first client",
    emptyBodyPrefix: "Choose",
    emptyBodyAction: "New client",
    emptyBodySuffix: "when you’re ready to get started.",
    issuesKicker: "A few things to check",
    issuesTitle: "Workspace issues",
    fallbackIssueName: "Workspace",
  },
  routes: {
    dashboard: { label: "Dashboard", eyebrow: "Studio overview", title: "What’s happening today?", description: "Here’s what’s happening in the studio and what needs your attention next." },
    studio: { label: "Studio", eyebrow: "Your studio", title: "Studio", description: "Your studio setup, mix defaults, workspace, and troubleshooting details." },
    clients: { label: "Clients", eyebrow: "Who you’re working with", title: "Clients", description: "Find a client, check their defaults, or jump into a project." },
    projects: { label: "Projects", eyebrow: "What you’re working on", title: "Projects", description: "See every project and where each mix stands." },
    tasks: { label: "Tasks", eyebrow: "Up next", title: "Tasks", description: "A quick look at what needs your attention." },
    reports: { label: "Reports", eyebrow: "Project reports", title: "Reports", description: "Find intake, delivery, and other project reports in one place." },
    activity: { label: "Activity Log", eyebrow: "Recent activity", title: "Activity Log", description: "See the latest project updates across the studio." },
    settings: { label: "Settings", eyebrow: "Make it yours", title: "Settings", description: "Adjust how JL Mixing Studio looks and behaves." },
  },
  clients: {
    reading: "Reading clients…",
    loadFailed: "Clients could not be loaded",
    studioKicker: "Your studio",
    singular: "client",
    plural: "clients",
    newClient: "New client",
    searchLabel: "Clients",
    tableClient: "Client",
    tableClientId: "Client ID",
    tableDefaultArtist: "Default artist",
    tableProjects: "Projects",
    detailsLabel: "Client details",
    readOnly: "Read only",
    editingUnavailable: "Client editing isn’t available yet.",
    projectsKicker: "Client projects",
    projectsFor: "Projects for",
    editClient: "Edit client",
    newProject: "New project",
    noProjects: "No projects for this client.",
    createFirstProject: "Create the first project when you’re ready.",
  },
  projects: {
    reading: "Reading projects…",
    loadFailed: "Projects could not be loaded",
    studioKicker: "Your studio",
    singular: "project",
    plural: "projects",
    newProject: "New project",
    searchLabel: "Projects",
    tableProject: "Project",
    tableClient: "Client",
    tableArtist: "Artist",
    current: "Current",
    approved: "Approved",
    delivered: "Delivered",
    revisionPrefix: "Revision",
    tabs: { overview: "Overview", intake: "Intake", revisions: "Revisions", delivery: "Delivery", reports: "Reports", files: "Files", metadata: "Metadata" },
    workflowLabel: "Project workflow",
    revisionStateLabel: "Project revision state",
    informationKicker: "Project information",
    detailsTitle: "Project details",
    projectId: "Project ID",
    deadline: "Deadline",
    audio: "Audio",
    schema: "Schema",
    createdWith: "Created with",
    actionsKicker: "Project actions",
    actionsTitle: "Keep the project moving",
    openDawPlanned: "Open DAW — Planned",
    validateIntake: "Validate intake",
    newRevision: "New revision",
    viewRevisions: "View revisions",
  },
  activity: {
    priority: { recovery: "Recovery", overdue: "Overdue", delivery: "Delivery", upcoming: "Upcoming", review: "Review" },
    event: { clientCreated: "Client created", projectCreated: "Project created", revisionCreated: "Revision created", revisionApproved: "Revision approved", deliveryCreated: "Delivery created" },
    deadlinePrefix: "Deadline",
    revisionPrefix: "Revision",
    openProject: "Open project",
  },
} as const;
'''
(RESOURCES / "copy.ts").write_text(copy_ts)

routes = SRC / "ui" / "routes.ts"
text = routes.read_text()
text = text.replace('export type PrimaryRoute =', 'import { copy } from "../resources/copy";\n\nexport type PrimaryRoute =')
start = text.index('export const routes: RouteDefinition[] = [')
text = text[:start] + '''export const routes: RouteDefinition[] = ([
  "dashboard",
  "studio",
  "clients",
  "projects",
  "tasks",
  "reports",
  "activity",
  "settings",
] as const).map((id) => ({ id, ...copy.routes[id] }));
'''
routes.write_text(text)

shell = SRC / "AppShellViews.tsx"
text = shell.read_text()
text = text.replace('import { routes, type PrimaryRoute, type RouteDefinition } from "./ui/routes";', 'import { routes, type PrimaryRoute, type RouteDefinition } from "./ui/routes";\nimport { copy } from "./resources/copy";')
text = text.replace('label = "Open folder"', 'label = copy.common.openFolder')
replacements = {
    'setMessage("Path copied.")': 'setMessage(copy.common.pathCopied)',
    'safeError(error, "The path could not be copied.")': 'safeError(error, copy.common.pathCopyFailed)',
    'setMessage("Folder opened.")': 'setMessage(copy.common.folderOpened)',
    'safeError(error, "The folder could not be opened.")': 'safeError(error, copy.common.folderOpenFailed)',
    'path ?? "Resolving folder…"': 'path ?? copy.common.resolvingFolder',
    '>Copy path</button>': '>{copy.common.copyPath}</button>',
    'issue.displayName ?? "Workspace"': 'issue.displayName ?? copy.workspace.fallbackIssueName',
    '? "item needs" : "items need"': '? copy.workspace.issueAttentionSingular : copy.workspace.issueAttentionPlural',
    '} attention': '} {copy.workspace.issueAttentionSuffix}',
    '<span>Your available clients and projects are still here below.</span>': '<span>{copy.workspace.partialHelp}</span>',
    '>Review issues</a>': '>{copy.workspace.reviewIssues}</a>',
    '<p className="kicker">Setup required</p>': '<p className="kicker">{copy.workspace.setupKicker}</p>',
    '<h2>Your studio workspace isn’t ready yet</h2>': '<h2>{copy.workspace.setupTitle}</h2>',
    '<p>Set up your studio workspace to get started.</p>': '<p>{copy.workspace.setupBody}</p>',
    '<p className="kicker">Something doesn’t look right</p>': '<p className="kicker">{copy.workspace.invalidKicker}</p>',
    '<h2>We can’t read this studio setup yet</h2>': '<h2>{copy.workspace.invalidTitle}</h2>',
    '<p>Check the details below, then try again.</p>': '<p>{copy.workspace.invalidBody}</p>',
    '<p className="kicker">You’re ready to go</p>': '<p className="kicker">{copy.workspace.emptyKicker}</p>',
    '<h2>Your studio is ready for its first client</h2>': '<h2>{copy.workspace.emptyTitle}</h2>',
    '<p>Choose <strong>New client</strong> when you’re ready to get started.</p>': '<p>{copy.workspace.emptyBodyPrefix} <strong>{copy.workspace.emptyBodyAction}</strong> {copy.workspace.emptyBodySuffix}</p>',
    '<p className="kicker">A few things to check</p>': '<p className="kicker">{copy.workspace.issuesKicker}</p>',
    '<h2 id="issues-heading">Workspace issues</h2>': '<h2 id="issues-heading">{copy.workspace.issuesTitle}</h2>',
    'aria-label="JL Mixing Studio"': 'aria-label={copy.navigation.brandLabel}',
    'aria-label="Primary navigation"': 'aria-label={copy.navigation.primaryLabel}',
    '<small>Current workspace</small>': '<small>{copy.navigation.currentWorkspace}</small>',
    '?? "Default workspace"': '?? copy.navigation.defaultWorkspace',
    '? "Checking…"': '? copy.navigation.checking',
    ': "Unavailable"': ': copy.navigation.unavailable',
    'aria-label="Global search"': 'aria-label={copy.navigation.globalSearchLabel}',
    '<span>Search everything</span>': '<span>{copy.navigation.globalSearchPlaceholder}</span>',
    '<span className="planned-pill">Planned</span>': '<span className="planned-pill">{copy.common.planned}</span>',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"missing shell replacement: {old}")
    text = text.replace(old, new)
text = text.replace('const taskPriorityLabel: Record<DerivedTask["priority"], string> = { recovery: "Recovery", overdue: "Overdue", delivery: "Delivery", upcoming: "Upcoming", review: "Review" };', 'const taskPriorityLabel: Record<DerivedTask["priority"], string> = copy.activity.priority;')
text = text.replace('const activityEventLabel: Record<ActivityEvent["eventType"], string> = { clientCreated: "Client created", projectCreated: "Project created", revisionCreated: "Revision created", revisionApproved: "Revision approved", deliveryCreated: "Delivery created" };', 'const activityEventLabel: Record<ActivityEvent["eventType"], string> = copy.activity.event;')
text = text.replace('`Deadline ${task.deadline} · `', '`${copy.activity.deadlinePrefix} ${task.deadline} · `')
text = text.replace('`${activityEventLabel[event.eventType]} · Revision ${event.revision}`', '`${activityEventLabel[event.eventType]} · ${copy.activity.revisionPrefix} ${event.revision}`')
text = text.replace('>Open project</button>', '>{copy.activity.openProject}</button>')
shell.write_text(text)

project = SRC / "AppProjectViews.tsx"
text = project.read_text()
text = text.replace('} from "./AppShellViews";', '} from "./AppShellViews";\nimport { copy } from "./resources/copy";')
text = text.replace('revision === null ? "Not set" : `Revision ${revision}`', 'revision === null ? copy.common.notSet : `${copy.projects.revisionPrefix} ${revision}`')
replacements = {
    '>Reading clients…</section>': '>{copy.clients.reading}</section>',
    '<strong>Clients could not be loaded</strong>': '<strong>{copy.clients.loadFailed}</strong>',
    '<p className="kicker">Your studio</p>': '<p className="kicker">{copy.clients.studioKicker}</p>',
    '? "client" : "clients"': '? copy.clients.singular : copy.clients.plural',
    '{loading ? "Refreshing…" : "Refresh"}': '{loading ? copy.common.refreshing : copy.common.refresh}',
    '>New client</button>': '>{copy.clients.newClient}</button>',
    '<ContextSearch label="Clients" />': '<ContextSearch label={copy.clients.searchLabel} />',
    '<th scope="col">Client</th><th scope="col">Client ID</th><th scope="col">Default artist</th><th scope="col">Projects</th>': '<th scope="col">{copy.clients.tableClient}</th><th scope="col">{copy.clients.tableClientId}</th><th scope="col">{copy.clients.tableDefaultArtist}</th><th scope="col">{copy.clients.tableProjects}</th>',
    'client.defaultArtist || "Not set"': 'client.defaultArtist || copy.common.notSet',
    'aria-label="Breadcrumb"': 'aria-label={copy.common.breadcrumbLabel}',
    'aria-label="Client details"': 'aria-label={copy.clients.detailsLabel}',
    '<article><span>Client ID</span>': '<article><span>{copy.clients.tableClientId}</span>',
    '<article><span>Default artist</span>': '<article><span>{copy.clients.tableDefaultArtist}</span>',
    '<article><span>Projects</span>': '<article><span>{copy.clients.tableProjects}</span>',
    '<aside className="route-note"><strong>Read only</strong><span>Client editing isn’t available yet.</span></aside>': '<aside className="route-note"><strong>{copy.clients.readOnly}</strong><span>{copy.clients.editingUnavailable}</span></aside>',
    '<p className="kicker">Client projects</p>': '<p className="kicker">{copy.clients.projectsKicker}</p>',
    '>Projects for {client.clientName}</h2>': '>{copy.clients.projectsFor} {client.clientName}</h2>',
    '>Edit client <span>Planned</span></button>': '>{copy.clients.editClient} <span>{copy.common.planned}</span></button>',
    '>New project</button>': '>{copy.clients.newProject}</button>',
    '<strong>No projects for this client.</strong><p>Create the first project when you’re ready.</p>': '<strong>{copy.clients.noProjects}</strong><p>{copy.clients.createFirstProject}</p>',
    '>Reading projects…</section>': '>{copy.projects.reading}</section>',
    '<strong>Projects could not be loaded</strong>': '<strong>{copy.projects.loadFailed}</strong>',
    '? "project" : "projects"': '? copy.projects.singular : copy.projects.plural',
    '<ContextSearch label="Projects" />': '<ContextSearch label={copy.projects.searchLabel} />',
    '<th scope="col">Project</th><th scope="col">Client</th><th scope="col">Artist</th><th scope="col">Current</th><th scope="col">Approved</th><th scope="col">Delivered</th>': '<th scope="col">{copy.projects.tableProject}</th><th scope="col">{copy.projects.tableClient}</th><th scope="col">{copy.projects.tableArtist}</th><th scope="col">{copy.projects.current}</th><th scope="col">{copy.projects.approved}</th><th scope="col">{copy.projects.delivered}</th>',
    'aria-label="Project workflow"': 'aria-label={copy.projects.workflowLabel}',
    'aria-label="Project revision state"': 'aria-label={copy.projects.revisionStateLabel}',
    '<article><span>Current</span>': '<article><span>{copy.projects.current}</span>',
    '<article><span>Approved</span>': '<article><span>{copy.projects.approved}</span>',
    '<article><span>Delivered</span>': '<article><span>{copy.projects.delivered}</span>',
    '<p className="kicker">Project information</p>': '<p className="kicker">{copy.projects.informationKicker}</p>',
    '>Project details</h2>': '>{copy.projects.detailsTitle}</h2>',
    '<div><dt>Client</dt>': '<div><dt>{copy.projects.tableClient}</dt>',
    '<div><dt>Project ID</dt>': '<div><dt>{copy.projects.projectId}</dt>',
    '<div><dt>Artist</dt>': '<div><dt>{copy.projects.tableArtist}</dt>',
    '<div><dt>Deadline</dt>': '<div><dt>{copy.projects.deadline}</dt>',
    'project.deadline ?? "Not set"': 'project.deadline ?? copy.common.notSet',
    '<div><dt>Audio</dt>': '<div><dt>{copy.projects.audio}</dt>',
    '<div><dt>Schema</dt>': '<div><dt>{copy.projects.schema}</dt>',
    '<div><dt>Created with</dt>': '<div><dt>{copy.projects.createdWith}</dt>',
    '<p className="kicker">Project actions</p>': '<p className="kicker">{copy.projects.actionsKicker}</p>',
    '>Keep the project moving</h2>': '>{copy.projects.actionsTitle}</h2>',
    '>Open DAW — Planned</button>': '>{copy.projects.openDawPlanned}</button>',
    '>Validate intake</button>': '>{copy.projects.validateIntake}</button>',
    '>New revision</button>': '>{copy.projects.newRevision}</button>',
    '>View revisions</button>': '>{copy.projects.viewRevisions}</button>',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"missing project replacement: {old}")
    text = text.replace(old, new)
old_tabs = 'const tabs: Array<[ProjectView, string]> = [["overview", "Overview"], ["intake", "Intake"], ["revisions", "Revisions"], ["delivery", "Delivery"], ["reports", "Reports"], ["files", "Files"], ["metadata", "Metadata"]];'
new_tabs = 'const tabs: Array<[ProjectView, string]> = (["overview", "intake", "revisions", "delivery", "reports", "files", "metadata"] as const).map((view) => [view, copy.projects.tabs[view]]);'
if old_tabs not in text:
    raise SystemExit("missing project tabs")
text = text.replace(old_tabs, new_tabs)
project.write_text(text)
'''
