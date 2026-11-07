"""Step 1 of 2: build the mailbox register's sheets, formulas and typing checks with openpyxl.

Writes an intermediate .xlsx (default: register-sheets.xlsx next to this script, git-ignored). Step 2,
add-macros.py, run with LibreOffice's own Python, turns it into mailbox-register-TEMPLATE.ods with the
Counter tab, the buttons and the macros. Run both from the repo root:

    python physical-mailbox/tools/calc/build-register.py
    "C:/Program Files/LibreOffice/program/python.exe" physical-mailbox/tools/calc/add-macros.py
"""
import os, sys, datetime as dt
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'scripts'))
import owner_guard  # noqa: E402,F401  stops a clone that is not set up by an owner
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
from openpyxl.comments import Comment

OUT = sys.argv[1] if len(sys.argv) > 1 else str(Path(__file__).resolve().parent / 'register-sheets.xlsx')
os.makedirs(os.path.dirname(OUT), exist_ok=True)

F = 'Arial'
base = Font(name=F, size=11)
bold = Font(name=F, size=11, bold=True)
head = Font(name=F, size=11, bold=True, color='FFFFFF')
title = Font(name=F, size=16, bold=True, color='1F3A6E')
blue = Font(name=F, size=11, color='0000FF')
grey = Font(name=F, size=10, italic=True, color='666666')
HEAD = PatternFill('solid', fgColor='1F3A6E')
INPUT = PatternFill('solid', fgColor='FFF7CC')
EX = PatternFill('solid', fgColor='EDEDED')
thin = Side(style='thin', color='BBBBBB')
box = Border(left=thin, right=thin, top=thin, bottom=thin)
ROWS = 300  # rows prepared with formulas

wb = Workbook()

# ---------- Start here ----------
st = wb.active; st.title = 'Start here'
lines = [
    ("Goin' Postal Forsythe: mailbox register", title),
    ("Opens in LibreOffice Calc, no internet needed. The buttons are on the Counter tab. Keep the filled-in copy on the counter PC and its backup, never on GitHub: it holds customer details.", base),
    ("", base),
    ("Which cells to type in", bold),
    ("Yellow cells are for typing. White cells are formulas: leave them alone, they fill themselves.", base),
    ("Grey rows are examples. On Holders, Payments and Boxes, delete them (right-click the row number, Delete Rows) before the first real customer. On Measure, type your boxes over them or clear them (select the cells, press Delete): never delete a Measure row, the USPS chart shares those rows.", base),
    ("", base),
    ("A new customer", bold),
    ("1. Holders tab: a new row. Code = MB- and the next number (MB-002, MB-003 ...). Name, phone, email, size, term (Monthly, 6 months or Yearly), start date (today).", base),
    ("2. See both IDs (see the intake packet). Type each ID's type, last 4 and expiry. Never the whole number.", base),
    ("3. Fill in PS Form 1583 with the customer and sign the store's part. Type the date in '1583 signed'.", base),
    ("4. Take the first payment on the POS. Payments tab: a new row with the date, the code, months covered (1, 6 for a 6-month term, 12 for yearly) and the amount.", base),
    ("5. 'Ready for a box' on the Holders tab now says YES. Pick a Free box on the Boxes tab, type its number in the holder's Box # column, hand over the key, tick Keys given.", base),
    ("", base),
    ("Every payment after that", bold),
    ("Payments tab: one row each time. 'Paid through' on the Holders tab moves forward by itself.", base),
    ("", base),
    ("What the Status column means", bold),
    ("Current: paid. Due soon: paid-through date within 7 days. Overdue: past the paid-through date. Closed: Closed date filled in.", base),
    ("ID check: EXPIRED means one of the two IDs on file has passed its expiry; ask for a current one and type it over the old one. 'same kind' means both IDs are the same type, 'no address' means neither shows the home address, 'missing' means an ID is not typed in yet.", base),
    ("Typing checks: a cell that refuses what you typed says why in a box. Dropdown columns only take their list: click the small arrow.", base),
    ("", base),
    ("Closing a box", bold),
    ("Type the Closed date on the holder's row and collect the key. The box shows Free on the Boxes tab again.", base),
    ("", base),
    ("Every quarter", bold),
    ("USPS: the store certifies its customer list each quarter (Domestic Mail Manual 508 1.8.3: by January 15, April 15, July 15 and October 15), in USPS's online CMRA Customer Registration Database or the way the Monroe postmaster says. Counter tab, USPS quarterly list: every open box in name order, to check against before certifying. Confirm how Monroe does it with the postmaster.", base),
    ("", base),
    ("Box sizes", bold),
    ("Measure tab: measure every box once, the USPS way. It works out the USPS size and the store size, and its button on the Counter tab fills the Boxes tab.", base),
    ("", base),
    ("Prices", bold),
    ("The prices on the Prices tab are placeholders from the website (src/data/mailboxes.json). Peter and Rin set the real ones there; every formula follows.", base),
]
for i, (t, f) in enumerate(lines, 1):
    c = st.cell(row=i, column=1, value=t); c.font = f; c.alignment = Alignment(wrap_text=True, vertical='top')
