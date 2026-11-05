"""Carry a filled mailbox register into a newer template: the customers stay, the new tabs and buttons arrive.

Run with LibreOffice's own Python, from the repo root, with the register closed in Calc:

    "C:/Program Files/LibreOffice/program/python.exe" physical-mailbox/tools/calc/upgrade-register.py
    "C:/Program Files/LibreOffice/program/python.exe" physical-mailbox/tools/calc/upgrade-register.py --replace
    "C:/Program Files/LibreOffice/program/python.exe" physical-mailbox/tools/calc/upgrade-register.py OLD.ods --template NEW.ods --out OUT.ods
    "C:/Program Files/LibreOffice/program/python.exe" physical-mailbox/tools/calc/upgrade-register.py --self-test

Defaults: OLD is physical-mailbox/mailbox-register.ods, the template is mailbox-register-TEMPLATE.ods,
and OUT is mailbox-register-upgraded.ods next to OLD. The old file is opened read-only and never
written. With --replace, once every check passes, the old file is renamed
mailbox-register-before-upgrade-YYYY-MM-DD.ods (kept, never deleted) and the upgraded file takes
its name.

What it carries, tab by tab, matching columns by their heading so a column that moved still lands
right:
  - every typed cell (a cell that is not a formula in the new template) on Holders, Payments, Boxes,
    Measure and Prices, including the blanks, so deleted example rows stay deleted;
  - each row's cell colours, so the grey example look goes when the rows were typed over;
  - the side cells that are not under a heading: Prices B7 (months a year costs), Measure's store
    sizes and Fits item sizes, Lists F1 (a backup folder override);
  - any tab of your own (pivot tables, notes), copied whole. The Call list, USPS quarterly and Box
    report tabs are left out: their buttons rebuild them.
Formulas, typing checks, the Counter tab and the macros come from the new template.

It checks before saving: the typed cells match the old file one for one, every customer's Status,
Paid through, ID check and Ready match what the old file worked out (a template that changed a
formula on purpose shows up here as a warning), no formula errors, and the macros and buttons are
in. It stops without saving if a check fails.
"""
import os, sys, time, shutil, subprocess, tempfile, argparse, datetime as dt
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
import owner_guard  # noqa: E402,F401

import uno  # noqa: E402
from com.sun.star.beans import PropertyValue  # noqa: E402

SOFFICE = Path(sys.executable).with_name('soffice.exe')
PORT = 2085
FOLDER = HERE.parents[1]          # physical-mailbox/
FORMULA = uno.Enum('com.sun.star.table.CellContentType', 'FORMULA')
EMPTY = uno.Enum('com.sun.star.table.CellContentType', 'EMPTY')
VALUE = uno.Enum('com.sun.star.table.CellContentType', 'VALUE')
CLEAR = 1 | 2 | 4 | 16  # values, dates, strings, formulas; the cell's fill, borders and number format stay

# tab: (header row, first data row, last data row, last column), all counted from 0. Measure stops at Q:
# the USPS chart and the item sizes to its right are the template's, except the CELLS below.
TABLES = {'Holders': (0, 1, 300, 40), 'Payments': (0, 1, 1200, 20), 'Boxes': (0, 1, 300, 20), 'Measure': (12, 13, 312, 16), 'Prices': (0, 1, 3, 10)}
CELLS = {'Prices': ['B7'], 'Measure': ['X14:X18', 'S22:V26'], 'Lists': ['F1']}
REBUILT = {'Call list', 'USPS quarterly', 'Box report'}   # tabs the buttons and macros make again
CHECK_COLS = ['Status', 'Paid through', 'ID check', 'Ready for a box']


def pv(name, value):
    p = PropertyValue(); p.Name = name; p.Value = value; return p


def url(path):
    return uno.systemPathToFileUrl(str(Path(path).resolve()))


def start_office():
    profile = Path(tempfile.mkdtemp(prefix='lo-upgrade-'))
    proc = subprocess.Popen([str(SOFFICE), f'-env:UserInstallation={url(profile)}', '--headless', '--invisible', '--norestore', '--nologo',
                             f'--accept=socket,host=127.0.0.1,port={PORT};urp;'])
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
    for _ in range(60):
        try:
            ctx = resolver.resolve(f'uno:socket,host=127.0.0.1,port={PORT};urp;StarOffice.ComponentContext')
            return proc, profile, ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
        except Exception:
            time.sleep(1)
    proc.kill(); raise SystemExit('LibreOffice did not start')


