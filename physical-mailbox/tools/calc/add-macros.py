"""Step 2 of 2: turn the sheets from build-register.py into mailbox-register-TEMPLATE.ods with macros.

Run with LibreOffice's own Python (it ships the uno module), from the repo root:

    "C:/Program Files/LibreOffice/program/python.exe" physical-mailbox/tools/calc/add-macros.py

It starts a hidden LibreOffice with a throwaway profile, then:
  1. loads tools/calc/register-sheets.xlsx,
  2. adds the Counter tab first: live counts and one button per job, each wired to a sub in macros/Mailbox.bas,
  3. puts tools/calc/macros/Mailbox.bas in the document as Standard.Mailbox,
  4. binds Open Document (fill typed rows, land on the Counter tab), Save Document Done (the day's
     backup copy), and Content changed on Holders and Payments (codes, dates and box numbers as you type),
  5. saves physical-mailbox/mailbox-register-TEMPLATE.ods,
  6. reopens that file and runs every macro function against it (add a customer, a payment, IDs, a box,
     the call list, the USPS list, a backup, closing a box, the Measure tab and Boxes from measurements,
     fill as you type, typed box numbers, the Python macro, text formats and cell locks), then closes it
     without saving,
  7. opens a copy in a real Calc view and types into it through Calc's own input command, as the
     keyboard does, to check the sheet events fire.
It exits non-zero if any check fails.
"""
import os, sys, time, shutil, subprocess, tempfile, datetime as dt
from pathlib import Path
HERE = Path(__file__).resolve().parent
FOLDER = HERE.parents[1]          # physical-mailbox/
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
import owner_guard  # noqa: E402,F401

import uno  # noqa: E402
from com.sun.star.beans import PropertyValue  # noqa: E402
from com.sun.star.awt import Point, Size  # noqa: E402
from com.sun.star.script import ScriptEventDescriptor  # noqa: E402

SOFFICE = Path(sys.executable).with_name('soffice.exe')
SRC = HERE / 'register-sheets.xlsx'
BAS = HERE / 'macros' / 'Mailbox.bas'
OUT = FOLDER / 'mailbox-register-TEMPLATE.ods'
PORT = 2083
MACRO = 'vnd.sun.star.script:Standard.Mailbox.{}?language=Basic&location=document'

BUTTONS = [
    ('New customer', 'btnNewCustomer', 'Adds them on the Holders tab with the next MB- code and today as the start date, then says what to fill in.'),
    ('Record a payment', 'btnPayment', 'For a payment taken on the POS: suggests the months and the amount from the price, writes the Payments row, shows the new paid-through date.'),
    ('Give a box', 'btnAssignBox', 'Checks both IDs, the 1583 and a payment first. Then offers the Free boxes of their size and shows their new address.'),
    ('Find a customer', 'btnFind', 'By code, box number or part of a name. Jumps to their row on the Holders tab.'),
    ('Close a box', 'btnCloseBox', 'Keys back: writes today as the Closed date and the forwarding address. The box shows Free again.'),
    ('Call list', 'btnCallList', 'Everyone overdue, due within a week, or with an ID to fix, worst first, with what to do. Print it with Ctrl+P.'),
    ('USPS quarterly list', 'btnUSPSList', 'Every open box in name order, to check before the quarterly USPS certification (Jan 15, Apr 15, Jul 15, Oct 15). Print it if the postmaster wants paper.'),
    ('Boxes from measurements', 'btnBoxesFromMeasure', 'After measuring on the Measure tab: adds every measured box to the Boxes tab with its store size. A box someone holds keeps its size.'),
    ('Save and back up', 'btnBackup', 'Saves, and puts a dated copy in Documents\\Mailbox backups. Saving with Ctrl+S makes the day\'s copy too.'),
]
# setFormula takes Calc's own syntax: $Sheet.$A$1 (a dot, not Excel's Sheet!A1) and ; between arguments.
COUNTS = [
    ('Rented boxes', '=COUNTIFS($Holders.$A$2:$A$301;"<>";$Holders.$Z$2:$Z$301;"";$Holders.$B$2:$B$301;"<>")'),
    ('Free boxes', '=COUNTIF($Boxes.$E$2:$E$301;"Free")'),
    ('Overdue', '=COUNTIF($Holders.$M$2:$M$301;"Overdue")'),
    ('Due within a week', '=COUNTIF($Holders.$M$2:$M$301;"Due soon")'),
    ('IDs to fix', '=COUNTIFS($Holders.$A$2:$A$301;"<>";$Holders.$Z$2:$Z$301;"";$Holders.$W$2:$W$301;"<>OK")'),
    ('Ready, waiting on a box', '=COUNTIFS($Holders.$X$2:$X$301;"YES";$Holders.$B$2:$B$301;"";$Holders.$Z$2:$Z$301;"")'),
    ('Taken this month ($)', '=SUMIFS($Payments.$E$2:$E$1201;$Payments.$A$2:$A$1201;">="&DATE(YEAR(TODAY());MONTH(TODAY());1))'),
]


