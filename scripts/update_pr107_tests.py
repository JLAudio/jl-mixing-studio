from pathlib import Path

path = Path("src/App.test.tsx")
text = path.read_text()
replacements = {
    '/preserve Delivery Notes and unrelated package files/i': '/Delivery Notes and unrelated files stay in place/i',
    '/every file, folder, edited note, ZIP/i': '/everything currently inside 05_Final_Delivery/i',
    'findByText("Review lifecycle impact")': 'findByText("Check what will change")',
    '/historical approval metadata.*older than current Revision 2/i': '/existing approval record.*older than current Revision 2/i',
    '/intake source files will not be modified/i': '/intake source files will not be changed/i',
    '/existing report remains readable/i': '/still read the current report/i',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"Expected stale assertion not found: {old}")
    text = text.replace(old, new)
path.write_text(text)
