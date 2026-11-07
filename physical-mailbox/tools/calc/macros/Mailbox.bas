REM  Goin' Postal Forsythe: mailbox register macros (v1.86.0)
REM  Lives inside mailbox-register-TEMPLATE.ods as Standard.Mailbox. The buttons on the Counter tab
REM  call the btn... subs; each one asks its questions in small boxes and then calls a plain function
REM  below (AddCustomer, AddPayment, AssignBox, CloseHolder, BuildCallList, BuildUSPSList, BoxesFromMeasure, Backup),
REM  which never shows a box itself, so tools/calc/add-macros.py can test it without anyone clicking.
REM  Setting a cell from a macro skips the typing checks, so every function checks its own input.
Option Explicit

Private Const R0 As Long = 1
Private Const HLAST As Long = 300
Private Const PLAST As Long = 1200
Private Const STORE_LINE As String = "1800 Forsythe Ave Ste 2 #"
Private Const STORE_CITY As String = "Monroe, LA 71201"
Private Const APP As String = "Mailbox register"

REM True while a sheet event is filling cells, so the fill does not set off the same event again.
Private busy As Boolean

REM Holders columns (0 = A)
Private Const H_CODE As Long = 0
Private Const H_BOX As Long = 1
Private Const H_NAME As Long = 2
Private Const H_BUSINESS As Long = 3
Private Const H_PHONE As Long = 4
Private Const H_EMAIL As Long = 5
Private Const H_SIZE As Long = 6
Private Const H_TERM As Long = 7
Private Const H_START As Long = 8
Private Const H_PRICE As Long = 9
Private Const H_PAIDTHRU As Long = 11
Private Const H_STATUS As Long = 12
Private Const H_ID1 As Long = 13
Private Const H_1583 As Long = 20
Private Const H_IDCHECK As Long = 22
Private Const H_READY As Long = 23
Private Const H_KEYS As Long = 24
Private Const H_CLOSED As Long = 25
Private Const H_NOTES As Long = 26

REM Payments columns
Private Const P_DATE As Long = 0
Private Const P_CODE As Long = 1
Private Const P_MONTHS As Long = 3
Private Const P_AMOUNT As Long = 4
Private Const P_RECEIPT As Long = 6
Private Const P_STAFF As Long = 7

REM Boxes columns
Private Const B_BOX As Long = 0
Private Const B_SIZE As Long = 1
Private Const B_STATUS As Long = 4
Private Const B_NOTE As Long = 6

REM Measure tab (build-register.py: header on row 13, boxes from row 14; Store size is column H)
Private Const M0 As Long = 13
Private Const MLAST As Long = 312
Private Const M_BOX As Long = 0
Private Const M_STORESIZE As Long = 7

REM ---------------------------------------------------------------- helpers

Function Sh(sName As String) As Object
	Sh = ThisComponent.Sheets.getByName(sName)
End Function

Function CellText(oSheet As Object, c As Long, r As Long) As String
	CellText = Trim(oSheet.getCellByPosition(c, r).getString())
End Function

Function TodaySerial() As Double
	TodaySerial = Fix(CDbl(Now()))
End Function

Function DateText(v As Double) As String
	If v <= 0 Then
		DateText = ""
	Else
		DateText = Format(CDate(v), "mmm d, yyyy")
	End If
End Function

Function OnlyDigits(s As String) As String
	Dim i As Long, ch As String, out As String
	out = ""
	For i = 1 To Len(s)
		ch = Mid(s, i, 1)
		If ch >= "0" And ch <= "9" Then out = out & ch
	Next i
	OnlyDigits = out
End Function

Function SizeName(s As String) As String
	Select Case UCase(Left(Trim(s), 1))
		Case "S" : SizeName = "Small"
		Case "M" : SizeName = "Medium"
		Case "L" : SizeName = "Large"
		Case "F" : SizeName = "Folder"
		Case Else : SizeName = ""
	End Select
End Function

REM The first Holders or Payments row whose column c is empty, or -1 when the tab is full.
Function FirstFree(oSheet As Object, c As Long, lastRow As Long) As Long
	Dim r As Long
	For r = R0 To lastRow
		If CellText(oSheet, c, r) = "" Then
			FirstFree = r
			Exit Function
		End If
	Next r
	FirstFree = -1
End Function

Function NextCode() As String
	Dim h As Object, r As Long, s As String, n As Long, m As Long
	h = Sh("Holders")
	m = 0
	For r = R0 To HLAST
		s = CellText(h, H_CODE, r)
		If Left(s, 3) = "MB-" And Len(s) = 6 Then
			If IsNumeric(Mid(s, 4)) Then
				n = CLng(Mid(s, 4))
				If n > m Then m = n
			End If
		End If
	Next r
	NextCode = "MB-" & Format(m + 1, "000")
End Function