st.column_dimensions['A'].width = 120

# ---------- Prices ----------
pr = wb.create_sheet('Prices')
pr['A1'] = 'Size'; pr['B1'] = 'Monthly price ($)'; pr['C1'] = 'Yearly price ($)'; pr['D1'] = 'Fits'; pr['E1'] = '6-month price ($)'
for c in 'ABCDE': pr[f'{c}1'].font = head; pr[f'{c}1'].fill = HEAD
sizes = [('Small', 15, 'Letters and small envelopes'), ('Medium', 22, 'Letters, magazines, small parcels'), ('Large', 30, 'Everything, with package acceptance')]
for i, (n, m, fits) in enumerate(sizes, 2):
    pr[f'A{i}'] = n; pr[f'B{i}'] = m; pr[f'B{i}'].font = blue; pr[f'B{i}'].fill = INPUT
    pr[f'C{i}'] = f'=B{i}*$B$7'; pr[f'D{i}'] = fits; pr[f'E{i}'] = f'=B{i}*$B$8'
    pr[f'B{i}'].number_format = pr[f'C{i}'].number_format = pr[f'E{i}'].number_format = '$#,##0.00'
pr['A7'] = 'A year costs this many months'; pr['B7'] = 10; pr['B7'].font = blue; pr['B7'].fill = INPUT
pr['B7'].comment = Comment('12 months for the price of 10, as on the website. Source: site/src/data/mailboxes.json, placeholder until the owners confirm.', 'PeterShip')
pr['A8'] = '6 months cost this many months'; pr['B8'] = 6; pr['B8'].font = blue; pr['B8'].fill = INPUT
pr['B8'].comment = Comment('6 means no discount for paying 6 months at once; 5 would be 6 months for the price of 5. Placeholder until the owners decide.', 'PeterShip')
pr['A9'] = 'Placeholders until Peter and Rin confirm (the same numbers as the website). Change the yellow cells; everything else follows.'; pr['A9'].font = grey
for col, w in zip('ABCDE', (32, 18, 18, 40, 18)): pr.column_dimensions[col].width = w
for r in pr.iter_rows(min_row=2, max_row=8):
    for c in r:
        if c.font != blue: c.font = Font(name=F, size=11, bold=c.font.bold)

# ---------- Holders ----------
ho = wb.create_sheet('Holders')
cols = [
    ('Code', 11, True), ('Box #', 8, True), ('Name', 22, True), ('Business (optional)', 20, True), ('Phone', 14, True), ('Email', 24, True),
    ('Size', 9, True), ('Term', 11, True), ('Start date', 12, True),
    ('Price per term ($)', 12, False), ('Months paid', 9, False), ('Paid through', 12, False), ('Status', 10, False),
    ('ID 1 type (photo ID)', 20, True), ('ID 1 last 4', 9, True), ('ID 1 expires', 12, True),
    ('ID 2 type', 20, True), ('ID 2 last 4', 9, True), ('ID 2 expires', 12, True), ('ID 2 shows home address?', 10, True),
    ('1583 signed', 12, True), ('Checked by', 11, True), ('ID check', 10, False), ('Ready for a box', 10, False),
    ('Keys given', 8, True), ('Closed date', 12, True), ('Notes', 30, True), ('Open box (helper)', 8, False),
]
for i, (n, w, _) in enumerate(cols, 1):
    c = ho.cell(row=1, column=i, value=n); c.font = head; c.fill = HEAD; c.alignment = Alignment(wrap_text=True, vertical='center')
    ho.column_dimensions[c.column_letter].width = w