def stop_office(proc, profile, desktop):
    try: desktop.terminate()
    except Exception: pass
    try: proc.wait(20)
    except Exception: proc.kill()
    shutil.rmtree(profile, ignore_errors=True)


def load(desktop, path, read_only):
    # Macros never run here (MacroExecutionMode 0): no Open Document event, no backup copy on save.
    return desktop.loadComponentFromURL(url(path), '_blank', 0, (pv('Hidden', True), pv('ReadOnly', read_only), pv('MacroExecutionMode', 0)))


def headings(sheet, row, last_col):
    out = {}
    for c, v in enumerate(sheet.getCellRangeByPosition(0, row, last_col, row).getDataArray()[0]):
        t = str(v).strip()
        if t and t not in out:
            out[t] = c
    return out


def copy_cell(src, dst):
    """The old cell's content into the new cell, keeping text as text (a last 4 of 0123 stays 0123)."""
    kind = src.getType()
    if kind == EMPTY:
        dst.clearContents(CLEAR)
    elif kind == VALUE:
        dst.setValue(src.getValue())
    elif kind == FORMULA:       # a formula in the old file, typed in the new template: carry what it showed
        if src.FormulaResultType2 == 1:
            dst.setValue(src.getValue())
        elif src.getString():
            dst.setString(src.getString())
        else:
            dst.clearContents(CLEAR)
    else:
        dst.setString(src.getString())
    dst.CellBackColor = src.CellBackColor


def typed(cell):
    return cell.getType() != FORMULA


def filled(v):
    return str(v) != ''