REM A customer's row from a code, an open box number, or part of a name that matches one customer.
Function FindHolder(sWhat As String) As Long
	Dim h As Object, r As Long, hits As Long, hitRow As Long, w As String
	FindHolder = -1
	w = UCase(Trim(sWhat))
	If w = "" Then Exit Function
	h = Sh("Holders")
	For r = R0 To HLAST
		If UCase(CellText(h, H_CODE, r)) = w Then
			FindHolder = r
			Exit Function
		End If
	Next r
	For r = R0 To HLAST
		If CellText(h, H_CODE, r) <> "" And CellText(h, H_CLOSED, r) = "" And UCase(CellText(h, H_BOX, r)) = w Then
			FindHolder = r
			Exit Function
		End If
	Next r
	hits = 0
	For r = R0 To HLAST
		If CellText(h, H_CODE, r) <> "" And InStr(1, UCase(CellText(h, H_NAME, r)), w) > 0 Then
			hits = hits + 1
			hitRow = r
		End If
	Next r
	If hits = 1 Then FindHolder = hitRow
End Function

Function ExpectedAmount(r As Long, months As Long) As Double
	Dim h As Object, price As Double
	h = Sh("Holders")
	price = h.getCellByPosition(H_PRICE, r).getValue()
	If CellText(h, H_TERM, r) = "Yearly" Then
		ExpectedAmount = Int(price * months / 12 * 100 + 0.5) / 100
	Else
		ExpectedAmount = Int(price * months * 100 + 0.5) / 100
	End If
End Function

REM Box numbers that show Free on the Boxes tab, of one size (or any size when sSize is empty), comma-separated.
Function FreeBoxes(sSize As String) As String
	Dim b As Object, r As Long, out As String
	ThisComponent.calculateAll()
	b = Sh("Boxes")
	out = ""
	For r = R0 To HLAST
		If CellText(b, B_BOX, r) <> "" And CellText(b, B_STATUS, r) = "Free" Then
			If sSize = "" Or CellText(b, B_SIZE, r) = sSize Then
				If out <> "" Then out = out & ", "
				out = out & CellText(b, B_BOX, r)
			End If
		End If
	Next r
	FreeBoxes = out
End Function

REM Why a customer is not ready for a box yet, in one line; empty when they are.
Function NotReadyReason(r As Long) As String
	Dim h As Object, why As String
	ThisComponent.calculateAll()
	h = Sh("Holders")
	why = ""
	If CellText(h, H_IDCHECK, r) <> "OK" Then why = why & "the two IDs (ID check says " & CellText(h, H_IDCHECK, r) & "); "
	If CellText(h, H_1583, r) = "" Then why = why & "the date PS Form 1583 was signed; "
	If h.getCellByPosition(10, r).getValue() <= 0 Then why = why & "a first payment (press Record a payment); "
	NotReadyReason = why
End Function

REM ---------------------------------------------------------------- the work, no boxes shown

REM Adds a customer on the first empty Holders row. Returns the new code, or a line starting with "!" saying what is wrong.
Function AddCustomer(sName As String, sPhone As String, sEmail As String, sSize As String, sTerm As String) As String
	Dim h As Object, r As Long, code As String
	If Len(Trim(sName)) < 2 Then
		AddCustomer = "!Type the customer's name."
		Exit Function
	End If
	If sPhone <> "" And Len(OnlyDigits(sPhone)) <> 10 Then
		AddCustomer = "!A phone number needs ten digits."
		Exit Function
	End If
	If sEmail <> "" And (InStr(sEmail, "@") = 0 Or InStr(sEmail, " ") > 0) Then
		AddCustomer = "!That email does not look right."
		Exit Function
	End If
	If SizeName(sSize) = "" Then
		AddCustomer = "!The size is Small, Medium, Large or Folder."
		Exit Function
	End If
	h = Sh("Holders")
	r = FirstFree(h, H_CODE, HLAST)
	If r < 0 Then
		AddCustomer = "!The Holders tab is full."
		Exit Function
	End If
	code = NextCode()
	h.getCellByPosition(H_CODE, r).setString(code)
	h.getCellByPosition(H_NAME, r).setString(Trim(sName))
	If sPhone <> "" Then h.getCellByPosition(H_PHONE, r).setString(Trim(sPhone))
	If sEmail <> "" Then h.getCellByPosition(H_EMAIL, r).setString(Trim(sEmail))
	h.getCellByPosition(H_SIZE, r).setString(SizeName(sSize))
	If UCase(Left(sTerm, 1)) = "Y" Then
		h.getCellByPosition(H_TERM, r).setString("Yearly")
	Else
		h.getCellByPosition(H_TERM, r).setString("Monthly")
	End If
	h.getCellByPosition(H_START, r).setValue(TodaySerial())
	ThisComponent.calculateAll()
	AddCustomer = code
