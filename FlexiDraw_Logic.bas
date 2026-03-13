
' ==========================================================================================
' FLEXIDRAW TOURNAMENT LOGIC - DYNAMIC EXCEL VERSION
'
' INSTRUCTIONS:
' 1. Create 3 Sheets in your Excel file: "Teams", "Groups", "Rules"
' 2. Paste this code into a Module (Alt+F11 -> Insert -> Module)
' 3. Run "Main_RunDraw"
'
' SHEET FORMATS:
' Sheet "Teams":  Col A: Name, Col B: Organization, Col C: Seed (Number)
' Sheet "Groups": Col A: Name, Col B: Capacity
' Sheet "Rules":  
'    Col A: Type (MUTUAL_EXCLUSION, SEED_SEPARATION, TEAM_LOCK)
'    Col B: Attribute / Team Name (for LOCK)
'    Col C: Seeds / Group Name (for LOCK)
'    Col D: MaxCount
'    Col E: Active (TRUE/FALSE)
' ==========================================================================================

Option Explicit

' --- DATA STRUCTURES ---

Type Team
    ID As String
    Name As String
    Organization As String
    Seed As Integer
End Type

Type Group
    ID As String
    Name As String
    Capacity As Integer
    TeamCount As Integer
    TeamIndices(1 To 100) As Integer 
End Type

Type Rule
    Type As String
    Attribute As String ' Used for Attribute name or Team Name in locks
    Seeds As String     ' Used for Comma-sep seeds or Group Name in locks
    MaxCount As Integer
    IsActive As Boolean
End Type

' --- GLOBAL VARIABLES ---
Dim AllTeams() As Team
Dim AllGroups() As Group
Dim AllRules() As Rule
Dim TeamCount As Integer
Dim GroupCount As Integer
Dim RuleCount As Integer

Sub Main_RunDraw()
    Dim startTime As Double
    startTime = Timer
    
    On Error GoTo ErrorHandler
    
    ' 1. Read Data from Sheets
    LoadDataFromSheets
    
    ' 2. Shuffle Teams
    ShuffleTeams
    
    ' 3. Sort Teams (Seeds & Locks First optimization)
    SortTeamsPriority
    
    ' 4. Run Solver
    Dim success As Boolean
    success = SolveDraw(1)
    
    ' 5. Output Results
    If success Then
        OutputToSheet
        MsgBox "Draw Complete! Success! Time: " & Format(Timer - startTime, "0.00") & "s", vbInformation
    Else
        MsgBox "Could not find a valid configuration matching all rules.", vbCritical
    End If
    Exit Sub

ErrorHandler:
    MsgBox "Error: " & Err.Description & vbCrLf & "Ensure you have sheets named 'Teams', 'Groups', and 'Rules' formatted correctly.", vbExclamation
End Sub

Sub LoadDataFromSheets()
    Dim ws As Worksheet
    Dim lastRow As Long, i As Long
    
    ' -- LOAD TEAMS --
    Set ws = ThisWorkbook.Sheets("Teams")
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    If lastRow < 2 Then Err.Raise 1001, , "No Teams found in Teams sheet"
    
    TeamCount = lastRow - 1
    ReDim AllTeams(1 To TeamCount)
    
    For i = 2 To lastRow
        AllTeams(i - 1).ID = "T" & i
        AllTeams(i - 1).Name = ws.Cells(i, 1).Value
        AllTeams(i - 1).Organization = ws.Cells(i, 2).Value
        If IsNumeric(ws.Cells(i, 3).Value) And Not IsEmpty(ws.Cells(i, 3).Value) Then
            AllTeams(i - 1).Seed = CInt(ws.Cells(i, 3).Value)
        Else
            AllTeams(i - 1).Seed = 0
        End If
    Next i
    
    ' -- LOAD GROUPS --
    Set ws = ThisWorkbook.Sheets("Groups")
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    If lastRow < 2 Then Err.Raise 1002, , "No Groups found in Groups sheet"
    
    GroupCount = lastRow - 1
    ReDim AllGroups(1 To GroupCount)
    
    For i = 2 To lastRow
        AllGroups(i - 1).ID = "G" & i
        AllGroups(i - 1).Name = ws.Cells(i, 1).Value
        AllGroups(i - 1).Capacity = CInt(ws.Cells(i, 2).Value)
        AllGroups(i - 1).TeamCount = 0
    Next i
    
    ' -- LOAD RULES --
    Set ws = ThisWorkbook.Sheets("Rules")
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    
    If lastRow >= 2 Then
        RuleCount = lastRow - 1
        ReDim AllRules(1 To RuleCount)
        For i = 2 To lastRow
            AllRules(i - 1).Type = ws.Cells(i, 1).Value
            AllRules(i - 1).Attribute = ws.Cells(i, 2).Value
            If AllRules(i - 1).Type = "TEAM_LOCK" Then
                AllRules(i - 1).Seeds = ws.Cells(i, 3).Value
            Else
                AllRules(i - 1).Seeds = "," & Replace(ws.Cells(i, 3).Value, " ", "") & ","
            End If
            AllRules(i - 1).MaxCount = CInt(ws.Cells(i, 4).Value)
            AllRules(i - 1).IsActive = ws.Cells(i, 5).Value
        Next i
    Else
        RuleCount = 0
    End If
