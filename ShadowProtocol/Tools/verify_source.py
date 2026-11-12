#!/usr/bin/env python3
"""
SHADOW PROTOCOL: NASSER 07 - static source verification for the UE tree.

Runs without Unreal. It cannot prove the project compiles, but it catches the
classes of mistake that hand-written C++ actually produces: undeclared member
definitions, missing includes, wrong .generated.h ordering, unbalanced
delimiters, and copy-paste artefacts.

    python3 ShadowProtocol/Tools/verify_source.py [--strict]

Exit code 0 = clean, 1 = findings. Use it before every commit.
"""

import argparse
import glob
import os
import re
import sys

MODULE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Source", "ShadowProtocol")
PROJECT_INCLUDE_ROOTS = ("Core/", "Character/", "Weapons/", "AI/", "Mission/", "UI/", "World/")

# Copy-paste artefacts seen in this codebase before. Kept as a permanent net.
FORBIDDEN_PATTERNS = [
    (r"FMath::FMath", "doubled FMath namespace"),
    (r"\bStStamina", "doubled identifier (StStamina)"),
    (r"&&\s*false\s*\)", "dead '&& false' condition"),
    (r"\bTODO\b(?!:)", "bare TODO (use 'TODO: <what>')"),
]

problems = []
stats = {}


def read(path):
    with open(path, "r", encoding="utf-8", errors="replace") as handle:
        return handle.read()


def strip_code(src):
    """Remove comments and string literals so delimiters can be counted."""
    out = []
    i, n = 0, len(src)
    while i < n:
        ch = src[i]
        if ch == "/" and i + 1 < n and src[i + 1] == "/":
            while i < n and src[i] != "\n":
                i += 1
        elif ch == "/" and i + 1 < n and src[i + 1] == "*":
            i += 2
            while i + 1 < n and not (src[i] == "*" and src[i + 1] == "/"):
                i += 1
            i += 2
        elif ch == '"':
            i += 1
            while i < n and src[i] != '"':
                i += 2 if src[i] == "\\" else 1
            i += 1
        elif ch == "'":
            i += 1
            while i < n and src[i] != "'":
                i += 2 if src[i] == "\\" else 1
            i += 1
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def collect_files():
    headers = sorted(glob.glob(os.path.join(MODULE, "**", "*.h"), recursive=True))
    sources = sorted(glob.glob(os.path.join(MODULE, "**", "*.cpp"), recursive=True))
    return headers, sources


def check_delimiters(path):
    code = strip_code(read(path))
    rel = os.path.relpath(path, MODULE)
    for open_ch, close_ch, label in (("{", "}", "braces"), ("(", ")", "parens")):
        depth = 0
        line = 1
        for ch in code:
            if ch == "\n":
                line += 1
            elif ch == open_ch:
                depth += 1
            elif ch == close_ch:
                depth -= 1
                if depth < 0:
                    problems.append(f"{rel}:{line}: unmatched '{close_ch}' ({label})")
                    depth = 0
        if depth != 0:
            problems.append(f"{rel}: unbalanced {label} (depth {depth} at end of file)")


def check_generated_include(path):
    src = read(path)
    rel = os.path.relpath(path, MODULE)
    if "GENERATED_BODY" not in src and "UENUM" not in src:
        return
    includes = re.findall(r'#include\s+"([^"]+)"', src)
    generated = [inc for inc in includes if inc.endswith(".generated.h")]
    if not generated:
        problems.append(f"{rel}: reflected types but no .generated.h include")
        return
    if includes[-1] != generated[0]:
        problems.append(f"{rel}: '{generated[0]}' must be the last include (found '{includes[-1]}')")


def check_includes(path):
    rel = os.path.relpath(path, MODULE)
    for inc in re.findall(r'#include\s+"([^"]+)"', read(path)):
        if not inc.startswith(PROJECT_INCLUDE_ROOTS):
            continue
        if not os.path.exists(os.path.join(MODULE, inc)):
            problems.append(f"{rel}: includes missing header '{inc}'")


def check_definition_pairs(header, source):
    header_src = read(header)
    source_src = read(source)
    declared = set(re.findall(r"\b([A-Za-z_]\w*)\s*\(", header_src))
    rel = os.path.relpath(source, MODULE)

    for line_no, line in enumerate(source_src.splitlines(), start=1):
        match = re.match(r"^(?:[A-Za-z_][\w:<>,\*&\s]*?\s)?([A-Z]\w*)::(~?\w+)\s*\(", line)
        if not match:
            continue
        cls, name = match.group(1), match.group(2)
        if name in ("StaticClass",):
            continue
        if name not in declared:
            problems.append(f"{rel}:{line_no}: defines {cls}::{name} but the header does not declare it")


def check_forbidden(path):
    rel = os.path.relpath(path, MODULE)
    src = read(path)
    for pattern, description in FORBIDDEN_PATTERNS:
        for match in re.finditer(pattern, src):
            line = src[: match.start()].count("\n") + 1
            problems.append(f"{rel}:{line}: {description}")


def check_uclass_prefix(path):
    """UCLASS types should be prefixed A/U; USTRUCT/UENUM F/E. Catches copy-paste slips."""
    src = read(path)
    rel = os.path.relpath(path, MODULE)
    for kind, pattern, allowed in (
        ("UCLASS", r"UCLASS\([^)]*\)\s*(?:class|struct)\s+(?:SHADOWPROTOCOL_API\s+)?(\w+)", ("U", "A")),
        ("USTRUCT", r"USTRUCT\([^)]*\)\s*struct\s+(\w+)", ("F",)),
        ("UENUM", r"UENUM\([^)]*\)\s*enum\s+class\s+(\w+)", ("E",)),
    ):
        for name in re.findall(pattern, src):
            if not name.startswith(allowed):
                problems.append(f"{rel}: {kind} '{name}' should start with {'/'.join(allowed)}")


def main():
    parser = argparse.ArgumentParser(description="Static verification for the ShadowProtocol UE module")
    parser.add_argument("--strict", action="store_true", help="treat warnings as failures")
    args = parser.parse_args()

    if not os.path.isdir(MODULE):
        print(f"Module directory not found: {MODULE}")
        return 1

    headers, sources = collect_files()
    stats["headers"] = len(headers)
    stats["sources"] = len(sources)

    for path in headers + sources:
        check_delimiters(path)
        check_forbidden(path)
        check_includes(path)

    for header in headers:
        check_generated_include(header)
        check_uclass_prefix(header)

    pairs = 0
    for header in headers:
        source = header[:-2] + ".cpp"
        if os.path.exists(source):
            pairs += 1
            check_definition_pairs(header, source)
    stats["pairs"] = pairs

    print(f"headers: {stats['headers']}  sources: {stats['sources']}  header/cpp pairs: {stats['pairs']}")

    if problems:
        for entry in problems:
            print(f"  ! {entry}")
        print(f"\n=== {len(problems)} finding(s) ===")
        return 1

    print("\n=== CLEAN: no findings ===")
    print("Note: this proves the source is internally consistent, not that it compiles.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