def upgrade(desktop, old_path, template_path, out_path):
    """Returns (report lines, warnings, failures). Saves out_path only when there are no failures."""
    report, warnings = [], []
    old = load(desktop, old_path, True)
    new = load(desktop, template_path, False)
    try:
        old.calculateAll()
        os_, ns = old.Sheets, new.Sheets
        expected = []   # (sheet, column, row, text the old file showed)
        for tab, (hr, r0, r1, lc) in TABLES.items():
            if not os_.hasByName(tab):
                report.append(f'{tab}: not in the old file (a new tab), kept as the template has it')
                continue
            o, n = os_.getByName(tab), ns.getByName(tab)
            oh, nh = headings(o, hr, lc), headings(n, hr, lc)
            probe = r0 + 1 if r1 > r0 else r0          # the row under the example: formulas only where they belong
            cols = [(name, oh[name], nc, typed(n.getCellByPosition(nc, probe))) for name, nc in nh.items() if name in oh]
            for name in nh:
                if name not in oh:
                    report.append(f'{tab}: column "{name}" is new, filled in by the template')
            for name in oh:
                if name not in nh:
                    warnings.append(f'{tab}: the old column "{name}" is not in the new template, so it was not carried')
            od = o.getCellRangeByPosition(0, r0, lc, r1).getDataArray()
            nd = n.getCellRangeByPosition(0, r0, lc, r1).getDataArray()
            rows = [r for r in range(r0, r1 + 1)
                    if any(filled(od[r - r0][oc]) or filled(nd[r - r0][nc]) for _, oc, nc, t in cols if t)]
            carried = 0
            for r in rows:
                for name, oc, nc, is_typed in cols:
                    src, dst = o.getCellByPosition(oc, r), n.getCellByPosition(nc, r)
                    if is_typed:
                        copy_cell(src, dst)
                        expected.append((n, nc, r, src.getString()))
                        carried += src.getType() != EMPTY
                    else:
                        dst.CellBackColor = src.CellBackColor
            report.append(f'{tab}: {carried} typed cells carried, {sum(1 for r in rows if any(filled(od[r - r0][oc]) for _, oc, _, t in cols if t))} rows')
        for tab, refs in CELLS.items():
            if not (os_.hasByName(tab) and ns.hasByName(tab)):
                continue
            o, n = os_.getByName(tab), ns.getByName(tab)
            for ref in refs:
                orng, nrng = o.getCellRangeByName(ref), n.getCellRangeByName(ref)
                a = nrng.RangeAddress
                for r in range(nrng.Rows.Count):
                    for c in range(nrng.Columns.Count):
                        src, dst = orng.getCellByPosition(c, r), nrng.getCellByPosition(c, r)
                        if typed(dst):
                            copy_cell(src, dst)
                            expected.append((n, a.StartColumn + c, a.StartRow + r, src.getString()))
        own = [os_.getByIndex(i).Name for i in range(os_.getCount())]
        own = [t for t in own if not ns.hasByName(t) and t not in REBUILT]
        for t in own:
            ns.importSheet(old, t, ns.getCount())
            report.append(f'your own tab "{t}" copied (a pivot table on it: right-click it > Refresh)')
        new.calculateAll()

        failures = [f'{n.Name} column {c + 1}, row {r + 1}: old {t!r}, new {n.getCellByPosition(c, r).getString()!r}'
                    for n, c, r, t in expected if n.getCellByPosition(c, r).getString() != t]
        if os_.hasByName('Holders'):
            o, n = os_.getByName('Holders'), ns.getByName('Holders')
            oh, nh = headings(o, 0, 40), headings(n, 0, 40)
            od = o.getCellRangeByPosition(0, 1, 40, 300).getDataArray()
            nd = n.getCellRangeByPosition(0, 1, 40, 300).getDataArray()
            for i, line in enumerate(nd):
                code = str(line[nh['Code']])
                for col in CHECK_COLS:
                    if code and col in oh and col in nh and str(od[i][oh[col]]) != str(line[nh[col]]):
                        warnings.append(f'{code} {col}: was {od[i][oh[col]]!r}, the new template works out {line[nh[col]]!r}')
        errs = []
        for i in range(ns.getCount()):
            sh = ns.getByIndex(i)
            cur = sh.createCursor(); cur.gotoEndOfUsedArea(False)
            end = cur.RangeAddress
            data = sh.getCellRangeByPosition(0, 0, min(end.EndColumn, 40), min(end.EndRow, 1300)).getDataArray()
            errs += [f'{sh.Name} row {r + 1}' for r, line in enumerate(data) for v in line
                     if isinstance(v, str) and v.startswith(('#NAME?', '#VALUE!', '#REF!', '#DIV/0!', '#N/A', '#NUM!', 'Err:'))]
        if errs:
            failures.append(f'formula errors in the upgraded file: {errs[:5]}')
        if not (new.BasicLibraries.hasByName('Standard') and new.BasicLibraries.getByName('Standard').hasByName('Mailbox')):
            failures.append('the macros are missing from the template')
        if failures:
            return report, warnings, failures
        new.storeToURL(url(out_path), (pv('FilterName', 'calc8'),))
    finally:
        old.close(True)
        new.close(True)

    back = load(desktop, out_path, True)
    try:
        ok = (back.Sheets.getByName('Counter').DrawPage.Forms.getByIndex(0).getCount() > 0
              and back.BasicLibraries.getByName('Standard').hasByName('Mailbox'))
    finally:
        back.close(True)
    return report, warnings, [] if ok else ['the saved file lost its buttons or macros']


def locked(path):
    p = Path(path)
    return (p.parent / f'.~lock.{p.name}#').exists()