End Function

REM Adds a payment row for a code. Returns "" when done, or a line saying what is wrong.
Function AddPayment(sCode As String, months As Long, amount As Double, sReceipt As String, sStaff As String) As String
	Dim p As Object, r As Long
	If FindHolder(sCode) < 0 Then
		AddPayment = "No customer with code " & sCode & "."
		Exit Function
	End If
	If months < 1 Or months > 24 Then
		AddPayment = "Months covered is 1 to 24."
		Exit Function
	End If
	If amount < 0 Or amount > 5000 Then
		AddPayment = "The amount is in dollars, 0 to 5000."
		Exit Function
	End If
	p = Sh("Payments")
	r = FirstFree(p, P_CODE, PLAST)
	If r < 0 Then
		AddPayment = "The Payments tab is full."
		Exit Function
	End If
	p.getCellByPosition(P_DATE, r).setValue(TodaySerial())
	p.getCellByPosition(P_CODE, r).setString(UCase(Trim(sCode)))
	p.getCellByPosition(P_MONTHS, r).setValue(months)
	p.getCellByPosition(P_AMOUNT, r).setValue(amount)
	If sReceipt <> "" Then p.getCellByPosition(P_RECEIPT, r).setString(sReceipt)
	If sStaff <> "" Then p.getCellByPosition(P_STAFF, r).setString(sStaff)
	ThisComponent.calculateAll()
	AddPayment = ""
End Function

REM Gives a Free box to a ready customer. Returns "" when done, or a line saying what is wrong.
Function AssignBox(r As Long, sBox As String) As String
	Dim h As Object, why As String, sFree As String, cell As Object
	h = Sh("Holders")
	If CellText(h, H_BOX, r) <> "" Then
		AssignBox = "This customer already has box " & CellText(h, H_BOX, r) & "."
		Exit Function
	End If
	why = NotReadyReason(r)
	If why <> "" Then
		AssignBox = "Not ready for a box yet. Still needed: " & why
		Exit Function
	End If
	sFree = ", " & FreeBoxes("") & ","
	If InStr(sFree, ", " & Trim(sBox) & ",") = 0 Then
		AssignBox = "Box " & sBox & " is not Free on the Boxes tab."
		Exit Function
	End If
	cell = h.getCellByPosition(H_BOX, r)
	If IsNumeric(sBox) Then
		cell.setValue(CDbl(sBox))
	Else
		cell.setString(Trim(sBox))
	End If
	ThisComponent.calculateAll()
	AssignBox = ""
End Function

Sub AddNote(r As Long, sNote As String)
	Dim h As Object, old As String
	h = Sh("Holders")
	old = CellText(h, H_NOTES, r)
	If old <> "" Then old = old & "; "
	h.getCellByPosition(H_NOTES, r).setString(old & sNote)
End Sub

Sub CloseHolder(r As Long, sForward As String)
	Dim h As Object
	h = Sh("Holders")
	h.getCellByPosition(H_CLOSED, r).setValue(TodaySerial())
	AddNote(r, "Closed " & DateText(TodaySerial()) & ", keys back" & IIf(sForward <> "", ", forward to " & sForward, ""))
	ThisComponent.calculateAll()
End Sub

Function NewSheet(sName As String) As Object
	Dim s As Object
	If ThisComponent.Sheets.hasByName(sName) Then ThisComponent.Sheets.removeByName(sName)
	ThisComponent.Sheets.insertNewByName(sName, ThisComponent.Sheets.getCount())
	s = Sh(sName)
	NewSheet = s
End Function

Sub PutRow(oSheet As Object, r As Long, vals As Variant)
	Dim i As Long
	For i = LBound(vals) To UBound(vals)
		oSheet.getCellByPosition(i, r).setString(vals(i))
	Next i
End Sub

REM Everyone to call or remind, worst first. Returns how many.
Function BuildCallList() As Long
	Dim h As Object, c As Object, r As Long, out As Long, pass As Integer, st As String, idc As String, todo As String, take As Boolean
	ThisComponent.calculateAll()
	h = Sh("Holders")
	c = NewSheet("Call list")
	PutRow(c, 0, Array("Call list, " & DateText(TodaySerial())))
	c.getCellByPosition(0, 0).CharWeight = 150
	PutRow(c, 2, Array("Code", "Name", "Phone", "Box", "Status", "Paid through", "ID check", "What to do"))
	out = 3
	For pass = 1 To 4
		For r = R0 To HLAST
			If CellText(h, H_CODE, r) <> "" And CellText(h, H_CLOSED, r) = "" Then
				st = CellText(h, H_STATUS, r)
				idc = CellText(h, H_IDCHECK, r)
				take = False
				Select Case pass
					Case 1 : take = (st = "Overdue") : todo = "Call: payment is overdue"
					Case 2 : take = (st <> "Overdue" And idc = "EXPIRED") : todo = "Ask for a current ID at the next visit"
					Case 3 : take = (st = "Due soon" And idc <> "EXPIRED") : todo = "Remind at pickup: payment due within a week"
					Case 4 : take = (st <> "Overdue" And st <> "Due soon" And idc <> "OK" And idc <> "EXPIRED") : todo = "Finish the IDs (" & idc & ")"
				End Select
				If take Then
					PutRow(c, out, Array(CellText(h, H_CODE, r), CellText(h, H_NAME, r), CellText(h, H_PHONE, r), CellText(h, H_BOX, r), st, DateText(h.getCellByPosition(H_PAIDTHRU, r).getValue()), idc, todo))
					out = out + 1
				End If
			End If
		Next r
	Next pass
	If out = 3 Then PutRow(c, 3, Array("Nobody to call. Every open box is paid and every ID is current."))
	c.getColumns().getByIndex(1).Width = 5000
	c.getColumns().getByIndex(7).Width = 9000
	BuildCallList = out - 3