End Sub

Function SolveDraw(teamIndex As Integer) As Boolean
    If teamIndex > TeamCount Then
        SolveDraw = True
        Exit Function
    End If
    Dim i As Integer
    For i = 1 To GroupCount
        If CheckConstraints(teamIndex, i) Then
            With AllGroups(i)
                .TeamCount = .TeamCount + 1
                .TeamIndices(.TeamCount) = teamIndex
            End With
            If SolveDraw(teamIndex + 1) Then
                SolveDraw = True
                Exit Function
            End If
            With AllGroups(i)
                .TeamIndices(.TeamCount) = 0
                .TeamCount = .TeamCount - 1
            End With
        End If
    Next i
    SolveDraw = False
End Function

Function CheckConstraints(teamIdx As Integer, groupIdx As Integer) As Boolean
    Dim g As Integer, t As Integer, r As Integer
    Dim currentTeam As Team
    Dim targetGroup As Group
    currentTeam = AllTeams(teamIdx)
    targetGroup = AllGroups(groupIdx)
    If targetGroup.TeamCount >= targetGroup.Capacity Then
        CheckConstraints = False
        Exit Function
    End If
    For r = 1 To RuleCount
        If AllRules(r).IsActive Then
            Select Case AllRules(r).Type
                Case "TEAM_LOCK"
                   If currentTeam.Name = AllRules(r).Attribute Then
                        If targetGroup.Name <> AllRules(r).Seeds Then
                            CheckConstraints = False
                            Exit Function
                        End If
                   End If
                Case "MUTUAL_EXCLUSION"
                    If AllRules(r).Attribute = "organization" Then
                        For t = 1 To targetGroup.TeamCount
                            If AllTeams(targetGroup.TeamIndices(t)).Organization = currentTeam.Organization Then
                                CheckConstraints = False
                                Exit Function
                            End If
                        Next t
                    End If
                Case "SEED_SEPARATION"
                    If currentTeam.Seed > 0 And InStr(AllRules(r).Seeds, "," & currentTeam.Seed & ",") > 0 Then
                        For t = 1 To targetGroup.TeamCount
                            Dim existingSeed As Integer
                            existingSeed = AllTeams(targetGroup.TeamIndices(t)).Seed
                            If existingSeed > 0 And InStr(AllRules(r).Seeds, "," & existingSeed & ",") > 0 Then
                                CheckConstraints = False
                                Exit Function
                            End If
                        Next t
                    End If
            End Select
        End If
    Next r
    CheckConstraints = True
End Function