ho.row_dimensions[1].height = 44
ho.freeze_panes = 'D2'
L = {n: ho.cell(row=1, column=i).column_letter for i, (n, _, _) in enumerate(cols, 1)}
for r in range(2, ROWS + 2):
    A = f'{L["Code"]}{r}'
    for i, (n, _, inp) in enumerate(cols, 1):
        c = ho.cell(row=r, column=i); c.font = base; c.border = box
        if inp: c.fill = INPUT
    ho[f'{L["Price per term ($)"]}{r}'] = f'=IF(OR({A}="",{L["Size"]}{r}=""),"",IF({L["Term"]}{r}="Yearly",INDEX(Prices!$C$2:$C$4,MATCH({L["Size"]}{r},Prices!$A$2:$A$4,0)),IF({L["Term"]}{r}="6 months",INDEX(Prices!$E$2:$E$4,MATCH({L["Size"]}{r},Prices!$A$2:$A$4,0)),INDEX(Prices!$B$2:$B$4,MATCH({L["Size"]}{r},Prices!$A$2:$A$4,0)))))'
    ho[f'{L["Months paid"]}{r}'] = f'=IF({A}="","",SUMIFS(Payments!$D:$D,Payments!$B:$B,{A}))'
    ho[f'{L["Paid through"]}{r}'] = f'=IF(OR({A}="",{L["Start date"]}{r}=""),"",EDATE({L["Start date"]}{r},{L["Months paid"]}{r}))'
    pt = f'{L["Paid through"]}{r}'
    ho[f'{L["Status"]}{r}'] = f'=IF({A}="","",IF({L["Closed date"]}{r}<>"","Closed",IF({pt}="","",IF({pt}<TODAY(),"Overdue",IF({pt}-TODAY()<=7,"Due soon","Current")))))'
    e1, e2 = f'{L["ID 1 expires"]}{r}', f'{L["ID 2 expires"]}{r}'
    ho[f'{L["ID check"]}{r}'] = f'=IF({A}="","",IF(OR(AND({e1}<>"",{e1}<TODAY()),AND({e2}<>"",{e2}<TODAY())),"EXPIRED",IF(OR({L["ID 1 type (photo ID)"]}{r}="",{L["ID 2 type"]}{r}=""),"missing",IF({L["ID 1 type (photo ID)"]}{r}={L["ID 2 type"]}{r},"same kind",IF(AND({L["ID 2 shows home address?"]}{r}<>"Yes",{L["ID 1 type (photo ID)"]}{r}<>"Driver"&CHAR(39)&"s license or state ID",{L["ID 1 type (photo ID)"]}{r}<>"Tribal ID"),"no address","OK")))))'
    ho[f'{L["Ready for a box"]}{r}'] = f'=IF({A}="","",IF(AND({L["ID check"]}{r}="OK",{L["1583 signed"]}{r}<>"",N({L["Months paid"]}{r})>0),"YES","not yet"))'
    ho[f'{L["Open box (helper)"]}{r}'] = f'=IF(AND({A}<>"",{L["Closed date"]}{r}="",{L["Box #"]}{r}<>""),{L["Box #"]}{r},"")'
    for n in ('Start date', 'Paid through', 'ID 1 expires', 'ID 2 expires', '1583 signed', 'Closed date'):
        ho[f'{L[n]}{r}'].number_format = 'mmm d, yyyy'
    ho[f'{L["Price per term ($)"]}{r}'].number_format = '$#,##0.00'
ho.column_dimensions[L['Open box (helper)']].hidden = True

# example row 2
today = dt.date.today()
ex = {'Code': 'MB-001', 'Box #': 101, 'Name': 'EXAMPLE Jane Doe', 'Phone': '318 555 0100', 'Email': 'jane@example.com', 'Size': 'Small', 'Term': 'Monthly',
      'Start date': today, 'ID 1 type (photo ID)': "Driver's license or state ID", 'ID 1 last 4': '1234', 'ID 1 expires': dt.date(today.year + 3, 4, 1),
      'ID 2 type': 'Home or vehicle insurance policy', 'ID 2 last 4': '9876', 'ID 2 expires': dt.date(today.year + 1, 6, 30), 'ID 2 shows home address?': 'Yes',
      '1583 signed': today, 'Checked by': 'Peter', 'Keys given': 'Yes', 'Notes': 'Example row: delete before the first real customer'}
for n, v in ex.items():
    c = ho[f'{L[n]}2']; c.value = v
for i in range(1, len(cols) + 1):
    ho.cell(row=2, column=i).fill = EX

def dv(sheet, formula, rng, prompt=None):
    d = DataValidation(type='list', formula1=formula, allow_blank=True, showErrorMessage=True, showInputMessage=True,
                       errorTitle='Pick from the list', error='Click the small arrow in the cell and pick one of the choices.')
    if prompt: d.promptTitle, d.prompt = 'Pick one', prompt
    sheet.add_data_validation(d); d.add(rng)

def rule(sheet, rng, kind, f1, f2=None, op=None, title='', prompt='', error=''):
    # One check on a typed column: stop the entry and say why. Titles and messages stay short (Excel caps them).
    d = DataValidation(type=kind, operator=op, formula1=f1, formula2=f2, allow_blank=True, showErrorMessage=True, showInputMessage=bool(prompt),
                       errorStyle='stop', errorTitle=title[:32], error=error[:255], promptTitle=title[:32], prompt=prompt[:255])
    sheet.add_data_validation(d); d.add(rng)
