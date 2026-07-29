from pathlib import Path

path = Path("src/App.tsx")
source = path.read_text()

old_routes_import = 'import { routes, type PrimaryRoute, type RouteDefinition } from "./ui/routes";'
if old_routes_import not in source:
    raise SystemExit("routes import not found")
source = source.replace(old_routes_import, 'import type { PrimaryRoute } from "./ui/routes";\nimport { getAppRouteContext } from "./AppRouteContext";', 1)

start_marker = '  const resolvedClient = workspace.status === "ready" && selectedClientId\n'
end_marker = '      : baseRouteDefinition;\n'
start = source.find(start_marker)
if start < 0:
    raise SystemExit("route context start not found")
end = source.find(end_marker, start)
if end < 0:
    raise SystemExit("route context end not found")
end += len(end_marker)

replacement = '''  const {
    resolvedClient,
    resolvedProjectClient,
    resolvedProject,
    deliveryCreationAvailable,
    deliveryCreationHelp,
    activeRouteDefinition,
  } = getAppRouteContext(
    workspace,
    version,
    selectedClientId,
    selectedProject,
    activeRoute,
    projectView,
    deliveryCreationSupported,
  );
'''
source = source[:start] + replacement + source[end:]

for forbidden in ["const resolvedClient =", "const deliveryCreationHelp = (() =>", "const baseRouteDefinition ="]:
    if forbidden in source:
        raise SystemExit(f"inline route derivation remains: {forbidden}")
for required in ["getAppRouteContext(", "resolvedProjectClient,", "activeRouteDefinition,"]:
    if required not in source:
        raise SystemExit(f"route context wiring missing: {required}")

path.write_text(source)
print(f"App.tsx route context extracted; {len(source.splitlines())} lines remain")
