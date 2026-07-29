from pathlib import Path

path = Path('src/App.test.tsx')
text = path.read_text()
replacements = {
    'expect(await screen.findByRole("alert")).toHaveTextContent(/workspace could not be refreshed/i);': 'expect(await screen.findByRole("alert")).toHaveTextContent(/studio could not be refreshed/i);',
    'expect(await screen.findByText(/was created and added to the workspace/i)).toBeInTheDocument();': 'expect(await screen.findByText(/was added to your studio/i)).toBeInTheDocument();',
    'expect(screen.getByRole("alert")).toHaveTextContent(/may have completed/i);\n    expect(mockedInvoke.mock.calls.filter(([command]) => command === "create_client")).toHaveLength(1);': 'expect(screen.getByRole("alert")).toHaveTextContent(/result is uncertain/i);\n    expect(mockedInvoke.mock.calls.filter(([command]) => command === "create_client")).toHaveLength(1);',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'missing expected text: {old}')
    text = text.replace(old, new, 1)
path.write_text(text)