last = ROWS + 1
dv(ho, '=Prices!$A$2:$A$4', f'{L["Size"]}2:{L["Size"]}{last}')
dv(ho, '"Monthly,6 months,Yearly"', f'{L["Term"]}2:{L["Term"]}{last}')
ids1 = "Driver's license or state ID,Passport,US passport card,Military ID,Government employee ID,University ID,Permanent resident card,Certificate of naturalization,Tribal ID"
# list over 255 chars is not allowed inline: put the lists on a hidden sheet
lists = wb.create_sheet('Lists')
id1 = ids1.split(',')
id2 = id1 + ['Current lease or mortgage or deed', 'Voter registration card', 'Vehicle registration card', 'Home or vehicle insurance policy']
for i, v in enumerate(id1, 1): lists[f'A{i}'] = v
for i, v in enumerate(id2, 1): lists[f'B{i}'] = v
lists['D1'] = 'Never accepted: Social Security card, credit or debit card, birth certificate.'
lists.sheet_state = 'hidden'
dv(ho, f'=Lists!$A$1:$A${len(id1)}', f'{L["ID 1 type (photo ID)"]}2:{L["ID 1 type (photo ID)"]}{last}', 'A photo ID. Never a Social Security card, credit card or birth certificate.')
dv(ho, f'=Lists!$B$1:$B${len(id2)}', f'{L["ID 2 type"]}2:{L["ID 2 type"]}{last}', 'A different kind from ID 1. One of the two must show the current home address.')
dv(ho, '"Yes,No"', f'{L["ID 2 shows home address?"]}2:{L["ID 2 shows home address?"]}{last}')
dv(ho, '"Yes,No"', f'{L["Keys given"]}2:{L["Keys given"]}{last}')
ho[f'{L["ID 1 last 4"]}1'].comment = Comment('Last four characters only. Never write the whole ID number here.', 'PeterShip')
ho[f'{L["ID 2 shows home address?"]}1'].comment = Comment('USPS wants one of the two IDs to show the current home address. A license usually does; if ID 1 shows it, answer Yes here only if ID 2 does too, and note it.', 'PeterShip')

red = PatternFill('solid', fgColor='F8C9C4'); amber = PatternFill('solid', fgColor='FCE4B6'); green = PatternFill('solid', fgColor='D5EDD3')
S = L['Status']; IC = L['ID check']; RB = L['Ready for a box']
ho.conditional_formatting.add(f'{S}2:{S}{last}', FormulaRule(formula=[f'{S}2="Overdue"'], fill=red, font=Font(name=F, bold=True, color='9C0006')))
ho.conditional_formatting.add(f'{S}2:{S}{last}', FormulaRule(formula=[f'{S}2="Due soon"'], fill=amber))
ho.conditional_formatting.add(f'{S}2:{S}{last}', FormulaRule(formula=[f'{S}2="Current"'], fill=green))
ho.conditional_formatting.add(f'{IC}2:{IC}{last}', FormulaRule(formula=[f'{IC}2="EXPIRED"'], fill=red, font=Font(name=F, bold=True, color='9C0006')))
ho.conditional_formatting.add(f'{RB}2:{RB}{last}', FormulaRule(formula=[f'{RB}2="YES"'], fill=green))

# ---------- Payments ----------
pa = wb.create_sheet('Payments')
pcols = [('Date', 12, True), ('Code', 11, True), ('Name', 22, False), ('Months covered', 10, True), ('Amount taken ($)', 12, True), ('Expected ($)', 12, False), ('POS receipt #', 14, True), ('Staff', 11, True), ('Note', 30, True)]
for i, (n, w, _) in enumerate(pcols, 1):
    c = pa.cell(row=1, column=i, value=n); c.font = head; c.fill = HEAD; c.alignment = Alignment(wrap_text=True, vertical='center')
    pa.column_dimensions[c.column_letter].width = w
pa.row_dimensions[1].height = 32; pa.freeze_panes = 'A2'
for r in range(2, ROWS * 4 + 2):
    for i, (n, _, inp) in enumerate(pcols, 1):
        c = pa.cell(row=r, column=i); c.font = base; c.border = box
        if inp: c.fill = INPUT
    pa[f'C{r}'] = f'=IF(B{r}="","",IFERROR(INDEX(Holders!$C:$C,MATCH(B{r},Holders!$A:$A,0)),"no such code"))'
    _i = f'MATCH(INDEX(Holders!$G:$G,MATCH(B{r},Holders!$A:$A,0)),Prices!$A$2:$A$4,0)'
    # Each whole year at the yearly price, then each whole 6 months at the 6-month price, then single months.
    pa[f'F{r}'] = f'=IF(OR(B{r}="",D{r}=""),"",IFERROR(INDEX(Prices!$C$2:$C$4,{_i})*INT(D{r}/12)+INDEX(Prices!$E$2:$E$4,{_i})*INT(MOD(D{r},12)/6)+INDEX(Prices!$B$2:$B$4,{_i})*MOD(D{r},6),""))'
    pa[f'A{r}'].number_format = 'mmm d, yyyy'; pa[f'E{r}'].number_format = pa[f'F{r}'].number_format = '$#,##0.00'
for n, v in zip('ABDEGHI', (today, 'MB-001', 1, 15, '1043', 'Peter', 'Example row: delete')):
    pa[f'{n}2'] = v
for i in range(1, len(pcols) + 1): pa.cell(row=2, column=i).fill = EX
pa['F1'].comment = Comment('What the Prices tab says this should be. 12 months = the yearly price, 6 months = the 6-month price. If it differs from Amount taken, check the POS.', 'PeterShip')
pa.conditional_formatting.add(f'C2:C{ROWS*4+1}', FormulaRule(formula=['C2="no such code"'], fill=red))

