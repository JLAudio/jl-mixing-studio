from pathlib import Path

path = Path("src/App.test.tsx")
text = path.read_text()

replacements = {
    'name: "1 derived task"': 'name: "1 task"',
    'name: "1 derived event"': 'name: "1 event"',
    '/not a complete audit log/i': '/supported project milestones/i',
    'name: "No derived tasks"': 'name: "Nothing needs your attention"',
    'name: "No supported activity events"': 'name: "No recent activity yet"',
    '/no approved client-edit command/i': '/client editing.*available yet/i',
    'name: "Authoritative files"': 'name: "Project files"',
    'getByText("Delivery manifest")': 'getByText("Delivery details")',
    'getByText("No delivery package recorded")': 'getByText("No delivery package yet")',
    '/did not re-hash delivery files/i': '/did not re-check the delivery files/i',
    'getByText("Replacement review required")': 'getByText("New delivery available")',
    '/existing package represents Revision 1.*approved Revision 2/i': '/current package contains Revision 1.*approved Revision 2/i',
    '/only validated clients and projects are shown/i': '/clients and projects we can read are still available/i',
    'name: "Workspace not found"': 'name: "Your studio workspace isn’t ready yet"',
    'name: "No clients or projects yet"': 'name: "Your studio is ready for its first client"',
    '/create the first client/i': '/ready to get started/i',
    'name: "The workspace cannot be read safely"': 'name: "We can’t read this studio setup yet"',
}

for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"Expected stale copy assertion not found: {old}")
    text = text.replace(old, new)

path.write_text(text)