End Function

REM The alphabetical customer list USPS expects from a CMRA each quarter. Returns how many.
Function BuildUSPSList() As Long
	Dim h As Object, u As Object, r As Long, n As Long, i As Long, j As Long, t As String
	Dim names(HLAST) As String, rows(HLAST) As Long
	ThisComponent.calculateAll()
	h = Sh("Holders")
	n = 0
	For r = R0 To HLAST
		If CellText(h, H_CODE, r) <> "" And CellText(h, H_CLOSED, r) = "" And CellText(h, H_BOX, r) <> "" Then
			names(n) = UCase(CellText(h, H_NAME, r))
			rows(n) = r
			n = n + 1
		End If
	Next r
	For i = 1 To n - 1
		For j = i To 1 Step -1
			If names(j) < names(j - 1) Then
				t = names(j) : names(j) = names(j - 1) : names(j - 1) = t
				r = rows(j) : rows(j) = rows(j - 1) : rows(j - 1) = r
			Else
				Exit For
			End If
		Next j
	Next i
	u = NewSheet("USPS quarterly")
	PutRow(u, 0, Array("Goin' Postal Forsythe, " & STORE_LINE & "..., " & STORE_CITY))
	PutRow(u, 1, Array("CMRA customer list, " & DateText(TodaySerial()) & ". " & n & " rented boxes."))
	u.getCellByPosition(0, 0).CharWeight = 150
	PutRow(u, 3, Array("Name", "Business", "Box #", "Since"))
	For i = 0 To n - 1
		r = rows(i)
		PutRow(u, 4 + i, Array(CellText(h, H_NAME, r), CellText(h, H_BUSINESS, r), CellText(h, H_BOX, r), DateText(h.getCellByPosition(H_START, r).getValue())))
	Next i
	u.getColumns().getByIndex(0).Width = 6000
	u.getColumns().getByIndex(1).Width = 6000
	BuildUSPSList = n
End Function

REM Copies every measured box and its store size from the Measure tab to the Boxes tab. Adds boxes
REM that are not there yet and sets the size of Free ones; a box someone holds keeps its size.
REM Returns "added,changed,held" (held = sizes that differ on a box with a holder, left alone).
Function BoxesFromMeasure() As String
	Dim m As Object, b As Object, r As Long, br As Long, sBox As String, sSize As String, found As Long
	Dim added As Long, changed As Long, held As Long, oFrom As Object
	ThisComponent.calculateAll()
	m = Sh("Measure")
	b = Sh("Boxes")
	For r = M0 To MLAST
		sBox = CellText(m, M_BOX, r)
		sSize = CellText(m, M_STORESIZE, r)
		If sBox <> "" And sSize <> "" Then
			found = -1
			For br = R0 To HLAST
				If CellText(b, B_BOX, br) = sBox Then
					found = br
					Exit For
				End If
			Next br
			If found < 0 Then
				found = FirstFree(b, B_BOX, HLAST)
				If found < 0 Then Exit For
				oFrom = m.getCellByPosition(M_BOX, r)
				If oFrom.getType() = com.sun.star.table.CellContentType.VALUE Then
					b.getCellByPosition(B_BOX, found).setValue(oFrom.getValue())
				Else
					b.getCellByPosition(B_BOX, found).setString(sBox)
				End If
				b.getCellByPosition(B_SIZE, found).setString(sSize)
				added = added + 1
			ElseIf CellText(b, B_SIZE, found) <> sSize Then
				If CellText(b, B_STATUS, found) = "Free" Or CellText(b, B_STATUS, found) = "" Then
					b.getCellByPosition(B_SIZE, found).setString(sSize)
					changed = changed + 1
				Else
					held = held + 1
				End If
			End If
		End If
	Next r
	ThisComponent.calculateAll()
	BoxesFromMeasure = added & "," & changed & "," & held