# ---------- Boxes ----------
bx = wb.create_sheet('Boxes')
bcols = [('Box #', 9, True), ('Size', 10, True), ('Holder code', 12, False), ('Holder', 24, False), ('Status', 10, False), ('Paid through', 13, False), ('Note', 30, True)]
for i, (n, w, _) in enumerate(bcols, 1):
    c = bx.cell(row=1, column=i, value=n); c.font = head; c.fill = HEAD
    bx.column_dimensions[c.column_letter].width = w
bx.freeze_panes = 'A2'
OB = L['Open box (helper)']
for r in range(2, ROWS + 2):
    for i, (n, _, inp) in enumerate(bcols, 1):
        c = bx.cell(row=r, column=i); c.font = base; c.border = box
        if inp: c.fill = INPUT
    bx[f'C{r}'] = f'=IF(A{r}="","",IFERROR(INDEX(Holders!$A:$A,MATCH(A{r},Holders!${OB}:${OB},0)),""))'
    bx[f'D{r}'] = f'=IF(C{r}="","",INDEX(Holders!$C:$C,MATCH(C{r},Holders!$A:$A,0)))'
    bx[f'E{r}'] = f'=IF(A{r}="","",IF(C{r}="","Free",INDEX(Holders!${S}:${S},MATCH(C{r},Holders!$A:$A,0))))'
    bx[f'F{r}'] = f'=IF(C{r}="","",INDEX(Holders!${L["Paid through"]}:${L["Paid through"]},MATCH(C{r},Holders!$A:$A,0)))'
    bx[f'F{r}'].number_format = 'mmm d, yyyy'
dv(bx, '=Prices!$A$2:$A$4', f'B2:B{ROWS+1}')
for i, (n, sz) in enumerate([(101, 'Small'), (102, 'Small'), (201, 'Medium')], 2):
    bx[f'A{i}'] = n; bx[f'B{i}'] = sz
    for c in range(1, 8): bx.cell(row=i, column=c).fill = EX
bx['G2'] = 'Example box numbers: type the store\'s real boxes over these'
bx.conditional_formatting.add(f'E2:E{ROWS+1}', FormulaRule(formula=['E2="Free"'], fill=green))
bx.conditional_formatting.add(f'E2:E{ROWS+1}', FormulaRule(formula=['E2="Overdue"'], fill=red))


# ---------- input checks (v1.81.1) ----------
H = lambda n: f'{L[n]}2:{L[n]}{last}'
c = lambda n: f'{L[n]}2'
rule(ho, H('Code'), 'custom', f'AND(LEFT({c("Code")},3)="MB-",LEN({c("Code")})=6,ISNUMBER(VALUE(RIGHT({c("Code")},3))),COUNTIF($A$2:$A${last},{c("Code")})=1)',
     title='Customer code', prompt='MB- and three digits: MB-002, MB-003 ... Each code once.', error='Use MB- and three digits, like MB-002, and do not reuse a code that is already on this tab.')
# Box #: a dropdown of the Boxes tab's numbers, and any number typed by hand is allowed too (no stop box).
# The OnHoldersChange macro checks a typed number: letters and digits, not another open customer's box,
# and a number not on the Boxes tab yet is added there.
_bd = DataValidation(type='list', formula1=f'=Boxes!$A$2:$A${last}', allow_blank=True, showErrorMessage=False, showInputMessage=True,
                     promptTitle='Box number', prompt='Pick a box from the list, or type its number. A number not on the Boxes tab yet is added there. Give a box (Counter tab) checks the customer is ready first.')
ho.add_data_validation(_bd); _bd.add(H('Box #'))
rule(ho, H('Name'), 'textLength', '2', '60', 'between', title='Name', error="Type the customer's name (2 to 60 letters).")
rule(ho, H('Phone'), 'custom', f'LEN(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE({c("Phone")}," ",""),"-",""),"(",""),")",""),".",""))=10',
     title='Phone', prompt='Ten digits, like 318 555 0100.', error='A phone number needs ten digits, like 318 555 0100.')
rule(ho, H('Email'), 'custom', f'AND(ISNUMBER(FIND("@",{c("Email")})),ISNUMBER(FIND(".",{c("Email")},FIND("@",{c("Email")}))),ISERROR(FIND(" ",{c("Email")})))',
     title='Email', error='That does not look like an email address. It needs an @ and a dot after it, and no spaces.')
rule(ho, H('Start date'), 'date', 'DATE(2000,1,1)', 'TODAY()+31', 'between', title='Start date', prompt='The day they signed up, like 11/7/2026.', error='Type a date, like 11/7/2026. It cannot be more than a month from today.')
for n in ('ID 1 last 4', 'ID 2 last 4'):
    rule(ho, H(n), 'textLength', '4', None, 'equal', title='Last 4 only', prompt='The last four characters of the ID number. Never the whole number.', error='Type exactly four characters: the end of the ID number, never the whole number.')