ERRORS = ('#NAME?', '#VALUE!', '#REF!', '#DIV/0!', '#N/A', '#NUM!', '#NULL!', 'Err:')  # not '#' alone: '#10 envelope'


def pv(name, value):
    p = PropertyValue(); p.Name = name; p.Value = value; return p


def url(path):
    return uno.systemPathToFileUrl(str(Path(path).resolve()))


REMOTE = {}  # the remote component context, for services such as DispatchHelper


def start_office():
    profile = Path(tempfile.mkdtemp(prefix='lo-mailbox-'))
    proc = subprocess.Popen([str(SOFFICE), f'-env:UserInstallation={url(profile)}', '--headless', '--invisible', '--norestore', '--nologo',
                             f'--accept=socket,host=127.0.0.1,port={PORT};urp;'])
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
    for _ in range(60):
        try:
            ctx = resolver.resolve(f'uno:socket,host=127.0.0.1,port={PORT};urp;StarOffice.ComponentContext')
            REMOTE.update(ctx=ctx, smgr=ctx.ServiceManager)
            return proc, profile, ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
        except Exception:
            time.sleep(1)
    proc.kill(); raise SystemExit('LibreOffice did not start')


def build(desktop):
    doc = desktop.loadComponentFromURL(url(SRC), '_blank', 0, (pv('Hidden', True),))
    sheets = doc.Sheets
    sheets.insertNewByName('Counter', 0)
    c = sheets.getByName('Counter')
    cell = lambda col, row: c.getCellByPosition(col, row)
    cell(0, 0).setString('Mailbox counter'); cell(0, 0).CharHeight = 18; cell(0, 0).CharWeight = 150
    cell(0, 1).setString("Goin' Postal Forsythe. Press a button: each one asks its questions in small boxes. The counts update by themselves.")
    for i, (label, formula) in enumerate(COUNTS):
        cell(0, 3 + i).setString(label); cell(0, 3 + i).CharWeight = 150
        cell(1, 3 + i).setFormula(formula); cell(1, 3 + i).CharHeight = 14; cell(1, 3 + i).CharWeight = 150
    from com.sun.star.lang import Locale
    loc = Locale('en', 'US', ''); fmts = doc.NumberFormats
    key = fmts.queryKey('[$$-409]#,##0.00', loc, False)
    if key == -1:
        key = fmts.addNew('[$$-409]#,##0.00', loc)
    cell(1, 3 + len(COUNTS) - 1).NumberFormat = key
    cols = c.Columns
    cols.getByIndex(0).Width = 6500; cols.getByIndex(1).Width = 3000; cols.getByIndex(2).Width = 17000
    first = 3 + len(COUNTS) + 1
    cell(0, first).setString('Buttons'); cell(0, first).CharWeight = 150
    dp = c.DrawPage
    models = []
    for i, (label, sub, text) in enumerate(BUTTONS):
        r = first + 1 + i
        c.Rows.getByIndex(r).Height = 1150
        cell(2, r).setString(text); cell(2, r).IsTextWrapped = True; cell(2, r).VertJustify = 2
        m = doc.createInstance('com.sun.star.form.component.CommandButton')
        m.Label = label; m.Name = f'btn{i}'; m.FontHeight = 12; m.FontWeight = 150
        shape = doc.createInstance('com.sun.star.drawing.ControlShape')
        pos = cell(0, r).Position
        shape.setPosition(Point(pos.X + 100, pos.Y + 80))
        shape.setSize(Size(9200, 1000))
        shape.setControl(m)
        dp.add(shape)
        models.append((m.Name, sub))
    form = dp.Forms.getByIndex(0)
    names = [form.getByIndex(i).Name for i in range(form.getCount())]
    for name, sub in models:
        d = ScriptEventDescriptor()
        d.ListenerType = 'XActionListener'; d.EventMethod = 'actionPerformed'; d.AddListenerParam = ''
        d.ScriptType = 'Script'; d.ScriptCode = MACRO.format(sub)
        form.registerScriptEvent(names.index(name), d)
    cell(0, first + len(BUTTONS) + 2).setString('First time on a machine: Tools > Options > LibreOffice > Security > Macro Security > Trusted Sources > Trusted File Locations > Add, and pick the folder this file is in. Then close and reopen it.')
    cell(0, first + len(BUTTONS) + 2).CharColor = 0x9C0006

    libs = doc.BasicLibraries
    if not libs.hasByName('Standard'):
        libs.createLibrary('Standard')
    libs.loadLibrary('Standard')
    lib = libs.getByName('Standard')
    src = BAS.read_text(encoding='utf8').replace('\r\n', '\n')
    if lib.hasByName('Mailbox'):
        lib.replaceByName('Mailbox', src)
    else:
        lib.insertByName('Mailbox', src)
    for event, sub in (('OnLoad', 'OnOpen'), ('OnSaveDone', 'OnSaved')):
        props = (pv('EventType', 'Script'), pv('Script', MACRO.format(sub)))
        uno.invoke(doc.Events, 'replaceByName', (event, uno.Any('[]com.sun.star.beans.PropertyValue', props)))
    # Sheet > Sheet Events > Content changed: a row typed by hand fills in like one added by a button.
    for tab, sub in (('Holders', 'OnHoldersChange'), ('Payments', 'OnPaymentsChange')):
        props = (pv('EventType', 'Script'), pv('Script', MACRO.format(sub)))
        uno.invoke(sheets.getByName(tab).Events, 'replaceByName', ('OnChange', uno.Any('[]com.sun.star.beans.PropertyValue', props)))
    doc.ApplyFormDesignMode = False
    doc.CurrentController.setActiveSheet(c)
    doc.storeToURL(url(OUT), (pv('FilterName', 'calc8'),))
    doc.close(True)