Sub OutputToSheet()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets.Add
    ws.Name = "DrawResults_" & Format(Now, "hhmmss")
    
    Dim startRow As Integer, startCol As Integer
    Dim g As Integer, t As Integer
    
    startRow = 2
    startCol = 2
    
    ' We will display 3 groups per row
    Dim groupsPerRow As Integer: groupsPerRow = 3
    Dim colOffset As Integer: colOffset = 5 ' Number of columns per group box
    
    For g = 1 To GroupCount
        Dim currentGroupRow As Integer
        Dim currentGroupCol As Integer
        
        currentGroupRow = startRow + (Int((g - 1) / groupsPerRow) * 12) ' Assume max 10 teams per group for spacing
        currentGroupCol = startCol + (((g - 1) Mod groupsPerRow) * colOffset)
        
        ' --- Draw Header Box ---
        With ws.Cells(currentGroupRow, currentGroupCol)
            .Value = AllGroups(g).Name
            .Font.Bold = True
            .Interior.Color = RGB(220, 230, 241)
            .HorizontalAlignment = xlCenter
        End With
        
        ' Merge header across 3 columns
        ws.Range(ws.Cells(currentGroupRow, currentGroupCol), ws.Cells(currentGroupRow, currentGroupCol + 2)).Merge
        
        ' Headers for the team table
        ws.Cells(currentGroupRow + 2, currentGroupCol).Value = "Team"
        ws.Cells(currentGroupRow + 2, currentGroupCol + 1).Value = "Org"
        ws.Cells(currentGroupRow + 2, currentGroupCol + 2).Value = "Seed"
        ws.Range(ws.Cells(currentGroupRow + 2, currentGroupCol), ws.Cells(currentGroupRow + 2, currentGroupCol + 2)).Font.Bold = True
        ws.Range(ws.Cells(currentGroupRow + 2, currentGroupCol), ws.Cells(currentGroupRow + 2, currentGroupCol + 2)).Borders(xlEdgeBottom).LineStyle = xlContinuous
        
        ' List Teams
        For t = 1 To AllGroups(g).TeamCount
            Dim teamIdx As Integer
            teamIdx = AllGroups(g).TeamIndices(t)
            
            ws.Cells(currentGroupRow + 2 + t, currentGroupCol).Value = AllTeams(teamIdx).Name
            ws.Cells(currentGroupRow + 2 + t, currentGroupCol + 1).Value = AllTeams(teamIdx).Organization
            If AllTeams(teamIdx).Seed > 0 Then 
                ws.Cells(currentGroupRow + 2 + t, currentGroupCol + 2).Value = AllTeams(teamIdx).Seed
                ' Highlight seeds
                ws.Cells(currentGroupRow + 2 + t, currentGroupCol + 2).Interior.Color = RGB(255, 255, 200)
            End If
        Next t
        
        ' Box border around the group
        Dim boxRange As Range
        Set boxRange = ws.Range(ws.Cells(currentGroupRow, currentGroupCol), ws.Cells(currentGroupRow + 2 + AllGroups(g).Capacity, currentGroupCol + 2))
        boxRange.BorderAround LineStyle:=xlContinuous, Weight:=xlThin
        
    Next g
    
    ws.Columns.AutoFit
    ws.Activate
End Sub

Sub ShuffleTeams()
    Dim i As Integer, j As Integer
    Dim temp As Team
    Randomize
    For i = TeamCount To 2 Step -1
        j = Int((i * Rnd) + 1)
        temp = AllTeams(i)
        AllTeams(i) = AllTeams(j)
        AllTeams(j) = temp
    Next i
End Sub

Sub SortTeamsPriority()
    Dim i As Integer, j As Integer
    Dim temp As Team
    For i = 1 To TeamCount - 1
        For j = i + 1 To TeamCount
            Dim scoreA As Integer: scoreA = 0
            Dim scoreB As Integer: scoreB = 0
            Dim r As Integer
            For r = 1 To RuleCount
                If AllRules(r).Type = "TEAM_LOCK" And AllRules(r).Attribute = AllTeams(i).Name Then scoreA = scoreA + 100
                If AllRules(r).Type = "TEAM_LOCK" And AllRules(r).Attribute = AllTeams(j).Name Then scoreB = scoreB + 100
            Next r
            If AllTeams(i).Seed > 0 Then scoreA = scoreA + 10
            if AllTeams(j).Seed > 0 Then scoreB = scoreB + 10
            If scoreB > scoreA Then
                temp = AllTeams(i)
                AllTeams(i) = AllTeams(j)
                AllTeams(j) = temp
            End If
        Next j
    Next i
End Sub
  