for n in ('ID 1 expires', 'ID 2 expires'):
    rule(ho, H(n), 'date', 'TODAY()', None, 'greaterThanOrEqual', title='ID expiry', prompt='The expiry date printed on the ID.', error='That ID has expired. USPS does not accept an expired ID: ask for a current one.')
rule(ho, H('1583 signed'), 'date', 'DATE(2000,1,1)', 'TODAY()', 'between', title='1583 signed', prompt='The day the customer signed PS Form 1583 with you.', error='Type the date the 1583 was signed. It cannot be in the future.')
rule(ho, H('Checked by'), 'textLength', '1', '30', 'between', title='Checked by', prompt='Who looked at the two IDs.', error='Type the name of the person who checked the IDs.')
rule(ho, H('Closed date'), 'custom', f'AND(ISNUMBER({c("Closed date")}),{c("Closed date")}>={c("Start date")},{c("Closed date")}<=TODAY())',
     title='Closed date', prompt='The day the keys came back.', error='Type a date between the start date and today.')

ho.conditional_formatting.add(H('Box #'), FormulaRule(formula=[f'AND({c("Box #")}<>"",{c("Closed date")}="",COUNTIFS($B$2:$B${last},{c("Box #")},${L["Closed date"]}$2:${L["Closed date"]}${last},"")>1)'], fill=red, font=Font(name=F, bold=True, color='9C0006')))
# A name with no code: the row's formulas all wait on the code (the fill-as-you-type macro adds it; red if macros are off).
ho.conditional_formatting.add(H('Code'), FormulaRule(formula=[f'AND({c("Code")}="",{c("Name")}<>"")'], fill=red))
# A box typed in before the customer is ready (Give a box refuses this; typing by hand does not).
ho.conditional_formatting.add(H('Box #'), FormulaRule(formula=[f'AND({c("Box #")}<>"",{c("Closed date")}="",{c("Ready for a box")}<>"YES")'], fill=amber))
ho.conditional_formatting.add(H('ID check'), FormulaRule(formula=[f'OR({c("ID check")}="same kind",{c("ID check")}="no address",{c("ID check")}="missing")'], fill=amber))

PL = ROWS * 4 + 1
rule(pa, f'A2:A{PL}', 'date', 'DATE(2000,1,1)', 'TODAY()', 'between', title='Payment date', prompt='The day it was paid on the POS.', error='Type the payment date, like 11/7/2026. It cannot be in the future.')
dv(pa, f'=Holders!$A$2:$A${last}', f'B2:B{PL}', "Pick the customer's code (MB-...) from the Holders tab.")
rule(pa, f'D2:D{PL}', 'whole', '1', '24', 'between', title='Months covered', prompt='1 for a month, 12 for a year.', error='Months covered is a whole number from 1 to 24: 1 for a month, 12 for a year.')
rule(pa, f'E2:E{PL}', 'decimal', '0', '5000', 'between', title='Amount', prompt='What the POS took, in dollars.', error='Type the amount in dollars, like 15 or 150.00.')

rule(bx, f'A2:A{last}', 'custom', f'AND(COUNTIF($A$2:$A${last},A2)=1,LEN(A2)<=6,ISERROR(FIND(" ",A2)))', title='Box number', prompt='The number on the box door: letters and digits, up to 6, like 101 or A12.', error='Each box once, letters and digits only, up to 6 characters (101, A12).')

for cell in ('B2', 'B3', 'B4'):
    rule(pr, cell, 'decimal', '0', '1000', 'between', title='Monthly price', error='Type the monthly price in dollars, like 15.')
rule(pr, 'B7', 'whole', '1', '12', 'between', title='Months a year costs', error='A whole number from 1 to 12. 10 means 12 months for the price of 10.')
rule(pr, 'B8', 'whole', '1', '6', 'between', title='Months 6 months cost', error='A whole number from 1 to 6. 5 means 6 months for the price of 5.')
wb.move_sheet('Boxes', offset=-1)