def self_test(desktop):
    """Fill a copy of the template like a real store would, upgrade it, and check every customer arrives."""
    tmp = Path(tempfile.mkdtemp(prefix='upgrade-test-'))
    template = FOLDER / 'mailbox-register-TEMPLATE.ods'
    old = tmp / 'filled.ods'
    shutil.copy(template, old)
    doc = load(desktop, old, False)
    s = doc.Sheets
    h, p, b, m, pr = (s.getByName(n) for n in ('Holders', 'Payments', 'Boxes', 'Measure', 'Prices'))
    today = (dt.date.today() - dt.date(1899, 12, 30)).days
    for sh in (h, p, b):
        sh.Rows.removeByIndex(1, 1)                 # the store deleted the grey example rows
    m.Rows.removeByIndex(13, 3)
    people = [('MB-002', 301, 'Ada Brown', 'Small'), ('MB-003', 302, 'Cy Dupree', 'Medium'), ('MB-004', '', 'Eve Fontenot', 'Small')]
    for i, (code, box, name, size) in enumerate(people):
        r = 1 + i
        h.getCellByPosition(0, r).setString(code)
        if box: h.getCellByPosition(1, r).setValue(box)
        h.getCellByPosition(2, r).setString(name); h.getCellByPosition(4, r).setString('318 555 01%02d' % i)
        h.getCellByPosition(6, r).setString(size); h.getCellByPosition(7, r).setString('Monthly')
        h.getCellByPosition(8, r).setValue(today - 40)
        h.getCellByPosition(13, r).setString("Driver's license or state ID"); h.getCellByPosition(14, r).setString('0123' if i == 0 else '12%02d' % i)
        h.getCellByPosition(15, r).setValue(today + 900)
        h.getCellByPosition(16, r).setString('Home or vehicle insurance policy'); h.getCellByPosition(17, r).setString('98%02d' % i)
        h.getCellByPosition(18, r).setValue(today + 200); h.getCellByPosition(19, r).setString('Yes')
        h.getCellByPosition(20, r).setValue(today - 40); h.getCellByPosition(21, r).setString('Peter')
    h.getCellByPosition(26, 2).setString('Prefers texts')
    for i, (code, months) in enumerate((('MB-002', 2), ('MB-003', 1), ('MB-004', 1))):
        p.getCellByPosition(0, 1 + i).setValue(today - 40); p.getCellByPosition(1, 1 + i).setString(code)
        p.getCellByPosition(3, 1 + i).setValue(months); p.getCellByPosition(4, 1 + i).setValue(15.0 * months)
        p.getCellByPosition(6, 1 + i).setString('R%d' % (500 + i))
    for i, (box, size) in enumerate(((301, 'Small'), (302, 'Medium'), (303, 'Large'))):
        b.getCellByPosition(0, 1 + i).setValue(box); b.getCellByPosition(1, 1 + i).setString(size)
        m.getCellByPosition(0, 13 + i).setValue(box)
        for c, v in enumerate((5, 5.5, 14.75)): m.getCellByPosition(1 + c, 13 + i).setValue(v)
    pr.getCellByPosition(1, 1).setValue(17); pr.getCellByPosition(1, 6).setValue(11)
    m.getCellByPosition(23, 15).setString('Large')       # the owners sell USPS size 3 as Large
    s.insertNewByName('My notes', s.getCount())
    s.getByName('My notes').getCellByPosition(0, 0).setString('Keys cut Nov 6')
    s.insertNewByName('Call list', s.getCount())
    doc.calculateAll()
    before = {r: [h.getCellByPosition(c, r).getString() for c in (11, 12, 22, 23)] for r in (1, 2, 3)}
    doc.store(); doc.close(True)

    out = tmp / 'upgraded.ods'
    report, warnings, failures = upgrade(desktop, old, template, out)
    checks = []
    def check(what, ok, got=''):
        print(('  ok   ' if ok else '  FAIL ') + what + ('' if ok else f'  (got {got!r})'))
        if not ok: checks.append(what)
    check('the upgrade passes its own checks', not failures, failures)
    check('no warnings when the template is the same', not warnings, warnings)
    if not failures:
        doc = load(desktop, out, True)
        s = doc.Sheets; h, p, b, m, pr = (s.getByName(n) for n in ('Holders', 'Payments', 'Boxes', 'Measure', 'Prices'))
        doc.calculateAll()
        check('three customers, the grey example gone', [h.getCellByPosition(2, r).getString() for r in (1, 2, 3, 4)] == ['Ada Brown', 'Cy Dupree', 'Eve Fontenot', ''],
              [h.getCellByPosition(2, r).getString() for r in (1, 2, 3, 4)])
        check('the example row is not grey any more', h.getCellByPosition(2, 1).CellBackColor != 0xEDEDED, hex(h.getCellByPosition(2, 1).CellBackColor))
        check('paid through, status, ID check and ready match the old file',
              all([h.getCellByPosition(c, r).getString() for c in (11, 12, 22, 23)] == before[r] for r in (1, 2, 3)), before)
        check('a last 4 of 0123 stays 0123, as text', h.getCellByPosition(14, 1).getString() == '0123' and h.getCellByPosition(14, 1).getType() != VALUE, h.getCellByPosition(14, 1).getString())
        check('the note came across', h.getCellByPosition(26, 2).getString() == 'Prefers texts')
        check('the payments came across', [p.getCellByPosition(6, r).getString() for r in (1, 2, 3)] == ['R500', 'R501', 'R502'])
        check('the boxes came across', [b.getCellByPosition(0, r).getString() for r in (1, 2, 3)] == ['301', '302', '303'])
        check('Boxes shows who holds 301', b.getCellByPosition(2, 1).getString() == 'MB-002', b.getCellByPosition(2, 1).getString())
        check('the prices and months a year came across', (pr.getCellByPosition(1, 1).getValue(), pr.getCellByPosition(1, 6).getValue()) == (17, 11))
        check("the owners' store size choice came across", m.getCellByPosition(23, 15).getString() == 'Large')
        check('the measurements came across', m.getCellByPosition(4, 13).getValue() == 406, m.getCellByPosition(4, 13).getValue())
        check('your own tab came across', s.hasByName('My notes') and s.getByName('My notes').getCellByPosition(0, 0).getString() == 'Keys cut Nov 6')
        check('a rebuilt tab (Call list) was left out', not s.hasByName('Call list'))
        check('the buttons and macros are in', s.getByName('Counter').DrawPage.Forms.getByIndex(0).getCount() == 9)
        doc.close(True)

    # A register from v1.82.1, before the Measure tab existed: the real first upgrade.
    v1821 = tmp / 'v1.82.1.ods'
    git = subprocess.run(['git', 'show', 'v1.82.1:physical-mailbox/mailbox-register-TEMPLATE.ods'], cwd=ROOT, capture_output=True)
    if git.returncode == 0:
        v1821.write_bytes(git.stdout)
        report, warnings, failures = upgrade(desktop, v1821, template, tmp / 'from-1821.ods')
        check('a v1.82.1 register upgrades (no Measure tab in it)', not failures and any('Measure: not in the old file' in x for x in report), (failures, report))
    shutil.rmtree(tmp, ignore_errors=True)
    return checks


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('old', nargs='?', default=str(FOLDER / 'mailbox-register.ods'))
    ap.add_argument('--template', default=str(FOLDER / 'mailbox-register-TEMPLATE.ods'))
    ap.add_argument('--out')
    ap.add_argument('--replace', action='store_true', help='after the checks pass, keep the old file under a dated name and put the upgraded one in its place')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args()
    proc, profile, desktop = start_office()
    try:
        if a.self_test:
            bad = self_test(desktop)
            if bad:
                raise SystemExit(f'{len(bad)} check(s) failed')
            print('all checks passed')
            return
        old = Path(a.old)
        if not old.exists():
            raise SystemExit(f'{old} is not there')
        if locked(old):
            raise SystemExit(f'{old.name} is open in Calc (or Calc closed badly). Save and close it, then run this again.')
        if old.resolve() == Path(a.template).resolve():
            raise SystemExit('That is the template itself. Point it at the filled register.')
        out = Path(a.out) if a.out else old.with_name(old.stem + '-upgraded.ods')
        report, warnings, failures = upgrade(desktop, old, a.template, out)
        for line in report:
            print('  ' + line)
        for line in warnings:
            print('  WARNING ' + line)
        if failures:
            for line in failures:
                print('  FAIL ' + line)
            raise SystemExit('Not saved: fix the above, or ask. The old file is untouched.')
        print(f'wrote {out}')
        if a.replace:
            keep = old.with_name(f'{old.stem}-before-upgrade-{dt.date.today():%Y-%m-%d}.ods')
            n = 2
            while keep.exists():
                keep = old.with_name(f'{old.stem}-before-upgrade-{dt.date.today():%Y-%m-%d}-{n}.ods'); n += 1
            os.replace(old, keep)
            os.replace(out, old)
            print(f'kept the old one as {keep.name}; {old.name} is now the upgraded register')
        else:
            print('Open it, look it over, then run again with --replace (or rename it yourself).')
    finally:
        stop_office(proc, profile, desktop)


main()
