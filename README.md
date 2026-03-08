# AG-FlexiDraw Tournament System

FlexiDraw is a powerful, highly customizable tournament draw generator designed for sports tournaments (like Badminton, Tennis, Football etc) where complex rules regarding organization separation, seeding, and zone distribution are required. Two features that make it stand out are:
1. **Group Stage Draw:** Traditional tournament structure with groups and knockout rounds.
2. **Direct Bracket Elimination:** Skip groups and go straight to a knockout bracket.

This draw generator consists of two parts:
1. **The Web Application:** A visual interface to configure and run draws instantly.
2. **The VBA Engine:** A downloadable logic script that allows you to run the exact same draw logic locally within Microsoft Excel.

---

## 📖 Web Application User Guide

### 1. Teams & Orgs Tab (Common)
This is the starting point for both draw modes.
*   **Manual Entry:** Enter an Organization name (e.g., "Club A") and a count (e.g., 2 teams) to batch-create teams.
*   **Import CSV:** You can upload a `.csv` file with the headers: `Name, Organization, Seed`.
*   **Duplicate Handling:** The system automatically detects duplicate entries and offers a "Remove Duplicates" button.
*   **Actions:** Edit names/seeds inline or delete specific teams.

---

### 📊 Mode Selection: Group Stage Draw
*Select this mode in the sidebar for traditional tournament structures (Groups -> Knockout).*

#### 2. Groups Tab
*   **Auto-Distribute:** Use "Generate Groups" in the Teams tab to auto-create groups.
*   **Capacity Check:** Total Team Count must match Total Group Capacity.
*   **Zones:** Assign groups to "Zones" (Top/Bottom Half) for later bracket seeding rules.

#### 3. Brackets Tab
*   **Advancing Teams:** Set how many teams move on from each group (e.g., Top 2).
*   **Zone Mapping:** Map your Groups to Bracket Zones (e.g., Group A -> Top Half).

#### 4. Rules Stage
*   **Attribute Exclusion:** Prevent teams from the same Org in the same group.
*   **Seed Separation:** Prevent seeds 1 & 2 from meeting in the group stage.
*   **Seed Zone Separation:** Force seeds 1 & 2 into opposite halves of the bracket.
*   **Team Lock:** Force a team into a specific group.

---

### 🏆 Mode Selection: Direct Bracket Elimination
*Select this mode in the sidebar to skip groups and go straight to a knockout bracket.*

#### 2. Bracket Setup Tab
*   **Starting Round:** Select bracket size (Round of 32, 16, Quarter-Finals, etc.).
*   **Slot Assignment:** 
    *   **Manual Placement:** Assign specific teams to specific bracket slots.
    *   **Fixed/Lock:** Click 🔓/🔒 to lock a team to a slot. Fixed teams stay put during the random draw.
*   **Capacity Validation:** Team count must match the selected bracket size.

#### 3. Rules Stage
*   **Half Separation:** Ensure specific teams are in different halves (Top/Bottom), preventing them from meeting until the Final.
*   **Team Lock:** Force a team into a specific bracket slot.

---

### 🏁 Results & Export (Common)
*   **Run Draw:** Triggers the randomization algorithm.
*   **Visual View:** 
    *   *Group Mode:* Shows organized group tables.
    *   *Elimination Mode:* Shows a visual tournament bracket/tree.
*   **Export Options:**
    *   **CSV:** Standard spreadsheet result.
    *   **Excel VBA (Group Mode only):** Download the logic script for offline Excel use.

---

## 🖥️ How to Use the Excel VBA (Offline Mode)

If you prefer to keep your data in Excel or need to run draws offline, follow these steps.

### Step 1: Download the Script
1. Go to the **Results** tab in the web app.
2. Click **Export Excel Macro (VBA)**.
3. Save the file `FlexiDraw_Logic.bas`.

### Step 2: Prepare Your Excel File
You do not need to manually create the sheets! We have built a setup tool for you.

1. Open a **BLANK** Microsoft Excel workbook.
2. Press **`Alt + F11`** to open the VBA Editor.
3. Go to **File > Import File...** and select the `FlexiDraw_Logic.bas` you downloaded.
4. Close the VBA Editor window.
5. In Excel, press **`Alt + F8`**.
6. Select **`Setup_Workbook_Structure`** and click **Run**.
    *   *Result:* This will automatically create three sheets: `Teams`, `Groups`, and `Rules` with the correct column headers ready for you.

### Step 3: Enter Your Data
Fill in the newly created sheets:

**Sheet: Teams**
*   **Name:** Team Name (e.g., "John Doe").
*   **Organization:** Club or Country.
*   **Seed:** Integer (1, 2, 3...). Leave blank or 0 if unseeded.

**Sheet: Groups**
*   **Name:** Group Name (e.g., "Group A").
*   **Capacity:** Number of slots (e.g., 4).
*   **Zone:** Bracket assignment (e.g., "Top Half").

**Sheet: Rules**
*   **Type:** Valid values: `MUTUAL_EXCLUSION`, `SEED_SEPARATION`, `ZONE_SEPARATION`, `TEAM_LOCK`.
*   **Attribute / Team Name:** 
    *   For Exclusion: "organization"
    *   For Lock: The exact Team Name.
*   **Seeds / Group Name:**
    *   For Separation: "1, 2"
    *   For Lock: The exact Group Name.
*   **MaxCount:** Usually 1.
*   **Active:** TRUE or FALSE.

### Step 4: Run the Draw
1. Press **`Alt + F8`**.
2. Select **`Main_RunDraw`**.
3. Click **Run**.
4. The system will process the draw and create a new sheet called `DrawResults_...` with visual Group Boxes.

---

## ⚠️ Important Notes
*   **Capacity Mismatch:** The VBA will throw an error if your total teams do not match the total group capacity.
*   **Saving:** Always save your Excel file as **Excel Macro-Enabled Workbook (.xlsm)** to keep the code.

---

## 🛠️ Project Setup (Developer Guide)

### Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Running Locally

To start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) (or [http://localhost:3001](http://localhost:3001) if port 3000 is occupied) to view it in the browser.

### Building for Production

To build the application for deployment:
```bash
npm run build
```
The output will be in the `dist` folder. **Note:** The `vite.config.ts` is configured with `base: './'` to ensure that assets are correctly resolved when deployed to subdirectories (e.g., GitHub Pages).

### Deployment (GitHub Actions)

This project is configured to automatically deploy to **GitHub Pages** on push to the `main` branch.

**Prerequisites:**
1.  Go to your repository **Settings** > **Pages**.
2.  Set the **Source** to "GitHub Actions".
3.  Go to **Settings** > **Secrets and variables** > **Actions**.
4.  Add a New Repository Secret:
    *   **Name**: `GEMINI_API_KEY`
    *   **Value**: Your Gemini API Key. 

---

## ✅ Project Verification

For a detailed walkthrough of the local execution and feature verification, refer to [PROJECT_VERIFICATION.md](./PROJECT_VERIFICATION.md).