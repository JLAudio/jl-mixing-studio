from pathlib import Path
import textwrap

lib_path = Path("src-tauri/src/lib.rs")
tests_path = Path("src-tauri/src/lib_tests.rs")
source = lib_path.read_text()
marker = "#[cfg(test)]\nmod tests {\n"
start = source.index(marker)
body_start = start + len(marker)
if not source.rstrip().endswith("}"):
    raise SystemExit("expected lib.rs test module to end the file")
body = source[body_start:].rstrip()
if not body.endswith("}"):
    raise SystemExit("expected closing brace for lib.rs test module")
body = body[:-1]
body = textwrap.dedent(body).lstrip("\n")
lib_path.write_text(source[:start] + '#[cfg(test)]\n#[path = "lib_tests.rs"]\nmod tests;\n')
tests_path.write_text(body.rstrip() + "\n")
print("moved lib.rs inline tests to src-tauri/src/lib_tests.rs")