End Function

REM Lists F1 when set; otherwise "Mailbox backups" in the Documents folder File Explorer shows. LibreOffice's
REM Work path follows Windows, so a Documents folder OneDrive has moved is found too.
Function BackupFolder() As String
	Dim f As String
	f = CellText(Sh("Lists"), 5, 0)
	If f = "" Then f = DocumentsFolder() & "\Mailbox backups"
	BackupFolder = f
End Function

Function DocumentsFolder() As String
	Dim w As String
	On Error Resume Next
	w = ConvertFromURL(CreateUnoService("com.sun.star.util.PathSettings").Work)
	If w = "" Or Dir(w, 16) = "" Then w = Environ("USERPROFILE") & "\Documents"
	DocumentsFolder = w
End Function

REM A dollar amount as typed: "$15", "15.00" or "1,200" all read as the number. -1 when it is not one.
Function MoneyValue(s As String) As Double
	Dim t As String
	t = Trim(Replace(Replace(s, "$", ""), ",", ""))
	If t = "" Or Not IsNumeric(t) Then
		MoneyValue = -1
	Else
		MoneyValue = CDbl(t)
	End If
End Function

REM Saves a dated copy (one per day; a second backup the same day replaces the first). Returns the file path.
Function Backup(sFolder As String) As String
	Dim f As String, path As String
	Dim args(0) As New com.sun.star.beans.PropertyValue
	f = sFolder
	If f = "" Then f = BackupFolder()
	If Dir(f, 16) = "" Then MkDir f
	path = f & "\mailbox-register-" & Format(Now(), "yyyy-mm-dd") & ".ods"
	args(0).Name = "FilterName"
	args(0).Value = "calc8"
	ThisComponent.storeToURL(ConvertToURL(path), args())
	Backup = path
End Function

REM ---------------------------------------------------------------- the buttons

Function AskHolder(sWhy As String) As Long
	Dim ctl As Object, sel As Object, r As Long, w As String
	AskHolder = -1
	ctl = ThisComponent.CurrentController
	If ctl.getActiveSheet().getName() = "Holders" Then
		sel = ThisComponent.getCurrentSelection()
		If HasUnoInterfaces(sel, "com.sun.star.sheet.XCellRangeAddressable") Then
			r = sel.getRangeAddress().StartRow
			If r >= R0 And r <= HLAST Then
				If CellText(Sh("Holders"), H_CODE, r) <> "" Then
					AskHolder = r
					Exit Function
				End If
			End If
		End If
	End If
	w = InputBox(sWhy & Chr(10) & Chr(10) & "Type their code (MB-...), their box number, or part of their name:", APP)
	If Trim(w) = "" Then Exit Function
	r = FindHolder(w)
	If r < 0 Then
		MsgBox "No single customer matches """ & w & """. Try their code (MB-...).", 48, APP
	Else
		AskHolder = r
	End If
End Function

Sub JumpTo(sSheet As String, c As Long, r As Long)
	Dim s As Object
	s = Sh(sSheet)
	ThisComponent.CurrentController.setActiveSheet(s)
	ThisComponent.CurrentController.select(s.getCellByPosition(c, r))
End Sub

Sub btnNewCustomer(Optional oEvent)
	Dim nm As String, ph As String, em As String, sz As String, tm As String, res As String, r As Long
	nm = InputBox("Customer name:", APP & ": new customer")
	If Trim(nm) = "" Then Exit Sub
	ph = InputBox("Phone, ten digits (or leave blank):", APP & ": new customer")
	em = InputBox("Email (or leave blank):", APP & ": new customer")
	sz = InputBox("Box size: type S for Small, M for Medium, L for Large, or F for a Folder in the filing cabinet.", APP & ": new customer", "S")
	If Trim(sz) = "" Then Exit Sub
	If MsgBox("Paying by the year?" & Chr(10) & "Yes = yearly, No = monthly.", 4 + 32, APP & ": new customer") = 6 Then
		tm = "Yearly"
	Else
		tm = "Monthly"
	End If
	res = AddCustomer(nm, ph, em, sz, tm)
	If Left(res, 1) = "!" Then
		MsgBox Mid(res, 2), 48, APP
		Exit Sub
	End If
	r = FindHolder(res)
	JumpTo("Holders", H_ID1, r)
	MsgBox res & " added for " & Trim(nm) & "." & Chr(10) & Chr(10) & "Next:" & Chr(10) & "1. Type both IDs in the yellow cells to the right (last 4 only)." & Chr(10) & "2. The date PS Form 1583 was signed, and your name." & Chr(10) & "3. Press Record a payment on the Counter tab." & Chr(10) & "4. Then Give a box.", 64, APP
End Sub

Sub btnPayment(Optional oEvent)
	Dim r As Long, h As Object, code As String, m As String, months As Long, amt As String, rc As String, staff As String, res As String
	r = AskHolder("Record a payment taken on the POS.")
	If r < 0 Then Exit Sub
	h = Sh("Holders")
	code = CellText(h, H_CODE, r)
	m = InputBox("Months this payment covers for " & CellText(h, H_NAME, r) & " (" & CellText(h, H_TERM, r) & "):", APP & ": payment", IIf(CellText(h, H_TERM, r) = "Yearly", "12", "1"))
	If Trim(m) = "" Then Exit Sub
	If Not IsNumeric(m) Then
		MsgBox "Months is a whole number, like 1 or 12.", 48, APP
		Exit Sub
	End If
	If CDbl(m) <> Fix(CDbl(m)) Then
		MsgBox "Months is a whole number, like 1 or 12.", 48, APP
		Exit Sub
	End If
	months = CLng(m)
	amt = InputBox("Amount taken on the POS, in dollars:", APP & ": payment", Format(ExpectedAmount(r, months), "0.00"))
	If Trim(amt) = "" Then Exit Sub
	If MoneyValue(amt) < 0 Then
		MsgBox """" & amt & """ is not an amount. Type dollars, like 15 or 15.00. Nothing was recorded.", 48, APP
		Exit Sub
	End If
	rc = InputBox("POS receipt number:", APP & ": payment")
	staff = InputBox("Your name:", APP & ": payment")
	res = AddPayment(code, months, MoneyValue(amt), rc, staff)
	If res <> "" Then
		MsgBox res, 48, APP
		Exit Sub
	End If
	MsgBox "Payment recorded for " & code & "." & Chr(10) & "Paid through " & DateText(h.getCellByPosition(H_PAIDTHRU, r).getValue()) & ".", 64, APP