# ---------- Measure (v1.82.2) ----------
# USPS sets no size for a CMRA's private mailboxes (DMM 508 1.8 says nothing on it). Its PO Box chart
# (DMM 508 4.1.3: sizes 1 to 5 by cubic inches) is the standard way to name a box size, so each box is
# measured once and sized the USPS way. The measurement table starts at MT (header row); the reference
# tables sit to its right from column S. add-macros.py and Mailbox.bas (M_* constants) use these positions.
me = wb.create_sheet('Measure')
MT = 13                      # header row of the measurement table; boxes from row MT+1
MLAST = MT + ROWS            # last box row
steps = [
    ('Measuring the boxes', title),
    ("USPS sets no size for a store's private mailboxes, but its PO Box chart (sizes 1 to 5, by cubic inches, on the right) is the standard way to name one. Measure every box once, before the first customer and whenever boxes are added.", base),
    ('1. Tape measure, in inches, door open. Width and height: the door opening at its tightest point (the frame lip, not the wall behind it). Depth: from the front of the opening to the back wall, less anything that sticks in (a hinge, the lock bolt).', base),
    ('2. Fractions as decimals: 1/8 = .125, 1/4 = .25, 3/8 = .375, 1/2 = .5, 5/8 = .625, 3/4 = .75, 7/8 = .875. Round down: a box is only as big as its tightest spot.', base),
    ('3. One row per door, by the number on the door. A bank of identical boxes: measure one, then copy its three numbers down to the rest.', base),
    ('4. The sheet works out the cubic inches, the USPS size and the store size. Which USPS sizes count as Small, Medium and Large is for Peter and Rin: the yellow Store size cells in the chart on the right. The prices follow from the Prices tab.', base),
    ('5. The Fits columns say yes when that item goes in flat without bending (the item sizes are on the right; change them if yours differ). Use them for the Fits words on the Prices tab and to answer "will my packages fit?".', base),
    ('6. Counter tab, Boxes from measurements: copies every measured box and its store size to the Boxes tab. It never changes the size of a box someone holds. Check says OK when both tabs agree.', base),
    ('Never delete a row on this tab: the USPS chart on the right shares rows 14 to 18. To remove a box or the grey examples, select its cells and press Delete.', bold),
    ('Parcels too big for the box: USPS sets no rule for a private mailbox; the service agreement (OWNERS terms) says how long the store holds them at the counter.', grey),
]
for i, (t, f) in enumerate(steps, 1):
    me.merge_cells(start_row=i, start_column=1, end_row=i, end_column=17)
    c = me.cell(row=i, column=1, value=t); c.font = f; c.alignment = Alignment(wrap_text=True, vertical='top')
    if i > 1: me.row_dimensions[i].height = 30
mcols = [('Box #', 8, True), ('Inside width (in)', 10, True), ('Inside height (in)', 10, True), ('Depth (in)', 9, True),
         ('Cubic inches', 9, False), ('USPS size', 7, False), ('USPS name', 9, False), ('Store size', 9, False),
         ('Boxes tab says', 11, False), ('Check', 16, False)]
FITS = [('#10 envelope', 9.5, 4.125, 0.25), ('9 x 12 envelope', 12, 9, 0.5), ('Small Flat Rate Box', 8.6875, 5.4375, 1.75),
        ('Medium Flat Rate Box', 11.25, 8.75, 6), ('Shoebox', 13, 8, 5)]
IT = MT + 9                  # first item row on the right
for k in range(len(FITS)):
    mcols.append((f'="Fits: "&$S${IT + k}', 10, False))
mcols.append(('Note', 24, True))
for i, (n, w, _) in enumerate(mcols, 1):
    c = me.cell(row=MT, column=i, value=n); c.font = head; c.fill = HEAD; c.alignment = Alignment(wrap_text=True, vertical='center')
    me.column_dimensions[c.column_letter].width = w
me.row_dimensions[MT].height = 44
usps = [(1, 'X-Small', '3 x 5 1/2', '10-15 letters, 2 rolled magazines', 0, 'Small'),
        (2, 'Small', '5 x 5 1/2', '10-15 letters, 5 rolled magazines', 296, 'Small'),
        (3, 'Medium', '11 x 5 1/2', 'Large envelopes and magazines, flat', 500, 'Medium'),
        (4, 'Large', '11 x 11', 'Two shoeboxes and some letters', 1000, 'Large'),
        (5, 'X-Large', '22 1/2 x 12', 'Flat Rate Boxes and parcels', 2000, 'Large')]
U0 = MT + 1                  # first USPS row on the right
me.cell(row=MT - 1, column=19, value='USPS PO Box sizes (Domestic Mail Manual 508 4.1.3; every one 14 3/4 deep)').font = bold
for j, n in enumerate(['USPS size', 'Name', 'Opening W x H (in)', 'Holds (USPS)', 'Cubic inches from', 'Store size (yours)']):
    c = me.cell(row=MT, column=19 + j, value=n); c.font = head; c.fill = HEAD; c.alignment = Alignment(wrap_text=True, vertical='center')
for k, row in enumerate(usps):
    for j, v in enumerate(row):
        c = me.cell(row=U0 + k, column=19 + j, value=v); c.font = base; c.border = box
    me.cell(row=U0 + k, column=24).fill = INPUT; me.cell(row=U0 + k, column=24).font = blue
me.cell(row=IT - 2, column=19, value='Things that should fit (inches, longest side first; change them if yours differ)').font = bold
for j, n in enumerate(['Item', 'Longest', 'Middle', 'Shortest']):
    c = me.cell(row=IT - 1, column=19 + j, value=n); c.font = head; c.fill = HEAD
for k, row in enumerate(FITS):
    for j, v in enumerate(row):
        c = me.cell(row=IT + k, column=19 + j, value=v); c.font = blue; c.border = box; c.fill = INPUT
for col, w in zip('STUVWX', (20, 10, 12, 30, 10, 12)):
    me.column_dimensions[col].width = w
