
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
' Sheet "Groups": Col A: Name, Col B: Capacity, Col C: Zone
' Sheet "Rules":  
'    Col A: Type (MUTUAL_EXCLUSION, SEED_SEPARATION, ZONE_SEPARATION, TEAM_LOCK)
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
    Zone As String
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
        AllGroups(i - 1).Zone = ws.Cells(i, 3).Value
        AllGroups(i - 1).TeamCount = 0
    Next i
    
    ' -- LOAD RULES --
    Set ws = ThisWorkbook.Sheets("Rules")
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    ' It's okay if no rules exist, but let's check
    
    If lastRow >= 2 Then
        RuleCount = lastRow - 1
        ReDim AllRules(1 To RuleCount)
        For i = 2 To lastRow
            AllRules(i - 1).Type = ws.Cells(i, 1).Value
            AllRules(i - 1).Attribute = ws.Cells(i, 2).Value
            
            ' For TEAM_LOCK, we just store the group name in 'Seeds' field as string
            ' For others, we assume comma separated seeds or values
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

' --- SOLVER LOGIC ---

Function SolveDraw(teamIndex As Integer) As Boolean
    ' Base Case
    If teamIndex > TeamCount Then
        SolveDraw = True
        Exit Function
    End If
    
    Dim i As Integer
    
    ' Try to place current team in each group
    For i = 1 To GroupCount
        If CheckConstraints(teamIndex, i) Then
            ' Place
            With AllGroups(i)
                .TeamCount = .TeamCount + 1
                .TeamIndices(.TeamCount) = teamIndex
            End With
            
            ' Recurse
            If SolveDraw(teamIndex + 1) Then
                SolveDraw = True
                Exit Function
            End If
            
            ' Backtrack
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
    
    ' 1. Capacity Check
    If targetGroup.TeamCount >= targetGroup.Capacity Then
        CheckConstraints = False
        Exit Function
    End If
    
    ' 2. Rule Checks
    For r = 1 To RuleCount
        If AllRules(r).IsActive Then
            Select Case AllRules(r).Type
                
                Case "TEAM_LOCK"
                   ' Attribute = Team Name, Seeds = Group Name
                   If currentTeam.Name = AllRules(r).Attribute Then
                        If targetGroup.Name <> AllRules(r).Seeds Then
                            CheckConstraints = False
                            Exit Function
                        End If
                   End If

                Case "MUTUAL_EXCLUSION"
                    ' Check if any team in group has same attribute (Org)
                    If AllRules(r).Attribute = "organization" Then
                        For t = 1 To targetGroup.TeamCount
                            If AllTeams(targetGroup.TeamIndices(t)).Organization = currentTeam.Organization Then
                                CheckConstraints = False
                                Exit Function
                            End If
                        Next t
                    End If
                    
                Case "SEED_SEPARATION"
                    ' If current team is a specific seed
                    If currentTeam.Seed > 0 And InStr(AllRules(r).Seeds, "," & currentTeam.Seed & ",") > 0 Then
                        ' Check if group already has a restricted seed
                        For t = 1 To targetGroup.TeamCount
                            Dim existingSeed As Integer
                            existingSeed = AllTeams(targetGroup.TeamIndices(t)).Seed
                            If existingSeed > 0 And InStr(AllRules(r).Seeds, "," & existingSeed & ",") > 0 Then
                                CheckConstraints = False
                                Exit Function
                            End If
                        Next t
                    End If
                    
                Case "ZONE_SEPARATION"
                    ' If current team is seed, and group has a zone
                    If currentTeam.Seed > 0 And targetGroup.Zone <> "" And InStr(AllRules(r).Seeds, "," & currentTeam.Seed & ",") > 0 Then
                        ' Check ALL groups with same zone
                        For g = 1 To GroupCount
                            If AllGroups(g).Zone = targetGroup.Zone Then
                                For t = 1 To AllGroups(g).TeamCount
                                    Dim zSeed As Integer
                                    zSeed = AllTeams(AllGroups(g).TeamIndices(t)).Seed
                                    If zSeed > 0 And InStr(AllRules(r).Seeds, "," & zSeed & ",") > 0 Then
                                        CheckConstraints = False
                                        Exit Function
                                    End If
                                Next t
                            End If
                        Next g
                    End If
                    
            End Select
        End If
    Next r
    
    CheckConstraints = True
End Function

' --- HELPERS ---

Sub OutputToSheet()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets.Add
    ws.Name = "Results_" & Format(Now, "hhmmss")
    
    ws.Cells(1, 1).Value = "Group"
    ws.Cells(1, 2).Value = "Zone"
    ws.Cells(1, 3).Value = "Team"
    ws.Cells(1, 4).Value = "Organization"
    ws.Cells(1, 5).Value = "Seed"
    
    Dim r As Integer, g As Integer, t As Integer
    r = 2
    
    For g = 1 To GroupCount
        For t = 1 To AllGroups(g).TeamCount
            Dim teamIdx As Integer
            teamIdx = AllGroups(g).TeamIndices(t)
            
            ws.Cells(r, 1).Value = AllGroups(g).Name
            ws.Cells(r, 2).Value = AllGroups(g).Zone
            ws.Cells(r, 3).Value = AllTeams(teamIdx).Name
            ws.Cells(r, 4).Value = AllTeams(teamIdx).Organization
            If AllTeams(teamIdx).Seed > 0 Then ws.Cells(r, 5).Value = AllTeams(teamIdx).Seed
            
            r = r + 1
        Next t
    Next g
    
    ws.Columns("A:E").AutoFit
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
    ' Sorts by Lock status first, then Seed, then Random (from shuffle)
    Dim i As Integer, j As Integer
    Dim temp As Team
    
    For i = 1 To TeamCount - 1
        For j = i + 1 To TeamCount
            Dim scoreA As Integer, scoreB As Integer
            scoreA = 0
            scoreB = 0
            
            ' Determine if team A is locked
            Dim r As Integer
            For r = 1 To RuleCount
                If AllRules(r).Type = "TEAM_LOCK" And AllRules(r).Attribute = AllTeams(i).Name Then
                    scoreA = scoreA + 100
                End If
                If AllRules(r).Type = "TEAM_LOCK" And AllRules(r).Attribute = AllTeams(j).Name Then
                    scoreB = scoreB + 100
                End If
            Next r
            
            ' Determine Seed
            If AllTeams(i).Seed > 0 Then scoreA = scoreA + 10
            If AllTeams(j).Seed > 0 Then scoreB = scoreB + 10
            
            If scoreB > scoreA Then
                temp = AllTeams(i)
                AllTeams(i) = AllTeams(j)
                AllTeams(j) = temp
            End If
        Next j
    Next i
End Sub
  