def test(desktop):
    failures = []
    def check(what, ok, got=''):
        print(('  ok   ' if ok else '  FAIL ') + what + ('' if ok else f'  (got {got!r})'))
        if not ok: failures.append(what)
    doc = desktop.loadComponentFromURL(url(OUT), '_blank', 0, (pv('Hidden', True), pv('MacroExecutionMode', 4)))
    sp = doc.getScriptProvider()
    run = lambda name, *a: sp.getScript(MACRO.format(name)).invoke(a, (), ())[0]
    s = doc.Sheets
    h, p, b = s.getByName('Holders'), s.getByName('Payments'), s.getByName('Boxes')
    c = s.getByName('Counter')
    form = s.getByName('Counter').DrawPage.Forms.getByIndex(0)
    check('nine buttons, each bound to a macro', form.getCount() == len(BUTTONS) == 9 and all(form.getScriptEvents(i)[0].ScriptCode.startswith('vnd.sun.star.script:Standard.Mailbox.btn') for i in range(form.getCount())), form.getCount())
    check('the macro module is in the document', doc.BasicLibraries.getByName('Standard').hasByName('Mailbox'))
    check('the Counter tab is first', s.getByIndex(0).Name == 'Counter', s.getByIndex(0).Name)
    TEXT = 256  # com.sun.star.util.NumberFormat.TEXT
    fmt = lambda cell: doc.NumberFormats.getByKey(cell.NumberFormat).Type & TEXT
    check('ID last 4, phone and POS receipt columns are text (0123 stays 0123)',
          all(fmt(h.getCellByPosition(c, 5)) for c in (4, 14, 17)) and fmt(p.getCellByPosition(6, 5)))
    check('yellow cells are unlocked and formula cells locked, for Tools > Protect Sheet',
          not any(h.getCellByPosition(c, 5).CellProtection.IsLocked for c in (0, 1, 2, 13, 14, 20, 25, 26))
          and all(h.getCellByPosition(c, 5).CellProtection.IsLocked for c in (9, 11, 12, 22, 23))
          and not p.getCellByPosition(0, 5).CellProtection.IsLocked and p.getCellByPosition(2, 5).CellProtection.IsLocked
          and not s.getByName('Measure').getCellByPosition(23, 14).CellProtection.IsLocked)
    for tab, sub in (('Holders', 'OnHoldersChange'), ('Payments', 'OnPaymentsChange')):
        ev = {x.Name: x.Value for x in s.getByName(tab).Events.getByName('OnChange')}
        check(f'{tab}: Content changed runs {sub}', ev.get('Script', '').endswith(f'Mailbox.{sub}?language=Basic&location=document'), ev)
    check('a bad name is refused', str(run('AddCustomer', 'X', '', '', 'S', 'Monthly')).startswith('!'))
    check('a nine-digit phone is refused', str(run('AddCustomer', 'Test Person', '318 555 010', '', 'S', 'Monthly')).startswith('!'))
    check('a size that is not Small, Medium, Large or Folder is refused', str(run('AddCustomer', 'Test Person', '318 555 0100', '', 'x', 'Monthly')).startswith('!'))
    pr = s.getByName('Prices')
    check('the Prices tab has a Folder size with a price', (pr.getCellByPosition(0, 4).getString(), pr.getCellByPosition(1, 4).getValue() > 0) == ('Folder', True))
    code = run('AddCustomer', 'Test Person', '318 555 0100', 'test@example.com', 's', 'Monthly')
    check('AddCustomer gives the next code', code == 'MB-002', code)
    row = run('FindHolder', 'MB-002')
    check('FindHolder by code', row == 2, row)
    check('FindHolder by part of a name', run('FindHolder', 'test pers') == 2)
    check('start date is today', int(h.getCellByPosition(8, row).getValue()) == (dt.date.today() - dt.date(1899, 12, 30)).days)
    check('a payment for a code that does not exist is refused', run('AddPayment', 'MB-999', 1, 15.0, '', '') != '')
    check('AddPayment', run('AddPayment', 'MB-002', 1, 15.0, '1001', 'Tester') == '')
    check('the payment row names the customer', p.getCellByPosition(2, 2).getString() == 'Test Person', p.getCellByPosition(2, 2).getString())
    check('status is Current after paying', h.getCellByPosition(12, row).getString() == 'Current', h.getCellByPosition(12, row).getString())
    check('not ready without IDs', 'IDs' in run('NotReadyReason', row))
    check('Give a box is refused before the IDs', run('AssignBox', row, '102') != '')
    today = (dt.date.today() - dt.date(1899, 12, 30)).days
    for col, v in ((13, "Driver's license or state ID"), (14, '1234'), (16, 'Home or vehicle insurance policy'), (17, '5678'), (19, 'Yes'), (21, 'Tester')):
        h.getCellByPosition(col, row).setString(v)
    for col, v in ((15, today + 1000), (18, today + 400), (20, today)):
        h.getCellByPosition(col, row).setValue(v)
    doc.calculateAll()
    check('ready once IDs, 1583 and a payment are in', run('NotReadyReason', row) == '', run('NotReadyReason', row))
    check('FreeBoxes for Small', run('FreeBoxes', 'Small') == '102', run('FreeBoxes', 'Small'))
    check('a box that is not Free is refused', run('AssignBox', row, '101') != '')
    check('AssignBox', run('AssignBox', row, '102') == '')
    check('the Boxes tab shows the new holder', b.getCellByPosition(2, 2).getString() == 'MB-002', b.getCellByPosition(2, 2).getString())
    check('a second box is refused', run('AssignBox', row, '201') != '')
    n = run('BuildCallList')
    check('Call list builds (nobody overdue in the template)', n == 0 and s.hasByName('Call list'), n)
    n = run('BuildUSPSList')
    u = s.getByName('USPS quarterly')
    check('USPS list has both rented boxes in name order', n == 2 and u.getCellByPosition(0, 4).getString() == 'EXAMPLE Jane Doe' and u.getCellByPosition(0, 5).getString() == 'Test Person', n)
    bdir = Path(tempfile.mkdtemp(prefix='mailbox-backup-'))
    path = run('Backup', str(bdir))
    check('Backup writes a dated .ods', Path(path).exists() and Path(path).suffix == '.ods', path)
    docs = uno.fileUrlToSystemPath(REMOTE['smgr'].createInstanceWithContext('com.sun.star.util.PathSettings', REMOTE['ctx']).Work)
    check("the backup folder is in the Documents folder Windows uses (OneDrive's too), unless Lists F1 names one",
          run('BackupFolder') == docs + '\\Mailbox backups' and Path(docs).is_dir(), (run('BackupFolder'), docs))
    money = [run('MoneyValue', v) for v in ('$15', '15.00', ' 1,200 ', 'fifteen', '')]
    check('amounts typed as $15, 15.00 or 1,200 read as dollars; words are refused', money == [15, 15, 1200, -1, -1], money)
    run('CloseHolder', row, 'PO Box 1, Lake Providence')
    doc.calculateAll()
    check('closing writes the date and frees the box', h.getCellByPosition(25, row).getValue() == today and b.getCellByPosition(4, 2).getString() == 'Free', b.getCellByPosition(4, 2).getString())
    check('closing keeps the forwarding address in Notes', 'PO Box 1' in h.getCellByPosition(26, row).getString())
    bad = [(i, c.getCellByPosition(1, 3 + i).getError()) for i in range(len(COUNTS)) if c.getCellByPosition(1, 3 + i).getError()]
    check('every Counter count calculates', not bad, bad)
    check('the Counter counts are right after the test (1 open box, 2 Free)', c.getCellByPosition(1, 3).getValue() == 1 and c.getCellByPosition(1, 4).getValue() == 2, (c.getCellByPosition(1, 3).getValue(), c.getCellByPosition(1, 4).getValue()))
    # Measure tab: rows from 14 (index 13); A box, B-D inches, E cubic, F USPS size, H store size, J check, K-O fits
    m = s.getByName('Measure')
    M = lambda col, row: m.getCellByPosition(col, row)
    check('Measure: a 5 x 5.5 x 14.75 box is 406 cubic inches, USPS size 2, Small, matches Boxes',
          (M(4, 13).getValue(), M(5, 13).getValue(), M(7, 13).getString(), M(9, 13).getString()) == (406, 2, 'Small', 'OK'),
          (M(4, 13).getValue(), M(5, 13).getValue(), M(7, 13).getString(), M(9, 13).getString()))
    check('Measure: an 11 x 5.5 box takes a 9 x 12 envelope, not a Medium Flat Rate Box',
          (M(5, 15).getValue(), M(11, 15).getString(), M(13, 15).getString()) == (3, 'yes', 'no'),
          (M(5, 15).getValue(), M(11, 15).getString(), M(13, 15).getString()))
    for col, v in ((0, 301), (1, 22.5), (2, 12), (3, 14.75)):
        M(col, 16).setValue(v)
    for col, v in ((1, 11), (2, 11)):
        M(col, 13).setValue(v); M(col, 15).setValue(v)   # 101 (held by the example) and 201 (Free) measure Large
    doc.calculateAll()
    check('Measure: a new 22.5 x 12 box is USPS size 5, Large, not on Boxes yet',
          (M(5, 16).getValue(), M(7, 16).getString(), M(9, 16).getString()) == (5, 'Large', 'add to Boxes'),
          (M(5, 16).getValue(), M(7, 16).getString(), M(9, 16).getString()))
    res = run('BoxesFromMeasure')
    check('Boxes from measurements: 1 added, 1 Free box resized, 1 held box left alone', res == '1,1,1', res)
    sizes = {b.getCellByPosition(0, i).getString(): b.getCellByPosition(1, i).getString() for i in range(1, 6)}
    check('the Boxes tab has 301 Large and 201 Large, and 101 kept Small', (sizes.get('301'), sizes.get('201'), sizes.get('101')) == ('Large', 'Large', 'Small'), sizes)
    check('Check says OK for 301 and flags 101', (M(9, 16).getString(), M(9, 13).getString()) == ('OK', 'Boxes says Small'), (M(9, 16).getString(), M(9, 13).getString()))
    check('running it again changes nothing', run('BoxesFromMeasure') == '0,0,1')
    # Typed by hand: a name on an empty row gets the next code and today; a payment code gets today's date.
    hr = 10
    h.getCellByPosition(2, hr).setString('Typed Byhand')
    run('OnHoldersChange', h.getCellRangeByPosition(0, hr, 27, hr))
    doc.calculateAll()
    check('a name typed on an empty Holders row gets the next code and today as start date',
          h.getCellByPosition(0, hr).getString() == 'MB-003' and int(h.getCellByPosition(8, hr).getValue()) == today,
          (h.getCellByPosition(0, hr).getString(), h.getCellByPosition(8, hr).getValue()))
    check('...and its price per term fills in once the size is typed', (h.getCellByPosition(6, hr).setString('Small'), doc.calculateAll(), h.getCellByPosition(9, hr).getValue())[2] == 15, h.getCellByPosition(9, hr).getValue())
    h.getCellByPosition(8, hr).setValue(today - 3)
    run('OnHoldersChange', h.getCellRangeByPosition(2, hr, 2, hr))
    check('a code or start date already there is never changed', h.getCellByPosition(0, hr).getString() == 'MB-003' and int(h.getCellByPosition(8, hr).getValue()) == today - 3)
    sel = doc.createInstance('com.sun.star.sheet.SheetCellRanges')
    pr_ = 20
    p.getCellByPosition(1, pr_).setString('MB-003')
    sel.addRangeAddress(p.getCellRangeByPosition(1, pr_, 1, pr_).getRangeAddress(), False)
    run('OnPaymentsChange', sel)
    check('a payment code typed by hand gets today as its date (several ranges at once too)', int(p.getCellByPosition(0, pr_).getValue()) == today, p.getCellByPosition(0, pr_).getValue())
    # A box number typed by hand on Typed Byhand's row (MB-003, Small)
    def box_entry(v):
        h.getCellByPosition(1, hr).setString(v) if isinstance(v, str) else h.getCellByPosition(1, hr).setValue(v)
        return run('CheckBoxEntry', hr)
    check('a typed box number not on the Boxes tab is added there with the customer size',
          box_entry(305) == 'added' and any(b.getCellByPosition(0, i).getString() == '305' and b.getCellByPosition(1, i).getString() == 'Small' for i in range(1, 12)))
    check('...and typing it again is simply fine', box_entry(305) == '')
    check("a box another open customer holds is refused, naming them", str(box_entry(101)).startswith('!Box 101 is already EXAMPLE Jane Doe'), box_entry(101))
    check('a box number with a space or over 6 characters is refused', str(box_entry('A 12')).startswith('!') and str(box_entry('1234567')).startswith('!'))
    check('the Box # cell keeps a dropdown but takes typed numbers', h.getCellByPosition(1, hr).Validation.Type == uno.Enum('com.sun.star.sheet.ValidationType', 'LIST') and not h.getCellByPosition(1, hr).Validation.ShowErrorMessage)
    h.getCellByPosition(1, hr).clearContents(1 | 2 | 4 | 16)
    for i in range(1, 12):
        if b.getCellByPosition(0, i).getString() == '305':
            b.getCellByPosition(0, i).clearContents(1 | 2 | 4 | 16); b.getCellByPosition(1, i).clearContents(1 | 2 | 4 | 16); b.getCellByPosition(6, i).clearContents(1 | 2 | 4 | 16)
    h.getCellByPosition(0, hr).clearContents(1 | 2 | 4 | 16)
    n = run('FillTypedRows')
    check('opening the register gives a code to a name typed while macros were off', n == 1 and h.getCellByPosition(0, hr).getString() == 'MB-003', (n, h.getCellByPosition(0, hr).getString()))
    for col in (0, 1, 3):
        p.getCellByPosition(col, pr_).clearContents(1 | 2 | 4 | 16)
    for col in (0, 2, 6, 8):
        h.getCellByPosition(col, hr).clearContents(1 | 2 | 4 | 16)
    doc.calculateAll()
    sys.path.insert(0, str(HERE / 'macros' / 'python'))
    import mailbox_tools  # the Python macro, called with the document as it would be from the menu
    n = mailbox_tools.build_box_report(doc)
    br = s.getByName('Box report')
    got = [br.getCellByPosition(c, 4).getString() for c in range(4)]
    fr = 30
    for col, v in ((2, 'Folder Person'), (6, 'Folder'), (7, 'Monthly')):
        h.getCellByPosition(col, fr).setString(v)
    h.getCellByPosition(0, fr).setString('MB-050'); h.getCellByPosition(8, fr).setValue(today)
    doc.calculateAll()
    check('a Folder customer is priced from the Folder row', h.getCellByPosition(9, fr).getValue() == pr.getCellByPosition(1, 4).getValue(), h.getCellByPosition(9, fr).getValue())
    check('AddCustomer takes F for Folder', run('SizeName', 'f') == 'Folder')
    for col in (0, 2, 6, 7, 8):
        h.getCellByPosition(col, fr).clearContents(1 | 2 | 4 | 16)
    doc.calculateAll()
    check('Python macro box_report: 4 boxes, 1 taken, 3 Free', n == 3 and got == ['All', '4', '1', '3'], (n, got))
    for name in ('Holders', 'Payments', 'Boxes', 'Measure'):
        sh = s.getByName(name)
        rng = sh.getCellRangeByPosition(0, 1, {'Holders': 27, 'Measure': 23}.get(name, 8), 40)
        bad = [(name, cc, rr) for rr in range(40) for cc in range(rng.Columns.Count) if rng.getCellByPosition(cc, rr).getError()]
        check(f'no formula errors on {name}', not bad, bad[:3])
    errs = []
    for name in ('Holders', 'Payments', 'Boxes', 'Counter', 'Measure'):
        sh = s.getByName(name)
        cur = sh.createCursor(); cur.gotoEndOfUsedArea(False)
        last = cur.RangeAddress.EndRow
        data = sh.getCellRangeByPosition(0, 0, cur.RangeAddress.EndColumn, min(last, 60)).getDataArray()
        errs += [(name, r, v) for r, line in enumerate(data) for v in line if isinstance(v, str) and v.startswith(ERRORS)]
    check('no formula errors', not errs, errs[:3])
    doc.close(True)
    shutil.rmtree(bdir, ignore_errors=True)
    return failures


