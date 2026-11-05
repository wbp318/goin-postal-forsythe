"""Python macros for the mailbox register: an example of Calc plus Python, and a useful one.

Install once per machine (see the README, "Python with Calc"): copy this file to
    %APPDATA%\\LibreOffice\\4\\user\\Scripts\\python\\mailbox_tools.py
(make the Scripts\\python folders if they are not there), restart LibreOffice, open the register,
then Tools > Macros > Run Macro > My Macros > mailbox_tools > box_report > Run.

Inside LibreOffice, XSCRIPTCONTEXT is given to every Python macro: it is the open document.
Cells are read and written by position, (column, row), both counted from 0: A1 is (0, 0).
"""


def _sheet(doc, name):
    return doc.Sheets.getByName(name)


def _rows(sheet, cols, first=1, last=300):
    """The text of columns `cols` for every row whose first column is filled."""
    data = sheet.getCellRangeByPosition(0, first, max(cols), last).getDataArray()
    return [[str(line[c]).strip() for c in cols] for line in data if str(line[cols[0]]).strip()]


def box_report(*_args):
    """The menu entry: Tools > Macros > Run Macro > My Macros > mailbox_tools > box_report."""
    build_box_report(XSCRIPTCONTEXT.getDocument())  # noqa: F821 - XSCRIPTCONTEXT is given by LibreOffice


def build_box_report(doc):
    """A 'Box report' tab: per store size, how many boxes, taken, Free, and the monthly income.

    Takes the document instead of asking LibreOffice for it, so a script outside Calc can call it too
    (that is how it is tested). Returns how many sizes it reported.
    """
    doc.calculateAll()
    boxes = _rows(_sheet(doc, 'Boxes'), [0, 1, 4])           # Box #, Size, Status
    prices = {size: float(p or 0) for size, p in _rows(_sheet(doc, 'Prices'), [0, 1], 1, 3)}
    sizes = list(prices) + sorted({b[1] for b in boxes if b[1] and b[1] not in prices})
    if doc.Sheets.hasByName('Box report'):
        doc.Sheets.removeByName('Box report')
    doc.Sheets.insertNewByName('Box report', doc.Sheets.getCount())
    out = _sheet(doc, 'Box report')
    head = ('Size', 'Boxes', 'Taken', 'Free', 'Monthly price', 'Taken now, a month', 'All full, a month')
    for c, v in enumerate(head):
        out.getCellByPosition(c, 0).setString(v)
        out.getCellByPosition(c, 0).CharWeight = 150
    r = 1
    for size in sizes + ['All']:
        mine = [b for b in boxes if size == 'All' or b[1] == size]
        taken = sum(1 for b in mine if b[2] not in ('Free', ''))
        price = prices.get(size, 0.0)
        row = [size, len(mine), taken, len(mine) - taken]
        if size == 'All':
            row += ['', sum(prices.get(b[1], 0) for b in mine if b[2] not in ('Free', '')), sum(prices.get(b[1], 0) for b in mine)]
        else:
            row += [price, taken * price, len(mine) * price]
        for c, v in enumerate(row):
            cell = out.getCellByPosition(c, r)
            cell.setValue(v) if isinstance(v, (int, float)) else cell.setString(v)
        r += 1
    out.getCellByPosition(0, r + 1).setString('Built by the box_report Python macro. Run it again any time; it replaces this tab.')
    doc.CurrentController.setActiveSheet(out)
    return r - 2  # sizes reported, for tests


g_exportedScripts = (box_report,)