End Sub

Sub btnAssignBox(Optional oEvent)
	Dim r As Long, h As Object, why As String, sFree As String, pick As String, res As String, sz As String, parts As Variant
	r = AskHolder("Give a box to a customer.")
	If r < 0 Then Exit Sub
	h = Sh("Holders")
	If CellText(h, H_BOX, r) <> "" Then
		MsgBox CellText(h, H_NAME, r) & " already has box " & CellText(h, H_BOX, r) & ".", 48, APP
		Exit Sub
	End If
	why = NotReadyReason(r)
	If why <> "" Then
		MsgBox "Not ready for a box yet. Still needed:" & Chr(10) & why, 48, APP
		JumpTo("Holders", H_ID1, r)
		Exit Sub
	End If
	sz = CellText(h, H_SIZE, r)
	sFree = FreeBoxes(sz)
	If sFree = "" Then
		MsgBox "No " & sz & " box is Free on the Boxes tab.", 48, APP
		Exit Sub
	End If
	parts = Split(sFree, ",")
	pick = InputBox("Free " & sz & " boxes: " & sFree & Chr(10) & Chr(10) & "Which box for " & CellText(h, H_NAME, r) & "?", APP & ": give a box", Trim(parts(0)))
	If Trim(pick) = "" Then Exit Sub
	res = AssignBox(r, Trim(pick))
	If res <> "" Then
		MsgBox res, 48, APP
		Exit Sub
	End If
	If MsgBox("Two keys handed over and the key receipt signed?", 4 + 32, APP) = 6 Then h.getCellByPosition(H_KEYS, r).setString("Yes")
	MsgBox "Box " & Trim(pick) & " is " & CellText(h, H_NAME, r) & "'s." & Chr(10) & Chr(10) & "Their address:" & Chr(10) & CellText(h, H_NAME, r) & Chr(10) & STORE_LINE & Trim(pick) & Chr(10) & STORE_CITY, 64, APP
End Sub

Sub btnCloseBox(Optional oEvent)
	Dim r As Long, h As Object, fw As String
	r = AskHolder("Close a box.")
	If r < 0 Then Exit Sub
	h = Sh("Holders")
	If CellText(h, H_CLOSED, r) <> "" Then
		MsgBox "That box is already closed.", 48, APP
		Exit Sub
	End If
	If MsgBox("Close box " & CellText(h, H_BOX, r) & " for " & CellText(h, H_NAME, r) & "?" & Chr(10) & "Both keys back and any mail handed over?", 4 + 32, APP) <> 6 Then Exit Sub
	fw = InputBox("Forwarding address (also write it on their 1583), or leave blank:", APP & ": close a box")
	CloseHolder(r, Trim(fw))
	MsgBox "Closed. Box " & CellText(h, H_BOX, r) & " shows Free on the Boxes tab again.", 64, APP
End Sub

Sub btnCallList(Optional oEvent)
	Dim n As Long
	n = BuildCallList()
	JumpTo("Call list", 0, 2)
	MsgBox n & " to call or remind. The list is on the Call list tab; print it with Ctrl+P.", 64, APP
