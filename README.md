# FlexiDraw Tournament System

FlexiDraw is a powerful, constraint-based tournament draw generator designed for sports tournaments (like Badminton, Tennis, Pickleball) where complex rules regarding organization separation, seeding, and zone distribution are required.

It consists of two parts:
1. **The Web Application:** A visual interface to configure and run draws instantly.
2. **The VBA Engine:** A downloadable logic script that allows you to run the exact same draw logic locally within Microsoft Excel.

---

## 📖 Web Application User Guide

### 1. Teams & Orgs Tab
This is where you input your participants.
*   **Manual Entry:** Enter an Organization name (e.g., "Club A") and a count (e.g., 2 teams) to batch-create teams.
*   **Import CSV:** You can upload a `.csv` file with the headers: `Name, Organization, Seed`.
    *   *Note:* Seed is optional. Leave blank for unseeded teams.
*   **Duplicate Handling:** The system automatically detects duplicate entries (same Name + Organization) and offers a "Remove Duplicates" button.
*   **Actions:** You can edit names/seeds inline or delete specific teams.

### 2. Groups Tab
Configure the containers for your teams.
*   **Auto-Distribute:** In the "Teams" tab, use the "Generate Groups" button to auto-create groups based on team count.
*   **Capacity Check:** The system enforces that Total Team Count must match Total Group Capacity. You cannot proceed to the Draw until these match.
*   **Zones:** Assign groups to specific "Zones" (e.g., Top Half, Bottom Half). This is crucial for the "Zone Separation" rule (preventing top seeds from meeting until the finals).

### 3. Brackets Tab
Define the stage *after* the groups.
*   **Advancing Teams:** Set how many teams move on from each group (e.g., Top 2).
*   **Zone Mapping:** Map your Groups to Bracket Zones (e.g., Groups A & B -> Top Half). This visual interface ensures you have balanced bracket halves.

### 4. Rules Tab
The heart of the system. Toggle constraints on/off.
*   **Attribute Exclusion:** Prevents teams from the same Organization from landing in the same group.
*   **Seed Group Separation:** Ensures specific seeds (e.g., 1 & 2) never meet in the group stage.
*   **Seed Zone Separation:** Ensures specific seeds (e.g., 1 & 2) are placed in opposite halves of the bracket (e.g., Seed 1 in Group A [Top Half], Seed 2 in Group D [Bottom Half]).
*   **Team Lock:** Forces a specific team into a specific group (useful for Host teams or fixed slots).

### 5. Results (Run Draw) Tab
*   **Run Draw:** Triggers the randomization and backtracking algorithm to find a valid solution.
*   **Export CSV:** Downloads the results in a simple format.
*   **Export Excel Macro (VBA):** Downloads the logic script to run this offline.

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
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### Building for Production

To build the application for deployment:
```bash
npm run build
```
The output will be in the `dist` folder.

### Deployment (GitHub Actions)

This project is configured to automatically deploy to **GitHub Pages** on push to the `main` branch.

**Prerequisites:**
1.  Go to your repository **Settings** > **Pages**.
2.  Set the **Source** to "GitHub Actions".
3.  Go to **Settings** > **Secrets and variables** > **Actions**.
4.  Add a New Repository Secret:
    *   **Name**: `GEMINI_API_KEY`
    *   **Value**: Your Gemini API Key.