def test_typing(desktop):
    """Type into a copy through Calc's own input command, as the keyboard does, and check the sheet events fire."""
    failures = []
    work = Path(tempfile.mkdtemp(prefix='mailbox-typing-')) / 'r.ods'
    shutil.copy(OUT, work)
    doc = desktop.loadComponentFromURL(url(work), '_blank', 0, (pv('MacroExecutionMode', 4),))   # not hidden: typing needs a view
    try:
        ctl = doc.CurrentController
        dh = REMOTE['smgr'].createInstanceWithContext('com.sun.star.frame.DispatchHelper', REMOTE['ctx'])
        h, p = doc.Sheets.getByName('Holders'), doc.Sheets.getByName('Payments')
        def type_in(sheet, col, row, text, filled=None):
            # Enter a cell the way the keyboard does, then wait for the macro's fill, as a person's pace would.
            ctl.setActiveSheet(sheet); ctl.select(sheet.getCellByPosition(col, row))
            dh.executeDispatch(ctl.Frame, '.uno:EnterString', '', 0, (pv('StringName', text),))
            for _ in range(200):   # up to 20 s: the first macro call compiles the module
                if filled is None or filled():
                    break
                time.sleep(0.1)
        bx = doc.Sheets.getByName('Boxes')
        on_boxes = lambda v: [bx.getCellByPosition(1, i).getString() for i in range(1, 12) if bx.getCellByPosition(0, i).getString() == v]
        type_in(h, 2, 2, 'John Roberts', lambda: h.getCellByPosition(0, 2).getString() != '')
        type_in(h, 2, 3, 'Second Person', lambda: h.getCellByPosition(0, 3).getString() != '')
        type_in(p, 1, 2, 'MB-002', lambda: p.getCellByPosition(0, 2).getString() != '')
        type_in(h, 6, 2, 'Small')
        type_in(h, 1, 2, '412', lambda: on_boxes('412'))
        doc.calculateAll()
        new_box = on_boxes('412')
        got = [h.getCellByPosition(0, 2).getString(), h.getCellByPosition(0, 3).getString(), p.getCellByPosition(0, 2).getString() != '', p.getCellByPosition(2, 2).getString(), new_box]
        ok = got == ['MB-002', 'MB-003', True, 'John Roberts', ['Small']]
        print(('  ok   ' if ok else '  FAIL ') + 'typed in Calc: names get MB-002 and MB-003, a payment code gets its date and name, a new box number typed by hand lands on Boxes' + ('' if ok else f'  (got {got!r})'))
        if not ok: failures.append('typing')
    finally:
        doc.close(True)
        shutil.rmtree(work.parent, ignore_errors=True)
    return failures


def main():
    if not SRC.exists():
        raise SystemExit(f'{SRC} is missing: run build-register.py first')
    proc, profile, desktop = start_office()
    try:
        build(desktop)
        print(f'wrote {OUT}')
        failures = test(desktop) + test_typing(desktop)
    finally:
        try: desktop.terminate()
        except Exception: pass
        try: proc.wait(20)
        except Exception: proc.kill()
        shutil.rmtree(profile, ignore_errors=True)
    if failures:
        raise SystemExit(f'{len(failures)} check(s) failed')
    print('all checks passed')


main()