End Sub

Sub btnUSPSList(Optional oEvent)
	Dim n As Long
	n = BuildUSPSList()
	JumpTo("USPS quarterly", 0, 3)
	MsgBox n & " rented boxes, in name order, on the USPS quarterly tab. Check it against the USPS CMRA database before the quarterly certification (Jan 15, Apr 15, Jul 15, Oct 15), or print it with Ctrl+P if the postmaster wants paper.", 64, APP
End Sub

Sub btnBoxesFromMeasure(Optional oEvent)
	Dim res As Variant, msg As String
	res = Split(BoxesFromMeasure(), ",")
	msg = res(0) & " boxes added to the Boxes tab, " & res(1) & " Free boxes given their measured size."
	If CLng(res(2)) > 0 Then msg = msg & Chr(10) & res(2) & " boxes someone holds measure as a different size: they kept theirs. See Check on the Measure tab."
	JumpTo("Boxes", B_SIZE, R0)
	MsgBox msg, 64, APP
End Sub

Sub btnFind(Optional oEvent)
	Dim w As String, r As Long
	w = InputBox("Code (MB-...), box number, or part of a name:", APP & ": find")
	If Trim(w) = "" Then Exit Sub
	r = FindHolder(w)
	If r < 0 Then
		MsgBox "No single customer matches """ & w & """. Use Ctrl+F on the Holders tab to see every match.", 48, APP
	Else
		JumpTo("Holders", H_NAME, r)
	End If
End Sub

Sub btnBackup(Optional oEvent)
	Dim p As String
	On Error GoTo Failed
	If ThisComponent.isModified() Then ThisComponent.store()
	p = Backup("")
	MsgBox "Saved, and a copy is in:" & Chr(10) & p & Chr(10) & Chr(10) & "Copy that folder to the USB stick or Google Drive at closing.", 64, APP
	Exit Sub
Failed:
	MsgBox "The backup did not work: " & Error$ & Chr(10) & "Save with Ctrl+S, then try again.", 16, APP
End Sub

REM ---------------------------------------------------------------- fill as you type
REM Holders and Payments call these on Content changed (Sheet > Sheet Events), so a row typed by hand
REM fills in like one added by a button. They only ever fill an empty cell; they never change one.

REM One Holders row: a name with no code gets the next MB- code, and no start date gets today.
REM Returns what it filled ("code", "start", "code,start" or "").
Function FillHolderRow(r As Long) As String
	Dim h As Object, did As String
	h = Sh("Holders")
	did = ""
	If CellText(h, H_NAME, r) <> "" Then
		If CellText(h, H_CODE, r) = "" Then
			h.getCellByPosition(H_CODE, r).setString(NextCode())
			did = "code"
		End If
		If CellText(h, H_START, r) = "" Then
			h.getCellByPosition(H_START, r).setValue(TodaySerial())
			did = did & IIf(did = "", "", ",") & "start"
		End If
	End If
	FillHolderRow = did
End Function

REM One Payments row: a code with no date gets today. Returns "date" or "".
Function FillPaymentRow(r As Long) As String
	Dim p As Object
	p = Sh("Payments")
	FillPaymentRow = ""
	If CellText(p, P_CODE, r) <> "" And CellText(p, P_DATE, r) = "" Then
		p.getCellByPosition(P_DATE, r).setValue(TodaySerial())
		FillPaymentRow = "date"
	End If
End Function

REM The rows a Content changed event covers: one cell, a range, or several ranges.
Function ChangedRows(oEvent As Object, lastRow As Long) As Variant
	Dim addrs As Variant, out() As Long, n As Long, i As Long, r As Long, a As Object
	If oEvent.supportsService("com.sun.star.sheet.SheetCellRanges") Then
		addrs = oEvent.getRangeAddresses()
	Else
		addrs = Array(oEvent.getRangeAddress())
	End If
	n = -1
	ReDim out(0) As Long
	For i = LBound(addrs) To UBound(addrs)
		a = addrs(i)
		For r = IIf(a.StartRow < R0, R0, a.StartRow) To IIf(a.EndRow > lastRow, lastRow, a.EndRow)
			n = n + 1
			ReDim Preserve out(n) As Long
			out(n) = r
		Next r
	Next i
	If n < 0 Then
		ChangedRows = Array()
	Else
		ChangedRows = out()
	End If
End Function

REM A box number typed on a Holders row. Returns "" when it is fine, "added" when it was not on the
REM Boxes tab and has been added there (with the customer's size), or "!" and why it cannot be used.
Function CheckBoxEntry(r As Long) As String
	Dim h As Object, b As Object, sBox As String, i As Long, ch As String, r2 As Long, br As Long, cell As Object
	h = Sh("Holders")
	CheckBoxEntry = ""
	sBox = CellText(h, H_BOX, r)
	If sBox = "" Or CellText(h, H_CLOSED, r) <> "" Then Exit Function
	If Len(sBox) > 6 Then
		CheckBoxEntry = "!Box numbers are up to 6 letters and digits, like 101 or A12."
		Exit Function
	End If
	For i = 1 To Len(sBox)
		ch = UCase(Mid(sBox, i, 1))
		If Not ((ch >= "0" And ch <= "9") Or (ch >= "A" And ch <= "Z")) Then
			CheckBoxEntry = "!Box numbers are letters and digits only, like 101 or A12."
			Exit Function
		End If
	Next i
	For r2 = R0 To HLAST
		If r2 <> r And CellText(h, H_CODE, r2) <> "" And CellText(h, H_CLOSED, r2) = "" And UCase(CellText(h, H_BOX, r2)) = UCase(sBox) Then
			CheckBoxEntry = "!Box " & sBox & " is already " & CellText(h, H_NAME, r2) & "'s (" & CellText(h, H_CODE, r2) & "). Free boxes show on the Boxes tab."
			Exit Function
		End If
	Next r2
	b = Sh("Boxes")
	For br = R0 To HLAST
		If UCase(CellText(b, B_BOX, br)) = UCase(sBox) Then Exit Function
	Next br
	br = FirstFree(b, B_BOX, HLAST)
	If br < 0 Then
		CheckBoxEntry = "!The Boxes tab is full."
		Exit Function
	End If
	cell = b.getCellByPosition(B_BOX, br)
	If IsNumeric(sBox) Then
		cell.setValue(CDbl(sBox))
	Else
		cell.setString(UCase(sBox))
	End If
	b.getCellByPosition(B_SIZE, br).setString(CellText(h, H_SIZE, r))
	b.getCellByPosition(B_NOTE, br).setString("Added from Holders " & DateText(TodaySerial()) & ": measure it on the Measure tab")
	CheckBoxEntry = "added"
End Function

REM True when a Content changed event covers the Holders Box # column.
Function TouchesBoxColumn(oEvent As Object) As Boolean
	Dim addrs As Variant, i As Long
	If oEvent.supportsService("com.sun.star.sheet.SheetCellRanges") Then
		addrs = oEvent.getRangeAddresses()
	Else
		addrs = Array(oEvent.getRangeAddress())
	End If
	TouchesBoxColumn = False
	For i = LBound(addrs) To UBound(addrs)
		If addrs(i).StartColumn <= H_BOX And addrs(i).EndColumn >= H_BOX Then TouchesBoxColumn = True
	Next i
End Function

Sub OnHoldersChange(Optional oEvent)
	Dim rows As Variant, i As Long, boxCol As Boolean, res As String
	If busy Or IsMissing(oEvent) Then Exit Sub
	busy = True
	On Error GoTo Done
	rows = ChangedRows(oEvent, HLAST)
	boxCol = TouchesBoxColumn(oEvent)
	For i = LBound(rows) To UBound(rows)
		FillHolderRow(rows(i))
		If boxCol Then
			res = CheckBoxEntry(rows(i))
			If Left(res, 1) = "!" Then
				Sh("Holders").getCellByPosition(H_BOX, rows(i)).clearContents(1 + 2 + 4 + 16)
				MsgBox Mid(res, 2), 48, APP
			End If
		End If
	Next i
	ThisComponent.calculateAll()
Done:
	busy = False
End Sub

Sub OnPaymentsChange(Optional oEvent)
	Dim rows As Variant, i As Long
	If busy Or IsMissing(oEvent) Then Exit Sub
	busy = True
	On Error GoTo Done
	rows = ChangedRows(oEvent, PLAST)
	For i = LBound(rows) To UBound(rows)
		FillPaymentRow(rows(i))
	Next i
Done:
	busy = False
End Sub

REM ---------------------------------------------------------------- document events

REM Open Document: land on the Counter tab.
Sub OnOpen(Optional oEvent)
	On Error Resume Next
	FillTypedRows()
	ThisComponent.CurrentController.setActiveSheet(Sh("Counter"))
End Sub

REM Rows typed while macros were off (or before fill-as-you-type existed): a name with no code gets
REM one, a payment with no date gets today. Returns how many cells it filled.
Function FillTypedRows() As Long
	Dim r As Long, n As Long
	busy = True
	n = 0
	For r = R0 To HLAST
		If FillHolderRow(r) <> "" Then n = n + 1
	Next r
	For r = R0 To PLAST
		If FillPaymentRow(r) <> "" Then n = n + 1
	Next r
	busy = False
	If n > 0 Then ThisComponent.calculateAll()
	FillTypedRows = n
End Function

REM Save Document Done: keep the day's copy in the backup folder, silently.
Sub OnSaved(Optional oEvent)
	On Error Resume Next
	Backup("")
End Sub