UR = lambda col: f'${col}${U0}:${col}${U0 + 4}'
for r in range(MT + 1, MLAST + 1):
    for i, (n, _, inp) in enumerate(mcols, 1):
        c = me.cell(row=r, column=i); c.font = base; c.border = box
        if inp: c.fill = INPUT
    me[f'E{r}'] = f'=IF(COUNT(B{r}:D{r})<3,"",ROUND(B{r}*C{r}*D{r},0))'
    me[f'F{r}'] = f'=IF(E{r}="","",MATCH(E{r},{UR("W")},1))'
    me[f'G{r}'] = f'=IF(F{r}="","",INDEX({UR("T")},F{r}))'
    me[f'H{r}'] = f'=IF(F{r}="","",INDEX({UR("X")},F{r}))'
    me[f'I{r}'] = f'=IF(A{r}="","",IFERROR(INDEX(Boxes!$B$2:$B${last},MATCH(A{r},Boxes!$A$2:$A${last},0))&"","not there yet"))'
    me[f'J{r}'] = f'=IF(OR(A{r}="",H{r}=""),"",IF(I{r}="not there yet","add to Boxes",IF(I{r}="","size blank on Boxes",IF(I{r}=H{r},"OK","Boxes says "&I{r}))))'
    for k in range(len(FITS)):
        it = IT + k
        col = me.cell(row=r, column=11 + k).column_letter
        me[f'{col}{r}'] = (f'=IF(E{r}="","",IF(AND(LARGE(B{r}:D{r},1)>=$T${it},LARGE(B{r}:D{r},2)>=$U${it},'
                           f'SMALL(B{r}:D{r},1)>=$V${it}),"yes","no"))')
    me[f'E{r}'].number_format = '#,##0'
# the example boxes from the Boxes tab, measured like USPS size 2 and 3 boxes
for i, (n, w, h_, d) in enumerate([(101, 5, 5.5, 14.75), (102, 5, 5.5, 14.75), (201, 11, 5.5, 14.75)], MT + 1):
    me[f'A{i}'], me[f'B{i}'], me[f'C{i}'], me[f'D{i}'] = n, w, h_, d
    for c in range(1, len(mcols) + 1): me.cell(row=i, column=c).fill = EX
me[f'{me.cell(row=MT + 1, column=len(mcols)).column_letter}{MT + 1}'] = 'Example measurements: type over them'
rule(me, f'A{MT+1}:A{MLAST}', 'custom', f'COUNTIF($A${MT+1}:$A${MLAST},A{MT+1})=1', title='Box number',
     prompt='The number on the box door.', error='That box number is already on this tab. One row per box.')
rule(me, f'B{MT+1}:D{MLAST}', 'decimal', '0.5', '60', 'between', title='Inches', prompt='Inches, fractions as decimals: 5 1/2 = 5.5.',
     error='Type inches between 0.5 and 60, fractions as decimals: 5 1/2 = 5.5, 14 3/4 = 14.75.')
dv(me, '=Prices!$A$2:$A$4', f'X{U0}:X{U0 + 4}', 'Which store size this USPS size is sold as.')
for k in range(len(FITS)):
    rule(me, f'T{IT+k}:V{IT+k}', 'decimal', '0', '60', 'between', title='Inches', error='Type inches, fractions as decimals.')
me.conditional_formatting.add(f'J{MT+1}:J{MLAST}', FormulaRule(formula=[f'J{MT+1}="OK"'], fill=green))
me.conditional_formatting.add(f'J{MT+1}:J{MLAST}', FormulaRule(formula=[f'AND(J{MT+1}<>"",J{MT+1}<>"OK")'], fill=amber))
# ---------- Calc friendliness (v1.84.0) ----------
# Text format where a number would lose something: a last 4 of 0123 stays 0123 instead of becoming 123
# (which the four-character check would then refuse), and a phone or receipt number stays as typed.
for col in ('Phone', 'ID 1 last 4', 'ID 2 last 4'):
    for r in range(2, last + 1):
        ho[f'{L[col]}{r}'].number_format = '@'
for r in range(2, ROWS * 4 + 2):
    pa[f'G{r}'].number_format = '@'
# Every yellow cell is unlocked, so Tools > Protect Sheet stops typing over a formula while the yellow
# cells and the buttons (which write only to yellow cells) keep working.
from openpyxl.styles import Protection
for ws in wb.worksheets:
    for row in ws.iter_rows():
        for c in row:
            colour = str(c.fill.fgColor.rgb).upper() if c.fill is not None else ''
            formula = isinstance(c.value, str) and c.value.startswith('=')
            if colour.endswith('FFF7CC') or (colour.endswith('EDEDED') and not formula):   # yellow, or a grey example typed cell
                c.protection = Protection(locked=False)
from openpyxl.workbook.properties import CalcProperties
wb.calculation = CalcProperties(fullCalcOnLoad=True)
wb.security = None
wb.save(OUT)
print(OUT)
